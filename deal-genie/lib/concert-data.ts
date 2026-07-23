/**
 * IBM Concert — data module
 *
 * IBM Concert® is an agentic IT Ops platform that creates an adaptable, unified
 * operational layer across complex environments.
 *
 * CONFIRMED PRICING (IBM Concert platform Parts & Pricing Deck, Jun 17, 2026):
 *  PID: 5900BBE
 *  Billing metric: Resource Unit (RU)
 *
 *  License types:
 *   Subscription license:      $212/RU
 *   Monthly license:           $265/RU
 *   Term license + support:  $6,360/RU
 *
 *  RU mapping by use case (CRITICAL — not flat per-app or per-node):
 *   Vulnerability management:   3 RU per managed application
 *   Resource optimization:      1 RU per 5 Managed Virtual Servers (MVS)
 *   Other use cases:            RU consumption varies — confirmed with IBM
 *
 *  No separate platform floor price — consumption is pure RU-based.
 *
 * Key cross-sell: Instana → Concert
 *  Instana provides real-time, full-stack telemetry. Concert ingests that telemetry
 *  alongside cost, security, and change data to produce AI-driven, business-impact-prioritized
 *  operational intelligence.
 */

// ─── Concert modules ──────────────────────────────────────────────────────────

export interface ConcertModule {
  key: string;
  label: string;
  summary: string;
  ruMapping?: string;  // How RUs are consumed for this module
}

export const CONCERT_MODULES: ConcertModule[] = [
  {
    key: "observe",
    label: "Concert Observe",
    summary: "Full-stack observability — connects Instana agents' telemetry into a shared cross-domain context for faster detection and impact analysis. Requires Instana agents for observability data.",
  },
  {
    key: "operate",
    label: "Concert Operate",
    summary: "AI-guided incident response — correlates signals, surfaces root causes, and guides teams from alert to resolution.",
  },
  {
    key: "optimize",
    label: "Concert Optimize",
    summary: "Performance and cost optimization across cloud, K8s, and hybrid environments. Powered by IBM Turbonomic (requires Turbonomic targets). AI-driven resource decisions feed the Concert shared context.",
    ruMapping: "1 RU per 5 Managed Virtual Servers (MVS)",
  },
  {
    key: "protect",
    label: "Concert Protect",
    summary: "CVE and risk enrichment — evaluates software composition, maps CVEs to affected components, and prioritizes risks based on impact. Integrates with Instana for container vulnerability data.",
    ruMapping: "3 RU per managed application (vulnerability management use case)",
  },
  {
    key: "resilience",
    label: "Concert Resilience",
    summary: "Business continuity and cascade failure prevention — assesses operational health and stability by evaluating availability, configuration, compliance, and runtime signals. Generates resilience scores.",
  },
  {
    key: "workflows",
    label: "Concert Workflows",
    summary: "AI-generated workflow automation — orchestrates remediation across security, ops, and ITSM tools with governance and audit trails.",
  },
];

/**
 * Sidekick integration (IBM Docs, Jul 2026):
 * Concert, Instana, and Turbonomic share a unified sidebar ("Sidekick").
 * In Instana: shows Turbonomic resource actions + Concert CVE/resilience data.
 * In Turbonomic: shows Instana performance metrics + Concert data.
 * In Concert: shows Instana performance metrics + Turbonomic optimization insights.
 * Requires eligible SaaS subscriptions under the same IBM account.
 */
export const CONCERT_SIDEKICK_NOTE =
  "IBM Sidekick integration: Instana + Turbonomic + Concert share a unified 3-product sidebar. Sellers can position 'one-account, three lenses' — observability (Instana), optimization (Turbonomic), operational intelligence (Concert) — with zero context-switching between tools.";

// ─── Pricing constants (confirmed IBM CPQ, Jun 17, 2026) ─────────────────────

export const CONCERT_PRICE_PER_RU_SUBSCRIPTION = 212;    // $/RU — annual subscription
export const CONCERT_PRICE_PER_RU_MONTHLY      = 265;    // $/RU — monthly license
export const CONCERT_PRICE_PER_RU_TERM         = 6360;   // $/RU — term license + support

// RU mapping constants
export const CONCERT_RU_PER_APP_VULN    = 3;   // vulnerability management: 3 RU per app
export const CONCERT_RU_PER_MVS_OPTIM  = 0.2; // optimization: 1 RU per 5 MVS = 0.2 RU/MVS

// ─── Seller value story: Concert + Instana cross-sell ────────────────────────
export const CONCERT_INSTANA_VALUE_POINTS = [
  "Instana delivers real-time, high-fidelity telemetry across the application and infrastructure stack; Concert elevates that data into business-impact-aware operational intelligence.",
  "The combined story moves customers from 'alert fatigue' to 'intelligent operations' — Instana captures every signal, Concert determines which ones matter and orchestrates the response.",
  "Concert Observe is literally built on Instana agents — configuring Instana is a required setup step for Concert Observe. The two products are architecturally integrated, not just complementary.",
  "Sidekick: Concert and Instana share a unified sidebar in both UIs — Instana users see Concert CVE/resilience data; Concert users see Instana performance metrics. Zero context-switching.",
  "BWI (German Armed Forces IT) avoided 30,000 potential IT service disruptions and freed 35% potential capacity using Concert — a reference story for the combined Instana + Concert play.",
];

// ─── Best practices snippets ─────────────────────────────────────────────────
export const CONCERT_BEST_PRACTICES = [
  {
    title: "Size by RU consumption — two confirmed mappings",
    body: "Concert is billed per Resource Unit (RU) at $212/RU/year (subscription). Two confirmed RU mappings: vulnerability management = 3 RU per app; optimization = 1 RU per 5 MVS. Use these to build budgetary estimates. Other modules: confirm RU mapping with IBM.",
  },
  {
    title: "Lead with the alert-fatigue problem",
    body: "Ask: 'How many alerts does your ops team receive per day? How many are actionable?' Concert is specifically designed for teams drowning in signals but starved for context.",
  },
  {
    title: "Instana is the architectural feeder — not optional",
    body: "Concert Observe requires Instana agents as its observability data source. Concert Optimize is powered by Turbonomic. These are not optional integrations — they are required data connections. Instana + Turbonomic + Concert is the full-stack trio IBM has built: Observe it (Instana), Act on it (Turbonomic), Govern it (Concert).",
  },
  {
    title: "Sidekick: the 3-product unified experience",
    body: "IBM Sidekick puts Instana, Turbonomic, and Concert data in a single sidebar across all three UIs. This is IBM's 'integrated observability' product experience — position as differentiation vs. point tools.",
  },
  {
    title: "Concert is not just another observability tool",
    body: "Concert is an ITOps platform — it aggregates signals from any source (Instana, Datadog, cloud cost data, security scanners) and adds AI-driven context and workflow automation. It does not replace monitoring; it makes monitoring actionable.",
  },
  {
    title: "Lead with one module, expand to others",
    body: "Start with the module that matches the primary pain. Alert fatigue → Observe + Operate. Vulnerabilities/compliance → Protect (3 RU/app). Cloud waste → Optimize (1 RU/5 MVS). Do not try to sell all six modules at once.",
  },
];

export const CONCERT_QUICK_REFERENCE = [
  { term: "RU", definition: "Resource Unit — Concert's billing unit. Subscription: $212/RU/year (PID 5900BBE)." },
  { term: "Vulnerability use case", definition: "3 RU per managed application. E.g. 50 apps = 150 RU = $31,800/year list." },
  { term: "Optimization use case", definition: "1 RU per 5 MVS. E.g. 500 MVS = 100 RU = $21,200/year list." },
  { term: "Concert Observe", definition: "Cross-domain observability. Requires Instana agents as the data source." },
  { term: "Concert Optimize", definition: "Resource right-sizing. Powered by Turbonomic — requires Turbonomic target configuration." },
  { term: "Concert Protect", definition: "CVE analysis and risk enrichment. Integrates with Instana container data." },
  { term: "Concert Resilience", definition: "Resilience scoring — evaluates availability, compliance, configuration, and runtime health." },
  { term: "Concert Operate", definition: "AI-guided incident response and root-cause analysis." },
  { term: "Sidekick", definition: "Unified 3-product sidebar in Instana, Turbonomic, and Concert UIs — cross-product insights without switching tools." },
  { term: "Agentic IT Ops", definition: "Concert's AI layer autonomously surfaces insights and orchestrates actions — not just dashboards." },
];
