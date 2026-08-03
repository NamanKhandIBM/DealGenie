/**
 * compare-engine.ts
 *
 * Variable-selector scenario fan-out — zero AI, fully deterministic.
 *
 * Instead of hardcoded tiers, the seller picks 1–2 "fork variables"
 * (e.g. "Which capabilities?" or "How many users?").
 * The engine fans out every meaningful option for those variables
 * and computes a price for each combination using the existing engines.
 *
 * Results are ordered high → low price (anchoring).
 */

import { computeVerifyQuote } from "./verify-engine";
import { computeVaultQuote } from "./vault-engine";
import { computeNS1Quote } from "./ns1-engine";
import { computeInstanaQuote } from "./instana-engine";
import { computeTurbonomicScope } from "./turbonomic-engine";
import { computeTerraformRecommendation } from "./terraform-engine";
import { computeConcertRecommendation } from "./concert-engine";
import { computeWebMethodsScope } from "./webmethods-engine";
import { computeMaaS360Estimate, recommendMaaS360Plan } from "./maas360-engine";
import type { Product } from "./types";
import type { VerifyCapability } from "./data";
import type { InstanaPurchaseModel, InstanaTier } from "./instana-data";
import type { TurbonomicDeployment } from "./turbonomic-data";
import type { TerraformDeployment } from "./terraform-data";
import type { ConcertInputs } from "./concert-engine";
import type { WebMethodsInputs } from "./webmethods-engine";

// ─── Public types ─────────────────────────────────────────────────────────────

/** A single toggleable add-on with a known annual price delta */
export interface AddonDefinition {
  key: string;             // answer key — e.g. "addon_sms", "includeNonProd"
  label: string;           // display label (without "Add-on:" prefix)
  partNumber: string;      // IBM part number
  annualDelta: number;     // how much it adds to the annual list price (approx)
  deltaNote: string;       // human note on how delta is calculated
  /** "yes"/"no" for binary toggles; number for quantity-based (e.g. pkiAddon certs) */
  yesValue: string | number;
  noValue: string | number;
}

/** A single forkable variable the seller can choose to compare across */
export interface ForkVariable {
  key: string;
  label: string;
  /** Short description of what this variable affects */
  impact: string;
  /** The options to fan out over */
  options: ForkOption[];
}

export interface ForkOption {
  label: string;
  /** The raw answer value (same format as ConversationState.answers[key]) */
  value: string | number | string[];
}

/** One computed scenario (one combination of fork variable values) */
export interface Scenario {
  /** Human-readable name built from the fork option labels */
  name: string;
  /** The answer overrides that produced this scenario */
  overrides: Record<string, string | number | boolean | string[]>;
  annualList: number;
  monthlyList: number;
  /** Key drivers shown under the price */
  drivers: string[];
}

export interface CompareResult {
  product: Product;
  forkVars: ForkVariable[];         // the variables that were forked
  scenarios: Scenario[];            // ordered high → low price
  baselineIdx: number;
  recommendedIdx: number;
  insightText: string;
  /** For the sensitivity slider */
  sliderVar: ForkVariable | null;
  sliderKey: string;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
  sliderUnit: string;
  sliderCurrentValue: number;
}

// ─── Add-on definitions (persistent checkbox panel) ──────────────────────────

/**
 * Returns the full list of toggleable add-ons for a product.
 * These are shown as checkboxes in the sidebar — not as fan-out variables.
 * annualDelta is a *typical* 1-unit annual cost used for display only;
 * the live running total always uses computeScenarioPrice for accuracy.
 */
export function getAddonDefinitions(
  product: Product,
  _answers: Record<string, string | number | boolean | string[]>
): AddonDefinition[] {
  if (product === "Verify") {
    return [
      { key: "addon_sms",    label: "SMS / Email MFA",            partNumber: "D02T6ZX", annualDelta: 0,      deltaNote: "Usage-based: $33.70 per 1,000 auth events — see CPQ for volume estimate", yesValue: "yes",    noValue: "no"    },
      { key: "addon_hag",    label: "Hosted Application Gateway", partNumber: "D01UQZX", annualDelta: 270000, deltaNote: "$22,500 / instance / month",                              yesValue: "yes",    noValue: "no"    },
      { key: "addon_vanity", label: "Vanity Domain",              partNumber: "D01URZX", annualDelta: 6744,   deltaNote: "$562 / instance / month",                                 yesValue: "yes",    noValue: "no"    },
      // Non-prod is mutually exclusive — one entry, value is the part number ("D22PGLL" | "D21CWLL" | "none")
      { key: "nonProd",      label: "Non-Production (with SLA)",  partNumber: "D22PGLL", annualDelta: 33720,  deltaNote: "$2,810 / instance / month — toggle to switch or remove",  yesValue: "D22PGLL",noValue: "none"  },
    ];
  }
  if (product === "Vault") {
    // Vault 2.0 (Model A — Platform model) add-ons only
    // Model B (legacy Clients/RVU) is deprecated in Vault 2.0 — all new quotes use Model A.
    return [
      { key: "includeNonProd", label: "Non-production cluster",           partNumber: "D155GZX", annualDelta: 48000,   deltaNote: "$48,000 / yr",                               yesValue: "yes", noValue: "no" },
      { key: "includeKMIP",    label: "KMIP support",                     partNumber: "D155LZX", annualDelta: 264000,  deltaNote: "Upgrades install from $96K → $360K / cluster",yesValue: "yes", noValue: "no" },
    ];
  }
  if (product === "NS1") {
    return [
      { key: "ddosProtection", label: "Spike / DDoS Protection",          partNumber: "D10ATZX", annualDelta: 0,       deltaNote: "Fixed add-on — see CPQ for price",           yesValue: "yes", noValue: "no" },
    ];
  }
  // No persistent add-on panel for the other 6 products
  return [];
}

/**
 * Compute base price with all add-ons stripped out.
 * Used so the add-on panel can show exact deltas.
 */
export function computeBasePrice(
  product: Product,
  answers: Record<string, string | number | boolean | string[]>
): number {
  const addons = getAddonDefinitions(product, answers);
  const noAddons: Record<string, string | number | boolean | string[]> = {};
  for (const a of addons) noAddons[a.key] = a.noValue;
  // Also zero out the raw addOns array for Verify
  if (product === "Verify") noAddons["addOns"] = [];
  return computeScenarioPrice(product, answers, noAddons);
}

// ─── Per-product fork variable definitions ────────────────────────────────────
// These mirror the actual question options in questions.ts.
// They are the "levers" a seller can choose to explore.

export function getForkVariables(
  product: Product,
  _answers: Record<string, string | number | boolean | string[]>
): ForkVariable[] {
  if (product === "Verify") {
    return [
      // ── Core pricing levers ───────────────────────────────────────────────
      {
        key: "capabilities",
        label: "Security capabilities",
        impact: "Biggest price driver — each capability adds RUs on top of the base",
        options: [
          { label: "SSO only",                  value: ["SSO"] },
          { label: "SSO + MFA",                 value: ["SSO", "MFA"] },
          { label: "SSO + MFA + Adaptive",      value: ["SSO", "MFA", "Adaptive"] },
          { label: "Full suite (+ Lifecycle)",  value: ["SSO", "MFA", "Adaptive", "Lifecycle"] },
        ],
      },
      {
        key: "population",
        label: "User population",
        impact: "Drives MAU — price jumps non-linearly at tier boundaries",
        options: [
          { label: "1,000 users",    value: 1000 },
          { label: "5,000 users",    value: 5000 },
          { label: "10,000 users",   value: 10000 },
          { label: "50,000 users",   value: 50000 },
          { label: "100,000 users",  value: 100000 },
          { label: "500,000 users",  value: 500000 },
        ],
      },
      {
        key: "avgLogins",
        label: "Login frequency",
        impact: "Controls how many months/year count as active MAU",
        options: [
          { label: "Occasional (3 months/yr)",  value: 3 },
          { label: "Seasonal (6 months/yr)",    value: 6 },
          { label: "Regular (9 months/yr)",     value: 9 },
          { label: "Always-on (12 months/yr)",  value: 12 },
        ],
      },
      // ── Add-ons — each is a binary include/exclude comparison ─────────────
      {
        key: "addon_sms",
        label: "Add-on: SMS / Email MFA (D02T6ZX)",
        impact: "$33.70 per 1,000 authentication events — compare cost of adding it",
        options: [
          { label: "Without SMS/Email MFA", value: "no" },
          { label: "With SMS/Email MFA",    value: "yes" },
        ],
      },
      {
        key: "addon_hag",
        label: "Add-on: Hosted Application Gateway (D01UQZX)",
        impact: "$22,500 / instance / month — compare with vs without",
        options: [
          { label: "Without App Gateway", value: "no" },
          { label: "With App Gateway",    value: "yes" },
        ],
      },
      {
        key: "addon_vanity",
        label: "Add-on: Vanity Domain (D01URZX)",
        impact: "$562 / instance / month — compare with vs without",
        options: [
          { label: "Without Vanity Domain", value: "no" },
          { label: "With Vanity Domain",    value: "yes" },
        ],
      },
      {
        key: "nonProd",
        label: "Add-on: Non-Production environment",
        impact: "Compare no non-prod vs with-SLA ($33,720/yr) vs without-SLA ($16,920/yr)",
        options: [
          { label: "No non-prod",                    value: "none"    },
          { label: "Non-Prod — with SLA (D22PGLL)",  value: "D22PGLL" },
          { label: "Non-Prod — no SLA (D21CWLL)",    value: "D21CWLL" },
        ],
      },
    ];
  }

  if (product === "Vault") {
    // Vault 2.0 — Model A (Platform model) only
    // Model B (legacy Clients/RVU) is deprecated — all new quotes use Model A (Vault 2.0).
    return [
      {
        key: "staticSecretCount",
        label: "Secrets stored (passwords, API keys, configs)",
        impact: "1 secret = 1 RU/month — most common Vault use case. 500 secrets → ~$288K/yr list at 1-cluster",
        options: [
          { label: "< 25 secrets",        value: 12 },
          { label: "~100 secrets",        value: 100 },
          { label: "~500 secrets",        value: 500 },
          { label: "~1,000 secrets",      value: 1000 },
          { label: "~5,000 secrets",      value: 5000 },
        ],
      },
      {
        key: "dynamicRoles",
        label: "Auto-rotating credential roles (DB, cloud, SSH)",
        impact: "1 role = 1 RU/month — each DB connection or IAM role Vault auto-rotates",
        options: [
          { label: "None",             value: 0 },
          { label: "~10 roles",        value: 10 },
          { label: "~50 roles",        value: 50 },
          { label: "~200 roles",       value: 200 },
          { label: "~1,000 roles",     value: 1000 },
        ],
      },
      {
        key: "pkiCertsPerMonth",
        label: "SSL/TLS certificates issued per month",
        impact: "certs/month × (lifetime / 730h) = RU. 500 certs at 90-day lifetime = ~1,461 RU/mo extra",
        options: [
          { label: "None",               value: 0 },
          { label: "~50 certs/month",    value: 50 },
          { label: "~250 certs/month",   value: 250 },
          { label: "~1,000 certs/month", value: 1000 },
          { label: "~2,000 certs/month", value: 2000 },
        ],
      },
      {
        key: "installCount",
        label: "Number of clusters",
        impact: "Each production cluster = $96,000/yr install fee (D15FQZX)",
        options: [
          { label: "1 cluster",  value: 1 },
          { label: "2 clusters", value: 2 },
          { label: "3 clusters", value: 3 },
        ],
      },
      {
        key: "includeNonProd",
        label: "Add-on: Non-production environment (D155GZX)",
        impact: "$48,000/yr — compare cost of including a dev/test cluster",
        options: [
          { label: "Without non-prod", value: "no" },
          { label: "With non-prod",    value: "yes" },
        ],
      },
      {
        key: "includeKMIP",
        label: "Add-on: KMIP support (D155LZX vs D15FQZX)",
        impact: "Switches install from $96K to $360K/cluster — major cost uplift",
        options: [
          { label: "Standard install ($96K/cluster)",       value: "no" },
          { label: "KMIP-included install ($360K/cluster)", value: "yes" },
        ],
      },
    ];
  }

  if (product === "MaaS360") {
    return [
      {
        key: "maas360Devices",
        label: "Device count",
        impact: "All MaaS360 plans charge per device — linear scale, plan rate stays fixed",
        options: [
          { label: "500 devices",    value: 500 },
          { label: "1,000 devices",  value: 1000 },
          { label: "5,000 devices",  value: 5000 },
          { label: "10,000 devices", value: 10000 },
          { label: "25,000 devices", value: 25000 },
        ],
      },
      {
        key: "maas360Plan",
        label: "Plan tier",
        impact: "Essentials $4.00 → Enterprise $9.00/device/month — more than doubles the per-device rate",
        options: [
          { label: "Essentials ($4.00/device/mo)",  value: "Essentials" },
          { label: "Deluxe ($5.00/device/mo)",      value: "Deluxe" },
          { label: "Premier ($6.25/device/mo)",     value: "Premier" },
          { label: "Enterprise ($9.00/device/mo)",  value: "Enterprise" },
        ],
      },
    ];
  }

  if (product === "Instana") {
    return [
      {
        key: "instanaMVS",
        label: "Host / VM count (MVS)",
        impact: "Primary Instana cost driver — linear at $21.20 (Essentials) or $79.50 (Standard) per MVS/month",
        options: [
          { label: "25 hosts",     value: 25 },
          { label: "100 hosts",    value: 100 },
          { label: "250 hosts",    value: 250 },
          { label: "500 hosts",    value: 500 },
          { label: "1,000 hosts",  value: 1000 },
          { label: "2,500 hosts",  value: 2500 },
        ],
      },
      {
        key: "instanaTier",
        label: "Observability depth",
        impact: "Essentials (infra-only) $21.20 vs Standard (full-stack APM) $79.50 per MVS/month — 3.75× uplift",
        options: [
          { label: "Essentials — infrastructure only ($21.20/MVS/mo)", value: "Essentials" },
          { label: "Standard — full-stack APM ($79.50/MVS/mo)",        value: "Standard" },
        ],
      },
      {
        key: "instanaModel",
        label: "Purchase model",
        impact: "SaaS subscription (committed) vs Pay-Per-Use (no commitment, $0.03/MVS/hour)",
        options: [
          { label: "SaaS subscription (term commit)", value: "SaaS" },
          { label: "Pay-Per-Use (no commit)",          value: "PayPerUse" },
        ],
      },
    ];
  }

  if (product === "Turbonomic") {
    return [
      {
        key: "turbonomicMVS",
        label: "Host / VM count (MVS)",
        impact: "Primary Turbonomic cost driver — $18.80/MVS/month commercial SaaS (linear)",
        options: [
          { label: "100 VMs",    value: 100 },
          { label: "250 VMs",    value: 250 },
          { label: "500 VMs",    value: 500 },
          { label: "1,000 VMs",  value: 1000 },
          { label: "2,500 VMs",  value: 2500 },
          { label: "5,000 VMs",  value: 5000 },
        ],
      },
      {
        key: "turbonomicDeployment",
        label: "Deployment model",
        impact: "Commercial SaaS $18.80 vs Government/FedRAMP $23.50 per MVS/month — 25% uplift",
        options: [
          { label: "Commercial SaaS ($18.80/MVS/mo)",    value: "SaaS" },
          { label: "Government / FedRAMP ($23.50/MVS/mo)", value: "SaaSGov" },
        ],
      },
    ];
  }

  if (product === "Terraform") {
    return [
      {
        key: "terraformResources",
        label: "Managed resources (RUM)",
        impact: "Primary Terraform cost driver — graduated volume discounts kick in above 10K RUM",
        options: [
          { label: "500 RUM (Free tier)",   value: 500 },
          { label: "1,000 RUM",             value: 1000 },
          { label: "5,000 RUM",             value: 5000 },
          { label: "10,000 RUM",            value: 10000 },
          { label: "25,000 RUM",            value: 25000 },
          { label: "50,000 RUM",            value: 50000 },
        ],
      },
      {
        key: "terraformEdition",
        label: "Edition",
        impact: "Standard (D100DZX) $5.16/RUM/yr vs Premium (D11GDZX) $10.80/RUM/yr — 2× uplift for governance/audit",
        options: [
          { label: "Standard ($5.16/RUM/yr)",  value: "Standard" },
          { label: "Premium ($10.80/RUM/yr)",  value: "Premium" },
        ],
      },
    ];
  }

  if (product === "Concert") {
    return [
      {
        key: "concertApplications",
        label: "Application count",
        impact: "Protect (3 RU/app) and Resilience (5 RU/app) modules scale with app count",
        options: [
          { label: "10 apps",   value: 10 },
          { label: "25 apps",   value: 25 },
          { label: "50 apps",   value: 50 },
          { label: "100 apps",  value: 100 },
          { label: "250 apps",  value: 250 },
        ],
      },
      {
        key: "concertDeployment",
        label: "Deployment model",
        impact: "On-prem $212/RU/yr (D0MK3ZX) vs SaaS ~$1.06/RU/yr (5900BD6) — IBM-hosted is 200× cheaper per RU",
        options: [
          { label: "On-premises (self-hosted, $212/RU/yr)", value: "onprem" },
          { label: "SaaS (IBM-hosted, ~$1.06/RU/yr)",       value: "saas" },
        ],
      },
      {
        key: "concertPain",
        label: "Use-case scope",
        impact: "More modules = more RUs — compare a focused vs comprehensive Concert footprint",
        options: [
          { label: "Alert fatigue / observability only",   value: "alertFatigue" },
          { label: "Slow MTTR (resolve faster)",           value: "slowMTTR" },
          { label: "Cost optimisation",                    value: "costOptimization" },
          { label: "Risk / security posture",              value: "riskPosture" },
          { label: "Full suite (all modules)",             value: "all" },
        ],
      },
    ];
  }

  if (product === "webMethods") {
    return [
      {
        key: "webMethodsIntTxn",
        label: "Integration transactions / month",
        impact: "App integration charges $92/1,000 txn/yr with a volume factor — largest cost lever",
        options: [
          { label: "No integrations",         value: 0 },
          { label: "10,000 txn/mo",           value: 10000 },
          { label: "100,000 txn/mo",          value: 100000 },
          { label: "500,000 txn/mo",          value: 500000 },
          { label: "1,000,000 txn/mo",        value: 1000000 },
        ],
      },
      {
        key: "webMethodsApiTxn",
        label: "API management transactions / month",
        impact: "API charges $100/10K txn/yr — adds on top of integration costs",
        options: [
          { label: "No API management",       value: 0 },
          { label: "100,000 API calls/mo",    value: 100000 },
          { label: "500,000 API calls/mo",    value: 500000 },
          { label: "1,000,000 API calls/mo",  value: 1000000 },
        ],
      },
      {
        key: "webMethodsDeployment",
        label: "Deployment preference",
        impact: "SaaS (IBM-hosted) vs On-Premises — on-prem uses CP4I VPC licensing at different rates",
        options: [
          { label: "SaaS (IBM-hosted)",  value: "saas" },
          { label: "On-premises",        value: "onprem" },
        ],
      },
    ];
  }

  // NS1
  return [
    {
      key: "queryMQ",
      label: "Query volume",
      impact: "Biggest NS1 cost driver — tier pricing means non-linear jumps at boundaries",
      options: [
        { label: "25M queries/mo",    value: 25 },
        { label: "100M queries/mo",   value: 100 },
        { label: "300M queries/mo",   value: 300 },
        { label: "700M queries/mo",   value: 700 },
        { label: "2,000M queries/mo", value: 2000 },
      ],
    },
    {
      key: "filterChainCount",
      label: "Traffic steering / GSLB (filter chains)",
      impact: "Each steered DNS record = 1 filter chain fee on top of query cost",
      options: [
        { label: "No GSLB",           value: 0 },
        { label: "5 filter chains",   value: 5 },
        { label: "25 filter chains",  value: 25 },
        { label: "100 filter chains", value: 100 },
      ],
    },
    {
      key: "monitors",
      label: "Health monitors",
      impact: "Up/down checks per hostname — flat per-monitor monthly fee",
      options: [
        { label: "No monitors",   value: 0 },
        { label: "25 monitors",   value: 25 },
        { label: "100 monitors",  value: 100 },
        { label: "200 monitors",  value: 200 },
      ],
    },
    {
      key: "recordCount",
      label: "DNS record count",
      impact: "First 1,000 records are free on Standard — billable in 1,000-record blocks above that",
      options: [
        { label: "≤ 1,000 (all free)", value: 1000 },
        { label: "6,000 records",      value: 6000 },
        { label: "25,000 records",     value: 25000 },
        { label: "50,000 records",     value: 50000 },
      ],
    },
    {
      key: "ddosProtection",
      label: "Add-on: Spike / DDoS Protection (D10ATZX)",
      impact: "Flat add-on — compare cost of including DDoS protection",
      options: [
        { label: "Without DDoS protection", value: "no" },
        { label: "With DDoS protection",    value: "yes" },
      ],
    },
  ];
}

// ─── Price computation for one set of overrides ───────────────────────────────

export function computeScenarioPrice(
  product: Product,
  base: Record<string, string | number | boolean | string[]>,
  overrides: Record<string, string | number | boolean | string[]>
): number {
  const a = { ...base, ...overrides };

  if (product === "Verify") {
    const caps = (a.capabilities as string[]) ?? ["SSO"];
    const basePop = Number(base.population ?? 500);
    const pop = Number(a.population ?? basePop);
    const logins = Math.max(1, Math.min(12, Number(a.avgLogins ?? 12)));
    const term = String(a.term ?? "12-month") as "12-month" | "3-year";
    // regions — must be read from answers so multi-region quotes price correctly
    const regions = Math.max(1, Number(a.regions ?? 1));
    let managed = 0;
    if (caps.includes("Lifecycle")) {
      const baseMgd = Number(base.managedUsers ?? basePop);
      if ("population" in overrides && basePop > 0) {
        managed = Math.round(baseMgd * (pop / basePop));
      } else {
        managed = Number(a.managedUsers ?? pop);
      }
    }

    // Build add-on list.
    // Rules:
    //   - Start from base.addOns array (the original question-flow answer) but strip
    //     any non-prod parts — those are controlled exclusively by the `nonProd` key.
    //   - Apply binary addon_* override keys (yes/no toggles from the compare panel).
    //   - Apply the `nonProd` key (single-choice: "D22PGLL" | "D21CWLL" | "none").
    //   - NEVER double-count: nonProd must appear at most once in the final list.
    // IMPORTANT: verify-engine annualList = listPrice × qty, so monthly-rated parts
    // must already be multiplied by 12 here.
    const ADDON_PRICES: Record<string, { description: string; listPrice: number; unit: string }> = {
      D02T6ZX: { description: "SMS and Email MFA Only",       listPrice: 33.70,      unit: "per event per thousand" },
      D01UQZX: { description: "Hosted Application Gateway",  listPrice: 22500 * 12,  unit: "per instance / year"   },
      D01URZX: { description: "Vanity Domain",                listPrice: 562   * 12,  unit: "per instance / year"   },
      D22PGLL: { description: "Non-Production with SLA",      listPrice: 2810  * 12,  unit: "per instance / year"   },
      D21CWLL: { description: "Non-Production without SLA",   listPrice: 1410  * 12,  unit: "per instance / year"   },
    };

    // Non-prod part numbers — always managed via the `nonProd` key, never via addOns array
    const NON_PROD_PARTS = new Set(["D22PGLL", "D21CWLL"]);

    // Start from original addOns array, stripped of any non-prod entries
    const baseAddOns: string[] = (base.addOns as string[] | undefined) ?? [];
    const addOnSet = new Set(baseAddOns.filter((p) => p !== "none" && !NON_PROD_PARTS.has(p)));

    // Apply binary toggle overrides (addon_sms, addon_hag, addon_vanity)
    const binaryAddonMap: Record<string, string> = {
      addon_sms:    "D02T6ZX",
      addon_hag:    "D01UQZX",
      addon_vanity: "D01URZX",
    };
    for (const [key, part] of Object.entries(binaryAddonMap)) {
      // Use override value if present, otherwise fall back to base answer key
      const val = key in overrides ? String(overrides[key]) :
                  key in base     ? String(base[key])       : null;
      if (val === "yes") addOnSet.add(part);
      else if (val === "no") addOnSet.delete(part);
      // null → leave addOnSet unchanged (already seeded from baseAddOns)
    }

    // Apply nonProd — resolved from merged `a` (base + overrides)
    const nonProdVal = String(a.nonProd ?? "none");
    // Ensure no stale non-prod part from a previous state leaks in
    NON_PROD_PARTS.forEach((p) => addOnSet.delete(p));
    if (nonProdVal !== "none" && ADDON_PRICES[nonProdVal]) addOnSet.add(nonProdVal);

    const addOns = Array.from(addOnSet)
      .filter((p) => ADDON_PRICES[p])
      .map((p) => ({ part: p, quantity: 1, ...ADDON_PRICES[p] }));

    const result = computeVerifyQuote({
      capabilities: caps as VerifyCapability[],
      population: pop,
      avgLoginsPerYear: logins,
      managedUsers: managed,
      regions,
      term,
      addOns,
    });
    return result.totalAnnualList;
  }

  if (product === "Vault") {
    // Vault 2.0 — always Model A (Platform model)
    // Model B (legacy) deprecated — route all Vault through Model A.
    const installs = Number(a.installCount ?? 1);
    const includeNonProd = String(a.includeNonProd ?? "no") === "yes";
    const includeKMIP = String(a.includeKMIP ?? "no") === "yes";
    // Build use-case inputs from business-level keys so compare scenarios show
    // activity-based differences (secrets/roles/certs) not opaque RU numbers.
    // Legacy rusMonthly fallback: old quotes that have rusMonthly but not
    // staticSecretCount still price correctly.
    const certCount = Number(a.pkiCertsPerMonth ?? 0);
    const useCaseInputs = {
      staticSecretCount: Number(a.staticSecretCount ?? a.rusMonthly ?? 100),
      dynamicRoles:      Number(a.dynamicRoles ?? 0) || undefined,
      pkiCertsPerMonth:  certCount || undefined,
      pkiCertLifetimeHours: certCount > 0 ? Number(a.pkiCertLifetime ?? 2160) : undefined,
    };
    const result = computeVaultQuote({ model: "A-Platform", installCount: installs, useCaseInputs, includeNonProd, includeKMIP });
    return result.totalAnnualList;
  }

  if (product === "MaaS360") {
    const devices = Math.max(1, Number(a.maas360Devices ?? 1000));
    // maas360Plan override (from fork) OR derive from question-flow answers
    let planKey = String(a.maas360Plan ?? "");
    if (!planKey || !["Essentials", "Deluxe", "Premier", "Enterprise"].includes(planKey)) {
      // Derive from the recommendation engine using the boolean answers
      const rec = recommendMaaS360Plan({
        secureMail:   String(a.maas360SecureMail ?? "no") === "yes",
        advancedApps: String(a.maas360AdvancedApps ?? "no") === "yes",
        threatDefense: String(a.maas360ThreatDefense ?? "no") === "yes",
        remoteSupport: String(a.maas360RemoteSupport ?? "no") === "yes",
      });
      planKey = rec.planKey;
    }
    const result = computeMaaS360Estimate({ devices, planKey, addOnKeys: [], includeConcierge: false });
    return result.annualList;
  }

  if (product === "Instana") {
    const mvs = Math.max(1, Number(a.instanaMVS ?? 100));
    const tier = (String(a.instanaTier ?? "Standard")) as InstanaTier;
    const model = (String(a.instanaModel ?? "SaaS")) as InstanaPurchaseModel;
    const addLogs = String(a.instanaLogsInContext ?? "no") === "yes";
    const logGB = Number(a.instanaLogGB ?? 0);
    const result = computeInstanaQuote({
      model,
      tier,
      mvsCount: mvs,
      addLogsInContext: addLogs,
      estimatedLogGB: logGB > 0 ? logGB : undefined,
    });
    return result.totalAnnualList;
  }

  if (product === "Turbonomic") {
    const mvs = Math.max(1, Number(a.turbonomicMVS ?? 250));
    const deployment = (String(a.turbonomicDeployment ?? "SaaS")) as TurbonomicDeployment;
    const isGov = deployment === "SaaSGov";
    const result = computeTurbonomicScope({
      deployment: isGov ? "SaaS" : deployment,
      estimatedMVS: mvs,
      isGovernment: isGov,
      scopingModel: "mvs",
      includesPublicCloud: String(a.turbonomicCloud ?? "yes") === "yes",
      includesKubernetes: String(a.turbonomicKubernetes ?? "no") === "yes",
    });
    return result.totalAnnualList;
  }

  if (product === "Terraform") {
    const resources = Math.max(1, Number(a.terraformResources ?? 250));
    const team = Math.max(1, Number(a.terraformTeam ?? 5));
    const deployment = (String(a.terraformDeployment ?? "HCP")) as TerraformDeployment;
    const governance = String(a.terraformGovernance ?? "none");
    const vaultOwned = String(a.terraformVault ?? "no") === "yes";
    // terraformEdition override (from fork) sets governance flags to force the edition
    const editionOverride = String(a.terraformEdition ?? "");
    const needsPremium = editionOverride === "Premium" || governance === "audit";
    const needsGovernance = editionOverride === "Standard" || editionOverride === "Premium" || governance === "governance" || governance === "audit";
    const result = computeTerraformRecommendation({
      deployment,
      estimatedManagedResources: resources,
      teamSize: team,
      needsGovernance,
      needsAuditLog: needsPremium,
      needsAirGap: deployment === "Enterprise",
      vaultAlreadyOwned: vaultOwned,
    });
    return result.totalAnnualList;
  }

  if (product === "Concert") {
    const pain = (String(a.concertPain ?? "alertFatigue")) as ConcertInputs["primaryPain"];
    const apps = Number(a.concertApplications ?? 0);
    const concertMVS = Number(a.concertMVS ?? 0);
    const workflows = Number(a.concertWorkflows ?? 0);
    const deployment = (String(a.concertDeployment ?? "onprem")) as "saas" | "onprem";
    const observeTier = (String(a.concertObserveTier ?? "essentials")) as "essentials" | "standard";
    const result = computeConcertRecommendation({
      primaryPain: pain,
      deployment,
      hasInstana: String(a.concertInstana ?? "no") === "yes",
      needsWorkflowAutomation: String(a.concertAutomation ?? "no") === "yes",
      needsCostOptimization: pain === "costOptimization" || pain === "all",
      needsSecurityRisk: pain === "riskPosture" || pain === "all",
      needsResilience: String(a.concertResilience ?? "no") === "yes",
      estimatedApplications: apps > 0 ? apps : undefined,
      estimatedMVS: concertMVS > 0 ? concertMVS : undefined,
      estimatedWorkflows: workflows > 0 ? workflows : undefined,
      observeTier,
    });
    return result.totalAnnualList;
  }

  if (product === "webMethods") {
    const needs = Array.isArray(a.webMethodsNeeds) ? (a.webMethodsNeeds as string[]) : [];
    const deploymentRaw = String(a.webMethodsDeployment ?? "saas");
    const industry = (String(a.webMethodsIndustry ?? "other")) as WebMethodsInputs["industryVertical"];
    const intTxn = Number(a.webMethodsIntTxn ?? 0);
    const apiTxn = Number(a.webMethodsApiTxn ?? 0);
    const mftTxn = Number(a.webMethodsMftTxn ?? 0);
    const result = computeWebMethodsScope({
      needsAppIntegration: needs.includes("appIntegration") || intTxn > 0,
      needsAPIManagement: needs.includes("apiManagement") || apiTxn > 0,
      needsB2B: needs.includes("b2b"),
      needsMFT: needs.includes("mft") || mftTxn > 0,
      needsEventDriven: needs.includes("eventDriven"),
      preferSaaS: deploymentRaw === "saas",
      industryVertical: industry,
      estimatedIntegrations: intTxn > 0 ? intTxn : undefined,
      estimatedAPITransactions: apiTxn > 0 ? apiTxn : undefined,
      estimatedMFTTransactions: mftTxn > 0 ? mftTxn : undefined,
    });
    return result.totalAnnualList;
  }

  // NS1 — use totalAnnualList (confirmed marketplace prices) so the displayed price
  // matches the quote result. Pass all inputs that the quote engine uses.
  const mq = Number(a.queryMQ ?? 50);
  const fc = Number(a.filterChainCount ?? 0);
  const mon = Number(a.monitors ?? 0);
  const records = Number(a.recordCount ?? 0);
  const gslbRaw = String(a.gslb ?? "no");
  const ddosNxdRaw = String(a.ddos ?? "no");
  const result = computeNS1Quote({
    queryVolumeMQ:    mq,
    filterChains:     fc,
    monitors:         mon,
    recordCount:      records,
    rumBased:         gslbRaw === "yes-rum" || gslbRaw === "yes-rum-advanced",
    rumAdvanced:      gslbRaw === "yes-rum-advanced",
    ddosProtection:   ddosNxdRaw === "ddos" || ddosNxdRaw === "both" || ddosNxdRaw === "yes" || String(a.ddosProtection ?? "no") === "yes",
    nxdWaiver:        ddosNxdRaw === "nxd" || ddosNxdRaw === "both",
    dnsInsights:      String(a.insights ?? "no") === "yes",
    cloudSync:        String(a.cloudSync ?? "no") === "yes",
    growthMQ:         Number(a.growthMQ ?? 0),
    expectedGrowthPct: Number(a.growth ?? 0),
  });
  return result.totalAnnualList;
}

// ─── Normalise answers for the quoting engine ─────────────────────────────────

/**
 * Translates compare-panel answer keys back into the format that
 * computeVerifyResult (and the /api/compute-quote route) expects.
 *
 * Specifically for Verify: the compare panel stores add-ons as individual
 * boolean-ish keys (addon_hag: "yes") but computeVerifyResult reads a.addOns
 * which is an array of part numbers (["D01UQZX"]). This function rebuilds that
 * array from the current checkbox state so the rebuilt quote is accurate.
 *
 * Vault and NS1 add-ons (includeNonProd, pkiAddon, adpKeyMgmt, includeKMIP,
 * ddosProtection) are already the keys that computeVaultResult / computeNS1Result
 * read directly — no translation needed for those.
 */
export function normaliseAnswersForQuote(
  product: Product,
  answers: Record<string, string | number | boolean | string[]>
): Record<string, string | number | boolean | string[]> {
  if (product !== "Verify") return answers;

  // Map each binary addon_* key to its part number
  const BINARY_ADDON_MAP: Record<string, string> = {
    addon_sms:    "D02T6ZX",
    addon_hag:    "D01UQZX",
    addon_vanity: "D01URZX",
  };

  // Non-prod part numbers — controlled exclusively via the `nonProd` key.
  // computeVerifyResult reads `nonProd` directly, so we must NOT also add it
  // to the `addOns` array or it will be counted twice.
  const NON_PROD_PARTS = new Set(["D22PGLL", "D21CWLL"]);

  // Start from the existing addOns array, stripped of any non-prod entries
  const baseAddOns: string[] = (answers.addOns as string[] | undefined) ?? [];
  const addOnSet = new Set(baseAddOns.filter((p) => p !== "none" && !NON_PROD_PARTS.has(p)));

  // Apply each binary addon_* key if present
  for (const [key, part] of Object.entries(BINARY_ADDON_MAP)) {
    if (key in answers) {
      if (String(answers[key]) === "yes") addOnSet.add(part);
      else addOnSet.delete(part);
    }
  }

  // nonProd is intentionally NOT added to the addOns array here.
  // computeVerifyResult reads a.nonProd separately and appends it once.
  // Adding it here would cause a duplicate line item.

  return { ...answers, addOns: Array.from(addOnSet) };
}

// ─── Sensitivity slider price (single variable sweep) ────────────────────────

export function computeSliderPrice(
  product: Product,
  base: Record<string, string | number | boolean | string[]>,
  overrides: Record<string, string | number | boolean | string[]>,
  sliderKey: string,
  sliderValue: number
): number {
  // Pass sliderKey as an override so computeScenarioPrice sees it in `overrides`
  // and applies proportional scaling logic (e.g. managedUsers when population moves).
  return computeScenarioPrice(product, base, { ...overrides, [sliderKey]: sliderValue });
}

// ─── Fan-out builder ──────────────────────────────────────────────────────────

/**
 * Given the current answers and 1–2 chosen fork variable keys,
 * build a CompareResult with one scenario per option combination.
 */
export function buildFanOut(
  product: Product,
  answers: Record<string, string | number | boolean | string[]>,
  selectedVarKeys: string[]
): CompareResult {
  const allVars = getForkVariables(product, answers);
  const forkVars = selectedVarKeys
    .map((k) => allVars.find((v) => v.key === k))
    .filter(Boolean) as ForkVariable[];

  // Generate all combinations of options across chosen variables
  type Combo = { labels: string[]; overrides: Record<string, string | number | boolean | string[]> };
  let combos: Combo[] = [{ labels: [], overrides: {} }];

  for (const fv of forkVars) {
    const expanded: Combo[] = [];
    for (const existing of combos) {
      for (const opt of fv.options) {
        expanded.push({
          labels: [...existing.labels, opt.label],
          overrides: { ...existing.overrides, [fv.key]: opt.value },
        });
      }
    }
    combos = expanded;
  }

  // Build scenarios
  const rawScenarios: Scenario[] = combos.map((c) => {
    const price = computeScenarioPrice(product, answers, c.overrides);
    return {
      name: c.labels.join(" · ") || "Baseline",
      overrides: c.overrides,
      annualList: price,
      monthlyList: Math.round(price / 12),
      drivers: c.labels,
    };
  });

  // Sort high → low (anchoring)
  rawScenarios.sort((a, b) => b.annualList - a.annualList);

  // Remove duplicates (same price — can happen when fork var has no effect)
  const unique = rawScenarios.filter((s, i, arr) =>
    arr.findIndex((x) => x.annualList === s.annualList && x.name === s.name) === i
  );

  const baseline = unique[unique.length - 1];
  const recommended = unique.length >= 3 ? unique[1] : unique[0];
  const baselineIdx = unique.length - 1;
  const recommendedIdx = unique.indexOf(recommended);

  // Insight text
  const topPrice = unique[0].annualList;
  const bottomPrice = baseline.annualList;
  const pct = bottomPrice > 0 ? Math.round(((topPrice - bottomPrice) / bottomPrice) * 100) : 0;
  const insightText = buildInsight(product, forkVars, pct, unique);

  // Slider — use the first numeric variable that is NOT already shown on the cards.
  // Showing the same variable on the slider as the cards is redundant.
  const forkedKeys = new Set(forkVars.map((v) => v.key));
  const sliderForkVar =
    allVars.find((v) => !forkedKeys.has(v.key) && typeof v.options[0].value === "number") ?? null;

  const sliderKey = sliderForkVar?.key ?? "population";
  const sliderVals = sliderForkVar?.options.map((o) => Number(o.value)) ?? [1000, 500000];
  const sliderMin = Math.min(...sliderVals);
  const sliderMax = Math.max(...sliderVals);
  const sliderStep = sliderMax > 10000 ? 1000 : sliderMax > 1000 ? 100 : sliderMax > 100 ? 10 : 1;
  const sliderUnit = sliderForkVar
    ? sliderForkVar.label.toLowerCase().includes("user") ? "users"
    : sliderForkVar.label.toLowerCase().includes("query") ? "MQ/mo"
    : sliderForkVar.label.toLowerCase().includes("client") ? "clients"
    : sliderForkVar.label.toLowerCase().includes("secret") ? "secrets"
    : sliderForkVar.label.toLowerCase().includes("role") ? "roles"
    : sliderForkVar.label.toLowerCase().includes("cert") ? "certs/mo"
    : sliderForkVar.label.toLowerCase().includes("device") ? "devices"
    : sliderForkVar.label.toLowerCase().includes("host") || sliderForkVar.label.toLowerCase().includes("mvs") ? "hosts"
    : sliderForkVar.label.toLowerCase().includes("vm") ? "VMs"
    : sliderForkVar.label.toLowerCase().includes("rum") || sliderForkVar.label.toLowerCase().includes("resource") ? "RUM"
    : sliderForkVar.label.toLowerCase().includes("app") ? "apps"
    : sliderForkVar.label.toLowerCase().includes("txn") || sliderForkVar.label.toLowerCase().includes("transaction") ? "txn/mo"
    : ""
    : "";
  const sliderCurrentValue = typeof answers[sliderKey] === "number"
    ? answers[sliderKey] as number
    : Number(answers[sliderKey] ?? sliderMin);

  return {
    product,
    forkVars,
    scenarios: unique,
    baselineIdx,
    recommendedIdx,
    insightText,
    sliderVar: sliderForkVar,
    sliderKey,
    sliderMin,
    sliderMax,
    sliderStep,
    sliderUnit,
    sliderCurrentValue: Math.min(Math.max(sliderCurrentValue, sliderMin), sliderMax),
  };
}

// ─── Insight text ─────────────────────────────────────────────────────────────

function buildInsight(
  product: Product,
  forkVars: ForkVariable[],
  pctDiff: number,
  scenarios: Scenario[]
): string {
  const varLabel = forkVars.map((v) => v.label).join(" and ");
  const top = scenarios[0];
  const bottom = scenarios[scenarios.length - 1];
  const diff = top.annualList - bottom.annualList;
  const diffStr = "$" + Math.round(diff).toLocaleString();

  if (product === "Verify") {
    if (forkVars.some((v) => v.key === "capabilities")) {
      return `Capability choice is the dominant driver — the difference between the simplest and most complete option is ${diffStr}/yr (${pctDiff}%). Lifecycle Management has the biggest single impact because it charges per managed user rather than per MAU.`;
    }
    if (forkVars.some((v) => v.key === "population")) {
      return `User population drives MAU, which determines the pricing tier. Watch for non-linear jumps at tier boundaries — a small increase in users can trigger a significant price step. The spread across these options is ${diffStr}/yr.`;
    }
  }

  if (product === "Vault") {
    if (forkVars.some((v) => ["staticSecretCount", "dynamicRoles", "pkiCertsPerMonth"].includes(v.key))) {
      return `Vault 2.0 (Platform model) converts activity into monthly RUs at $48/RU/month ($576/yr). Secrets stored and dynamic roles each count as 1 RU; PKI certs add RUs based on cert lifetime. The ${pctDiff}% spread of ${diffStr}/yr reflects how much Vault activity drives the consumption meter.`;
    }
    if (forkVars.some((v) => v.key === "installCount")) {
      return `Each production cluster adds a $96,000/yr install fee (D15FQZX) plus RU charges. The ${pctDiff}% spread of ${diffStr}/yr is dominated by cluster count — consider HA vs multi-cluster topology carefully.`;
    }
    if (forkVars.some((v) => v.key === "includeKMIP")) {
      return `KMIP support switches the install SKU from D15FQZX ($96K/cluster) to D155LZX ($360K/cluster) — a $264K/cluster uplift. The ${pctDiff}% spread of ${diffStr}/yr is driven entirely by this one add-on.`;
    }
  }

  if (product === "MaaS360") {
    if (forkVars.some((v) => v.key === "maas360Plan")) {
      return `MaaS360 plan tier is the biggest per-device driver — Essentials ($4.00) to Enterprise ($9.00) is a 2.25× uplift. The ${pctDiff}% spread of ${diffStr}/yr shows the cost of moving up-tier to secure email, advanced apps, or threat defense.`;
    }
    if (forkVars.some((v) => v.key === "maas360Devices")) {
      return `MaaS360 pricing is linear per device — no volume tiers. The ${pctDiff}% spread of ${diffStr}/yr is directly proportional to device count at the selected plan rate.`;
    }
  }

  if (product === "Instana") {
    if (forkVars.some((v) => v.key === "instanaTier")) {
      return `Observability depth is the key cost lever — Standard (full-stack APM at $79.50/MVS/mo) is 3.75× Essentials (infra-only at $21.20/MVS/mo). The ${pctDiff}% spread of ${diffStr}/yr is the cost of full application performance monitoring versus infrastructure metrics only.`;
    }
    if (forkVars.some((v) => v.key === "instanaMVS")) {
      return `Instana charges per Managed Virtual Server (MVS) at a fixed rate — price is linear with host count. The ${pctDiff}% spread of ${diffStr}/yr shows the cost range across these fleet sizes. MVS count is the most accurate sizing input.`;
    }
    if (forkVars.some((v) => v.key === "instanaModel")) {
      return `Pay-Per-Use ($0.03/MVS/hour, no commitment) vs SaaS subscription — at full-month utilisation (730h), PPU equates to $21.90/MVS/month, slightly above Essentials SaaS. The ${pctDiff}% spread of ${diffStr}/yr reflects the commitment vs flexibility trade-off.`;
    }
  }

  if (product === "Turbonomic") {
    if (forkVars.some((v) => v.key === "turbonomicMVS")) {
      return `Turbonomic charges $18.80/MVS/month (commercial SaaS, D09ECZX) — linear with VM count. The ${pctDiff}% spread of ${diffStr}/yr is the cost range across these fleet sizes. Use MVS count for accurate scoping.`;
    }
    if (forkVars.some((v) => v.key === "turbonomicDeployment")) {
      return `Government/FedRAMP (D11Q7ZX) is $23.50/MVS/month vs commercial SaaS $18.80 — a 25% uplift for compliance. The ${diffStr}/yr difference reflects this rate premium across the scoped fleet.`;
    }
  }

  if (product === "Terraform") {
    if (forkVars.some((v) => v.key === "terraformResources")) {
      return `Terraform HCP charges per Managed Resource Unit (RUM) with volume discounts above 10K RUM. The ${pctDiff}% spread of ${diffStr}/yr reflects both the per-RUM rate and the graduated discount table — watch for the non-linear step at 10K.`;
    }
    if (forkVars.some((v) => v.key === "terraformEdition")) {
      return `Standard (D100DZX, $5.16/RUM/yr) gives policy-as-code and team access controls; Premium (D11GDZX, $10.80/RUM/yr) adds audit logging and SSO. The ${pctDiff}% spread of ${diffStr}/yr is the cost of upgrading governance capabilities.`;
    }
  }

  if (product === "Concert") {
    if (forkVars.some((v) => v.key === "concertDeployment")) {
      return `Concert On-Prem (D0MK3ZX, $212/RU/yr) vs Concert SaaS (5900BD6, ~$1.06/RU/yr) is a dramatic price difference — IBM hosts the SaaS platform and absorbs infrastructure costs. The ${diffStr}/yr spread of ${pctDiff}% is almost entirely deployment model.`;
    }
    if (forkVars.some((v) => v.key === "concertPain")) {
      return `Concert is modular — each enabled module adds RUs at $212/RU/yr (on-prem) or ~$1.06/RU/yr (SaaS). The ${pctDiff}% spread of ${diffStr}/yr shows the incremental cost of expanding from a focused use case to the full agentic ITOps suite.`;
    }
    if (forkVars.some((v) => v.key === "concertApplications")) {
      return `Concert Protect (3 RU/app) and Resilience (5 RU/app) scale with application count. The ${pctDiff}% spread of ${diffStr}/yr is driven by how many applications are in scope for security risk and resilience management.`;
    }
  }

  if (product === "webMethods") {
    if (forkVars.some((v) => v.key === "webMethodsIntTxn")) {
      return `App integration is priced at $92/1,000 txn/year with a volume factor — the largest cost lever in webMethods. The ${pctDiff}% spread of ${diffStr}/yr reflects how transaction volume scales the bill.`;
    }
    if (forkVars.some((v) => v.key === "webMethodsDeployment")) {
      return `SaaS (IBM-hosted) uses RU-based pricing with a $720 RU/yr base subscription; on-premises uses CP4I VPC licensing at different rates. The ${diffStr}/yr spread of ${pctDiff}% reflects the deployment model cost difference at these transaction volumes.`;
    }
  }

  if (product === "NS1") {
    return `NS1 pricing is tier-based on query volume — small increases near tier boundaries cause disproportionate price jumps. The ${pctDiff}% spread of ${diffStr}/yr across these options is driven by ${varLabel}.`;
  }

  return `The ${pctDiff}% price spread (${diffStr}/yr) across these scenarios is driven by differences in ${varLabel}.`;
}
