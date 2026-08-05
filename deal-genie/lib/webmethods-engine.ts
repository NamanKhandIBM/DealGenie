/**
 * webMethods estimation engine.
 *
 * CONFIRMED pricing (IBM Docs hybrid-integration-lib, Jul 2026 + Seismic Dec 2025
 *   + IWHI SaaS Sizing Calculator, 2nd July 2026
 *   + IWHI Software Sizing Calculator, 2nd July 2026):
 *
 *   SaaS RU structure (IWHI SaaS Sizing Calculator, 2nd Jul 2026):
 *     Base: Integration 60 RU/env/month + 5 RU/runtime | API Mgmt 50 RU/env/month | B2B 60 RU/env/month
 *     Integration tiers:   4 RU/100K txn (0–100M/mo), 1 RU/100K txn (100M+/mo)
 *     API Mgmt tiers:      3 RU/1M txn (0–1B/mo), 2 RU/1M txn (1B+/mo)
 *     B2B tiers:           4 RU/100K txn (0–100M/mo), 1 RU/100K txn (100M+/mo)
 *     List price: $40.08/RU/year
 *
 *   Software tiers have an extra low-volume band at 20 RU/100K txn (0–10M/mo).
 *   List price: $40.00/RU/year
 *
 *   Event-Driven: NOT a webMethods RU product — IBM Event Automation (PID 5900-AXM).
 *   On-Premises / CP4I Add-on: priced per VPC — same rate as CP4I. Contact IBM.
 */
import {
  WEBMETHODS_CAPABILITIES,
  WEBMETHODS_DEPLOYMENTS,
  WEBMETHODS_BEST_PRACTICES,
  WEBMETHODS_QUICK_REFERENCE,
  WEBMETHODS_PRICE_PER_RU_YEAR,
  WEBMETHODS_BASE_RU_PER_MONTH,
  WEBMETHODS_API_BASE_RU_PER_MONTH,
  WEBMETHODS_SAAS_INT_TIERS,
  WEBMETHODS_SAAS_API_TIERS,
  WEBMETHODS_SAAS_B2B_TIERS,
  WEBMETHODS_ANNUAL_RATE_MFT,
  computeMonthlyRU,
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
  estimatedIntegrations?: number;         // monthly integration transactions
  estimatedAPITransactions?: number;      // monthly API transactions
  estimatedB2BTransactions?: number;      // monthly B2B/EDI transactions
  estimatedMFTTransactions?: number;      // monthly file-transfer transactions
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

// ── Helper: compute monthly RU for a product using its tier table, with a note
function computeProductRU(
  monthlyTxn: number,
  tiers: typeof WEBMETHODS_SAAS_INT_TIERS,
  label: string,
): { monthlyRU: number; annualRU: number; notes: string } {
  const monthlyRU = computeMonthlyRU(monthlyTxn, tiers);
  const annualRU = monthlyRU * 12;
  const tier = [...tiers].reverse().find((t) => monthlyTxn >= t.fromTxn);
  const rateDesc = tier ? `${tier.ruPer} RU per ${tier.perTxn.toLocaleString()} txn` : "n/a";
  const notes = `${label}: ${monthlyTxn.toLocaleString()} txn/mo → ${monthlyRU} RU/mo (${rateDesc}) × 12 = ${annualRU} RU/yr. Source: IWHI SaaS Sizing Calculator, 2nd Jul 2026.`;
  return { monthlyRU, annualRU, notes };
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

    // Base charge: Integration 60 RU/env/month × 12 = 720 RU/year
    const baseRUAnnual = WEBMETHODS_BASE_RU_PER_MONTH * 12;
    const baseAnnualList = Math.round(baseRUAnnual * WEBMETHODS_PRICE_PER_RU_YEAR);
    lines.push({
      capability: "SaaS Base Subscription — Integration (1 environment)",
      rvuCount: baseRUAnnual,
      annualList: baseAnnualList,
      notes: `Integration base: ${WEBMETHODS_BASE_RU_PER_MONTH} RU/env/month × 12 = ${baseRUAnnual} RU/yr × $${WEBMETHODS_PRICE_PER_RU_YEAR}/RU/yr = $${baseAnnualList.toLocaleString()}/yr. Source: IWHI SaaS Sizing Calculator, 2nd Jul 2026.`,
    });

    if (intTxn > 0 && inputs.needsAppIntegration) {
      const { annualRU, notes } = computeProductRU(intTxn, WEBMETHODS_SAAS_INT_TIERS, "Integration");
      const annualList = Math.round(annualRU * WEBMETHODS_PRICE_PER_RU_YEAR);
      lines.push({
        capability: "App Integration — transaction usage",
        rvuCount: annualRU,
        annualList,
        notes: `${notes} × $${WEBMETHODS_PRICE_PER_RU_YEAR}/RU/yr = $${annualList.toLocaleString()}/yr`,
      });
    }

    if (apiTxn > 0 && inputs.needsAPIManagement) {
      // API Management base: 50 RU/env/month
      const apiBaseRUAnnual = WEBMETHODS_API_BASE_RU_PER_MONTH * 12;
      const apiBaseList = Math.round(apiBaseRUAnnual * WEBMETHODS_PRICE_PER_RU_YEAR);
      lines.push({
        capability: "API Management base (1 environment)",
        rvuCount: apiBaseRUAnnual,
        annualList: apiBaseList,
        notes: `API Mgmt base: ${WEBMETHODS_API_BASE_RU_PER_MONTH} RU/env/month × 12 = ${apiBaseRUAnnual} RU/yr × $${WEBMETHODS_PRICE_PER_RU_YEAR}/RU/yr = $${apiBaseList.toLocaleString()}/yr. Source: IWHI SaaS Sizing Calculator, 2nd Jul 2026.`,
      });
      const { annualRU, notes } = computeProductRU(apiTxn, WEBMETHODS_SAAS_API_TIERS, "API Management");
      const annualList2 = Math.round(annualRU * WEBMETHODS_PRICE_PER_RU_YEAR);
      lines.push({
        capability: "API Management — transaction usage",
        rvuCount: annualRU,
        annualList: annualList2,
        notes: `${notes} × $${WEBMETHODS_PRICE_PER_RU_YEAR}/RU/yr = $${annualList2.toLocaleString()}/yr`,
      });
    }

    if (inputs.needsB2B) {
      if (intTxn > 0) {
        const { annualRU, notes } = computeProductRU(intTxn, WEBMETHODS_SAAS_B2B_TIERS, "B2B (using integration txn as proxy)");
        const annualList = Math.round(annualRU * WEBMETHODS_PRICE_PER_RU_YEAR);
        lines.push({
          capability: "B2B Integration — transaction usage",
          rvuCount: annualRU,
          annualList,
          notes: `${notes} × $${WEBMETHODS_PRICE_PER_RU_YEAR}/RU/yr = $${annualList.toLocaleString()}/yr`,
        });
      } else {
        flags.push("B2B: provide monthly transaction volume for estimate. Tiers: 4 RU/100K txn (0–100M/mo), 1 RU/100K txn (100M+/mo). Base: 60 RU/env/month. Source: IWHI SaaS Sizing Calculator, 2nd Jul 2026.");
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
          capability: "Managed File Transfer / MFT",
          rvuCount: Math.ceil(annual / WEBMETHODS_PRICE_PER_RU_YEAR),
          annualList: annual,
          notes: `${mftTxn.toLocaleString()} file txn/mo → ${annualMftTxn.toLocaleString()}/yr → ${units.toFixed(1)}K units × $${WEBMETHODS_ANNUAL_RATE_MFT}/K/yr × ${factor} volume factor = $${annual.toLocaleString()}/yr. Note: MFT Jul 2026 tier table pending — using Oct 2024 proxy rate.`,
        });
      } else {
        flags.push("MFT: provide monthly file-transfer transaction volume for estimate. Jul 2026 Software tiers: 20 RU/100K txn (0–10M/mo), 4 RU (10M–100M), 1 RU (100M+). SaaS MFT tiers to confirm.");
      }
    }

    if (lines.length <= 1) {
      flags.push("Only base subscription estimated. Provide monthly transaction volume for full usage estimate. Integration base: 60 RU/env/month ($28,858/yr list at $40.08/RU/yr). Transaction tiers: 4 RU/100K txn (0–100M/mo), 1 RU/100K (100M+/mo). Source: IWHI SaaS Sizing Calculator, 2nd Jul 2026.");
    } else {
      flags.push(`SaaS estimate uses confirmed tiered RU rates from IWHI SaaS Sizing Calculator, 2nd Jul 2026. List price $${WEBMETHODS_PRICE_PER_RU_YEAR}/RU/year. Standard IBM discounting applies.`);
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
