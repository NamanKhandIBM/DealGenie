/**
 * IBM webMethods — data module
 *
 * IBM webMethods Integration (formerly Software AG webMethods, acquired by IBM).
 * Product: Hybrid iPaaS and integration platform for connecting apps, APIs, events,
 * files, data, and B2B/EDI partner ecosystems across hybrid environments.
 *
 * CONFIRMED PRICING (IBM "webMethods PIDs and Parts" guide + Seller Enablement
 *   Pricing & Packaging session, Dec 11, 2025 + IBM Docs hybrid-integration-lib, Jul 2026
 *   + IWHI SaaS Sizing Calculator, 2nd July 2026
 *   + IWHI Software Sizing Calculator, 2nd July 2026):
 *
 *  SaaS billing metric: Resource Unit (RU) [IBM Docs uses "RU" not "RVU" — canonical term]
 *
 *  SaaS RU tiered structure (CONFIRMED from IWHI SaaS Sizing Calculator, 2nd Jul 2026):
 *   Base charge:
 *     Integration:    60 RU/env/month  +  5 RU/additional runtime
 *     API Management: 50 RU/env/month
 *     B2B:            60 RU/env/month
 *   Transaction tiers (RUs / Per transactions):
 *     Integration:
 *       0 – 100,000,000:    4 RU per 100,000 txn  = 0.00004 RU/txn
 *       100,000,001+:       1 RU per 100,000 txn  = 0.00001 RU/txn
 *     API Management:
 *       0 – 1,000,000,000:  3 RU per 1,000,000 txn = 0.000003 RU/txn
 *       1,000,000,001+:     2 RU per 1,000,000 txn = 0.000002 RU/txn
 *     B2B:
 *       0 – 100,000,000:    4 RU per 100,000 txn  = 0.00004 RU/txn
 *       100,000,001+:       1 RU per 100,000 txn  = 0.00001 RU/txn
 *
 *  Software (on-prem) RU tiered structure (CONFIRMED from IWHI Software Sizing Calculator, 2nd Jul 2026):
 *   Transaction tiers (RUs / Per transactions):
 *     Integration:
 *       0 – 10,000,000:     20 RU per 100,000 txn = 0.0002 RU/txn
 *       10,000,001 – 100,000,000:  4 RU per 100,000 txn = 0.00004 RU/txn
 *       100,000,001+:        1 RU per 100,000 txn = 0.00001 RU/txn
 *     API Management:
 *       0 – 100,000,000:    20 RU per 1,000,000 txn = 0.00002 RU/txn
 *       100,000,001 – 1,000,000,000: 3 RU per 1,000,000 txn = 0.000003 RU/txn
 *       1,000,000,001+:      2 RU per 1,000,000 txn = 0.000002 RU/txn
 *     B2B:
 *       0 – 10,000,000:     20 RU per 100,000 txn = 0.0002 RU/txn
 *       10,000,001 – 100,000,000:  4 RU per 100,000 txn = 0.00004 RU/txn
 *       100,000,001+:        1 RU per 100,000 txn = 0.00001 RU/txn
 *
 *  Event-Driven / Events: CONFIRMED as a SEPARATE IBM product — NOT priced under webMethods RU.
*   Product: IBM Event Automation (Event Streams + Event Endpoint Management + Event Processing)
*   PID: 5900-AXM
*   Billing metric: Virtual Processor Core (VPC)
*   List price:
*     D0DU6ZX  Perpetual + S&S 12mo:  $8,000/VPC
*     D0DU8ZX  Subscription License:  $3,204/VPC/year
*     D0DU7ZX  Monthly License:       contact IBM
*     E0DU5ZX  Annual S&S Renewal
*     D0DU9ZX  S&S Reinstatement
*     Non-production equivalents: D0DUGZX / D0DUHZX / E0DUFZX (same pricing tiers)
*   Source: "IBM Event Automation Sizing, Parts & Pricing" (Feb 10, 2026)
*   NOTE: CP4I add-on variant (Event Processing only) was WITHDRAWN June 2026 — do not quote.
*   When a webMethods customer asks about event-driven workloads, route to IBM Event Automation
*   as a separate line item (different PID, different billing metric, different sales motion).
*
*  SaaS reference list price: $40.08/RU/year (confirmed IWHI SaaS Sizing Calculator, 2nd July 2026)
*  Software (on-prem) reference list price: $40.00/RU/year (confirmed IWHI Software Sizing Calculator, 2nd July 2026)
*  On-Premises / Cloud Pak for Integration (CP4I) webMethods Add-on:
*   Billing metric: VPC (Virtual Processor Core)
*   CP4I base list prices (confirmed "Cloud Pak for Integration - Sizing, Packaging and Pricing Guide", Jun 22, 2026):
*     D2689LL  Subscription (CTL):  $1,240/VPC/month
*     D20ZBLL  Perpetual:           $37,100/VPC
*     D211KLL  Monthly:             $1,540/VPC/month
*     Linux on Z equivalents: D268BLL / D20ZILL / D211LLL (same prices)
*   webMethods on-prem CP4I add-on: SEPARATE parts D16NRZX and D16NSZX (not bundled into base CP4I).
*   Source: "IWHI VPC Sizing Calculator for CP4I webMethods add-on" (Jun 4, 2026)
*   NOTE: List price per VPC for D16NRZX/D16NSZX not yet confirmed — contact IBM for current rate.
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
    rvuMetric: "$75 per 1,000 transactions/year",
  },
  {
    key: "mft",
    label: "Managed File Transfer (MFT)",
    summary: "Automate secure file-based data exchange across enterprises, partners, and clouds with audit trails, scheduling, and compliance controls.",
    rvuMetric: "$85 per 1,000 file-transfer transactions/year",
  },
  {
    key: "eventDriven",
    label: "Event-Driven Integration",
    summary: "Build real-time, event-driven architectures with Kafka, messaging, and streaming support. ⚠ Note: IBM has not confirmed a webMethods RU rate for Event-Driven — this capability may fall under IBM Event Automation (a separate product line). Confirm with IBM before quoting.",
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

// ─── Pricing constants (confirmed IWHI Sizing Calculators, 2nd July 2026) ──────

/** SaaS reference list price per RU per year (IWHI SaaS Sizing Calculator, 2nd Jul 2026) */
export const WEBMETHODS_PRICE_PER_RU_YEAR = 40.08;

/** Software (on-prem) reference list price per RU per year (IWHI Software Sizing Calculator, 2nd Jul 2026) */
export const WEBMETHODS_PRICE_PER_RU_YEAR_SOFTWARE = 40.00;

/** SaaS base charge per integration environment per month (IWHI SaaS Sizing Calculator, 2nd Jul 2026) */
export const WEBMETHODS_BASE_RU_PER_MONTH = 60;

/** SaaS base charge per additional runtime per month (IWHI SaaS Sizing Calculator, 2nd Jul 2026) */
export const WEBMETHODS_RUNTIME_RU_PER_MONTH = 5;

/** SaaS API Management base charge per environment per month (IWHI SaaS Sizing Calculator, 2nd Jul 2026) */
export const WEBMETHODS_API_BASE_RU_PER_MONTH = 50;

// ─── SaaS transaction tier tables (IWHI SaaS Sizing Calculator, 2nd Jul 2026) ─

export interface WebMethodsRUTier {
  fromTxn: number;          // inclusive lower bound (monthly transactions)
  ruPer: number;            // RU charge
  perTxn: number;           // denominator (transactions)
}

/**
 * SaaS Integration transaction tiers.
 * Source: IWHI SaaS Sizing Calculator, Master data tab, 2nd July 2026.
 */
export const WEBMETHODS_SAAS_INT_TIERS: WebMethodsRUTier[] = [
  { fromTxn:           0, ruPer: 4, perTxn: 100_000 },  // 0.00004 RU/txn
  { fromTxn: 100_000_001, ruPer: 1, perTxn: 100_000 },  // 0.00001 RU/txn
];

/**
 * SaaS API Management transaction tiers.
 * Source: IWHI SaaS Sizing Calculator, Master data tab, 2nd July 2026.
 */
export const WEBMETHODS_SAAS_API_TIERS: WebMethodsRUTier[] = [
  { fromTxn:             0, ruPer: 3, perTxn: 1_000_000 },  // 0.000003 RU/txn
  { fromTxn: 1_000_000_001, ruPer: 2, perTxn: 1_000_000 },  // 0.000002 RU/txn
];

/**
 * SaaS B2B transaction tiers.
 * Source: IWHI SaaS Sizing Calculator, Master data tab, 2nd July 2026.
 */
export const WEBMETHODS_SAAS_B2B_TIERS: WebMethodsRUTier[] = [
  { fromTxn:           0, ruPer: 4, perTxn: 100_000 },  // 0.00004 RU/txn
  { fromTxn: 100_000_001, ruPer: 1, perTxn: 100_000 },  // 0.00001 RU/txn
];

// ─── Software (on-prem) transaction tier tables (IWHI Software Sizing Calculator, 2nd Jul 2026) ─

/**
 * Software Integration transaction tiers.
 * Source: IWHI Software Sizing Calculator, Master data tab, 2nd July 2026.
 */
export const WEBMETHODS_SW_INT_TIERS: WebMethodsRUTier[] = [
  { fromTxn:          0, ruPer: 20, perTxn: 100_000 },  // 0.0002 RU/txn
  { fromTxn: 10_000_001, ruPer:  4, perTxn: 100_000 },  // 0.00004 RU/txn
  { fromTxn: 100_000_001, ruPer: 1, perTxn: 100_000 },  // 0.00001 RU/txn
];

/**
 * Software API Management transaction tiers.
 * Source: IWHI Software Sizing Calculator, Master data tab, 2nd July 2026.
 */
export const WEBMETHODS_SW_API_TIERS: WebMethodsRUTier[] = [
  { fromTxn:             0, ruPer: 20, perTxn: 1_000_000 },  // 0.00002 RU/txn
  { fromTxn:   100_000_001, ruPer:  3, perTxn: 1_000_000 },  // 0.000003 RU/txn
  { fromTxn: 1_000_000_001, ruPer:  2, perTxn: 1_000_000 },  // 0.000002 RU/txn
];

/**
 * Software B2B transaction tiers.
 * Source: IWHI Software Sizing Calculator, Master data tab, 2nd July 2026.
 */
export const WEBMETHODS_SW_B2B_TIERS: WebMethodsRUTier[] = [
  { fromTxn:          0, ruPer: 20, perTxn: 100_000 },  // 0.0002 RU/txn
  { fromTxn: 10_000_001, ruPer:  4, perTxn: 100_000 },  // 0.00004 RU/txn
  { fromTxn: 100_000_001, ruPer: 1, perTxn: 100_000 },  // 0.00001 RU/txn
];

/**
 * Compute monthly RU usage from monthly transaction count using a tier table.
 * Tiers are defined by monthly fromTxn lower bounds. Each tier covers from its
 * fromTxn up to (but not including) the next tier's fromTxn.
 */
export function computeMonthlyRU(monthlyTxn: number, tiers: WebMethodsRUTier[]): number {
  let ru = 0;
  for (let i = 0; i < tiers.length; i++) {
    const low  = tiers[i].fromTxn;
    const high = i + 1 < tiers.length ? tiers[i + 1].fromTxn - 1 : Infinity;
    if (monthlyTxn < low) break;
    const txnInBand = Math.min(monthlyTxn, high === Infinity ? monthlyTxn : high) - low + (low === 0 ? 1 : 1);
    ru += Math.ceil((txnInBand / tiers[i].perTxn) * tiers[i].ruPer);
  }
  return ru;
}

// Legacy single-tier constants retained for backward compatibility
/** @deprecated Use WEBMETHODS_SAAS_INT_TIERS. Tier-1 rate: 4 RU per 100K txn (0–100M monthly). */
export const WEBMETHODS_RU_PER_100K_TXN_TIER1 = 4;
/** @deprecated Use WEBMETHODS_SAAS_INT_TIERS. Tier-2 rate: 1 RU per 100K txn (100M+ monthly). */
export const WEBMETHODS_RU_PER_100K_TXN_TIER2 = 1;

// ─── Per-product annual rates — SUPERSEDED by July 2026 RU tier tables above ─
// Retained only for backward-compat references; do not use for new estimates.
/** @deprecated Use WEBMETHODS_SAAS_INT_TIERS + WEBMETHODS_PRICE_PER_RU_YEAR instead. */
export const WEBMETHODS_ANNUAL_RATE_INTEGRATION  = 92;
/** @deprecated Use WEBMETHODS_SAAS_API_TIERS + WEBMETHODS_PRICE_PER_RU_YEAR instead. */
export const WEBMETHODS_ANNUAL_RATE_API_MGMT     = 100;
/** @deprecated Use WEBMETHODS_SAAS_B2B_TIERS + WEBMETHODS_PRICE_PER_RU_YEAR instead. */
export const WEBMETHODS_ANNUAL_RATE_B2B          = 75;
/** @deprecated Use WEBMETHODS_SAAS_B2B_TIERS + WEBMETHODS_PRICE_PER_RU_YEAR instead. */
export const WEBMETHODS_ANNUAL_RATE_B2B_INT      = 92;
/** @deprecated MFT tiers not yet confirmed from Jul 2026 calculator — use prior rate as proxy. */
export const WEBMETHODS_ANNUAL_RATE_MFT          = 85;

/**
 * "Low Quantity Tier" volume-discount factor table.
 * Factor is multiplied by effective RU consumption as volume grows.
 * Source: IBM webMethods SaaS Calculator, Oct 2024.
 */
export interface WebMethodsVolumeTier {
  minUnits: number;
  maxUnits: number | null;
  factor: number;
}
export const WEBMETHODS_VOLUME_TIERS: WebMethodsVolumeTier[] = [
  { minUnits:      1, maxUnits:     25, factor: 1.00 },
  { minUnits:     26, maxUnits:    100, factor: 0.70 },
  { minUnits:    101, maxUnits:    500, factor: 0.50 },
  { minUnits:    501, maxUnits:   2500, factor: 0.30 },
  { minUnits:   2501, maxUnits:  25000, factor: 0.10 },
  { minUnits:  25001, maxUnits:   null, factor: 0.03 },
];

/** Return the discount factor for a given unit count */
export function webMethodsVolumeFactor(units: number): number {
  const tier = [...WEBMETHODS_VOLUME_TIERS].reverse().find((t) => units >= t.minUnits);
  return tier?.factor ?? 1.00;
}

/** Integration transactions per RU per month (App Integration capability) — legacy reference */
export const WEBMETHODS_INT_TRANSACTIONS_PER_RVU = 1000;

/** API transactions per RU per month (API Management capability) — legacy reference */
export const WEBMETHODS_API_TRANSACTIONS_PER_RVU = 10000;

/** Also export as WEBMETHODS_PRICE_PER_RVU_YEAR for backward compat */
export const WEBMETHODS_PRICE_PER_RVU_YEAR = WEBMETHODS_PRICE_PER_RU_YEAR;

// Note: Oct 2024 flat per-product annual rates have been superseded by the July 2026
// RU tiered tables above (WEBMETHODS_SAAS_*_TIERS / WEBMETHODS_SW_*_TIERS).
// The price-per-RU was updated from $11.54 to $40.08/yr (SaaS) and $40.00/yr (Software).

// ─── IBM Event Automation (separate product — NOT webMethods RU) ──────────────
// Source: "IBM Event Automation Sizing, Parts & Pricing" (Feb 10, 2026)
// PID: 5900-AXM · Billing metric: VPC (Virtual Processor Core)

export const IBM_EVENT_AUTOMATION_PID = "5900-AXM";
export const IBM_EVENT_AUTOMATION_PERPETUAL_PER_VPC = 8000;      // D0DU6ZX: Perpetual + S&S 12mo
export const IBM_EVENT_AUTOMATION_SUBSCRIPTION_PER_VPC_YEAR = 3204; // D0DU8ZX: Subscription License/year

export const IBM_EVENT_AUTOMATION_PARTS = {
  perpetualSS:  { part: "D0DU6ZX", description: "IBM Event Automation Perpetual + S&S 12mo", pricePerVPC: 8000,  unit: "per VPC" },
  subscription: { part: "D0DU8ZX", description: "IBM Event Automation Subscription License",  pricePerVPC: 3204,  unit: "per VPC/year" },
  monthly:      { part: "D0DU7ZX", description: "IBM Event Automation Monthly License",        pricePerVPC: null,  unit: "contact IBM" },
  ssRenewal:    { part: "E0DU5ZX", description: "IBM Event Automation Annual S&S Renewal",     pricePerVPC: null,  unit: "contact IBM" },
  ssReinstate:  { part: "D0DU9ZX", description: "IBM Event Automation S&S Reinstatement",      pricePerVPC: null,  unit: "contact IBM" },
  // Non-production equivalents (same pricing tiers)
  npPerpetual:  { part: "D0DUGZX", description: "IBM Event Automation Non-Production Perpetual", pricePerVPC: null, unit: "contact IBM" },
  npMonthly:    { part: "D0DUHZX", description: "IBM Event Automation Non-Production Monthly",   pricePerVPC: null, unit: "contact IBM" },
  npSSRenewal:  { part: "E0DUFZX", description: "IBM Event Automation Non-Production S&S",       pricePerVPC: null, unit: "contact IBM" },
} as const;

export const IBM_EVENT_AUTOMATION_NOTE =
  "IBM Event Automation (PID 5900-AXM) is a separate product from IBM webMethods. " +
  "Billing metric: VPC. List: $8,000/VPC (perpetual+S&S) or $3,204/VPC/year (subscription). " +
  "CP4I add-on variant (Event Processing only) was WITHDRAWN June 2026 — do not quote that path. " +
  "Route event-driven workloads to IBM Event Automation as a separate deal, not a webMethods RU add-on.";

// ─── CP4I (Cloud Pak for Integration) VPC pricing ────────────────────────────
// Source: "Cloud Pak for Integration - Sizing, Packaging and Pricing Guide" (Jun 22, 2026)

export const CP4I_SUBSCRIPTION_PER_VPC_MONTH = 1240;   // D2689LL — Subscription (CTL)
export const CP4I_PERPETUAL_PER_VPC           = 37100;  // D20ZBLL — Perpetual
export const CP4I_MONTHLY_PER_VPC_MONTH       = 1540;   // D211KLL — Monthly

export const CP4I_PARTS = {
  subscription: { part: "D2689LL",  description: "CP4I Subscription (CTL)",  pricePerVPCMonth: 1240,  notes: "Linux on Z: D268BLL" },
  perpetual:    { part: "D20ZBLL",  description: "CP4I Perpetual",            pricePerVPC: 37100,      notes: "Linux on Z: D20ZILL" },
  monthly:      { part: "D211KLL",  description: "CP4I Monthly",              pricePerVPCMonth: 1540,  notes: "Linux on Z: D211LLL" },
  // webMethods on-prem add-on parts (part numbers confirmed May 2026 + Jun 2026 IWHI sizing calculator)
  // Pricing: "Same price as CP4I" (IBM CP4I webMethods Add-on Pricing Guide, May 2026)
  // Current CP4I VPC list price NOT in Seismic — verify via Passport Advantage or IBM pricing desk.
  wmAddon1:     { part: "D16NRZX",  description: "webMethods CP4I VPC Subscription License",       pricePerVPC: null, notes: "Same price as CP4I VPC subscription (D2689LL). Current rate not in Seismic — verify via Passport Advantage." },
  wmAddon2:     { part: "D16NSZX",  description: "webMethods CP4I VPC License + SW S&S 12mo",       pricePerVPC: null, notes: "Same price as CP4I (perpetual+S&S variant, D20ZBLL). Current rate not in Seismic — verify via Passport Advantage." },
} as const;

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
    summary: "IBM manages infrastructure; customer focuses on integration design and management. Base: 60 RU/month per environment + 4 RU/100K txn (first 1M/yr). List $40.08/RU/year (IWHI SaaS Sizing Calculator, 2nd Jul 2026).",
  },
  {
    key: "onPrem",
    label: "webMethods On-Premises / Hybrid (CP4I Add-on)",
    summary: "Self-managed deployment. Billing metric: VPC. CP4I base: $1,240/VPC/month (D2689LL subscription) or $37,100/VPC (D20ZBLL perpetual). webMethods add-on: separate parts D16NRZX/D16NSZX — price per VPC contact IBM.",
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
    title: "Size SaaS by RU — base + tiered usage model (July 2026 rates)",
    body: "webMethods SaaS charges a base per environment/month (Integration: 60 RU, API Mgmt: 50 RU, B2B: 60 RU) plus tiered per-transaction RU. Integration: 4 RU/100K txn (0–100M/mo), then 1 RU/100K txn above. API Mgmt: 3 RU/1M txn (0–1B/mo), then 2 RU/1M above. B2B: 4 RU/100K txn (0–100M/mo), then 1 RU/100K above. List price $40.08/RU/year (IWHI SaaS Sizing Calculator, 2nd Jul 2026). Software (on-prem) has an extra low-volume tier at 20 RU/100K txn (0–10M/mo). On-prem is $40.00/RU/year.",
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
  { term: "RU", definition: "Resource Unit — SaaS billing unit. $40.08/RU/year (SaaS) or $40.00/RU/year (Software). Confirmed: IWHI Sizing Calculators, 2nd Jul 2026." },
  { term: "Integration rate (SaaS)", definition: "Base: 60 RU/env/month + 5 RU/runtime. Tiers: 4 RU per 100K txn (0–100M/mo), 1 RU per 100K txn (100M+/mo). Source: IWHI SaaS Sizing Calculator, 2nd Jul 2026." },
  { term: "API Management rate (SaaS)", definition: "Base: 50 RU/env/month. Tiers: 3 RU per 1M txn (0–1B/mo), 2 RU per 1M txn (1B+/mo). Source: IWHI SaaS Sizing Calculator, 2nd Jul 2026." },
  { term: "B2B rate (SaaS)", definition: "Base: 60 RU/env/month. Tiers: 4 RU per 100K txn (0–100M/mo), 1 RU per 100K txn (100M+/mo). Source: IWHI SaaS Sizing Calculator, 2nd Jul 2026." },
  { term: "Integration rate (Software)", definition: "Tiers: 20 RU per 100K txn (0–10M/mo), 4 RU per 100K txn (10M–100M/mo), 1 RU per 100K txn (100M+/mo). Source: IWHI Software Sizing Calculator, 2nd Jul 2026." },
  { term: "API Management rate (Software)", definition: "Tiers: 20 RU per 1M txn (0–100M/mo), 3 RU per 1M txn (100M–1B/mo), 2 RU per 1M txn (1B+/mo). Source: IWHI Software Sizing Calculator, 2nd Jul 2026." },
  { term: "B2B rate (Software)", definition: "Tiers: 20 RU per 100K txn (0–10M/mo), 4 RU per 100K txn (10M–100M/mo), 1 RU per 100K txn (100M+/mo). Source: IWHI Software Sizing Calculator, 2nd Jul 2026." },
  { term: "MFT rate", definition: "Tiers from Jul 2026 Software calc: 20 RU per 100K txn (0–10M/mo), 4 RU (10M–100M), 1 RU (100M+). SaaS MFT tiers similar — confirm from SaaS calculator. Prior proxy: $85/1K file txn/yr (Oct 2024)." },
  { term: "Event-Driven → IBM Event Automation", definition: "NOT a webMethods RU product. IBM Event Automation (PID 5900-AXM) is the correct SKU. Billing: VPC. $8,000/VPC perpetual (D0DU6ZX) or $3,204/VPC/year subscription (D0DU8ZX). Quote as a separate deal." },
  { term: "Volume discount factor", definition: "All webMethods SaaS products share a factor table: 1.00 at ≤25 units, 0.70 at 26–100, 0.50 at 101–500, 0.30 at 501–2500, 0.10 at 2501–25000, 0.03 at 25001+." },
  { term: "Flow Pilot", definition: "AI assistant inside webMethods for authoring, documenting, and testing integration flows." },
  { term: "B2B/EDI", definition: "Business-to-business and Electronic Data Interchange — webMethods' heritage strength." },
  { term: "VPC (CP4I)", definition: "Virtual Processor Core — on-prem/CP4I billing unit. CP4I subscription: $1,240/VPC/month (D2689LL). Perpetual: $37,100/VPC (D20ZBLL). webMethods add-on parts: D16NRZX/D16NSZX — price contact IBM. Software RU: $40.00/RU/year (IWHI Software Sizing Calculator, 2nd Jul 2026)." },
  { term: "Hybrid integration", definition: "Single platform spanning on-prem, IBM Cloud, and any public cloud." },
  { term: "webMethods 12.1", definition: "Current GA release — improved security, runtime, and developer experience." },
  { term: "CP4I", definition: "Cloud Pak for Integration — IBM's on-prem integration platform. webMethods on-prem add-on (D16NRZX/D16NSZX) is separate from base CP4I entitlement." },
];
