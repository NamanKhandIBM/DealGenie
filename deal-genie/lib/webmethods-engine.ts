/**
 * webMethods estimation engine.
 *
 * CONFIRMED pricing (IBM Docs hybrid-integration-lib, Jul 2026 + Seismic Dec 2025):
 *
 *   SaaS RU structure:
 *     Base: 60 RU/month per integration instance (production)
 *     Usage tier 1: 4 RU per 100K transactions (first 1M txn/year)
 *     Usage tier 2: 1 RU per 100K transactions (over 1M txn/year)
 *     List price: ~$11.54/RU/year
 *
 *   On-Premises / CP4I Add-on: priced per VPC — same rate as CP4I. Contact IBM.
 */
import {
  WEBMETHODS_CAPABILITIES,
  WEBMETHODS_DEPLOYMENTS,
  WEBMETHODS_BEST_PRACTICES,
  WEBMETHODS_QUICK_REFERENCE,
  WEBMETHODS_PRICE_PER_RU_YEAR,
  WEBMETHODS_BASE_RU_PER_MONTH,
  WEBMETHODS_RU_PER_100K_TXN_TIER1,
  WEBMETHODS_RU_PER_100K_TXN_TIER2,
  WEBMETHODS_API_TRANSACTIONS_PER_RVU,
} from "./webmethods-data";

export interface WebMethodsInputs {
  needsAppIntegration?: boolean;
  needsAPIManagement?: boolean;
  needsB2B?: boolean;
  needsEventDriven?: boolean;
  preferSaaS?: boolean;
  verifyAlreadyOwned?: boolean;
  estimatedIntegrations?: number;         // monthly integration transactions (for RVU calc)
  estimatedAPITransactions?: number;      // monthly API transactions (for RVU calc)
  industryVertical?: "financial" | "healthcare" | "manufacturing" | "retail" | "other";
}

export interface WebMethodsLineItem {
  capability: string;
  rvuCount: number;
  annualList: number;
  notes: string;
}

export interface WebMethodsScopeSummary {
  recommendedCapabilities: string[];
  capabilityDescriptions: { label: string; summary: string }[];
  deploymentRecommendation: string;
  lines: WebMethodsLineItem[];
  totalRVU: number;
  totalAnnualList: number;
  verifyNote?: string;
  sellerPositioning: string[];
  nextStep: string;
  flags: string[];
  bestPractices: typeof WEBMETHODS_BEST_PRACTICES;
  quickReference: typeof WEBMETHODS_QUICK_REFERENCE;
}

// ── Helper: compute annual RU from monthly transaction volume using tiered rates
function computeIntegrationRU(monthlyTxn: number): { usageRU: number; notes: string } {
  // Annualize: monthly × 12
  const annualTxn = monthlyTxn * 12;
  const tier1Cap = 1_000_000; // first 1M transactions/year at tier-1 rate
  const tier1Txn = Math.min(annualTxn, tier1Cap);
  const tier2Txn = Math.max(0, annualTxn - tier1Cap);

  const tier1RU = Math.ceil((tier1Txn / 100_000) * WEBMETHODS_RU_PER_100K_TXN_TIER1);
  const tier2RU = Math.ceil((tier2Txn / 100_000) * WEBMETHODS_RU_PER_100K_TXN_TIER2);
  const usageRU = tier1RU + tier2RU;

  const notes = tier2Txn > 0
    ? `${monthlyTxn.toLocaleString()} txn/mo → ${(annualTxn / 1_000_000).toFixed(1)}M/yr. Tier1: ${tier1RU} RU + Tier2: ${tier2RU} RU (over 1M)`
    : `${monthlyTxn.toLocaleString()} txn/mo → ${annualTxn.toLocaleString()}/yr, ${tier1RU} RU usage`;
  return { usageRU, notes };
}

export function computeWebMethodsScope(inputs: WebMethodsInputs): WebMethodsScopeSummary {
  const flags: string[] = [];
  const lines: WebMethodsLineItem[] = [];

  const recommended = new Set<string>();

  if (inputs.needsAppIntegration || !Object.values(inputs).some(Boolean)) {
    recommended.add("appIntegration");
  }
  if (inputs.needsAPIManagement) recommended.add("apiManagement");
  if (inputs.needsB2B)           recommended.add("b2b");
  if (inputs.needsEventDriven)   recommended.add("eventDriven");
  recommended.add("aiWorkflows");
  recommended.add("hybrid");

  // ── RU estimation (base + tiered usage model) ─────────────────────────────
  const isSaaS = inputs.preferSaaS
    || !(inputs.industryVertical === "financial" || inputs.industryVertical === "healthcare");

  if (isSaaS) {
    const intTxn = inputs.estimatedIntegrations ?? 0;
    const apiTxn = inputs.estimatedAPITransactions ?? 0;

    // Base charge: 60 RU/month × 12 = 720 RU/year per instance
    const baseRUAnnual = WEBMETHODS_BASE_RU_PER_MONTH * 12;
    const baseAnnualList = Math.round(baseRUAnnual * WEBMETHODS_PRICE_PER_RU_YEAR);
    lines.push({
      capability: "SaaS Base Subscription (1 environment)",
      rvuCount: baseRUAnnual,
      annualList: baseAnnualList,
      notes: `${WEBMETHODS_BASE_RU_PER_MONTH} RU/month × 12 = ${baseRUAnnual} RU × $${WEBMETHODS_PRICE_PER_RU_YEAR}/RU/yr`,
    });

    if (intTxn > 0 && inputs.needsAppIntegration) {
      const { usageRU, notes } = computeIntegrationRU(intTxn);
      const annual = Math.round(usageRU * WEBMETHODS_PRICE_PER_RU_YEAR);
      lines.push({
        capability: "App Integration (usage)",
        rvuCount: usageRU,
        annualList: annual,
        notes,
      });
    }

    if (apiTxn > 0 && inputs.needsAPIManagement) {
      // API usage: no confirmed tiered rate yet — use 1 RU per 10K API txn/month reference
      const apiRU = Math.ceil((apiTxn / WEBMETHODS_API_TRANSACTIONS_PER_RVU));
      const annual = Math.round(apiRU * WEBMETHODS_PRICE_PER_RU_YEAR);
      lines.push({
        capability: "API Management (usage)",
        rvuCount: apiRU,
        annualList: annual,
        notes: `${apiTxn.toLocaleString()} API txn/month ÷ ${WEBMETHODS_API_TRANSACTIONS_PER_RVU.toLocaleString()} = ${apiRU} RU/month ref. ⚠ API txn rate unconfirmed; confirm with IBM.`,
      });
      flags.push("API Management usage rate not confirmed in a single IBM document — validate RU/API-transaction conversion with IBM before presenting to client.");
    }

    if (lines.length <= 1) {
      // Only base, no usage — show budgetary note
      flags.push("Only base subscription estimated. Provide monthly transaction volume for full usage estimate. Base: 60 RU/month ($8,310/yr list). Usage: 4 RU/100K txn (tier 1).");
    } else {
      flags.push(`SaaS estimate uses confirmed base+usage model (IBM Docs, Jul 2026). List price $${WEBMETHODS_PRICE_PER_RU_YEAR}/RU/year. Standard IBM discounting applies.`);
    }
    if (inputs.needsB2B || inputs.needsEventDriven) {
      flags.push("B2B/EDI and Event-Driven RU rates not yet confirmed in public documentation — contact IBM for current transaction-to-RU mapping for these capabilities.");
    }
  } else {
    flags.push("On-Premises / CP4I: priced per VPC (Virtual Processor Core) — same rate as Cloud Pak for Integration. Contact IBM for current VPC pricing.");
  }

  const totalRVU = lines.reduce((s, l) => s + l.rvuCount, 0);
  const totalAnnualList = lines.reduce((s, l) => s + l.annualList, 0);

  // ── Capability descriptions ────────────────────────────────────────────────
  const capabilityDescriptions = WEBMETHODS_CAPABILITIES
    .filter((c) => recommended.has(c.key))
    .map((c) => ({ label: c.label, summary: c.summary }));

  // ── Deployment recommendation ──────────────────────────────────────────────
  const deploymentRecommendation = inputs.preferSaaS
    ? WEBMETHODS_DEPLOYMENTS.find((d) => d.key === "saas")!.summary
    : inputs.industryVertical === "financial" || inputs.industryVertical === "healthcare"
      ? WEBMETHODS_DEPLOYMENTS.find((d) => d.key === "onPrem")!.summary
      : "Evaluate SaaS vs. hybrid based on data residency and compliance requirements.";

  // ── Seller positioning ─────────────────────────────────────────────────────
  const sellerPositioning: string[] = [];
  sellerPositioning.push("IBM webMethods is a Forrester Wave Leader in iPaaS (Q3 2025) — use this as the entry-point credibility statement.");

  if (inputs.needsB2B) {
    sellerPositioning.push("B2B/EDI capability is a key differentiator vs. lightweight iPaaS tools. No other IBM integration product matches webMethods' B2B depth.");
  }
  if (inputs.needsAPIManagement && inputs.needsAppIntegration) {
    sellerPositioning.push("Unified platform for both API management and application integration — avoids point-tool sprawl and simplifies governance.");
  }
  if ((inputs.estimatedIntegrations ?? 0) > 50000) {
    sellerPositioning.push(`${(inputs.estimatedIntegrations ?? 0).toLocaleString()} integration transactions/month is significant — position webMethods' governance, reuse, and AI-assisted authoring as scale enablers.`);
  }

  // ── Verify cross-sell ──────────────────────────────────────────────────────
  let verifyNote: string | undefined;
  if (inputs.verifyAlreadyOwned) {
    verifyNote =
      "**IBM Security Verify is already in scope** — highlight the API security story. webMethods exposes APIs and integration endpoints; Verify provides the OAuth 2.0/OIDC identity layer that secures them. 'Governed integration fabric': webMethods for connectivity, Verify for access control.";
    flags.push("Verify owned: emphasize the webMethods API security + Verify identity governance integration story.");
  } else if (inputs.needsAPIManagement) {
    verifyNote =
      "**Cross-sell: IBM Security Verify.** APIs managed by webMethods need identity-based access control. IBM Security Verify provides OAuth 2.0/OIDC token governance and adaptive access policies. Type **cross-sell** to explore the Verify attach.";
  }

  // ── Next step ──────────────────────────────────────────────────────────────
  const nextStep = lines.length > 1
    ? "Use this base+usage RU estimate as a budgetary reference. Engage IBM for the webMethods SaaS PAYGo SKU and formal quote. For B2B deals, request a B2B/EDI-specific PoC."
    : "Request a webMethods demo with Flow Pilot AI assistance. Provide monthly transaction volumes for a full usage estimate. For B2B deals, request a B2B/EDI-specific reference.";

  if (inputs.industryVertical === "financial" || inputs.industryVertical === "healthcare") {
    flags.push(`${inputs.industryVertical === "financial" ? "Financial services" : "Healthcare"}: regulatory compliance and data residency may require on-premises or hybrid deployment. Confirm early.`);
  }

  return {
    recommendedCapabilities: Array.from(recommended),
    capabilityDescriptions,
    deploymentRecommendation,
    lines,
    totalRVU,
    totalAnnualList: Math.round(totalAnnualList * 100) / 100,
    verifyNote,
    sellerPositioning,
    nextStep,
    flags,
    bestPractices: WEBMETHODS_BEST_PRACTICES,
    quickReference: WEBMETHODS_QUICK_REFERENCE,
  };
}
