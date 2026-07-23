/**
 * Turbonomic estimation engine.
 *
 * Confirmed pricing (Seismic "IBM Turbonomic Pricing and Sizing Deck", Jul 9, 2026):
 *   D09ECZX  $18.80/MVS/month  — Commercial SaaS (standard/non-government)
 *   Overage: $22.60/MVS/month
 *   D11Q7ZX  $23.50/MVS/month  — Government/FedRAMP SaaS (PID 5900-AP1)
 *   D11Q8ZX  $28.20/MVS/month  — Government overage
 *   D0G8DZX  $9,700 one-time   — Install (professional services)
 *   D08YVZX  $40,560 one-time  — Build SaaS (professional services)
 *   D08YYZX  $9,700 one-time   — Perform SaaS (professional services)
 *   Essentials: $50,000/instance/year (1 instance = up to $2M annual cloud spend)
 *
 *   On-Premises and Parking Edition: contact-for-quote only.
 *
 * Two scoping paths (SaaS Commercial):
 *   "mvs"        — customer knows host/VM count → D09ECZX × MVS × $18.80/month
 *   "essentials" — customer knows annual cloud spend → ceil(spend/$2M) × $50K/year
 */
import {
  TURBONOMIC_MODELS,
  TURBONOMIC_PARTS,
  TURBONOMIC_BEST_PRACTICES,
  TURBONOMIC_QUICK_REFERENCE,
  TURBONOMIC_ESSENTIALS_PRICE_PER_INSTANCE,
  TURBONOMIC_ESSENTIALS_CLOUD_SPEND_PER_INSTANCE,
  type TurbonomicDeployment,
} from "./turbonomic-data";

export interface TurbonomicInputs {
  deployment: TurbonomicDeployment;
  isGovernment?: boolean;               // use D11Q7ZX instead of D09ECZX
  estimatedMVS: number;                 // hosts/VMs in scope (0 if unknown)
  annualCloudSpend?: number;            // USD — for Essentials edition sizing
  scopingModel?: "mvs" | "essentials";  // default: "mvs" if MVS > 0, else "essentials"
  includesKubernetes?: boolean;
  includesPublicCloud?: boolean;
  includesDatacenter?: boolean;
  includesAIWorkloads?: boolean;
  primaryDriver?: "cost" | "performance" | "both";
  instanaAlreadyOwned?: boolean;
  includeServices?: boolean;            // add D0G8DZX Install to estimate
}

export interface TurbonomicLineItem {
  part: string;
  description: string;
  quantity: number;
  unit: string;
  monthlyList: number;
  annualList: number;
  notes: string;
}

export interface TurbonomicScopeSummary {
  deployment: TurbonomicDeployment;
  deploymentLabel: string;
  estimatedMVS: number;
  scopingModel: "mvs" | "essentials" | "cfq";
  lines: TurbonomicLineItem[];
  totalMonthlyList: number;
  totalAnnualList: number;
  scopeItems: string[];
  keyFeatures: string[];
  instanaNote?: string;
  sellerTalkingPoints: string[];
  nextStep: string;
  flags: string[];
  bestPractices: typeof TURBONOMIC_BEST_PRACTICES;
  quickReference: typeof TURBONOMIC_QUICK_REFERENCE;
}

export function computeTurbonomicScope(inputs: TurbonomicInputs): TurbonomicScopeSummary {
  const isGov = inputs.isGovernment ?? false;
  // SaaSGov is a separate model for UI display; underlying price logic uses isGovernment flag
  const deploymentKey: TurbonomicDeployment =
    isGov && inputs.deployment === "SaaS" ? "SaaSGov" : inputs.deployment;
  const model = TURBONOMIC_MODELS.find((m) => m.key === deploymentKey)
    ?? TURBONOMIC_MODELS.find((m) => m.key === inputs.deployment)
    ?? TURBONOMIC_MODELS[0];

  const flags: string[] = [];
  const lines: TurbonomicLineItem[] = [];

  // ── Determine scoping path ─────────────────────────────────────────────────
  const isCfq = inputs.deployment === "OnPrem" || inputs.deployment === "Parking";
  const hasCloudSpend = (inputs.annualCloudSpend ?? 0) > 0;
  const hasMVS = inputs.estimatedMVS > 0;

  let scopingModel: "mvs" | "essentials" | "cfq" = "cfq";

  if (!isCfq) {
    const explicit = inputs.scopingModel;
    if (explicit === "essentials" && hasCloudSpend) {
      scopingModel = "essentials";
    } else if (explicit === "mvs" && hasMVS) {
      scopingModel = "mvs";
    } else if (hasMVS) {
      scopingModel = "mvs";
    } else if (hasCloudSpend) {
      scopingModel = "essentials";
    } else {
      scopingModel = "cfq";
      flags.push("No MVS count or cloud spend provided — provide either to generate a dollar estimate.");
    }
  }

  // ── Build line items ───────────────────────────────────────────────────────
  if (scopingModel === "mvs") {
    const partNum  = isGov ? "D11Q7ZX" : "D09ECZX";
    const subPart  = TURBONOMIC_PARTS.find((p) => p.part === partNum)!;
    const monthly  = Math.round(inputs.estimatedMVS * subPart.listPricePerUnit * 100) / 100;
    lines.push({
      part: subPart.part,
      description: subPart.description,
      quantity: inputs.estimatedMVS,
      unit: "MVS",
      monthlyList: monthly,
      annualList: Math.round(monthly * 12 * 100) / 100,
      notes: subPart.notes,
    });
    if (isGov) {
      flags.push(`Government/FedRAMP rate: $23.50/MVS/month (D11Q7ZX). Overage: $28.20/MVS/month (D11Q8ZX).`);
    } else {
      flags.push(`Commercial rate: $18.80/MVS/month (D09ECZX). Overage: $22.60/MVS/month. For government accounts, use D11Q7ZX at $23.50/MVS/month.`);
    }
  }

  if (scopingModel === "essentials") {
    const cloudSpend = inputs.annualCloudSpend ?? 0;
    const instances  = Math.max(1, Math.ceil(cloudSpend / TURBONOMIC_ESSENTIALS_CLOUD_SPEND_PER_INSTANCE));
    const annualTotal = instances * TURBONOMIC_ESSENTIALS_PRICE_PER_INSTANCE;
    lines.push({
      part: "Essentials",
      description: "Turbonomic Essentials Edition (annual subscription)",
      quantity: instances,
      unit: `instance${instances > 1 ? "s" : ""} (each covers $${(TURBONOMIC_ESSENTIALS_CLOUD_SPEND_PER_INSTANCE / 1_000_000).toFixed(0)}M cloud spend)`,
      monthlyList: Math.round((annualTotal / 12) * 100) / 100,
      annualList: annualTotal,
      notes: `$${TURBONOMIC_ESSENTIALS_PRICE_PER_INSTANCE.toLocaleString()}/instance/year × ${instances}`,
    });
    flags.push(`Essentials: $50,000/instance/year. Each instance covers up to $2M annual cloud spend. ${instances} instance${instances > 1 ? "s" : ""} for $${cloudSpend.toLocaleString()} spend.`);
    const savings20pct = Math.round(cloudSpend * 0.20);
    flags.push(`ROI anchor: 20% cloud cost reduction on $${cloudSpend.toLocaleString()} = $${savings20pct.toLocaleString()}/yr savings vs $${annualTotal.toLocaleString()} Turbonomic cost.`);
  }

  // Add Install service on SaaS deployments
  if (inputs.includeServices && (inputs.deployment === "SaaS" || isGov)) {
    const install = TURBONOMIC_PARTS.find((p) => p.part === "D0G8DZX")!;
    lines.push({
      part: install.part,
      description: install.description,
      quantity: 1,
      unit: "one-time",
      monthlyList: 0,
      annualList: install.listPricePerUnit,
      notes: install.notes,
    });
  }

  // ── Scope and feature items ────────────────────────────────────────────────
  const scopeItems: string[] = [];
  const keyFeatures: string[] = [];

  if (scopingModel === "mvs" && inputs.estimatedMVS > 0) {
    scopeItems.push(`${inputs.estimatedMVS.toLocaleString()} Managed Virtual Servers (MVS) in scope`);
  }
  if (scopingModel === "essentials" && inputs.annualCloudSpend) {
    scopeItems.push(`$${inputs.annualCloudSpend.toLocaleString()} estimated annual cloud spend`);
  }
  if (inputs.includesPublicCloud) {
    scopeItems.push("Public cloud (AWS / Azure / GCP) resources included");
    keyFeatures.push("Public cloud right-sizing — reduces wasted cloud spend on over-provisioned VMs and storage");
  }
  if (inputs.includesKubernetes) {
    scopeItems.push("Kubernetes / container platforms included");
    keyFeatures.push("Kubernetes cost optimization — auto right-size pods and containers to prevent over-provisioning");
  }
  if (inputs.includesDatacenter) {
    scopeItems.push("On-premises data center VMs / hypervisors included");
    keyFeatures.push("Data center optimization — VM right-sizing, server density, capacity reclamation");
  }
  if (inputs.includesAIWorkloads) {
    scopeItems.push("AI / GPU workloads in scope");
    keyFeatures.push("AI workload optimization — automatic GPU and compute allocation");
  }
  if (inputs.deployment === "Parking") {
    keyFeatures.push("Workload Parking — auto-stop/start idle non-production cloud workloads on schedule");
    flags.push("Parking Edition is cloud-only (AWS/Azure/GCP). For on-prem or Kubernetes, SaaS edition required.");
  }

  // ── Seller talking points ──────────────────────────────────────────────────
  const sellerTalkingPoints: string[] = [];
  if (inputs.primaryDriver === "cost" || inputs.primaryDriver === "both") {
    sellerTalkingPoints.push("Cloud waste reduction: Turbonomic continuously identifies overprovisioned resources and automates right-sizing — typically 15–30% cost savings on public cloud spend.");
  }
  if (inputs.primaryDriver === "performance" || inputs.primaryDriver === "both") {
    sellerTalkingPoints.push("Performance assurance: Turbonomic enforces application SLOs by automatically adjusting resources before users feel the impact — not after.");
  }
  sellerTalkingPoints.push("Autonomous operations: moves from manual ticket-and-action to AI-driven, policy-compliant resource decisions at scale.");

  if (scopingModel === "essentials" && inputs.annualCloudSpend) {
    const savings = Math.round(inputs.annualCloudSpend * 0.20);
    const cost = Math.ceil(inputs.annualCloudSpend / TURBONOMIC_ESSENTIALS_CLOUD_SPEND_PER_INSTANCE) * TURBONOMIC_ESSENTIALS_PRICE_PER_INSTANCE;
    sellerTalkingPoints.push(`ROI anchor: 20% cloud cost reduction on $${inputs.annualCloudSpend.toLocaleString()} = $${savings.toLocaleString()}/yr savings vs $${cost.toLocaleString()} Turbonomic cost.`);
  }

  // ── Instana note ───────────────────────────────────────────────────────────
  let instanaNote: string | undefined;
  if (inputs.instanaAlreadyOwned) {
    instanaNote =
      "**Instana integration active.** Turbonomic natively ingests Instana APM data, enabling application-aware optimization decisions rather than infrastructure-only actions. Key differentiation vs generic FinOps tools.";
    flags.push("Instana owned: highlight the Instana→Turbonomic integration — application-aware decisions instead of infrastructure-only.");
  } else {
    instanaNote =
      "**Cross-sell: IBM Instana.** Without Instana, Turbonomic sees resource utilization but not application performance. With Instana, every resource decision is application-aware — it will not right-size a resource causing latency or errors. Type **cross-sell** to add Instana to this quote.";
  }

  // ── Next step ──────────────────────────────────────────────────────────────
  const nextStep = isCfq
    ? "Engage IBM for a custom quote — On-Premises and Parking Edition pricing is contact-for-quote."
    : scopingModel === "cfq"
      ? "Provide MVS count or annual cloud spend to generate a dollar estimate, then engage IBM for CPQ quote."
      : "Use this as a budgetary reference. Engage IBM for a formal CPQ quote and apply standard discounting.";

  flags.push("List-price estimate — standard IBM discounting applies. Engage IBM or an authorized partner for net pricing.");

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalMonthlyList = lines.reduce((s, l) => s + l.monthlyList, 0);
  const totalAnnualList  = lines.reduce((s, l) => s + l.annualList,  0);

  return {
    deployment: deploymentKey,
    deploymentLabel: model.label,
    estimatedMVS: inputs.estimatedMVS,
    scopingModel,
    lines,
    totalMonthlyList: Math.round(totalMonthlyList * 100) / 100,
    totalAnnualList:  Math.round(totalAnnualList  * 100) / 100,
    scopeItems,
    keyFeatures,
    instanaNote,
    sellerTalkingPoints,
    nextStep,
    flags,
    bestPractices: TURBONOMIC_BEST_PRACTICES,
    quickReference: TURBONOMIC_QUICK_REFERENCE,
  };
}
