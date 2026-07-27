/**
 * IBM Concert — data module
 *
 * IBM Concert® is an agentic IT Ops platform that creates an adaptable, unified
 * operational layer across complex environments.
 *
 * CONFIRMED PRICING (IBM Concert platform Parts & Pricing Deck, Jun 17, 2026):
 *  PID: 5900BBE  (on-premises software license — this is the standard seller offering)
 *  Billing metric: Resource Unit (RU)
 *  Single platform part — one Concert RU covers all modules. CPQ line items use RU count only.
 *
 *  Part numbers (all confirmed Jun 17, 2026 deck):
 *   D0MK3ZX  Subscription License         $212.00/RU/year
 *   D0MK5ZX  Monthly License              $265.00/RU/month
 *   D0MK4ZX  License + S&S (Term)         $6,360.00/RU
 *   E0MK2ZX  Annual S&S Renewal           $1,270.00/RU
 *   D0MK6ZX  S&S Reinstatement            $3,820.00/RU
 *   X0MK2ZX  Extended Support (12mo)      $254.00/RU
 *   X0MK3ZX  Extended Support (sub)       $42.40/RU
 *   Z0MK2ZX  Advanced Support (12mo)      $382.00/RU
 *   Z0MK3ZX  Advanced Support (sub)       $31.80/RU
 *
 *  Concert SaaS (PID 5900BD6) — GA July 7, 2026 ("IBM Concert SaaS Parts & Pricing Deck", Jul 17, 2026):
 *   Billing: 1,000 RU/annum at $1,059.60 (~$1.06/RU/yr) — consumption SaaS model
 *   SEPARATE product from 5900BBE. Rule: SaaS deal → 5900BD6. On-prem/self-hosted → 5900BBE.
 *
 *  License types (5900BBE):
 *   Subscription license (D0MK3ZX): $212/RU/year
 *   Monthly license      (D0MK5ZX): $265/RU/month
 *   Term + support       (D0MK4ZX): $6,360/RU
 *
 *  RU mapping by use case (CONFIRMED — "Concert Standard RU Model – Ratio Table"):
 *   Protect  — Vulnerability management:   3 RU per managed application
 *   Resilience — Posture assessment:       5 RU per app leveraging posture assessment
 *   Workflows — Deployed workflows:        5 RU per deployed workflow in production
 *   Observe (Essentials) — App Perf Mgmt: 1 RU per 7 Managed Virtual Servers (MVS)
 *   Observe (Standard)  — App Perf Mgmt:  1 RU per 2 Managed Virtual Servers (MVS)
 *   Optimize — Resource optimization:      1 RU per 5 Managed Virtual Servers (MVS)
 *
 *  IBM's model defines five use-case buckets: Protect, Resilience, Workflows, Observe, Optimize.
 *  NOTE: "Operate" does NOT appear in IBM's RU model table and has no RU mapping.
 *        Do not quote or estimate RUs for "Operate" — there is no such category in IBM's
 *        current Concert pricing. Raise with IBM directly if the customer references it.
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
    ruMapping: "1 RU per 7 MVS (Essentials App Perf Mgmt) or 1 RU per 2 MVS (Standard App Perf Mgmt)",
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
    ruMapping: "5 RU per app leveraging posture assessment",
  },
  {
    key: "workflows",
    label: "Concert Workflows",
    summary: "AI-generated workflow automation — orchestrates remediation across security, ops, and ITSM tools with governance and audit trails.",
    ruMapping: "5 RU per deployed workflow in production",
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

// ─── Pricing constants + part numbers (confirmed IBM Concert Parts & Pricing Deck, Jun 17, 2026) ─

export const CONCERT_PRICE_PER_RU_SUBSCRIPTION = 212;    // $/RU — annual subscription  (D0MK3ZX)
export const CONCERT_PRICE_PER_RU_MONTHLY      = 265;    // $/RU — monthly license       (D0MK5ZX)
export const CONCERT_PRICE_PER_RU_TERM         = 6360;   // $/RU — term license + S&S    (D0MK4ZX)
export const CONCERT_PRICE_PER_RU_SS_RENEWAL   = 1270;   // $/RU — annual S&S renewal    (E0MK2ZX)
export const CONCERT_PRICE_PER_RU_SS_REINSTATE = 3820;   // $/RU — S&S reinstatement     (D0MK6ZX)

// Part numbers (PID 5900BBE — on-premises standard offering)
export const CONCERT_PARTS = {
  subscription:    { part: "D0MK3ZX", description: "IBM Concert Subscription License",          pricePerRU: 212,   unit: "per RU per year" },
  monthly:         { part: "D0MK5ZX", description: "IBM Concert Monthly License",               pricePerRU: 265,   unit: "per RU per month" },
  term:            { part: "D0MK4ZX", description: "IBM Concert License + S&S (Term)",          pricePerRU: 6360,  unit: "per RU" },
  ssRenewal:       { part: "E0MK2ZX", description: "IBM Concert Annual S&S Renewal",            pricePerRU: 1270,  unit: "per RU per year" },
  ssReinstate:     { part: "D0MK6ZX", description: "IBM Concert S&S Reinstatement",             pricePerRU: 3820,  unit: "per RU" },
  extSupport12mo:  { part: "X0MK2ZX", description: "IBM Concert Extended Support (12mo)",       pricePerRU: 254,   unit: "per RU" },
  extSupportSub:   { part: "X0MK3ZX", description: "IBM Concert Extended Support (subscription)", pricePerRU: 42.40, unit: "per RU" },
  advSupport12mo:  { part: "Z0MK2ZX", description: "IBM Concert Advanced Support (12mo)",       pricePerRU: 382,   unit: "per RU" },
  advSupportSub:   { part: "Z0MK3ZX", description: "IBM Concert Advanced Support (subscription)", pricePerRU: 31.80, unit: "per RU" },
} as const;

// Concert SaaS (PID 5900BD6) — GA July 7, 2026. Confirmed pricing:
export const CONCERT_SAAS_PRICE_PER_1000_RU_YEAR = 1059.60;  // $1,059.60 per 1,000 RU/annum
export const CONCERT_SAAS_PRICE_PER_RU_YEAR = 1059.60 / 1000; // ~$1.06/RU/yr
export const CONCERT_SAAS_PID = "5900BD6";
export const CONCERT_ONPREM_PID = "5900BBE";

// Rule confirmed: SaaS deployment → 5900BD6. On-prem/self-hosted deployment → 5900BBE.
export const CONCERT_SAAS_PID_NOTE =
  "Concert SaaS (PID 5900BD6, GA Jul 7, 2026): $1,059.60/1,000 RU/annum (~$1.06/RU/yr). " +
  "Concert On-Prem (PID 5900BBE, GA Jun 12, 2026): $212/RU/year (subscription). " +
  "Rule: SaaS deal → 5900BD6. On-prem/self-hosted → 5900BBE.";

// RU mapping constants (all confirmed — Concert Standard RU Model Ratio Table)
export const CONCERT_RU_PER_APP_VULN          = 3;          // Protect: 3 RU per managed app
export const CONCERT_RU_PER_APP_RESILIENCE    = 5;          // Resilience: 5 RU per app in posture assessment
export const CONCERT_RU_PER_WORKFLOW          = 5;          // Workflows: 5 RU per deployed workflow in production
export const CONCERT_RU_PER_MVS_OBSERVE_ESS   = 1 / 7;     // Observe Essentials: 1 RU per 7 MVS
export const CONCERT_RU_PER_MVS_OBSERVE_STD   = 1 / 2;     // Observe Standard: 1 RU per 2 MVS
export const CONCERT_RU_PER_MVS_OPTIM         = 1 / 5;     // Optimize: 1 RU per 5 MVS

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
    title: "Size by RU consumption — five confirmed mappings",
    body: "Concert is billed per Resource Unit (RU) at $212/RU/year (subscription). All five IBM use-case buckets now have confirmed RU mappings: Protect = 3 RU/app; Resilience = 5 RU/app; Workflows = 5 RU/workflow; Observe Essentials = 1 RU/7 MVS; Observe Standard = 1 RU/2 MVS; Optimize = 1 RU/5 MVS. There is no 'Operate' category in IBM's RU model.",
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
  { term: "Protect (Vulnerability)", definition: "3 RU per managed application. E.g. 50 apps = 150 RU = $31,800/year." },
  { term: "Resilience (Posture)", definition: "5 RU per app leveraging posture assessment. E.g. 20 apps = 100 RU = $21,200/year." },
  { term: "Workflows", definition: "5 RU per deployed workflow in production. E.g. 10 workflows = 50 RU = $10,600/year." },
  { term: "Observe (Essentials APM)", definition: "1 RU per 7 MVS. E.g. 700 MVS = 100 RU = $21,200/year." },
  { term: "Observe (Standard APM)", definition: "1 RU per 2 MVS. E.g. 200 MVS = 100 RU = $21,200/year." },
  { term: "Optimize", definition: "1 RU per 5 MVS. Powered by Turbonomic — requires Turbonomic target configuration." },
  { term: "Operate (⚠ no RU mapping)", definition: "'Operate' does not appear in IBM's Concert RU model. Do not quote RUs for this category — confirm with IBM if a customer references it." },
  { term: "Concert Observe", definition: "Cross-domain observability. Requires Instana agents as the data source. Two sub-tiers: Essentials (1 RU/7 MVS) and Standard (1 RU/2 MVS)." },
  { term: "Concert Protect", definition: "CVE analysis and risk enrichment. Integrates with Instana container data." },
  { term: "Concert Resilience", definition: "Resilience scoring — evaluates availability, compliance, configuration, and runtime health." },
  { term: "Sidekick", definition: "Unified 3-product sidebar in Instana, Turbonomic, and Concert UIs — cross-product insights without switching tools." },
  { term: "Agentic IT Ops", definition: "Concert's AI layer autonomously surfaces insights and orchestrates actions — not just dashboards." },
];
