/**
 * IBM Instana Observability — data module
 *
 * Pricing sourced from ibm.com/products/instana/pricing (July 2026 public list).
 * Metric: Managed Virtual Server (MVS) = one monitored host.
 *
 * Three purchase models:
 *  PayPerUse  — $0.03 USD/MVS/hour — no commitment, cancel anytime — no add-ons
 *  SaaS       — $21.20 USD/MVS/month starting (Essentials or Standard tier) — add-ons available
 *  SelfHosted — $1,440 USD/month starting — annual subscription — self-managed
 *
 * Tiers within SaaS:
 *  Essentials — infrastructure monitoring only
 *  Standard   — full-stack observability (APM, traces, synthetic, LLM observability, etc.)
 *
 * Add-ons (SaaS only):
 *  Managed PoPs  — synthetic test execution from managed PoPs — starts $0.00031/execution
 *  Logs in context — log ingestion with 30/60/90 day retention — starts $0.351/GB
 */

// ─── Pricing constants ────────────────────────────────────────────────────────

/** PayPerUse: USD per MVS per hour */
export const INSTANA_PPU_PRICE_PER_MVS_HOUR = 0.03;
/** SaaS starting price: USD per MVS per month (Essentials tier) */
export const INSTANA_SAAS_PRICE_PER_MVS_MONTH = 21.20;
/** SelfHosted starting price: USD per month (minimum commitment) */
export const INSTANA_SELFHOSTED_BASE_MONTH = 1440;

export type InstanaPurchaseModel = "PayPerUse" | "SaaS" | "SelfHosted";
export type InstanaTier = "Essentials" | "Standard";

export interface InstanaPlan {
  model: InstanaPurchaseModel;
  label: string;
  baseMonthly: number;
  unit: string;
  commitment: string;
  summary: string;
  includes: string[];
  addOnsAvailable: boolean;
}

export const INSTANA_PLANS: InstanaPlan[] = [
  {
    model: "PayPerUse",
    label: "Pay Per Use",
    baseMonthly: INSTANA_PPU_PRICE_PER_MVS_HOUR * 730, // ~$21.90/MVS/month at 730h
    unit: "$0.03/MVS/hour",
    commitment: "None — cancel anytime",
    summary: "Usage-based — pay only for observed hosts with no time commitment.",
    includes: [
      "Infrastructure or full observability (Essentials or Standard) per MVS",
      "No minimum term",
      "Unlimited users",
      "No add-ons available on this model",
    ],
    addOnsAvailable: false,
  },
  {
    model: "SaaS",
    label: "SaaS (Hosted by IBM)",
    baseMonthly: INSTANA_SAAS_PRICE_PER_MVS_MONTH,
    unit: "$21.20/MVS/month starting",
    commitment: "Flexible billing; annual or term options",
    summary: "IBM-hosted SaaS. Best for scaling teams. Essentials (infra only) or Standard (full-stack).",
    includes: [
      "Essentials or Standard tier per MVS",
      "Unlimited users",
      "No scale limits on hosts",
      "Flexible billing options",
      "Add-ons: Managed PoPs, Logs in context, Data ingestion",
    ],
    addOnsAvailable: true,
  },
  {
    model: "SelfHosted",
    label: "Self-Hosted",
    baseMonthly: INSTANA_SELFHOSTED_BASE_MONTH,
    unit: "$1,440/month starting",
    commitment: "Annual subscription",
    summary: "Customer-run deployment. Full feature parity with SaaS. Full data control.",
    includes: [
      "Essentials or Standard feature parity",
      "Monthly updates",
      "Full control over data and deployment",
      "Logs in context included",
      "Annual subscription required",
    ],
    addOnsAvailable: false,
  },
];

export interface InstanaAddon {
  key: string;
  label: string;
  price: number;
  unit: string;
  summary: string;
}

export const INSTANA_ADDONS: InstanaAddon[] = [
  {
    key: "managedPoPs",
    label: "Managed PoPs (Synthetic Tests)",
    price: 0.00031,
    unit: "per synthetic test execution",
    summary: "Execute synthetic tests from multiple IBM-managed global PoPs.",
  },
  {
    key: "logsInContext",
    label: "Logs in Context",
    price: 0.351,
    unit: "per GB ingested",
    summary: "Ingest logs from any source with 30, 60, or 90-day retention options.",
  },
];

// ─── Seller value story: Instana + Turbonomic cross-sell ─────────────────────
export const INSTANA_TURBONOMIC_VALUE_POINTS = [
  "Instana provides real-time observability and traces; Turbonomic uses that data to automate resource optimization actions, closing the loop from visibility to action.",
  "IBM Docs confirmed: Turbonomic automated integration requires minimum 200 MVS (Instana Standard SaaS). Both under the same IBM account enables one-click setup from the Instana 'Optimizations' tab — no manual configuration.",
  "Sidekick integration: Instana users see Turbonomic resource action recommendations in a sidebar without switching tools. Turbonomic users see Instana performance metrics in the same sidebar.",
  "Pairing full-stack observability with AI-driven resource management eliminates the manual analysis step between 'we see the problem' and 'we fixed the resource.'",
  "Customers can move from reactive fire-fighting to proactive performance assurance across cloud, Kubernetes, and data centers.",
];

// ─── Seller value story: Instana + Concert cross-sell ────────────────────────
export const INSTANA_CONCERT_VALUE_POINTS = [
  "Instana delivers high-fidelity telemetry and distributed traces; Concert ingests those signals alongside cost, risk, and change data to generate business-impact context.",
  "Concert Observe and Concert Protect are both architected on Instana agents — customers buying Concert who don't have Instana get lower-fidelity data from less capable sources. Instana is the recommended data source for Concert.",
  "Automated Concert integration: when Instana SaaS detects Concert under the same account, it auto-imports application components, Kubernetes clusters, and container images — eliminating SBOM file uploads.",
  "Concert elevates Instana signals from 'there is an alert' to 'this issue has high blast radius and should be prioritized' — reducing noise and accelerating triage.",
  "Together, they create a continuum from real-time observability (Instana) to strategic operational intelligence and AI-driven remediation (Concert).",
];

// ─── Best practices snippets ─────────────────────────────────────────────────
export const INSTANA_BEST_PRACTICES = [
  {
    title: "Lead with the MVS metric",
    body: "Every monitored host = 1 MVS. Count VMs, bare-metal servers, and nodes (Kubernetes worker nodes each count as 1 MVS). Containers on the same node do NOT add to MVS count.",
  },
  {
    title: "SaaS vs. Self-Hosted decision",
    body: "Recommend SaaS for most customers — IBM manages upgrades and infrastructure. Self-Hosted is correct when the customer has data-residency, air-gapped, or sovereignty requirements.",
  },
  {
    title: "Essentials vs. Standard tier",
    body: "Essentials covers infrastructure monitoring only (servers, VMs, Kubernetes). Standard adds full APM, distributed tracing, synthetic monitoring, mobile/website observability, and LLM/GenAI observability. Most APM motions land on Standard.",
  },
  {
    title: "Cross-sell trigger: Turbonomic",
    body: "When the client has Instana for visibility, probe for whether they are acting on those insights manually. If yes, Turbonomic automates resource optimization from those same telemetry feeds.",
  },
  {
    title: "Cross-sell trigger: Concert",
    body: "When the client already collects observability data but struggles to prioritize incidents by business impact, Concert is the next layer—it aggregates cross-domain signals and adds AI-driven risk prioritization.",
  },
];

export const INSTANA_QUICK_REFERENCE = [
  { term: "MVS", definition: "Managed Virtual Server — the billing unit. 1 monitored host = 1 MVS." },
  { term: "Essentials tier", definition: "Infrastructure monitoring only (no APM/traces)." },
  { term: "Standard tier", definition: "Full-stack observability including APM, traces, synthetic, and LLM." },
  { term: "PayPerUse", definition: "$0.03/MVS/hour — no commitment, no add-ons." },
  { term: "SaaS", definition: "From $21.20/MVS/month — IBM-hosted, flexible billing, add-ons available." },
  { term: "Self-Hosted", definition: "From $1,440/month — annual subscription, customer-managed." },
];
