/**
 * Concert estimation engine.
 *
 * Confirmed pricing (IBM Concert platform Parts & Pricing Deck, Jun 17, 2026):
 *   PID: 5900BBE — billing metric: Resource Unit (RU)
 *   Subscription: $212/RU/year
 *   Monthly:      $265/RU/month
 *   Term + support: $6,360/RU
 *
 * Confirmed RU mappings:
 *   Vulnerability management (Protect module): 3 RU per managed application
 *   Resource optimization (Optimize module):   1 RU per 5 MVS = 0.2 RU/MVS
 *   Other modules: RU mapping varies — this engine estimates and flags for IBM confirmation.
 */
import {
  CONCERT_MODULES,
  CONCERT_BEST_PRACTICES,
  CONCERT_QUICK_REFERENCE,
  CONCERT_PRICE_PER_RU_SUBSCRIPTION,
  CONCERT_PRICE_PER_RU_MONTHLY,
  CONCERT_RU_PER_APP_VULN,
  CONCERT_RU_PER_MVS_OPTIM,
} from "./concert-data";

export interface ConcertInputs {
  primaryPain: "alertFatigue" | "slowMTTR" | "costOptimization" | "riskPosture" | "all";
  hasInstana?: boolean;
  thirdPartyMonitoring?: boolean;
  needsWorkflowAutomation?: boolean;
  needsCostOptimization?: boolean;
  needsSecurityRisk?: boolean;
  estimatedApplications?: number;     // for Protect RU calculation (3 RU/app)
  estimatedMVS?: number;              // for Optimize RU calculation (1 RU/5 MVS)
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
  const licenseType = inputs.licenseType ?? "subscription";
  const pricePerRU = licenseType === "monthly"
    ? CONCERT_PRICE_PER_RU_MONTHLY * 12   // annualise monthly rate
    : CONCERT_PRICE_PER_RU_SUBSCRIPTION;

  // ── Module selection ───────────────────────────────────────────────────────
  const recommended = new Set<string>();
  recommended.add("observe");
  recommended.add("operate");

  const needsProtect = inputs.needsSecurityRisk || inputs.primaryPain === "riskPosture" || inputs.primaryPain === "all";
  const needsOptimize = inputs.needsCostOptimization || inputs.primaryPain === "costOptimization" || inputs.primaryPain === "all";
  const needsWorkflows = inputs.needsWorkflowAutomation || inputs.primaryPain === "all";
  const needsResilience = inputs.primaryPain === "all";
  const needsSlowMTTR = inputs.primaryPain === "slowMTTR" || inputs.primaryPain === "all";

  if (needsOptimize)  recommended.add("optimize");
  if (needsProtect)   recommended.add("protect");
  if (needsWorkflows) { recommended.add("workflows"); recommended.add("resilience"); }
  if (needsResilience) recommended.add("resilience");
  if (needsSlowMTTR)  { recommended.add("operate"); recommended.add("workflows"); }

  // ── RU estimation for confirmed modules ───────────────────────────────────
  const apps = inputs.estimatedApplications ?? 0;
  const mvs  = inputs.estimatedMVS ?? 0;

  if (needsProtect && apps > 0) {
    const ru = Math.ceil(apps * CONCERT_RU_PER_APP_VULN);
    lines.push({
      module: "Concert Protect — Vulnerability Management",
      ruCount: ru,
      annualList: Math.round(ru * pricePerRU * 100) / 100,
      notes: `3 RU × ${apps} apps = ${ru} RU at $${pricePerRU}/RU/year`,
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

  // Observe + Operate + other modules: RU mapping not confirmed — flag for IBM
  const unconfirmedModules = Array.from(recommended).filter((m) =>
    !(needsProtect && m === "protect" && apps > 0) &&
    !(needsOptimize && m === "optimize" && mvs > 0)
  );
  if (unconfirmedModules.length > 0) {
    flags.push(`Modules ${unconfirmedModules.join(", ")}: RU consumption varies by scope. Confirmed RU mappings: Protect = 3 RU/app, Optimize = 1 RU/5 MVS. Engage IBM to confirm RU count for other modules.`);
  }

  if (lines.length === 0 && (apps > 0 || mvs > 0)) {
    // Provide a rough budgetary estimate based on whatever data we have
    let roughRU = 0;
    if (apps > 0) roughRU += Math.ceil(apps * CONCERT_RU_PER_APP_VULN);
    if (mvs > 0)  roughRU += Math.ceil(mvs * CONCERT_RU_PER_MVS_OPTIM);
    if (roughRU > 0) {
      lines.push({
        module: "Concert (estimated — confirm RU mapping with IBM)",
        ruCount: roughRU,
        annualList: Math.round(roughRU * pricePerRU * 100) / 100,
        notes: `Rough estimate: ${apps > 0 ? `${apps} apps × 3 RU/app` : ""}${apps > 0 && mvs > 0 ? " + " : ""}${mvs > 0 ? `${mvs} MVS × 0.2 RU/MVS` : ""}`,
      });
    }
  }

  const totalRU = lines.reduce((s, l) => s + l.ruCount, 0);
  const totalAnnualList = lines.reduce((s, l) => s + l.annualList, 0);

  if (totalRU > 0) {
    flags.push(`Subscription rate: $${CONCERT_PRICE_PER_RU_SUBSCRIPTION}/RU/year. Monthly rate: $${CONCERT_PRICE_PER_RU_MONTHLY}/RU/month. PID: 5900BBE.`);
  } else {
    flags.push("Provide application count and/or MVS count to generate a dollar estimate. Concert pricing: $212/RU/year (subscription).");
  }

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
