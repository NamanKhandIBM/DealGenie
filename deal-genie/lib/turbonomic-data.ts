/**
 * IBM Turbonomic — data module
 *
 * IBM Turbonomic Application Resource Management (ARM).
 * Product: automates workload placement and resource optimization across hybrid cloud,
 * data center, Kubernetes, and public cloud (AWS, Azure, GCP).
 *
 * CONFIRMED PRICING (IBM CPQ / Seismic "IBM Turbonomic Pricing and Sizing Guide - 2026", Jul 9, 2026):
 *  Billing metric: Managed Virtual Server (MVS) per month — same unit as Instana.
 *
 *  MVS counting rules ("3 Rules of MVS"):
 *   1. Physical (non-virtualized) machines: 1 machine = 1 MVS
 *   2. Virtualized: 1 VM = 1 MVS (not the underlying host)
 *   3. Kubernetes / RHOCP: 1 worker NODE = 1 MVS (not pods/containers)
 *   → Hypervisor, Container/K8s, and cloud targets share the same MVS metric.
 *     No separate Container Edition SKU exists.
 *
 *  COMMERCIAL SaaS (PID 5737-N28 — D09ECZX):
 *   D09ECZX  IBM Turbonomic per MVS Committed Term License  $18.80/MVS/month
 *   Overage: $22.60/MVS/month
 *
 *  GOVERNMENT SaaS — FedRAMP (PID 5900-AP1 — D11Q7ZX):
 *   D11Q7ZX  IBM Turbonomic For Government Standard MVS/month  $23.50/MVS/month
 *   D11Q8ZX  Overage                                           $28.20/MVS/month
 *
 *  ON-PREMISES (PID 5737-N29 — billing metric: MVS, NOT VPC/socket):
 *   D28FALL  Subscription License               $21.15/MVS/month
 *   D28F9LL  Monthly License                    $56.90/MVS/month
 *   D28F7LL  Perpetual + S&S 12mo (Restricted)  $1,270.00/MVS/year
 *   E0R28LL  Annual S&S Renewal                 $254.00/MVS/year
 *   D28F8LL  S&S Reinstatement 12mo             $763.00/MVS/year
 *   Linux on Z equivalents: D0A65ZX / D0A64ZX / D0A63ZX / E0A62ZX / D0A66ZX (same prices)
 *
 *  PARKING EDITION (PID 5900-AP1):
 *   D177KZX  Pay-as-you-go per MVS  $6.26/MVS (no minimum order quantity)
 *
 *  ESSENTIALS EDITION:
 *   $50,000 / instance / year (1 instance = public cloud up to $2M annual spend)
 *
 *  Professional Services (list price, always include on new SaaS deployments):
 *   D0G8DZX  Install      $9,700 one-time
 *   D08YVZX  Build SaaS   $40,560 one-time
 *   D08YYZX  Perform SaaS $9,700 one-time
 *
 *  Discount approval thresholds (Turbonomic Pricing and Sizing Guide - 2026):
 *   ≤29% discount: self-approve
 *   30–49% discount: manager approval
 *   50%+: WW Sales Leader approval required
 *   (These apply at the 200–499 MVS quantity tier; thresholds may vary by tier)
 *
 *  Standard IBM discounting applies on top of list prices.
 *
 * Key integration: Instana → Turbonomic
 *  Instana observability data feeds Turbonomic's AI engine, enabling application-aware
 *  resource management decisions rather than infrastructure-only optimization.
 */

// ─── Deployment models ────────────────────────────────────────────────────────

export type TurbonomicDeployment = "SaaS" | "SaaSGov" | "OnPrem" | "Parking";

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
    pricing: "D28FALL $21.15/MVS/month (subscription) · D28F9LL $56.90/MVS/month (monthly) · D28F7LL $1,270/MVS/year (perpetual+S&S)",
    summary: "Self-hosted on customer Kubernetes or data center. Billing metric: MVS/month (NOT VPC). Same MVS counting rules as SaaS.",
    includes: [
      "All SaaS features",
      "Full control over data and deployment",
      "Customer-managed upgrades",
      "Linux on IBM Z variants available at same prices",
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
    notes: "Commercial/standard SaaS. Self-approve ≤29% discount; 30–49% requires manager; 50%+ WW Sales Leader.",
  },
  {
    part: "D09ECZX-OVG",
    description: "IBM Turbonomic MVS Overage (Commercial SaaS)",
    listPricePerUnit: 22.60,
    unit: "per MVS per month",
    notes: "Applied when actual MVS consumption exceeds committed quantity.",
  },
  // ── SaaS — Government / FedRAMP ───────────────────────────────────────────
  {
    part: "D11Q7ZX",
    description: "IBM Turbonomic For Government Standard MVS/month (FedRAMP)",
    listPricePerUnit: 23.50,
    unit: "per MVS per month",
    notes: "Government / FedRAMP rate only (PID 5900-AP1). Use D09ECZX for commercial accounts.",
  },
  {
    part: "D11Q8ZX",
    description: "IBM Turbonomic Government MVS Overage (FedRAMP)",
    listPricePerUnit: 28.20,
    unit: "per MVS per month",
    notes: "Government overage. Use only with D11Q7ZX government accounts.",
  },
  // ── On-Premises (PID 5737-N29) — billing metric: MVS/month ───────────────
  {
    part: "D28FALL",
    description: "IBM Turbonomic On-Premises — Subscription License",
    listPricePerUnit: 21.15,
    unit: "per MVS per month",
    notes: "On-prem subscription. MVS counting same as SaaS. Linux on Z equivalent: D0A65ZX.",
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
    notes: "Perpetual license + 12-month S&S. Linux on Z equivalent: D0A63ZX.",
  },
  {
    part: "E0R28LL",
    description: "IBM Turbonomic On-Premises — Annual S&S Renewal",
    listPricePerUnit: 254,
    unit: "per MVS per year",
    notes: "Annual software subscription & support renewal for D28F7LL perpetual. Linux on Z: E0A62ZX.",
  },
  {
    part: "D28F8LL",
    description: "IBM Turbonomic On-Premises — S&S Reinstatement 12mo",
    listPricePerUnit: 763,
    unit: "per MVS per year",
    notes: "Reinstatement of lapsed S&S. Linux on Z equivalent: D0A66ZX.",
  },
  // ── Parking Edition ───────────────────────────────────────────────────────
  {
    part: "D177KZX",
    description: "IBM Turbonomic Parking Edition — Pay-as-you-go",
    listPricePerUnit: 6.26,
    unit: "per MVS",
    notes: "PID 5900-AP1. No minimum order quantity. Cloud workload parking (start/stop schedules) only.",
  },
  // ── Professional Services ─────────────────────────────────────────────────
  {
    part: "D0G8DZX",
    description: "Turbonomic Install (Professional Services)",
    listPricePerUnit: 9700,
    unit: "one-time",
    notes: "Standard implementation service. Recommend on all new SaaS deployments.",
  },
  {
    part: "D08YVZX",
    description: "Turbonomic Build SaaS (Professional Services)",
    listPricePerUnit: 40560,
    unit: "one-time",
    notes: "Full build and configuration service for complex SaaS deployments.",
  },
  {
    part: "D08YYZX",
    description: "Turbonomic Perform SaaS (Professional Services)",
    listPricePerUnit: 9700,
    unit: "one-time",
    notes: "Performance optimization and tuning service post-deployment.",
  },
];

// ─── Discount approval thresholds ────────────────────────────────────────────
// Source: IBM Turbonomic Pricing and Sizing Guide - 2026 (Jul 9, 2026)

export const TURBONOMIC_DISCOUNT_THRESHOLDS = {
  selfApprove:    { maxPct: 29,  label: "Self-approve (rep only)" },
  managerApprove: { maxPct: 49,  label: "Manager approval required" },
  execApprove:    { maxPct: 100, label: "WW Sales Leader approval required" },
};

// ─── Essentials edition ───────────────────────────────────────────────────────

/** $50,000 / instance / year. 1 instance = up to $2M annual cloud spend. */
export const TURBONOMIC_ESSENTIALS_PRICE_PER_INSTANCE = 50000;
export const TURBONOMIC_ESSENTIALS_CLOUD_SPEND_PER_INSTANCE = 2_000_000;

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
    title: "Commercial vs Government rate — confirm first",
    body: "Most commercial accounts use D09ECZX at $18.80/MVS/month. The D11Q7ZX rate ($23.50/MVS/month) is the FedRAMP/Government SKU only. Always confirm account type before quoting to avoid misquoting.",
  },
  {
    title: "Scope with MVS count — use Instana inventory as the baseline",
    body: "Turbonomic is billed per Managed Virtual Server (MVS) per month — the same metric as Instana. If Instana is already in the deal, the Instana MVS count IS the Turbonomic scope. Commercial list: $18.80/MVS/month (D09ECZX).",
  },
  {
    title: "Essentials edition for pure FinOps / cloud-spend reduction",
    body: "$50,000/instance/year where each instance covers up to $2M in annual cloud spend. Best for customers with a clear FinOps budget driver who know their cloud spend figure.",
  },
  {
    title: "Always add professional services to the quote",
    body: "Include D0G8DZX (Install, $9,700) on every new SaaS deployment. For complex environments, include D08YVZX (Build SaaS, $40,560). Services drive faster time-to-value and reduce churn risk.",
  },
  {
    title: "Instana integration: automated, not just supported",
    body: "Turbonomic automated SaaS integration requires 200+ MVS Instana Standard SaaS. One-click setup from Instana Optimizations tab. Sidekick puts both UIs' key data in a unified sidebar. Position this as: IBM built the integration natively — it is not a manual connector.",
  },
];

export const TURBONOMIC_QUICK_REFERENCE = [
  { term: "ARM", definition: "Application Resource Management — Turbonomic's core capability for continuous workload optimization." },
  { term: "MVS (counting rules)", definition: "1 physical server = 1 MVS · 1 VM = 1 MVS · 1 K8s worker node = 1 MVS. Containers/pods do NOT add to count. Same metric as Instana." },
  { term: "D09ECZX", definition: "Commercial SaaS: $18.80/MVS/month list. Self-approve ≤29% discount; >29% needs manager." },
  { term: "D11Q7ZX", definition: "Government/FedRAMP SaaS: $23.50/MVS/month list. Only for government accounts (PID 5900-AP1)." },
  { term: "D28FALL", definition: "On-Premises subscription: $21.15/MVS/month. PID 5737-N29. Billing: MVS/month (not VPC)." },
  { term: "D28F9LL", definition: "On-Premises monthly: $56.90/MVS/month. Use for month-to-month on-prem deals." },
  { term: "D177KZX", definition: "Parking Edition: $6.26/MVS pay-as-you-go. No minimum. Cloud workload parking only." },
  { term: "Essentials edition", definition: "$50,000/instance/year. 1 instance covers up to $2M annual cloud spend." },
  { term: "D0G8DZX / D08YVZX", definition: "Professional services: Install ($9,700) and Build SaaS ($40,560). Include on every new deployment." },
  { term: "Discount thresholds", definition: "≤29% self-approve · 30–49% manager approval · 50%+ WW Sales Leader approval." },
];
