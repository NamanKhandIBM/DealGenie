/**
 * webMethods estimation engine.
 *
 * CONFIRMED pricing (IBM Docs hybrid-integration-lib, Jul 2026 + Seismic Dec 2025
 *   + IBM webMethods SaaS Calculator, Oct 2024):
 *
 *   SaaS RU structure (IBM Docs):
 *     Base: 60 RU/month per integration instance (production)
 *     Usage tier 1: 4 RU per 100K transactions (first 1M txn/year)
 *     Usage tier 2: 1 RU per 100K transactions (over 1M txn/year)
 *     List price: ~$11.54/RU/year
 *
 *   Per-product annual rates (IBM SaaS Calculator):
 *     Integration: $92/1K txn/yr | API Mgmt: $100/10K API txn/yr
 *     B2B: $75/1K txn/yr | B2B Integration: $92/1K txn/yr | MFT: $85/1K file txn/yr
 *     All share volume-discount factor table (1.00→0.03).
 *
 *   Event-Driven: NOT a confirmed webMethods RU metric — may be IBM Event Automation.
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
  WEBMETHODS_ANNUAL_RATE_INTEGRATION,
  WEBMETHODS_ANNUAL_RATE_API_MGMT,
  WEBMETHODS_ANNUAL_RATE_B2B,
  WEBMETHODS_ANNUAL_RATE_B2B_INT,
  WEBMETHODS_ANNUAL_RATE_MFT,
  webMethodsVolumeFactor,
} from "./webmethods-data";

export interface WebMethodsInputs {
  needsAppIntegration?: boolean;
  needsAPIManagement?: boolean;
  needsB2B?: boolean;
  needsMFT?: boolean;
  needsEventDriven?: boolean;
  preferSaaS?: boolean;
  verifyAlreadyOwned?: boolean;
  estimatedIntegrations?: number;         // monthly integration transactions (for RVU calc)
  estimatedAPITransactions?: number;      // monthly API transactions (for RVU calc)
  estimatedMFTTransactions?: number;      // monthly file-transfer transactions (for MFT calc)
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
  if (inputs.needsMFT)           recommended.add("mft");
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
      // Use confirmed IBM SaaS Calculator rate: $92 per 1,000 txn/year with volume factor
      const annualTxn = intTxn * 12;
      const units = annualTxn / 1000;
      const factor = webMethodsVolumeFactor(units);
      const annual = Math.round(units * WEBMETHODS_ANNUAL_RATE_INTEGRATION * factor);
      lines.push({
        capability: "App Integration (per-product rate)",
        rvuCount: Math.ceil(annual / WEBMETHODS_PRICE_PER_RU_YEAR), // back-calc for RU display
        annualList: annual,
        notes: `${intTxn.toLocaleString()} txn/mo → ${annualTxn.toLocaleString()}/yr → ${units.toFixed(1)}K units × $${WEBMETHODS_ANNUAL_RATE_INTEGRATION}/K/yr × ${factor} volume factor = $${annual.toLocaleString()}/yr. Source: IBM SaaS Calculator Oct 2024.`,
      });
    }

    if (apiTxn > 0 && inputs.needsAPIManagement) {
      // Use confirmed IBM SaaS Calculator rate: $100 per 10,000 API txn/year with volume factor
      const annualApiTxn = apiTxn * 12;
      const units = annualApiTxn / 10000;
      const factor = webMethodsVolumeFactor(units);
      const annual = Math.round(units * WEBMETHODS_ANNUAL_RATE_API_MGMT * factor);
      lines.push({
        capability: "API Management (per-product rate)",
        rvuCount: Math.ceil(annual / WEBMETHODS_PRICE_PER_RU_YEAR),
        annualList: annual,
        notes: `${apiTxn.toLocaleString()} API txn/mo → ${annualApiTxn.toLocaleString()}/yr → ${units.toFixed(1)}K units × $${WEBMETHODS_ANNUAL_RATE_API_MGMT}/10K-unit/yr × ${factor} volume factor = $${annual.toLocaleString()}/yr. Source: IBM SaaS Calculator Oct 2024.`,
      });
    }

    if (inputs.needsB2B) {
      // B2B: $75/1K txn/yr — flag that we need txn volume for a full estimate
      if (intTxn > 0) {
        const annualTxn = intTxn * 12;
        const units = annualTxn / 1000;
        const factor = webMethodsVolumeFactor(units);
        const annual = Math.round(units * WEBMETHODS_ANNUAL_RATE_B2B * factor);
        lines.push({
          capability: "B2B Integration (per-product rate)",
          rvuCount: Math.ceil(annual / WEBMETHODS_PRICE_PER_RU_YEAR),
          annualList: annual,
          notes: `${intTxn.toLocaleString()} txn/mo (used as proxy) → ${units.toFixed(1)}K units × $${WEBMETHODS_ANNUAL_RATE_B2B}/K/yr × ${factor} volume factor = $${annual.toLocaleString()}/yr. Source: IBM SaaS Calculator Oct 2024.`,
        });
      } else {
        flags.push("B2B: provide monthly transaction volume for estimate. Confirmed rate: $75/1K txn/yr (IBM SaaS Calculator Oct 2024) with volume factor.");
      }
    }

    if (inputs.needsMFT) {
      const mftTxn = inputs.estimatedMFTTransactions ?? 0;
      if (mftTxn > 0) {
        const annualMftTxn = mftTxn * 12;
        const units = annualMftTxn / 1000;
        const factor = webMethodsVolumeFactor(units);
        const annual = Math.round(units * WEBMETHODS_ANNUAL_RATE_MFT * factor);
        lines.push({
          capability: "Managed File Transfer / MFT (per-product rate)",
          rvuCount: Math.ceil(annual / WEBMETHODS_PRICE_PER_RU_YEAR),
          annualList: annual,
          notes: `${mftTxn.toLocaleString()} file txn/mo → ${annualMftTxn.toLocaleString()}/yr → ${units.toFixed(1)}K units × $${WEBMETHODS_ANNUAL_RATE_MFT}/K/yr × ${factor} volume factor = $${annual.toLocaleString()}/yr. Source: IBM SaaS Calculator Oct 2024.`,
        });
      } else {
        flags.push("MFT: provide monthly file-transfer transaction volume for estimate. Confirmed rate: $85/1K file txn/yr (IBM SaaS Calculator Oct 2024) with volume factor.");
      }
    }

    if (lines.length <= 1) {
      flags.push("Only base subscription estimated. Provide monthly transaction volume for full usage estimate. Base: 60 RU/month ($28,858/yr list at $40.08/RU/yr). Usage: 4 RU/100K txn (tier 1), or use per-product rates from IBM SaaS Calculator.");
    } else {
      flags.push(`SaaS estimate uses confirmed per-product rates (IBM SaaS Calculator Oct 2024) + base model (IBM Docs Jul 2026). List price ~$${WEBMETHODS_PRICE_PER_RU_YEAR}/RU/year. Standard IBM discounting applies.`);
    }
    if (inputs.needsEventDriven) {
      flags.push("⚠ Event-Driven: IBM has not confirmed a webMethods RU rate for this capability. It may be priced under IBM Event Automation (a separate product line). Do NOT quote a webMethods RU rate — confirm with IBM first.");
    }
  } else {
    flags.push(
      "On-Prem/CP4I: D16NRZX (VPC Subscription) and D16NSZX (VPC License + S&S) confirmed (CP4I webMethods Add-on Pricing Guide, May 5, 2026). " +
      "Price = same as base CP4I VPC rate (CP4I base: D2689LL $1,240/VPC/month subscription, D20ZBLL $37,100/VPC perpetual). " +
      "Confirm the exact webMethods add-on VPC rate via Passport Advantage or IBM pricing desk — the deck states 'same as CP4I' without giving an absolute figure."
    );
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

  flags.push(
    "Discount approval thresholds for IBM webMethods are not published as a static authorization matrix in Seismic. " +
    "Discount authority is managed in IBM Software CPQ — confirm approval requirements with your IBM pricing desk before committing to a discount level."
  );

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
