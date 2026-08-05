/**
 * Turbonomic estimation engine.
 *
 * Confirmed pricing (IBM Turbonomic Pricing and Sizing Guide 2026, Seismic, Jul 28 2026):
 *   D09ECZX  $18.80/MVS/month  — Commercial SaaS
 *   D09EDZX  $22.60/MVS/month  — Commercial overage (required on quote; billing NOT active)
 *   D11Q7ZX  $23.50/MVS/month  — Government/FedRAMP SaaS (PID 5900-AP1)
 *   D11Q8ZX  $28.20/MVS/month  — Government overage
 *   D0I0GZX  Tiered/unit/yr    — Monitored Costs (cloud-spend scoping; 1 unit = $100K)
 *   D0HE7ZX  $53,040/yr        — Hosting Edition (On-Prem → SaaS migration only)
 *   D0G8DZX  $9,700 one-time   — Install (professional services)
 *   D08YVZX  $40,560 one-time  — Build SaaS (professional services)
 *   D08YYZX  $9,700 one-time   — Perform SaaS (professional services)
 *
 *   On-Premises: contact-for-quote (no public estimate).
 *   Parking: $6.26/MVS pay-as-you-go (D177KZX).
 *   Hosting: $53,040/instance/year — existing On-Prem customers only.
 *
 * Three scoping paths (SaaS):
 *   "mvs"            — customer knows host/VM count → D09ECZX × MVS × $18.80/month
 *   "monitoredCosts" — customer knows annual cloud spend → tiered D0I0GZX pricing
 *   "cfq"            — no data, or On-Prem/Parking/Hosting → contact for quote
 */
import {
  TURBONOMIC_MODELS,
  TURBONOMIC_PARTS,
  TURBONOMIC_BEST_PRACTICES,
  TURBONOMIC_QUICK_REFERENCE,
  TURBONOMIC_MONITORED_COSTS_MIN_UNITS,
  computeMonitoredCosts,
  getTurbonomicDiscountTier,
  type TurbonomicDeployment,
} from "./turbonomic-data";

export interface TurbonomicInputs {
  deployment: TurbonomicDeployment;
  isGovernment?: boolean;                         // use D11Q7ZX instead of D09ECZX
  estimatedMVS: number;                           // hosts/VMs in scope (0 if unknown)
  annualCloudSpend?: number;                      // USD — for Monitored Costs sizing
  scopingModel?: "mvs" | "monitoredCosts";        // default: "mvs" if MVS > 0, else "monitoredCosts"
  // Use case
  useCase?: "vmware" | "kubernetes" | "finops" | "parking" | "other";
  // Infrastructure breakdown (multi-select)
  includesVMware?: boolean;
  includesKubernetes?: boolean;
  includesPublicCloud?: boolean;
  includesDatacenter?: boolean;
  includesAIWorkloads?: boolean;
  // Deal context
  clientType?: "new" | "existing";
  existingMotion?: "renewal" | "addCapacity" | "toSaaS";
  primaryDriver?: "cost" | "performance" | "both";
  // APM / observability
  apmNeed?: "no" | "yes" | "has_apm";
  existingAPM?: string;                           // instana | dynatrace | datadog | appdynamics | newrelic | other
  // Services
  isFirstDeployment?: boolean;
  includeServices?: boolean;                      // add services line items to estimate
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
  scopingModel: "mvs" | "monitoredCosts" | "cfq";
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
  const isCfq = inputs.deployment === "OnPrem"
    || inputs.deployment === "Parking"
    || inputs.deployment === "Hosting";

  const hasCloudSpend = (inputs.annualCloudSpend ?? 0) >= TURBONOMIC_MONITORED_COSTS_MIN_UNITS * 100_000;
  const hasMVS = inputs.estimatedMVS > 0;

  let scopingModel: "mvs" | "monitoredCosts" | "cfq" = "cfq";

  if (!isCfq) {
    const explicit = inputs.scopingModel;
    if (explicit === "monitoredCosts" && hasCloudSpend) {
      scopingModel = "monitoredCosts";
    } else if (explicit === "mvs" && hasMVS) {
      scopingModel = "mvs";
    } else if (hasMVS) {
      scopingModel = "mvs";
    } else if (hasCloudSpend) {
      scopingModel = "monitoredCosts";
    } else if ((inputs.annualCloudSpend ?? 0) > 0) {
      // Cloud spend provided but below minimum for Monitored Costs
      scopingModel = "cfq";
      flags.push(`Monitored Costs path requires at least $1,600,000 annual cloud spend (16 units × $100K). Cloud spend provided ($${(inputs.annualCloudSpend ?? 0).toLocaleString()}) is below the minimum — provide an MVS count to generate an estimate, or use the Parking Edition for smaller cloud environments.`);
    } else {
      scopingModel = "cfq";
      flags.push("No MVS count or annual cloud spend provided — provide either to generate a dollar estimate.");
    }
  }

  // ── Build line items ───────────────────────────────────────────────────────
  if (scopingModel === "mvs") {
    const partNum = isGov ? "D11Q7ZX" : "D09ECZX";
    const subPart = TURBONOMIC_PARTS.find((p) => p.part === partNum)!;
    const monthly = Math.round(inputs.estimatedMVS * subPart.listPricePerUnit * 100) / 100;
    lines.push({
      part: subPart.part,
      description: subPart.description,
      quantity: inputs.estimatedMVS,
      unit: "MVS",
      monthlyList: monthly,
      annualList: Math.round(monthly * 12 * 100) / 100,
      notes: subPart.notes,
    });

    // Discount tier flag
    const discountTier = getTurbonomicDiscountTier(inputs.estimatedMVS, isGov);
    if (isGov) {
      flags.push(`Government/FedRAMP rate: $23.50/MVS/month (D11Q7ZX). Overage: D11Q8ZX $28.20/MVS/month. Discount tier (${inputs.estimatedMVS} MVS): max ${discountTier.maxPct}% — ${discountTier.approval}.`);
    } else {
      flags.push(`Commercial rate: $18.80/MVS/month (D09ECZX). Overage: D09EDZX $22.60/MVS/month. Discount tier (${inputs.estimatedMVS} MVS): max ${discountTier.maxPct}% — ${discountTier.approval}.`);
    }
    flags.push("Overage billing is NOT currently active — SAPcc onboarding on hold indefinitely. Include overage part on quote at $0.");
  }

  if (scopingModel === "monitoredCosts") {
    const cloudSpend = inputs.annualCloudSpend ?? 0;
    const mc = computeMonitoredCosts(cloudSpend);
    if (mc) {
      lines.push({
        part: "D0I0GZX",
        description: "IBM Turbonomic Standard Monitored Costs per Annum License",
        quantity: mc.units,
        unit: `units (each covers $100K cloud spend)`,
        monthlyList: mc.monthlyList,
        annualList: mc.annualList,
        notes: `Tiered pricing: $${mc.tier.annualPerUnit.toFixed(2)}/unit/yr at ${mc.units} units. 1 unit = $100K cloud spend.`,
      });
      const savings20pct = Math.round(cloudSpend * 0.20);
      flags.push(`Monitored Costs: ${mc.units} units × $${mc.tier.annualPerUnit.toFixed(2)}/unit/yr = $${mc.annualList.toLocaleString()}/yr list (D0I0GZX).`);
      flags.push(`ROI anchor: 20% cloud cost reduction on $${cloudSpend.toLocaleString()} = $${savings20pct.toLocaleString()}/yr savings vs $${mc.annualList.toLocaleString()} Turbonomic cost.`);
    }
  }

  // Parking line item
  if (inputs.deployment === "Parking" && inputs.estimatedMVS > 0) {
    const parkPart = TURBONOMIC_PARTS.find((p) => p.part === "D177KZX")!;
    const total = Math.round(inputs.estimatedMVS * parkPart.listPricePerUnit * 100) / 100;
    lines.push({
      part: parkPart.part,
      description: parkPart.description,
      quantity: inputs.estimatedMVS,
      unit: "MVS",
      monthlyList: total,
      annualList: Math.round(total * 12 * 100) / 100,
      notes: parkPart.notes,
    });
    flags.push("Parking Edition: cloud workload start/stop only (AWS/Azure/GCP). For on-prem or Kubernetes optimization, SaaS edition is required.");
  }

  // Hosting line item
  if (inputs.deployment === "Hosting") {
    const hostPart = TURBONOMIC_PARTS.find((p) => p.part === "D0HE7ZX")!;
    lines.push({
      part: hostPart.part,
      description: hostPart.description,
      quantity: 1,
      unit: "instance",
      monthlyList: Math.round((hostPart.listPricePerUnit / 12) * 100) / 100,
      annualList: hostPart.listPricePerUnit,
      notes: hostPart.notes,
    });
    flags.push("Hosting Edition: ONLY for existing On-Prem customers migrating to SaaS. Max 1 instance. No discounts. Min 3-month term. Cannot hold On-Prem licence simultaneously.");
  }

  // Add Install service on SaaS deployments
  if (inputs.includeServices && (inputs.deployment === "SaaS" || inputs.deployment === "SaaSGov" || isGov)) {
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

  // Deal context flags
  if (inputs.clientType === "existing") {
    const motionLabel: Record<string, string> = {
      renewal: "Renewal — existing entitlement, same scope",
      addCapacity: "Expansion — adding capacity to existing deployment",
      toSaaS: "Migration — On-Prem to SaaS transition (Hosting Edition eligible)",
    };
    scopeItems.push(motionLabel[inputs.existingMotion ?? "renewal"] ?? "Existing client");
  }

  // Use case
  const useCaseLabel: Record<string, string> = {
    vmware: "VMware / virtual machine performance optimization",
    kubernetes: "Kubernetes / container performance optimization",
    finops: "Cloud cost optimization (FinOps)",
    parking: "Workload Parking — auto-stop idle cloud workloads",
    other: "Full Turbonomic platform capabilities",
  };
  if (inputs.useCase) {
    scopeItems.push(`Primary use case: ${useCaseLabel[inputs.useCase] ?? inputs.useCase}`);
  }

  if (scopingModel === "mvs" && inputs.estimatedMVS > 0) {
    scopeItems.push(`${inputs.estimatedMVS.toLocaleString()} Managed Virtual Servers (MVS) in scope`);
  }
  if (scopingModel === "monitoredCosts" && inputs.annualCloudSpend) {
    scopeItems.push(`$${inputs.annualCloudSpend.toLocaleString()} estimated annual cloud spend (Monitored Costs scoping)`);
  }

  // Infrastructure type breakdown
  if (inputs.includesVMware) {
    scopeItems.push("VMware / vSphere VMs in scope");
    keyFeatures.push("VMware right-sizing — automatically resize VMs, reclaim wasted capacity, improve host density without performance impact");
  }
  if (inputs.includesPublicCloud) {
    scopeItems.push("Public cloud (AWS / Azure / GCP) resources included");
    keyFeatures.push("Public cloud right-sizing — reduces wasted cloud spend on over-provisioned VMs and storage");
  }
  if (inputs.includesKubernetes) {
    scopeItems.push("Kubernetes / OpenShift container nodes in scope");
    keyFeatures.push("Kubernetes optimization — auto right-size pods and nodes, prevent over-provisioning of container infrastructure");
  }
  if (inputs.includesDatacenter) {
    scopeItems.push("On-premises data center VMs / hypervisors included");
    keyFeatures.push("Data center optimization — VM right-sizing, server density improvement, capacity reclamation");
  }
  if (inputs.includesAIWorkloads) {
    scopeItems.push("AI / GPU workloads in scope");
    keyFeatures.push("AI workload optimization — automatic GPU and compute allocation for AI/ML pipelines");
  }
  if (inputs.deployment === "Parking" || inputs.useCase === "parking") {
    keyFeatures.push("Workload Parking — auto-stop/start idle non-production cloud workloads on schedule (AWS/Azure/GCP)");
  }

  // ── Seller talking points ──────────────────────────────────────────────────
  const sellerTalkingPoints: string[] = [];

  if (inputs.useCase === "vmware") {
    sellerTalkingPoints.push("VMware customers face rising licensing costs post-Broadcom acquisition — Turbonomic reduces the VM footprint Broadcom licenses against, directly cutting licensing exposure.");
  }
  if (inputs.useCase === "kubernetes") {
    sellerTalkingPoints.push("Kubernetes environments over-provision by default because developers set resource requests conservatively. Turbonomic right-sizes continuously, reducing node count and cloud bills without impacting SLOs.");
  }
  if (inputs.primaryDriver === "cost" || inputs.primaryDriver === "both") {
    sellerTalkingPoints.push("Cloud waste reduction: Turbonomic continuously identifies overprovisioned resources and automates right-sizing — typically 15–30% cost savings on public cloud spend.");
  }
  if (inputs.primaryDriver === "performance" || inputs.primaryDriver === "both") {
    sellerTalkingPoints.push("Performance assurance: Turbonomic enforces application SLOs by automatically adjusting resources before users feel the impact — not after.");
  }
  sellerTalkingPoints.push("Autonomous operations: moves from manual ticket-and-action to AI-driven, policy-compliant resource decisions at scale.");

  if (scopingModel === "monitoredCosts" && inputs.annualCloudSpend) {
    const mc = computeMonitoredCosts(inputs.annualCloudSpend);
    if (mc) {
      const savings = Math.round(inputs.annualCloudSpend * 0.20);
      sellerTalkingPoints.push(`ROI anchor: 20% cloud cost reduction on $${inputs.annualCloudSpend.toLocaleString()} = $${savings.toLocaleString()}/yr savings vs $${mc.annualList.toLocaleString()} Turbonomic Monitored Costs list price.`);
    }
  }

  // ── Services recommendation ────────────────────────────────────────────────
  if (inputs.isFirstDeployment && (inputs.deployment === "SaaS" || (inputs.isGovernment))) {
    flags.push("First-time deployment: include D0G8DZX Install ($9,700) on the quote. For complex environments (multi-cloud, large K8s, custom SLO policies), add D08YVZX Build SaaS ($40,560). Services drive faster time-to-value and reduce churn risk.");
    sellerTalkingPoints.push("Services attach: IBM implementation services (Install + Build SaaS) accelerate time-to-value, improve adoption, and are strongly correlated with higher renewal rates. Recommend D0G8DZX ($9,700) as the minimum.");
  } else if (!inputs.isFirstDeployment && (inputs.deployment === "SaaS" || inputs.isGovernment)) {
    flags.push("Expanding existing deployment: consider D08YYZX Perform SaaS ($9,700) to maximize ROI — post-deployment optimization, tuning, and policy reviews 30–90 days after expansion go-live.");
  }

  // ── APM / Instana cross-sell note ──────────────────────────────────────────
  let instanaNote: string | undefined;
  const instanaOwned = inputs.existingAPM === "instana";
  const wantsAPM = inputs.apmNeed === "yes";
  const hasOtherAPM = inputs.apmNeed === "has_apm" && inputs.existingAPM && inputs.existingAPM !== "instana";

  if (instanaOwned) {
    instanaNote =
      "**IBM Instana integration active.** Turbonomic natively ingests Instana APM data, enabling application-aware optimization decisions rather than infrastructure-only actions. Automated one-click setup from the Instana Optimizations tab (requires 200+ MVS Instana Standard SaaS on the same account). Key differentiation vs generic FinOps tools.";
    flags.push("Instana owned: highlight the Instana→Turbonomic integration — application-aware decisions instead of infrastructure-only. Requires 200+ MVS Instana Standard SaaS on the same IBM account.");
  } else if (wantsAPM) {
    instanaNote =
      "**Cross-sell opportunity: IBM Instana.** The customer wants application-level visibility. IBM Instana feeds Turbonomic real-time APM telemetry — every resource decision becomes application-aware. Turbonomic will not right-size a resource that is causing latency or errors. **Automated integration** (same IBM account, 200+ MVS): one-click setup from Instana's Optimizations tab. Type **cross-sell** to add Instana to this quote.";
  } else if (hasOtherAPM) {
    const apmLabel: Record<string, string> = {
      dynatrace: "Dynatrace", datadog: "Datadog", appdynamics: "AppDynamics / Cisco",
      newrelic: "New Relic", other: "their current APM solution",
    };
    const apm = apmLabel[inputs.existingAPM ?? "other"] ?? "their APM solution";
    instanaNote =
      `**APM displacement opportunity.** The customer uses ${apm}. IBM Instana offers a native, automated Turbonomic integration that ${apm} cannot match — application-aware resource decisions, one-click setup, Sidekick sidebar. Consider positioning Instana as a replacement or complement. Type **cross-sell** to explore the Instana attach.`;
    flags.push(`Existing APM: ${apm}. Position IBM Instana's native Turbonomic integration as the differentiator — application-aware optimization that Turbonomic + ${apm} cannot provide natively.`);
  } else {
    instanaNote =
      "**Cross-sell: IBM Instana.** Without APM, Turbonomic optimizes resources but cannot see application SLO impact. With Instana, every resource decision is application-aware — it will not right-size a resource causing latency or errors. Type **cross-sell** to add Instana to this quote.";
  }

  // ── Next step ──────────────────────────────────────────────────────────────
  const nextStep = isCfq
    ? inputs.deployment === "Hosting"
      ? "Hosting Edition is only available to existing On-Prem customers migrating to SaaS — max 1 instance, no discounts, min 3-month term. Engage IBM via ISC opportunity."
      : "Engage IBM for a custom quote. On-Premises pricing is contact-for-quote — engage the Turbonomic SME team via your regional deal assist email."
    : scopingModel === "cfq"
      ? "Provide MVS count or annual cloud spend ($1.6M minimum for Monitored Costs) to generate a dollar estimate, then engage IBM for a CPQ quote."
      : "Use this as a budgetary reference. Engage IBM for a formal CPQ quote and apply standard discounting. Contact your regional Turbonomic deal assist team.";

  flags.push("List-price estimate — standard IBM discounting applies. Engage IBM or an authorized partner for net pricing via SAP CPQ / SQO.");

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
