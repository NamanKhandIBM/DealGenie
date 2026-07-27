/**
 * IBM Instana Observability — data module
 *
 * Pricing sourced from:
 *  - ibm.com/products/instana/pricing (July 2026 public list) — SaaS Essentials + PayPerUse
 *  - "Part Numbers & Pricing - IBM Instana Observability - IBM Sellers & Partners" (Apr 7, 2026)
 *    — SaaS Standard tier, SaaS part numbers, SelfHosted parts and per-MVS pricing
 *
 * Metric: Managed Virtual Server (MVS) = one monitored host.
 * MVS counting rules: 1 physical server = 1 MVS · 1 VM = 1 MVS · 1 K8s worker node = 1 MVS
 * Minimum order: 10 MVS per part number.
 *
 * SaaS tiers:
 *  Essentials (D0N78ZX) — infrastructure monitoring only          — $21.20/MVS/month
 *  Standard   (D0N79ZX) — full-stack APM, traces, synthetic, LLM — $79.50/MVS/month
 *
 * Self-Hosted (on-premises) tiers — billing metric is MVS/month (NOT VPC/socket):
 *  Essentials Self-Hosted (D29RRLL) — $32.10/MVS/month (incl. S&S)
 *  Standard   Self-Hosted (D29RTLL) — $120.00/MVS/month (incl. S&S)
 *  Essentials for Linux on IBM Z (D29RSLL) — $32.10/MVS/month
 *  Standard   for Linux on IBM Z (D29RULL) — $120.00/MVS/month
 *
 * PayPerUse — $0.03/MVS/hour — no commitment, no add-ons.
 *
 * Add-ons (SaaS only):
 *  Managed PoPs  — synthetic test execution — $0.00031/execution
 *  Logs in context — log ingestion — $0.351/GB
 */

// ─── Pricing constants ────────────────────────────────────────────────────────

/** PayPerUse: USD per MVS per hour */
export const INSTANA_PPU_PRICE_PER_MVS_HOUR = 0.03;

/** SaaS Essentials: USD per MVS per month */
export const INSTANA_SAAS_ESSENTIALS_PER_MVS_MONTH = 21.20;
/** SaaS Standard: USD per MVS per month (confirmed Apr 7, 2026 parts deck) */
export const INSTANA_SAAS_STANDARD_PER_MVS_MONTH = 79.50;
/** SaaS starting price alias — Essentials is the entry point */
export const INSTANA_SAAS_PRICE_PER_MVS_MONTH = INSTANA_SAAS_ESSENTIALS_PER_MVS_MONTH;

/** Self-Hosted Essentials: USD per MVS per month (incl. S&S) */
export const INSTANA_SELFHOSTED_ESSENTIALS_PER_MVS_MONTH = 32.10;
/** Self-Hosted Standard: USD per MVS per month (incl. S&S) */
export const INSTANA_SELFHOSTED_STANDARD_PER_MVS_MONTH = 120.00;
/** Self-Hosted starting price alias — Essentials at minimum 10 MVS = $321/mo */
export const INSTANA_SELFHOSTED_BASE_MONTH = INSTANA_SELFHOSTED_ESSENTIALS_PER_MVS_MONTH * 10;

/** Minimum MVS order quantity per part number */
export const INSTANA_MIN_MVS = 10;

// ─── Part numbers (confirmed Apr 7, 2026 parts deck) ─────────────────────────

export interface InstanaPart {
  part: string;
  description: string;
  model: "SaaS" | "SelfHosted";
  tier: "Essentials" | "Standard";
  pricePerMVSMonth: number;
  notes: string;
}

export const INSTANA_PARTS: InstanaPart[] = [
  {
    part: "D0N78ZX",
    description: "IBM Instana Observability Essentials — SaaS",
    model: "SaaS",
    tier: "Essentials",
    pricePerMVSMonth: 21.20,
    notes: "Infrastructure monitoring only. Min 10 MVS. IBM-hosted.",
  },
  {
    part: "D0N79ZX",
    description: "IBM Instana Observability Standard — SaaS",
    model: "SaaS",
    tier: "Standard",
    pricePerMVSMonth: 79.50,
    notes: "Full-stack APM, distributed tracing, synthetic, LLM observability. Min 10 MVS. IBM-hosted.",
  },
  {
    part: "D29RRLL",
    description: "IBM Instana Observability Essentials — Self-Hosted MVS Subscription (incl. S&S)",
    model: "SelfHosted",
    tier: "Essentials",
    pricePerMVSMonth: 32.10,
    notes: "On-premises/self-managed. Infrastructure monitoring only. Billing metric: MVS/month.",
  },
  {
    part: "D29RTLL",
    description: "IBM Instana Observability Standard — Self-Hosted MVS Subscription (incl. S&S)",
    model: "SelfHosted",
    tier: "Standard",
    pricePerMVSMonth: 120.00,
    notes: "On-premises/self-managed. Full-stack APM. Billing metric: MVS/month (incl. S&S).",
  },
  {
    part: "D29RSLL",
    description: "IBM Instana Observability Essentials — Self-Hosted for Linux on IBM Z",
    model: "SelfHosted",
    tier: "Essentials",
    pricePerMVSMonth: 32.10,
    notes: "Linux on IBM Z variant. Same price as standard self-hosted Essentials.",
  },
  {
    part: "D29RULL",
    description: "IBM Instana Observability Standard — Self-Hosted for Linux on IBM Z",
    model: "SelfHosted",
    tier: "Standard",
    pricePerMVSMonth: 120.00,
    notes: "Linux on IBM Z variant. Same price as standard self-hosted Standard.",
  },
];

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
    baseMonthly: INSTANA_SAAS_ESSENTIALS_PER_MVS_MONTH,
    unit: "$21.20/MVS/month (Essentials) · $79.50/MVS/month (Standard)",
    commitment: "Flexible billing; annual or term options",
    summary: "IBM-hosted SaaS. Essentials (infra only, D0N78ZX) or Standard (full-stack APM, D0N79ZX). Minimum 10 MVS per part.",
    includes: [
      "Essentials (D0N78ZX): $21.20/MVS/month — infrastructure monitoring only",
      "Standard (D0N79ZX): $79.50/MVS/month — APM, traces, synthetic, LLM observability",
      "Unlimited users",
      "No scale limits on hosts",
      "Add-ons: Managed PoPs, Logs in context, Data ingestion",
    ],
    addOnsAvailable: true,
  },
  {
    model: "SelfHosted",
    label: "Self-Hosted (On-Premises)",
    baseMonthly: INSTANA_SELFHOSTED_BASE_MONTH,
    unit: "$32.10/MVS/month (Essentials) · $120.00/MVS/month (Standard)",
    commitment: "Annual subscription; billing per MVS/month",
    summary: "Customer-managed deployment. Billing metric: MVS/month (NOT VPC). Essentials (D29RRLL) or Standard (D29RTLL). S&S included in price.",
    includes: [
      "Essentials (D29RRLL): $32.10/MVS/month — infrastructure monitoring, incl. S&S",
      "Standard (D29RTLL): $120.00/MVS/month — full-stack APM, incl. S&S",
      "Linux on IBM Z variants: D29RSLL (Essentials) / D29RULL (Standard) — same prices",
      "Full control over data and deployment",
      "Monthly updates; annual subscription required",
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
  { term: "MVS", definition: "Managed Virtual Server — the billing unit. 1 VM or physical host or K8s worker node = 1 MVS. Min order: 10 MVS." },
  { term: "Essentials tier", definition: "Infrastructure monitoring only (no APM/traces). SaaS: $21.20/MVS/mo (D0N78ZX). Self-Hosted: $32.10/MVS/mo (D29RRLL)." },
  { term: "Standard tier", definition: "Full-stack APM, distributed tracing, synthetic, LLM observability. SaaS: $79.50/MVS/mo (D0N79ZX). Self-Hosted: $120.00/MVS/mo (D29RTLL)." },
  { term: "PayPerUse", definition: "$0.03/MVS/hour — no commitment, no add-ons." },
  { term: "SaaS", definition: "Essentials $21.20/MVS/mo (D0N78ZX) · Standard $79.50/MVS/mo (D0N79ZX). IBM-hosted, add-ons available." },
  { term: "Self-Hosted", definition: "Essentials $32.10/MVS/mo (D29RRLL) · Standard $120.00/MVS/mo (D29RTLL). Customer-managed, S&S included. Billing: MVS/month (not VPC)." },
  { term: "D0N78ZX / D0N79ZX", definition: "SaaS Essentials / Standard part numbers. Min 10 MVS each." },
  { term: "D29RRLL / D29RTLL", definition: "Self-Hosted Essentials / Standard part numbers. MVS/month billing, S&S included." },
];
