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
import type { Product } from "./types";
import type { VerifyCapability } from "./data";

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
  answers: Record<string, string | number | boolean | string[]>
): AddonDefinition[] {
  if (product === "Verify") {
    return [
      { key: "addon_sms",         label: "SMS / Email MFA",               partNumber: "D02T6ZX", annualDelta: 0,      deltaNote: "Usage-based: $33.70 per 1,000 auth events — see CPQ for volume estimate", yesValue: "yes", noValue: "no" },
      { key: "addon_hag",         label: "Hosted Application Gateway",    partNumber: "D01UQZX", annualDelta: 270000, deltaNote: "$22,500 / instance / month",                    yesValue: "yes", noValue: "no" },
      { key: "addon_vanity",      label: "Vanity Domain",                  partNumber: "D01URZX", annualDelta: 6744,   deltaNote: "$562 / instance / month",                       yesValue: "yes", noValue: "no" },
      { key: "addon_nonprod_sla", label: "Non-Production (with SLA)",     partNumber: "D22PGLL", annualDelta: 33720,  deltaNote: "$2,810 / instance / month",                     yesValue: "yes", noValue: "no" },
      { key: "addon_nonprod_nosla",label:"Non-Production (no SLA)",       partNumber: "D21CWLL", annualDelta: 16920,  deltaNote: "$1,410 / instance / month",                     yesValue: "yes", noValue: "no" },
    ];
  }
  if (product === "Vault") {
    const model = String(answers.vaultModel ?? "B");
    if (model === "B") {
      return [
        { key: "includeNonProd", label: "Non-production cluster",         partNumber: "D1018ZX", annualDelta: 12480,   deltaNote: "$12,480 / yr",                               yesValue: "yes", noValue: "no" },
        { key: "pkiAddon",       label: "PKI cert management (50 certs)", partNumber: "D1406ZX", annualDelta: 8004,    deltaNote: "$5,004 install + $60/cert × 50",             yesValue: 50,    noValue: 0    },
        { key: "adpKeyMgmt",     label: "ADP Key Mgmt / KMIP (1 cluster)",partNumber: "D1013ZX", annualDelta: 249600,  deltaNote: "$249,600 / cluster",                         yesValue: 1,     noValue: 0    },
      ];
    }
    // Model A
    return [
      { key: "includeNonProd", label: "Non-production cluster",           partNumber: "D155GZX", annualDelta: 48000,   deltaNote: "$48,000 / yr",                               yesValue: "yes", noValue: "no" },
      { key: "includeKMIP",    label: "KMIP support",                     partNumber: "D155LZX", annualDelta: 264000,  deltaNote: "Upgrades install from $96K → $360K / cluster",yesValue: "yes", noValue: "no" },
    ];
  }
  // NS1
  return [
    { key: "ddosProtection", label: "Spike / DDoS Protection",            partNumber: "D10ATZX", annualDelta: 0,       deltaNote: "Fixed add-on — see CPQ for price",           yesValue: "yes", noValue: "no" },
  ];
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
  answers: Record<string, string | number | boolean | string[]>
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
        key: "addon_nonprod_sla",
        label: "Add-on: Non-Production with SLA (D22PGLL)",
        impact: "$2,810 / instance / month — compare with vs without",
        options: [
          { label: "Without Non-Prod (SLA)", value: "no" },
          { label: "With Non-Prod (SLA)",    value: "yes" },
        ],
      },
      {
        key: "addon_nonprod_nosla",
        label: "Add-on: Non-Production without SLA (D21CWLL)",
        impact: "$1,410 / instance / month — compare with vs without",
        options: [
          { label: "Without Non-Prod (no SLA)", value: "no" },
          { label: "With Non-Prod (no SLA)",    value: "yes" },
        ],
      },
    ];
  }

  if (product === "Vault") {
    const model = String(answers.vaultModel ?? "B");
    if (model === "B") {
      return [
        // ── Core levers ───────────────────────────────────────────────────
        {
          key: "edition",
          label: "Vault edition",
          impact: "Sets the install fee: Essentials $24,960 · Standard $90,000 · Premium $99,960 / cluster/yr",
          options: [
            { label: "Essentials", value: "Essentials" },
            { label: "Standard",   value: "Standard" },
            { label: "Premium",    value: "Premium" },
          ],
        },
        {
          key: "clientCount",
          label: "Client (app/service) count",
          impact: "Each connecting app or service = 1 client RVU at $1,296/yr",
          options: [
            { label: "50 clients",     value: 50 },
            { label: "250 clients",    value: 250 },
            { label: "1,000 clients",  value: 1000 },
            { label: "5,000 clients",  value: 5000 },
            { label: "10,000 clients", value: 10000 },
          ],
        },
        {
          key: "installCount",
          label: "Number of clusters",
          impact: "Each production cluster = one install fee (Essentials $24,960 · Standard $90K · Premium $99,960)",
          options: [
            { label: "1 cluster",  value: 1 },
            { label: "2 clusters", value: 2 },
            { label: "3 clusters", value: 3 },
          ],
        },
        // ── Add-ons ───────────────────────────────────────────────────────
        {
          key: "includeNonProd",
          label: "Add-on: Non-production environment",
          impact: "$12,480/yr (D1018ZX) — compare with vs without a dev/test cluster",
          options: [
            { label: "Without non-prod", value: "no" },
            { label: "With non-prod",    value: "yes" },
          ],
        },
        {
          key: "pkiAddon",
          label: "Add-on: PKI certificate management",
          impact: "$5,004 install + $60/cert/yr (D1406ZX + D1405ZX) — compare cert volumes",
          options: [
            { label: "No PKI",             value: 0 },
            { label: "PKI — 50 certs",     value: 50 },
            { label: "PKI — 250 certs",    value: 250 },
            { label: "PKI — 500 certs",    value: 500 },
          ],
        },
        {
          key: "adpKeyMgmt",
          label: "Add-on: ADP Key Management / KMIP (D1013ZX)",
          impact: "$249,600 / cluster needing KMIP — compare 0 vs 1 vs 2 clusters",
          options: [
            { label: "No KMIP",            value: 0 },
            { label: "KMIP — 1 cluster",   value: 1 },
            { label: "KMIP — 2 clusters",  value: 2 },
            { label: "KMIP — 3 clusters",  value: 3 },
          ],
        },
      ];
    }
    // Model A
    return [
      {
        key: "rusMonthly",
        label: "Monthly resource units (RU)",
        impact: "Platform model: $48/RU/month ($576/yr) before volume discounts",
        options: [
          { label: "100 RU/mo",    value: 100 },
          { label: "500 RU/mo",    value: 500 },
          { label: "1,000 RU/mo",  value: 1000 },
          { label: "5,000 RU/mo",  value: 5000 },
          { label: "10,000 RU/mo", value: 10000 },
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
          { label: "Standard install ($96K/cluster)",      value: "no" },
          { label: "KMIP-included install ($360K/cluster)", value: "yes" },
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
      impact: "First 3,000 records are free — billable in 1,000-record blocks above that",
      options: [
        { label: "< 3,000 (all free)", value: 2000 },
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
    let managed = 0;
    if (caps.includes("Lifecycle")) {
      const baseMgd = Number(base.managedUsers ?? basePop);
      if ("population" in overrides && basePop > 0) {
        managed = Math.round(baseMgd * (pop / basePop));
      } else {
        managed = Number(a.managedUsers ?? pop);
      }
    }

    // Build add-on list from both the base answers (existing addOns array)
    // and any individual addon_* comparison overrides.
    // IMPORTANT: verify-engine treats addOn.listPrice as ANNUAL (annualList = listPrice × qty).
    // Monthly-rated add-ons must be multiplied by 12 here before passing to the engine.
    const ADDON_PRICES: Record<string, { description: string; listPrice: number; unit: string }> = {
      D02T6ZX: { description: "SMS and Email MFA Only",        listPrice: 33.70,       unit: "per event per thousand" },
      D01UQZX: { description: "Hosted Application Gateway",   listPrice: 22500  * 12,  unit: "per instance / year" },
      D01URZX: { description: "Vanity Domain",                 listPrice: 562    * 12,  unit: "per instance / year" },
      D22PGLL: { description: "Non-Production with SLA",       listPrice: 2810   * 12,  unit: "per instance / year" },
      D21CWLL: { description: "Non-Production without SLA",    listPrice: 1410   * 12,  unit: "per instance / year" },
    };
    // Start from whatever add-ons were in the original answers
    const baseAddOns: string[] = (base.addOns as string[] | undefined) ?? [];
    // Build a mutable set, then apply each addon_* toggle override
    const addOnSet = new Set(baseAddOns.filter((p) => p !== "none"));
    const addonMap: Record<string, string> = {
      addon_sms:         "D02T6ZX",
      addon_hag:         "D01UQZX",
      addon_vanity:      "D01URZX",
      addon_nonprod_sla: "D22PGLL",
      addon_nonprod_nosla: "D21CWLL",
    };
    for (const [key, part] of Object.entries(addonMap)) {
      if (key in overrides) {
        if (String(overrides[key]) === "yes") addOnSet.add(part);
        else addOnSet.delete(part);
      }
    }
    const addOns = Array.from(addOnSet)
      .filter((p) => ADDON_PRICES[p])
      .map((p) => ({ part: p, quantity: 1, ...ADDON_PRICES[p] }));

    const result = computeVerifyQuote({ capabilities: caps as VerifyCapability[], population: pop, avgLoginsPerYear: logins, managedUsers: managed, term, addOns });
    return result.totalAnnualList;
  }

  if (product === "Vault") {
    const model = String(a.vaultModel ?? "B");
    const installs = Number(a.installCount ?? 1);
    if (model === "B") {
      // edition is stored as "1"/"2"/"3" from the questions, OR as the full name
      // when set by a fan-out override (which uses "Essentials"/"Standard"/"Premium").
      // Translate numeric codes to names first; full names pass through unchanged.
      const EDITION_CODES: Record<string, string> = { "1": "Essentials", "2": "Standard", "3": "Premium" };
      const editionRaw = String(a.edition ?? "2");
      const editionName = EDITION_CODES[editionRaw] ?? editionRaw;
      const edition = (["Essentials", "Standard", "Premium"].includes(editionName) ? editionName : "Standard") as "Essentials" | "Standard" | "Premium";
      const clients = Number(a.clientCount ?? 100);
      const includeNonProd = String(a.includeNonProd ?? "no") === "yes";
      const pkiCerts = Number(a.pkiAddon ?? 0);
      const adpKeyMgmt = Number(a.adpKeyMgmt ?? 0);
      const result = computeVaultQuote({ model: "B-Clients", edition, installCount: installs, clientCount: clients, includeNonProd, pkiCerts, adpKeyMgmt });
      return result.totalAnnualList;
    }
    const ru = Number(a.rusMonthly ?? 100);
    const includeNonProd = String(a.includeNonProd ?? "no") === "yes";
    const includeKMIP = String(a.includeKMIP ?? "no") === "yes";
    const result = computeVaultQuote({ model: "A-Platform", installCount: installs, useCaseInputs: { staticSecretCount: ru }, includeNonProd, includeKMIP });
    return result.totalAnnualList;
  }

  // NS1
  const mq = Number(a.queryMQ ?? 50);
  const fc = Number(a.filterChainCount ?? 0);
  const mon = Number(a.monitors ?? 0);
  const records = Number(a.recordCount ?? 0);
  const ddos = String(a.ddosProtection ?? "no") === "yes";
  const result = computeNS1Quote({ queryVolumeMQ: mq, filterChains: fc, monitors: mon, recordCount: records, ddosProtection: ddos });
  return result.ballparkAnnual;
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
    : sliderForkVar.label.toLowerCase().includes("ru") ? "RU/mo"
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
    if (forkVars.some((v) => v.key === "edition")) {
      return `Edition choice drives the per-cluster install fee (Essentials $24.9k → Premium $100k/cluster). The ${pctDiff}% spread of ${diffStr}/yr is dominated by install cost, with client RVUs as a secondary driver.`;
    }
    if (forkVars.some((v) => v.key === "clientCount")) {
      return `Client count (RVU) scales linearly at $1,296/client/yr — the ${pctDiff}% spread of ${diffStr}/yr is driven entirely by the number of connecting apps and services.`;
    }
    if (forkVars.some((v) => v.key === "rusMonthly")) {
      return `Platform-model (Model A) pricing scales with monthly RU consumption at $48/RU/month ($576/yr). The ${pctDiff}% spread of ${diffStr}/yr reflects different usage profiles. Volume discounts reduce the effective rate significantly at scale.`;
    }
  }
  if (product === "NS1") {
    return `NS1 pricing is tier-based on query volume — small increases near tier boundaries cause disproportionate price jumps. The ${pctDiff}% spread of ${diffStr}/yr across these options is driven by ${varLabel}.`;
  }

  return `The ${pctDiff}% price spread (${diffStr}/yr) across these scenarios is driven by differences in ${varLabel}.`;
}
