/**
 * Concert estimation engine.
 *
 * TWO PRODUCTS — different PIDs, different prices:
 *   PID 5900BD6 — Concert SaaS (GA Jul 7, 2026):   ~$1.06/RU/year ($1,059.60/1,000 RU/annum)
 *   PID 5900BBE — Concert On-Prem (GA Jun 12, 2026): $212/RU/year (subscription, D0MK3ZX)
 *                                                     $265/RU/month (monthly, D0MK5ZX)
 *
 * Rule: customer wants IBM to host → 5900BD6. Customer self-hosts → 5900BBE.
 *
 * Confirmed RU mappings (Concert Standard RU Model – Ratio Table):
 *   Protect     — Vulnerability management: 3 RU per managed application
 *   Resilience  — Posture assessment:       5 RU per app
 *   Workflows   — Deployed workflows:       5 RU per deployed workflow in production
 *   Observe ESS — App Perf Mgmt Essentials: 1 RU per 7 MVS
 *   Observe STD — App Perf Mgmt Standard:   1 RU per 2 MVS
 *   Optimize    — Resource optimization:    1 RU per 5 MVS
 *
 * NOTE: "Operate" is NOT a category in IBM's Concert RU model — no RU mapping exists.
 */
import {
  CONCERT_MODULES,
  CONCERT_BEST_PRACTICES,
  CONCERT_QUICK_REFERENCE,
  CONCERT_PRICE_PER_RU_SUBSCRIPTION,
  CONCERT_PRICE_PER_RU_MONTHLY,
  CONCERT_SAAS_PRICE_PER_RU_YEAR,
  CONCERT_SAAS_PID,
  CONCERT_ONPREM_PID,
  CONCERT_RU_PER_APP_VULN,
  CONCERT_RU_PER_APP_RESILIENCE,
  CONCERT_RU_PER_WORKFLOW,
  CONCERT_RU_PER_MVS_OBSERVE_ESS,
  CONCERT_RU_PER_MVS_OBSERVE_STD,
  CONCERT_RU_PER_MVS_OPTIM,
} from "./concert-data";

export interface ConcertInputs {
  primaryPain: "alertFatigue" | "slowMTTR" | "costOptimization" | "riskPosture" | "all";
  deployment?: "saas" | "onprem";          // "saas" → PID 5900BD6, "onprem" → PID 5900BBE
  hasInstana?: boolean;
  thirdPartyMonitoring?: boolean;
  needsWorkflowAutomation?: boolean;
  needsCostOptimization?: boolean;
  needsSecurityRisk?: boolean;
  needsResilience?: boolean;
  estimatedApplications?: number;     // for Protect (3 RU/app) and Resilience (5 RU/app)
  estimatedWorkflows?: number;        // for Workflows (5 RU/workflow)
  estimatedMVS?: number;              // for Optimize (1 RU/5 MVS) and Observe (1 RU/7 or 2 MVS)
  observeTier?: "essentials" | "standard"; // default: essentials (1 RU/7 MVS)
  licenseType?: "subscription" | "monthly";  // default: subscription
}

export interface ConcertLineItem {
  module: string;
  ruCount: number;
  annualList: number;
  notes: string;
}

export interface ConcertRecommendationResult {
  recommendedModules: string[];
  moduleDescriptions: { label: string; summary: string }[];
  lines: ConcertLineItem[];
  totalRU: number;
  totalAnnualList: number;
  pricePerRU: number;
  instanaNote?: string;
  sellerPositioning: string[];
  nextStep: string;
  flags: string[];
  bestPractices: typeof CONCERT_BEST_PRACTICES;
  quickReference: typeof CONCERT_QUICK_REFERENCE;
}

export function computeConcertRecommendation(inputs: ConcertInputs): ConcertRecommendationResult {
  const flags: string[] = [];
  const lines: ConcertLineItem[] = [];

  // Determine which product and price to use based on deployment model
  const isSaaS = (inputs.deployment ?? "onprem") === "saas";
  const pid = isSaaS ? CONCERT_SAAS_PID : CONCERT_ONPREM_PID;
  const licenseType = inputs.licenseType ?? "subscription";
  const pricePerRU = isSaaS
    ? CONCERT_SAAS_PRICE_PER_RU_YEAR                          // ~$1.06/RU/yr — PID 5900BD6
    : licenseType === "monthly"
      ? CONCERT_PRICE_PER_RU_MONTHLY * 12                     // $265/RU/mo annualised
      : CONCERT_PRICE_PER_RU_SUBSCRIPTION;                    // $212/RU/yr — D0MK3ZX

  if (isSaaS) {
    flags.push(`Concert SaaS (PID ${pid}, GA Jul 7, 2026): $1,059.60/1,000 RU/annum (~$1.06/RU/yr). IBM hosts the platform.`);
  } else {
    flags.push(`Concert On-Prem (PID ${pid}, GA Jun 12, 2026): $212/RU/year subscription (D0MK3ZX). Customer self-hosts.`);
  }

  // ── Module selection ───────────────────────────────────────────────────────
  const recommended = new Set<string>();
  recommended.add("observe");
  // NOTE: "operate" removed — it has no RU mapping in IBM's Concert model.

  const needsProtect    = inputs.needsSecurityRisk || inputs.primaryPain === "riskPosture" || inputs.primaryPain === "all";
  const needsOptimize   = inputs.needsCostOptimization || inputs.primaryPain === "costOptimization" || inputs.primaryPain === "all";
  const needsWorkflows  = inputs.needsWorkflowAutomation || inputs.primaryPain === "all";
  const needsResilience = inputs.needsResilience || inputs.primaryPain === "all";
  const needsSlowMTTR   = inputs.primaryPain === "slowMTTR" || inputs.primaryPain === "all";

  if (needsOptimize)   recommended.add("optimize");
  if (needsProtect)    recommended.add("protect");
  if (needsWorkflows || needsSlowMTTR) recommended.add("workflows");
  if (needsResilience) recommended.add("resilience");

  // ── RU estimation — all five confirmed mappings ───────────────────────────
  const apps      = inputs.estimatedApplications ?? 0;
  const mvs       = inputs.estimatedMVS ?? 0;
  const workflows = inputs.estimatedWorkflows ?? 0;
  const observeTier = inputs.observeTier ?? "essentials";

  if (needsProtect && apps > 0) {
    const ru = Math.ceil(apps * CONCERT_RU_PER_APP_VULN);
    lines.push({
      module: "Concert Protect — Vulnerability Management",
      ruCount: ru,
      annualList: Math.round(ru * pricePerRU * 100) / 100,
      notes: `3 RU × ${apps} apps = ${ru} RU at $${pricePerRU}/RU/year`,
    });
  }

  if (needsResilience && apps > 0) {
    const ru = Math.ceil(apps * CONCERT_RU_PER_APP_RESILIENCE);
    lines.push({
      module: "Concert Resilience — Posture Assessment",
      ruCount: ru,
      annualList: Math.round(ru * pricePerRU * 100) / 100,
      notes: `5 RU × ${apps} apps = ${ru} RU at $${pricePerRU}/RU/year`,
    });
  }

  if ((needsWorkflows || needsSlowMTTR) && workflows > 0) {
    const ru = Math.ceil(workflows * CONCERT_RU_PER_WORKFLOW);
    lines.push({
      module: "Concert Workflows — Deployed Workflow Automation",
      ruCount: ru,
      annualList: Math.round(ru * pricePerRU * 100) / 100,
      notes: `5 RU × ${workflows} workflows = ${ru} RU at $${pricePerRU}/RU/year`,
    });
  }

  if (mvs > 0) {
    // Observe is always recommended; tier determines RU/MVS ratio
    const ruPerMVS = observeTier === "standard" ? CONCERT_RU_PER_MVS_OBSERVE_STD : CONCERT_RU_PER_MVS_OBSERVE_ESS;
    const tierLabel = observeTier === "standard" ? "Standard APM (1 RU/2 MVS)" : "Essentials APM (1 RU/7 MVS)";
    const ru = Math.ceil(mvs * ruPerMVS);
    lines.push({
      module: `Concert Observe — ${tierLabel}`,
      ruCount: ru,
      annualList: Math.round(ru * pricePerRU * 100) / 100,
      notes: `${tierLabel} × ${mvs} MVS = ${ru} RU at $${pricePerRU}/RU/year`,
    });
  }

  if (needsOptimize && mvs > 0) {
    const ru = Math.ceil(mvs * CONCERT_RU_PER_MVS_OPTIM);
    lines.push({
      module: "Concert Optimize — Resource Optimization",
      ruCount: ru,
      annualList: Math.round(ru * pricePerRU * 100) / 100,
      notes: `1 RU per 5 MVS × ${mvs} MVS = ${ru} RU at $${pricePerRU}/RU/year`,
    });
  }

  // Flag if we have modules selected but no quantity inputs to size them
  const missingInputs: string[] = [];
  if ((needsProtect || needsResilience) && apps === 0) missingInputs.push("application count (for Protect/Resilience)");
  if ((needsWorkflows || needsSlowMTTR) && workflows === 0) missingInputs.push("workflow count (for Workflows)");
  if (mvs === 0) missingInputs.push("MVS count (for Observe/Optimize)");
  if (missingInputs.length > 0) {
    flags.push(`Provide ${missingInputs.join(" and ")} for a complete RU estimate.`);
  }

  const totalRU = lines.reduce((s, l) => s + l.ruCount, 0);
  const totalAnnualList = lines.reduce((s, l) => s + l.annualList, 0);

  if (totalRU > 0) {
    if (isSaaS) {
      flags.push(`Concert SaaS estimate: ${totalRU.toLocaleString()} RU × $${CONCERT_SAAS_PRICE_PER_RU_YEAR.toFixed(4)}/RU/yr = $${Math.round(totalRU * CONCERT_SAAS_PRICE_PER_RU_YEAR).toLocaleString()}/yr list (PID 5900BD6).`);
    } else {
      flags.push(`Concert On-Prem estimate: ${totalRU.toLocaleString()} RU × $${CONCERT_PRICE_PER_RU_SUBSCRIPTION}/RU/yr = $${Math.round(totalRU * CONCERT_PRICE_PER_RU_SUBSCRIPTION).toLocaleString()}/yr list (PID 5900BBE, D0MK3ZX).`);
    }
  } else {
    flags.push("Provide application count, workflow count, and/or MVS count to generate a dollar estimate.");
  }
  flags.push("⚠ 'Operate' has no RU mapping in IBM's Concert model — do not quote RUs for this label. If a customer asks about incident response / MTTR, that maps to Concert Observe + Workflows.");
  flags.push(
    "Concert discount guidance (Q1 2026 Sales Enablement deck): no standing self-approval matrix. " +
    "Pricing Play 6.023 'New to Concert' sets pre-approved rates by deal size " +
    "(XSmall 87%, Small 88%, Medium 89%, Large 90%) — but this is a named time-boxed play. " +
    "Geo approval required for all pricing. Engage your geo for discount authority."
  );

  // ── Module descriptions ────────────────────────────────────────────────────
  const moduleDescriptions = CONCERT_MODULES
    .filter((m) => recommended.has(m.key))
    .map((m) => ({ label: m.label, summary: m.summary }));

  // ── Seller positioning ─────────────────────────────────────────────────────
  const sellerPositioning: string[] = [];

  if (inputs.primaryPain === "alertFatigue" || inputs.primaryPain === "all") {
    sellerPositioning.push("Frame Concert as the solution to alert overload: 'Concert doesn't add more dashboards — it filters noise and surfaces only what matters, with business-impact context.'");
  }
  if (inputs.primaryPain === "slowMTTR") {
    sellerPositioning.push("Lead with MTTR: 'Concert correlates signals across domains so teams stop manually stitching together alerts and start following AI-guided resolution paths.'");
  }
  if (needsOptimize) {
    sellerPositioning.push("Concert Optimize right-sizes cloud and Kubernetes resources based on actual demand — direct FinOps ROI story.");
  }
  if (needsProtect || inputs.primaryPain === "riskPosture") {
    sellerPositioning.push("Concert Protect enriches every operational decision with real-time CVE, certificate, and compliance signals.");
  }

  sellerPositioning.push("BWI (German Armed Forces IT) reference: avoided 30,000 potential IT service disruptions and freed 35% capacity using Concert.");

  // ── Instana note ───────────────────────────────────────────────────────────
  let instanaNote: string | undefined;
  if (inputs.hasInstana) {
    instanaNote =
      "**Instana already in scope** — ideal Concert attach. Instana's high-fidelity telemetry feeds Concert's cross-domain context engine directly, making Concert significantly more powerful than with lower-fidelity monitoring sources. 'You already see everything with Instana; Concert tells you what matters.'";
    flags.push("Instana owned: position the Instana→Concert signal feed as a key value amplifier.");
  } else if (inputs.thirdPartyMonitoring) {
    instanaNote =
      "**Third-party monitoring detected** — Concert can ingest signals from non-Instana sources (Dynatrace, Datadog, Prometheus), but is richest with Instana. Consider a parallel Instana conversation as a long-term consolidation play.";
  }

  // ── Next step ──────────────────────────────────────────────────────────────
  const nextStep =
    "Schedule a Concert demo — connect Concert to an existing monitoring source and show how it reduces alert noise and accelerates triage. Engage IBM for a formal RU quote (PID 5900BBE).";

  if ((inputs.estimatedApplications ?? 0) >= 50) {
    flags.push(`${inputs.estimatedApplications} applications in scope — larger estates amplify Concert's cross-domain correlation value.`);
  }

  return {
    recommendedModules: Array.from(recommended),
    moduleDescriptions,
    lines,
    totalRU,
    totalAnnualList: Math.round(totalAnnualList * 100) / 100,
    pricePerRU,
    instanaNote,
    sellerPositioning,
    nextStep,
    flags,
    bestPractices: CONCERT_BEST_PRACTICES,
    quickReference: CONCERT_QUICK_REFERENCE,
  };
}
