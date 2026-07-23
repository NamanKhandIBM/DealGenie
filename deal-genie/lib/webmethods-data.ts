/**
 * IBM webMethods — data module
 *
 * IBM webMethods Integration (formerly Software AG webMethods, acquired by IBM).
 * Product: Hybrid iPaaS and integration platform for connecting apps, APIs, events,
 * files, data, and B2B/EDI partner ecosystems across hybrid environments.
 *
 * CONFIRMED PRICING (IBM "webMethods PIDs and Parts" guide + Seller Enablement
 *   Pricing & Packaging session, Dec 11, 2025 + IBM Docs hybrid-integration-lib, Jul 2026):
 *
 *  SaaS billing metric: Resource Unit (RU) [NOTE: IBM Docs uses "RU" not "RVU" in the
 *    Hybrid Integration SaaS guide — this is the canonical term]
 *
 *  SaaS RU structure (CONFIRMED from IBM Docs, Jul 2026):
 *   Base charge:    60 RU/month per enabled integration capability instance (production)
 *   Usage charge:   4 RU per 100,000 integration transactions for first 1M txn/year
 *                   1 RU per 100,000 integration transactions over 1M/year
 *   API transactions, events: separately priced by bundle — contact IBM for current rate
 *
 *  SaaS reference list price: ~$11.54/RU/year (confirmed from Seismic Dec 2025 guide)
 *  On-Premises / Cloud Pak for Integration (CP4I) webMethods Add-on:
 *   Priced on VPC (Virtual Processor Core) basis — same rate as CP4I
 *   Contact IBM for current VPC rates.
 *
 * Key cross-sell: webMethods ↔ IBM Security Verify
 *  webMethods exposes APIs and integration endpoints that require identity-aware security.
 *  IBM Security Verify provides OAuth 2.0/OIDC token-based access control, API security,
 *  and identity governance that webMethods can enforce at the API gateway layer.
 *  IBM API Connect documentation confirms: webMethods API Gateway uses "Identify and
 *  Authorize" policy for OAuth/OIDC — direct integration point with Verify.
 */

// ─── webMethods capability areas ─────────────────────────────────────────────

export interface WebMethodsCapability {
  key: string;
  label: string;
  summary: string;
  rvuMetric?: string;  // How RVUs are consumed for this capability
}

export const WEBMETHODS_CAPABILITIES: WebMethodsCapability[] = [
  {
    key: "appIntegration",
    label: "Application Integration",
    summary: "Connect SaaS, on-prem, and cloud applications with pre-built connectors and AI-assisted flow authoring (Flow Pilot).",
    rvuMetric: "1 RVU = 1,000 integration transactions/month",
  },
  {
    key: "apiManagement",
    label: "API Management",
    summary: "Design, publish, and govern APIs with policies, security controls, and developer portal.",
    rvuMetric: "1 RVU = 10,000 API transactions/month",
  },
  {
    key: "b2b",
    label: "B2B / EDI Integration",
    summary: "Manage B2B partner ecosystems, EDI workflows, and file-based data exchange in regulated environments.",
  },
  {
    key: "eventDriven",
    label: "Event-Driven Integration",
    summary: "Build real-time, event-driven architectures with Kafka, messaging, and streaming support.",
  },
  {
    key: "hybrid",
    label: "Hybrid Deployment",
    summary: "Run integrations on-premises, in IBM Cloud, or in a customer-managed cloud — single platform across environments.",
  },
  {
    key: "aiWorkflows",
    label: "AI-Powered Development",
    summary: "Use Flow Pilot to bring AI assistance into integration authoring, documentation, and testing.",
  },
];

// ─── Pricing constants (SaaS, confirmed IBM Docs Jul 2026 + Seismic Dec 2025) ─

/** SaaS reference list price per RU per year (Seismic Dec 2025) */
export const WEBMETHODS_PRICE_PER_RU_YEAR = 11.54;

/** SaaS base charge per integration capability instance per month (IBM Docs Jul 2026) */
export const WEBMETHODS_BASE_RU_PER_MONTH = 60;

/** Usage: RU per 100K integration transactions — tier 1 (first 1M txn/year) */
export const WEBMETHODS_RU_PER_100K_TXN_TIER1 = 4;

/** Usage: RU per 100K integration transactions — tier 2 (over 1M txn/year) */
export const WEBMETHODS_RU_PER_100K_TXN_TIER2 = 1;

/** Integration transactions per RU per month (App Integration capability) — legacy reference */
export const WEBMETHODS_INT_TRANSACTIONS_PER_RVU = 1000;

/** API transactions per RU per month (API Management capability) — legacy reference */
export const WEBMETHODS_API_TRANSACTIONS_PER_RVU = 10000;

/** Also export as WEBMETHODS_PRICE_PER_RVU_YEAR for backward compat */
export const WEBMETHODS_PRICE_PER_RVU_YEAR = WEBMETHODS_PRICE_PER_RU_YEAR;

// ─── Deployment options ───────────────────────────────────────────────────────

export interface WebMethodsDeployment {
  key: string;
  label: string;
  summary: string;
}

export const WEBMETHODS_DEPLOYMENTS: WebMethodsDeployment[] = [
  {
    key: "saas",
    label: "webMethods SaaS (IBM-hosted iPaaS)",
    summary: "IBM manages infrastructure; customer focuses on integration design and management. Base: 60 RU/month per environment + 4 RU/100K txn (first 1M/yr). List ~$11.54/RU/year.",
  },
  {
    key: "onPrem",
    label: "webMethods On-Premises / Hybrid",
    summary: "Self-managed deployment for regulated industries or data-residency requirements. Priced per VPC (same rate as CP4I) — contact IBM.",
  },
];

// ─── Seller value story: webMethods + Verify cross-sell ──────────────────────
export const WEBMETHODS_VERIFY_VALUE_POINTS = [
  "webMethods exposes integration and API endpoints across hybrid environments; IBM Security Verify adds OAuth 2.0/OIDC-based identity governance and API security so those endpoints are protected by authenticated, authorized identities.",
  "The combined story closes a common security gap: teams modernize integration with webMethods but leave API access ungoverned. Verify's SSO and adaptive access policies add the identity trust layer that the integration fabric requires.",
  "Sellers can position 'secure hybrid integration' as the outcome — webMethods for connectivity, Verify for identity and access control across every API and integration endpoint.",
];

// ─── Best practices snippets ─────────────────────────────────────────────────
export const WEBMETHODS_BEST_PRACTICES = [
  {
    title: "Size SaaS by RU — base + usage model",
    body: "webMethods SaaS charges 60 RU/month base per enabled integration instance, plus 4 RU per 100K transactions (first 1M/yr) then 1 RU/100K over 1M. List price ~$11.54/RU/year. Ask for monthly transaction volume and environment count to build a budgetary estimate. On-prem is VPC-based — contact IBM.",
  },
  {
    title: "B2B/EDI is a strong differentiator",
    body: "webMethods has deep B2B/EDI capabilities from the Software AG heritage. For supply chain, healthcare, financial services, or any organization with heavy partner ecosystem integration, B2B is a key differentiator over lightweight iPaaS alternatives.",
  },
  {
    title: "Cross-sell trigger: API access governance gap",
    body: "When the customer has APIs or integration endpoints that lack identity-based access control, probe for IBM Security Verify. Ask: 'Who controls access to these APIs? Are you enforcing identity and policy at the API gateway?'",
  },
  {
    title: "IBM webMethods 12.1 is the current release",
    body: "The current release adds modern runtime readiness, stronger security controls, and improved developer productivity with Flow Pilot AI assistance.",
  },
  {
    title: "On-prem is VPC-based — different motion from SaaS",
    body: "On-premises and CP4I webMethods Add-on is priced per VPC (Virtual Processor Core) at the same rate as Cloud Pak for Integration. This is a different commercial motion from SaaS RVU pricing. Always clarify deployment model early.",
  },
];

export const WEBMETHODS_QUICK_REFERENCE = [
  { term: "RU", definition: "Resource Unit — SaaS billing unit. ~$11.54/RU/year. Base: 60 RU/month/instance. Usage: 4 RU/100K txn (tier 1), 1 RU/100K (tier 2 over 1M/yr)." },
  { term: "Flow Pilot", definition: "AI assistant inside webMethods for authoring, documenting, and testing integration flows." },
  { term: "B2B/EDI", definition: "Business-to-business and Electronic Data Interchange — webMethods' heritage strength." },
  { term: "VPC", definition: "Virtual Processor Core — on-prem/CP4I billing unit. Same rate as CP4I. Contact IBM for current price." },
  { term: "Hybrid integration", definition: "Single platform spanning on-prem, IBM Cloud, and any public cloud." },
  { term: "webMethods 12.1", definition: "Current GA release — improved security, runtime, and developer experience." },
  { term: "CP4I", definition: "Cloud Pak for Integration — IBM's on-prem integration platform; webMethods on-prem add-on priced at CP4I VPC rate." },
];
