/**
 * IBM Turbonomic — data module
 *
 * IBM Turbonomic Application Resource Management (ARM).
 * Product: automates workload placement and resource optimization across hybrid cloud,
 * data center, Kubernetes, and public cloud (AWS, Azure, GCP).
 *
 * CONFIRMED PRICING (IBM Turbonomic Pricing and Sizing Guide 2026, Seismic, Jul 28 2026):
 *  Billing metric: Managed Virtual Server (MVS) per month — same unit as Instana.
 *
 *  MVS counting rules ("3 Rules of MVS"):
 *   1. Physical (non-virtualized) machines: 1 machine = 1 MVS
 *   2. Virtualized: 1 VM = 1 MVS (not the underlying host)
 *   3. Kubernetes / RHOCP: 1 worker NODE = 1 MVS (not pods/containers)
 *   → Hypervisor, Container/K8s, and cloud targets share the same MVS metric.
 *     No separate Container Edition SKU exists.
 *   → OCP Virtualization: count VMs. OCP containers: count nodes. Mixed: count whichever applies.
 *
 *  COMMERCIAL SaaS (PID 5900-AP1):
 *   D09ECZX  IBM Turbonomic per MVS Committed Term License   $18.80/MVS/month
 *   D09EDZX  IBM Turbonomic per MVS Overage                  $22.60/MVS/month  ← correct overage part
 *   D09EEZX  IBM Turbonomic SVC Level Agreement              $0.00 (always include)
 *
 *  GOVERNMENT SaaS — FedRAMP (PID 5900-AP1):
 *   D11Q7ZX  IBM Turbonomic For Government Standard MVS/month  $23.50/MVS/month
 *   D11Q8ZX  Overage                                           $28.20/MVS/month
 *   D14IUZX  IBM Turbonomic SVC Level Agreement (Gov)          $0.00 (always include)
 *   E126EZX  In-Country Support                                $9.40/MVS/month
 *   E11Q9ZX  Advanced Support                                  $3.53/MVS/month
 *
 *  MONITORED COSTS / cloud-spend scoping (PID 5900-AP1):
 *   D0I0GZX  IBM Turbonomic Standard Monitored Costs per Annum License  Tiered pricing
 *   D0I0HZX  IBM Turbonomic Standard Monitored Costs per Annum Overage  Tiered pricing
 *   D09EEZX  SVC Level Agreement (shared with commercial)                $0.00
 *   1 unit = $100K cloud spend. Min order: 16 units ($1.6M+ cloud spend).
 *   Replaces the old "Essentials edition" ($50K/instance) which is NOT in the 2026 pricing guide.
 *
 *  PARKING EDITION (PID 5900-AP1):
 *   D177KZX  Pay-as-you-go per MVS  $6.26/MVS (no minimum order quantity)
 *
 *  HOSTING EDITION — On-Prem to SaaS migration only (PID 5900-B74):
 *   D0HE7ZX  IBM Turbonomic Hosting per Instance License (12 months)  $53,040/year
 *   D0HE8ZX  IBM Turbonomic Hosting SLA                               $0.00
 *   Rules: only for existing On-Prem customers migrating to SaaS; max 1 instance; no discounts;
 *          min 3-month term; cannot hold On-Prem licence at same time.
 *
 *  ON-PREMISES (PID 5737-N29 — billing metric: MVS, NOT VPC/socket):
 *   D28FALL  Subscription License               $21.15/MVS/month
 *   D28F9LL  Monthly License                    $56.90/MVS/month
 *   D28F7LL  Perpetual + S&S 12mo (Restricted)  $1,270.00/MVS/year — federal accounts only
 *   E0R28LL  Annual S&S Renewal                 $254.00/MVS/year
 *   D28F8LL  S&S Reinstatement 12mo             $763.00/MVS/year
 *   Linux on Z equivalents: D0A65ZX / D0A64ZX / D0A63ZX / E0A62ZX / D0A66ZX (same prices)
 *   NOTE: Linux on Z requires L0 approval. Installs on Linux X86; manages TO Linux on Z only.
 *
 *  Professional Services (list price, always include on new SaaS deployments):
 *   D0G8DZX  Install      $9,700 one-time
 *   D08YVZX  Build SaaS   $40,560 one-time
 *   D08YYZX  Perform SaaS $9,700 one-time
 *
 *  Discount approval thresholds (Commercial SaaS — includes channel margin):
 *   50–199 MVS:   0% — no discount allowed
 *   200–499 MVS:  30% — self-approve
 *   500–999 MVS:  40% — WW Sales Leader approval required
 *   1,000+ MVS:   50% — WW Sales Leader approval required
 *
 *  Discount approval thresholds (Government / FedRAMP SaaS):
 *   0–199 MVS:    0% — no discount allowed
 *   200–499 MVS:  25% — self-approve
 *   500–999 MVS:  35% — WW Sales Leader approval required
 *   1,000+ MVS:   45% — WW Sales Leader approval required
 *
 *  FAQ: Overage billing for SaaS customers is NOT currently active.
 *       Overage billing onboarding for SAPcc has been put on hold indefinitely.
 *       Overage parts (D09EDZX / D11Q8ZX) are still required on every SaaS quote.
 *
 * Key integration: Instana → Turbonomic
 *  Instana observability data feeds Turbonomic's AI engine, enabling application-aware
 *  resource management decisions rather than infrastructure-only optimization.
 *  Requires 200+ MVS Instana Standard SaaS on the same IBM account.
 */

// ─── Deployment models ────────────────────────────────────────────────────────

export type TurbonomicDeployment = "SaaS" | "SaaSGov" | "OnPrem" | "Parking" | "Hosting";

export interface TurbonomicModel {
  key: TurbonomicDeployment;
  label: string;
  pricing: string;
  summary: string;
  includes: string[];
  bestFor: string;
}

export const TURBONOMIC_MODELS: TurbonomicModel[] = [
  {
    key: "SaaS",
    label: "Turbonomic SaaS (Commercial)",
    pricing: "$18.80/MVS/month (D09ECZX) — list price, standard discounting applies",
    summary: "IBM-hosted. Full workload optimization across hybrid cloud, Kubernetes, and data center.",
    includes: [
      "Public cloud optimization (AWS, Azure, GCP)",
      "Kubernetes optimization (EKS, AKS, GKE, OpenShift)",
      "Application & database resource optimization",
      "Data center secure connect tunnel",
      "SLO-driven optimization",
      "Enterprise SSO integration",
    ],
    bestFor: "Most commercial enterprise deals — IBM manages the platform.",
  },
  {
    key: "SaaSGov",
    label: "Turbonomic SaaS — Government / FedRAMP",
    pricing: "$23.50/MVS/month (D11Q7ZX) — list price, standard discounting applies",
    summary: "FedRAMP-authorized IBM-hosted deployment for US government and regulated public sector.",
    includes: [
      "All SaaS Commercial features",
      "FedRAMP authorized environment",
      "US government compliance posture",
    ],
    bestFor: "Federal, state, or local government; FedRAMP-required environments.",
  },
  {
    key: "OnPrem",
    label: "Turbonomic On-Premises (PID 5737-N29)",
    pricing: "D28FALL $21.15/MVS/month (subscription) · D28F9LL $56.90/MVS/month (monthly) · D28F7LL $1,270/MVS/year (perpetual — federal only)",
    summary: "Self-hosted on customer Kubernetes or data center. Billing metric: MVS/month (NOT VPC). Same MVS counting rules as SaaS.",
    includes: [
      "All SaaS features",
      "Full control over data and deployment",
      "Customer-managed upgrades",
      "Linux on IBM Z variants available at same prices (L0 approval required)",
    ],
    bestFor: "Air-gapped, regulated, or sovereignty-sensitive environments.",
  },
  {
    key: "Parking",
    label: "Turbonomic Parking Edition (D177KZX)",
    pricing: "D177KZX $6.26/MVS pay-as-you-go (no minimum)",
    summary: "Purpose-built for reducing cloud costs by automatically parking idle non-production workloads.",
    includes: [
      "Automated workload parking schedules (start/stop)",
      "AWS, Azure, and GCP support",
      "Streamlined SaaS experience",
    ],
    bestFor: "Entry-level FinOps motion or quick win for cloud cost reduction.",
  },
  {
    key: "Hosting",
    label: "Turbonomic Hosting Edition (PID 5900-B74)",
    pricing: "D0HE7ZX $53,040/instance/year — On-Prem to SaaS migration only, no discounts",
    summary: "Migration path for existing On-Prem customers moving to Turbonomic SaaS. Strict eligibility rules.",
    includes: [
      "IBM-hosted Turbonomic instance (same as SaaS)",
      "Migration assistance from On-Prem deployment",
      "Can combine with standard SaaS parts to expand entitlement",
    ],
    bestFor: "Existing On-Prem customers migrating to SaaS. NOT for new logos.",
  },
];

// ─── Confirmed part numbers ───────────────────────────────────────────────────

export interface TurbonomicPart {
  part: string;
  description: string;
  listPricePerUnit: number;
  unit: string;
  notes: string;
}

export const TURBONOMIC_PARTS: TurbonomicPart[] = [
  // ── SaaS — Commercial ─────────────────────────────────────────────────────
  {
    part: "D09ECZX",
    description: "IBM Turbonomic per Managed Virtual Server (Commercial SaaS)",
    listPricePerUnit: 18.80,
    unit: "per MVS per month",
    notes: "Commercial SaaS (PID 5900-AP1). No discount at 50–199 MVS; 30% at 200–499; 40% at 500–999 (WW SL); 50% at 1,000+ (WW SL). Discount includes channel margin.",
  },
  {
    part: "D09EDZX",
    description: "IBM Turbonomic per MVS Overage (Commercial SaaS)",
    listPricePerUnit: 22.60,
    unit: "per MVS per month",
    notes: "Required on every SaaS quote. Overage billing NOT currently active — SAPcc onboarding on hold indefinitely.",
  },
  {
    part: "D09EEZX",
    description: "IBM Turbonomic SVC Level Agreement (Commercial SaaS / Monitored Costs)",
    listPricePerUnit: 0,
    unit: "included",
    notes: "Always include on commercial SaaS and Monitored Costs quotes. $0.00.",
  },
  // ── SaaS — Government / FedRAMP ───────────────────────────────────────────
  {
    part: "D11Q7ZX",
    description: "IBM Turbonomic For Government Standard MVS/month (FedRAMP)",
    listPricePerUnit: 23.50,
    unit: "per MVS per month",
    notes: "Government / FedRAMP rate only (PID 5900-AP1). No discount at 0–199 MVS; 25% at 200–499; 35% at 500–999 (WW SL); 45% at 1,000+ (WW SL).",
  },
  {
    part: "D11Q8ZX",
    description: "IBM Turbonomic Government MVS Overage (FedRAMP)",
    listPricePerUnit: 28.20,
    unit: "per MVS per month",
    notes: "Required on every gov SaaS quote. Overage billing NOT currently active — SAPcc on hold indefinitely.",
  },
  {
    part: "D14IUZX",
    description: "IBM Turbonomic SVC Level Agreement (Government SaaS)",
    listPricePerUnit: 0,
    unit: "included",
    notes: "Always include on government SaaS quotes. $0.00.",
  },
  {
    part: "E126EZX",
    description: "IBM Turbonomic For Government — US In-Country Support",
    listPricePerUnit: 9.40,
    unit: "per MVS per month",
    notes: "Optional In-Country Support add-on for US government accounts.",
  },
  {
    part: "E11Q9ZX",
    description: "IBM Turbonomic For Government — Advanced Support",
    listPricePerUnit: 3.53,
    unit: "per MVS per month",
    notes: "Optional Advanced Support tier for government accounts.",
  },
  // ── Monitored Costs (cloud-spend scoping) ─────────────────────────────────
  {
    part: "D0I0GZX",
    description: "IBM Turbonomic Standard Monitored Costs per Annum License",
    listPricePerUnit: 0, // tiered — see TURBONOMIC_MONITORED_COSTS_TIERS
    unit: "per $100K cloud spend per year",
    notes: "Tiered pricing. Min 16 units ($1.6M+ cloud spend). See TURBONOMIC_MONITORED_COSTS_TIERS. Use when customer knows cloud spend but not MVS count.",
  },
  {
    part: "D0I0HZX",
    description: "IBM Turbonomic Standard Monitored Costs per Annum Overage",
    listPricePerUnit: 0, // tiered
    unit: "per $100K cloud spend per year",
    notes: "Overage for Monitored Costs path. Tiered pricing matches D0I0GZX.",
  },
  // ── Parking Edition ───────────────────────────────────────────────────────
  {
    part: "D177KZX",
    description: "IBM Turbonomic Parking Edition — Pay-as-you-go",
    listPricePerUnit: 6.26,
    unit: "per MVS",
    notes: "PID 5900-AP1. No minimum order quantity. Cloud workload parking (start/stop schedules) only. AWS/Azure/GCP.",
  },
  // ── Hosting Edition ───────────────────────────────────────────────────────
  {
    part: "D0HE7ZX",
    description: "IBM Turbonomic Hosting per Instance License (12 months)",
    listPricePerUnit: 53040,
    unit: "per instance per year",
    notes: "PID 5900-B74. ONLY for existing On-Prem customers migrating to SaaS. Max 1 instance; no discounts; min 3-month term; cannot hold On-Prem licence simultaneously.",
  },
  {
    part: "D0HE8ZX",
    description: "IBM Turbonomic Hosting SLA",
    listPricePerUnit: 0,
    unit: "included",
    notes: "Always include with D0HE7ZX. $0.00.",
  },
  // ── On-Premises (PID 5737-N29) — billing metric: MVS/month ───────────────
  {
    part: "D28FALL",
    description: "IBM Turbonomic On-Premises — Subscription License",
    listPricePerUnit: 21.15,
    unit: "per MVS per month",
    notes: "On-prem subscription (PID 5737-N29). MVS counting same as SaaS. Linux on Z equivalent: D0A65ZX.",
  },
  {
    part: "D28F9LL",
    description: "IBM Turbonomic On-Premises — Monthly License",
    listPricePerUnit: 56.90,
    unit: "per MVS per month",
    notes: "On-prem monthly. Linux on Z equivalent: D0A64ZX.",
  },
  {
    part: "D28F7LL",
    description: "IBM Turbonomic On-Premises — Perpetual + S&S 12mo (Restricted)",
    listPricePerUnit: 1270,
    unit: "per MVS per year",
    notes: "Perpetual is restricted — federal accounts only. Position subscription (D28FALL) for all others. Linux on Z: D0A63ZX.",
  },
  {
    part: "E0R28LL",
    description: "IBM Turbonomic On-Premises — Annual S&S Renewal",
    listPricePerUnit: 254,
    unit: "per MVS per year",
    notes: "Annual S&S renewal for D28F7LL perpetual. Linux on Z: E0A62ZX.",
  },
  {
    part: "D28F8LL",
    description: "IBM Turbonomic On-Premises — S&S Reinstatement 12mo",
    listPricePerUnit: 763,
    unit: "per MVS per year",
    notes: "Reinstatement of lapsed S&S. Linux on Z: D0A66ZX.",
  },
  // ── Professional Services ─────────────────────────────────────────────────
  {
    part: "D0G8DZX",
    description: "Turbonomic Install (Professional Services)",
    listPricePerUnit: 9700,
    unit: "one-time",
    notes: "Include on every new SaaS deployment. Standard implementation: connectivity, initial policy setup, user onboarding.",
  },
  {
    part: "D08YVZX",
    description: "Turbonomic Build SaaS (Professional Services)",
    listPricePerUnit: 40560,
    unit: "one-time",
    notes: "Complex environments: multi-cloud, large K8s, custom SLO policies, data center secure connect.",
  },
  {
    part: "D08YYZX",
    description: "Turbonomic Perform SaaS (Professional Services)",
    listPricePerUnit: 9700,
    unit: "one-time",
    notes: "Post-deployment performance optimization and tuning. Maximize ROI 30–90 days post go-live.",
  },
];

// ─── Discount approval thresholds ────────────────────────────────────────────
// Source: IBM Turbonomic Pricing and Sizing Guide 2026 (Seismic, Jul 28 2026)
// Commercial SaaS (D09ECZX) — discount includes channel margin
// Government SaaS (D11Q7ZX) — separate, lower limits

export interface TurbonomicDiscountTier {
  minMVS: number;
  maxMVS: number | null; // null = unlimited
  maxPct: number;
  approval: string;
}

export const TURBONOMIC_DISCOUNT_TIERS_COMMERCIAL: TurbonomicDiscountTier[] = [
  { minMVS: 50,   maxMVS: 199,  maxPct: 0,  approval: "No discount allowed at this tier" },
  { minMVS: 200,  maxMVS: 499,  maxPct: 30, approval: "Self-approve (rep only)" },
  { minMVS: 500,  maxMVS: 999,  maxPct: 40, approval: "WW Sales Leader approval required" },
  { minMVS: 1000, maxMVS: null, maxPct: 50, approval: "WW Sales Leader approval required" },
];

export const TURBONOMIC_DISCOUNT_TIERS_GOVERNMENT: TurbonomicDiscountTier[] = [
  { minMVS: 0,    maxMVS: 199,  maxPct: 0,  approval: "No discount allowed at this tier" },
  { minMVS: 200,  maxMVS: 499,  maxPct: 25, approval: "Self-approve (rep only)" },
  { minMVS: 500,  maxMVS: 999,  maxPct: 35, approval: "WW Sales Leader approval required" },
  { minMVS: 1000, maxMVS: null, maxPct: 45, approval: "WW Sales Leader approval required" },
];

/** Returns the applicable discount tier for a given MVS count. */
export function getTurbonomicDiscountTier(
  mvs: number,
  isGovernment: boolean
): TurbonomicDiscountTier {
  const tiers = isGovernment
    ? TURBONOMIC_DISCOUNT_TIERS_GOVERNMENT
    : TURBONOMIC_DISCOUNT_TIERS_COMMERCIAL;
  return (
    tiers.find((t) => mvs >= t.minMVS && (t.maxMVS === null || mvs <= t.maxMVS)) ??
    tiers[tiers.length - 1]
  );
}

// ─── Monitored Costs tiered pricing ──────────────────────────────────────────
// Source: IBM Turbonomic Pricing and Sizing Guide 2026 (Seismic, Jul 28 2026)
// 1 unit = $100,000 USD of annual cloud spend. Min order: 16 units.

export interface MonitoredCostsTier {
  minUnits: number;
  maxUnits: number | null;
  monthlyPerUnit: number;
  annualPerUnit: number;
  cloudSpendMin: number;  // USD
  cloudSpendMax: number | null;
}

export const TURBONOMIC_MONITORED_COSTS_TIERS: MonitoredCostsTier[] = [
  { minUnits: 1,    maxUnits: 25,   monthlyPerUnit: 250.00, annualPerUnit: 3000.00, cloudSpendMin: 1_600_000,   cloudSpendMax: 2_500_000   },
  { minUnits: 26,   maxUnits: 50,   monthlyPerUnit: 213.00, annualPerUnit: 2556.00, cloudSpendMin: 2_500_001,   cloudSpendMax: 5_000_000   },
  { minUnits: 51,   maxUnits: 75,   monthlyPerUnit: 184.00, annualPerUnit: 2208.00, cloudSpendMin: 5_000_001,   cloudSpendMax: 7_500_000   },
  { minUnits: 76,   maxUnits: 100,  monthlyPerUnit: 159.00, annualPerUnit: 1908.00, cloudSpendMin: 7_500_001,   cloudSpendMax: 10_000_000  },
  { minUnits: 101,  maxUnits: 150,  monthlyPerUnit: 134.00, annualPerUnit: 1608.00, cloudSpendMin: 10_000_001,  cloudSpendMax: 15_000_000  },
  { minUnits: 151,  maxUnits: 200,  monthlyPerUnit: 113.00, annualPerUnit: 1356.00, cloudSpendMin: 15_000_001,  cloudSpendMax: 20_000_000  },
  { minUnits: 201,  maxUnits: 250,  monthlyPerUnit: 107.00, annualPerUnit: 1284.00, cloudSpendMin: 20_000_001,  cloudSpendMax: 25_000_000  },
  { minUnits: 251,  maxUnits: 300,  monthlyPerUnit: 100.00, annualPerUnit: 1200.00, cloudSpendMin: 25_000_001,  cloudSpendMax: 30_000_000  },
  { minUnits: 301,  maxUnits: 400,  monthlyPerUnit:  91.70, annualPerUnit: 1100.40, cloudSpendMin: 30_000_001,  cloudSpendMax: 40_000_000  },
  { minUnits: 401,  maxUnits: 500,  monthlyPerUnit:  84.20, annualPerUnit: 1010.40, cloudSpendMin: 40_000_001,  cloudSpendMax: 50_000_000  },
  { minUnits: 501,  maxUnits: 750,  monthlyPerUnit:  81.70, annualPerUnit:  980.40, cloudSpendMin: 50_000_001,  cloudSpendMax: 75_000_000  },
  { minUnits: 751,  maxUnits: 1000, monthlyPerUnit:  79.20, annualPerUnit:  950.40, cloudSpendMin: 75_000_001,  cloudSpendMax: 100_000_000 },
  { minUnits: 1001, maxUnits: 1500, monthlyPerUnit:  75.00, annualPerUnit:  900.00, cloudSpendMin: 100_000_001, cloudSpendMax: 150_000_000 },
  { minUnits: 1501, maxUnits: 2000, monthlyPerUnit:  73.40, annualPerUnit:  880.80, cloudSpendMin: 150_000_001, cloudSpendMax: 200_000_000 },
  { minUnits: 2001, maxUnits: null, monthlyPerUnit:  70.90, annualPerUnit:  850.80, cloudSpendMin: 200_000_001, cloudSpendMax: null        },
];

/** Minimum cloud spend to use Monitored Costs path: 16 units × $100K = $1.6M */
export const TURBONOMIC_MONITORED_COSTS_MIN_UNITS = 16;
export const TURBONOMIC_MONITORED_COSTS_UNIT_SIZE = 100_000; // $100K per unit

/**
 * Compute Monitored Costs quote for a given annual cloud spend.
 * Returns null if spend is below the minimum (< $1,600,000).
 */
export function computeMonitoredCosts(annualCloudSpend: number): {
  units: number;
  tier: MonitoredCostsTier;
  annualList: number;
  monthlyList: number;
} | null {
  const units = Math.ceil(annualCloudSpend / TURBONOMIC_MONITORED_COSTS_UNIT_SIZE);
  if (units < TURBONOMIC_MONITORED_COSTS_MIN_UNITS) return null;

  // Find the tier — units may span multiple tiers; use the highest applicable tier
  // (same-tier pricing applies to all units at that quantity level)
  const tier = TURBONOMIC_MONITORED_COSTS_TIERS.find(
    (t) => units >= t.minUnits && (t.maxUnits === null || units <= t.maxUnits)
  ) ?? TURBONOMIC_MONITORED_COSTS_TIERS[TURBONOMIC_MONITORED_COSTS_TIERS.length - 1];

  const annualList = Math.round(units * tier.annualPerUnit * 100) / 100;
  const monthlyList = Math.round((annualList / 12) * 100) / 100;

  return { units, tier, annualList, monthlyList };
}

// ─── Seller value story: Turbonomic + Instana cross-sell ─────────────────────
export const TURBONOMIC_INSTANA_VALUE_POINTS = [
  "Turbonomic optimizes resources at the infrastructure and application layer; when Instana feeds it real-time APM data, the optimization decisions become application-aware rather than infrastructure-only.",
  "IBM confirmed: automated Turbonomic SaaS integration launches directly from Instana's 'Optimizations' tab — zero manual configuration when both products are under the same account.",
  "Sidekick integration: Turbonomic users see Instana performance metrics inline. Instana users see Turbonomic resource actions inline. One UI, two products' worth of insight.",
  "Without observability, Turbonomic can right-size VMs but cannot see application SLO impact. With Instana, actions are correlated to user experience, reducing the risk of over-aggressive resource reduction.",
  "The combined story is 'see everything with Instana, act on it intelligently with Turbonomic' — moving customers from manual analysis to AI-driven autonomous operations.",
];

// ─── Best practices snippets ─────────────────────────────────────────────────
export const TURBONOMIC_BEST_PRACTICES = [
  {
    title: "Commercial vs Government rate — confirm account type first",
    body: "Most commercial accounts use D09ECZX at $18.80/MVS/month. The D11Q7ZX rate ($23.50/MVS/month) is the FedRAMP/Government SKU only. Commercial max discount is 50% (1,000+ MVS); government max is 45%. No discounts below 200 MVS on either track.",
  },
  {
    title: "MVS scoping — use Instana inventory as the baseline",
    body: "Turbonomic is billed per Managed Virtual Server (MVS) per month — the same metric as Instana. If Instana is already in the deal, the Instana MVS count IS the Turbonomic scope. No separate infrastructure discovery needed. Commercial list: $18.80/MVS/month (D09ECZX).",
  },
  {
    title: "Monitored Costs (D0I0GZX) — for cloud-spend scoping",
    body: "When the customer knows their annual cloud bill but not their MVS count, use the Monitored Costs path (D0I0GZX). 1 unit = $100K cloud spend. Min 16 units ($1.6M+ cloud spend). Tiered pricing from $3,000/unit/yr (≤25 units) down to $850.80/unit/yr (2,001+ units). ROI anchor: 20% cloud savings typically exceeds the Turbonomic cost by 5–10×.",
  },
  {
    title: "Always add professional services to the quote",
    body: "Include D0G8DZX (Install, $9,700) on every new SaaS deployment. For complex environments, add D08YVZX (Build SaaS, $40,560). Services drive faster time-to-value and reduce churn risk.",
  },
  {
    title: "Instana integration: automated, not just supported",
    body: "Turbonomic automated SaaS integration requires 200+ MVS Instana Standard SaaS. One-click setup from the Instana Optimizations tab. Sidekick puts both UIs' key data in a unified sidebar. Position this as: IBM built the integration natively — not a manual connector.",
  },
  {
    title: "Perpetual On-Prem is restricted — federal customers only",
    body: "The Perpetual part (D28F7LL) is restricted and should only be offered to federal customers with explicit pushback. Position the Subscription (D28FALL, $21.15/MVS/month) for all other On-Prem deals.",
  },
  {
    title: "Overage billing is NOT currently active",
    body: "Overage parts (D09EDZX for commercial, D11Q8ZX for government) are required on every SaaS quote but IBM is not currently billing customers for overage consumption — SAPcc onboarding has been put on hold indefinitely. Include the parts at $0 and do not charge for them in customer conversations.",
  },
];

export const TURBONOMIC_QUICK_REFERENCE = [
  { term: "ARM", definition: "Application Resource Management — Turbonomic's core capability for continuous workload optimization." },
  { term: "MVS counting rules", definition: "1 physical server = 1 MVS · 1 VM = 1 MVS · 1 K8s worker node = 1 MVS. Pods/containers do NOT count. OCP Virtualization: count VMs. OCP containers: count nodes. Same metric as Instana." },
  { term: "D09ECZX", definition: "Commercial SaaS: $18.80/MVS/month list. 0% discount at 50–199 MVS; 30% self-approve at 200–499; 40% at 500–999 (WW SL); 50% at 1,000+ (WW SL). Includes channel margin." },
  { term: "D09EDZX", definition: "Commercial SaaS overage: $22.60/MVS/month. Required on every SaaS quote. Overage billing NOT currently active (SAPcc on hold)." },
  { term: "D11Q7ZX", definition: "Government/FedRAMP SaaS: $23.50/MVS/month. 0% at 0–199; 25% at 200–499; 35% at 500–999 (WW SL); 45% at 1,000+ (WW SL). PID 5900-AP1." },
  { term: "D0I0GZX", definition: "Monitored Costs license: tiered per $100K cloud spend/yr. Min 16 units ($1.6M+ cloud spend). Use when customer knows cloud bill not MVS count." },
  { term: "D28FALL", definition: "On-Premises subscription: $21.15/MVS/month. PID 5737-N29. Billing metric: MVS/month (NOT VPC). Default on-prem part — position over perpetual." },
  { term: "D177KZX", definition: "Parking Edition: $6.26/MVS pay-as-you-go. No minimum. Cloud workload parking only (AWS/Azure/GCP)." },
  { term: "D0HE7ZX", definition: "Hosting Edition: $53,040/instance/year. On-Prem to SaaS migration ONLY. 1 instance max. No discounts. PID 5900-B74." },
  { term: "D0G8DZX / D08YVZX", definition: "Professional services: Install ($9,700) and Build SaaS ($40,560). Include on every new SaaS deployment." },
];

// ─── Deal assist contacts ─────────────────────────────────────────────────────
export const TURBONOMIC_DEAL_ASSIST = {
  americas: { email: "TurbonomicAmericas-DealAssist@IBM.com", contact: "Tushar Bajaj", contactEmail: "tbajaj@us.ibm.com" },
  emea:     { email: "TurbonomicEMEA-DealAssist@IBM.com",    contact: "Joe Ashton",   contactEmail: "Joseph.Ashton@ibm.com" },
  apac:     { email: "TurbonomicAPAC-DealAssist@IBM.com",    contact: "Mark Jones",   contactEmail: "marjones@au1.ibm.com" },
  japan:    { email: "TurbonomicJapan-DealAssist@IBM.com",   contact: "Masa Kawano",  contactEmail: "Masa.Kawano@ibm.com" },
  worldwide:{ email: "N/A",                                  contact: "Sean Almeida", contactEmail: "sean.almeida@us.ibm.com" },
};
