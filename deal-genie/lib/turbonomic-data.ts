/**
 * IBM Turbonomic — data module
 *
 * IBM Turbonomic Application Resource Management (ARM).
 * Product: automates workload placement and resource optimization across hybrid cloud,
 * data center, Kubernetes, and public cloud (AWS, Azure, GCP).
 *
 * CONFIRMED PRICING (IBM CPQ / Seismic "IBM Turbonomic Pricing and Sizing Deck", Jul 9, 2026):
 *  Billing metric: Managed Virtual Server (MVS) per month — same unit as Instana.
 *
 *  COMMERCIAL SaaS (standard / non-government — D09ECZX):
 *   D09ECZX  IBM Turbonomic per MVS Committed Term License  $18.80/MVS/month
 *   Overage: $22.60/MVS/month
 *
 *  GOVERNMENT SaaS — FedRAMP (D11Q7ZX, PID 5900-AP1):
 *   D11Q7ZX  IBM Turbonomic For Government Standard MVS/month  $23.50/MVS/month
 *   D11Q8ZX  Overage                                           $28.20/MVS/month
 *
 *  Essentials edition:
 *   $50,000 / instance / year
 *   1 instance = public cloud resources up to $2M in annual cloud spend
 *
 *  Professional Services (list price, always include on new SaaS deployments):
 *   D0G8DZX  Install      $9,700 one-time
 *   D08YVZX  Build SaaS   $40,560 one-time
 *   D08YYZX  Perform SaaS $9,700 one-time
 *
 *  On-Premises and Parking Edition: contact-for-quote.
 *  Standard IBM discounting applies.
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
    label: "Turbonomic On-Premises",
    pricing: "Contact IBM for pricing — self-hosted",
    summary: "Self-hosted on customer Kubernetes or data center. Same features as SaaS.",
    includes: [
      "All SaaS features",
      "Full control over data and deployment",
      "Customer-managed upgrades",
    ],
    bestFor: "Air-gapped, regulated, or sovereignty-sensitive environments.",
  },
  {
    key: "Parking",
    label: "Turbonomic Parking Edition",
    pricing: "Contact IBM for pricing — cloud parking only",
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
  {
    part: "D09ECZX",
    description: "IBM Turbonomic per Managed Virtual Server (Commercial SaaS)",
    listPricePerUnit: 18.80,
    unit: "per MVS per month",
    notes: "Commercial/standard SaaS rate. Standard discounting applies.",
  },
  {
    part: "D09ECZX-OVG",
    description: "IBM Turbonomic MVS Overage (Commercial SaaS)",
    listPricePerUnit: 22.60,
    unit: "per MVS per month",
    notes: "Applied when actual MVS consumption exceeds committed quantity.",
  },
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
  { term: "MVS", definition: "Managed Virtual Server — the billing unit. 1 MVS = 1 host, VM, or equivalent. Same metric as Instana." },
  { term: "D09ECZX", definition: "Commercial SaaS: $18.80/MVS/month list. Use for all non-government accounts." },
  { term: "D11Q7ZX", definition: "Government/FedRAMP SaaS: $23.50/MVS/month list. Use only for government accounts (PID 5900-AP1)." },
  { term: "Essentials edition", definition: "$50,000/instance/year. 1 instance covers up to $2M annual cloud spend." },
  { term: "D0G8DZX / D08YVZX", definition: "Professional services: Install ($9,700) and Build SaaS ($40,560). Include on every new deployment." },
];
