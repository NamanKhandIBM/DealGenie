/**
 * Instana quoting engine — MVS-based sizing and public-price estimation.
 * Public pricing sourced from ibm.com/products/instana/pricing (July 2026).
 *
 * Metric: Managed Virtual Server (MVS) = one monitored host.
 * Models:
 *   PayPerUse  — $0.03/MVS/hour (no commitment)
 *   SaaS       — from $21.20/MVS/month (Essentials or Standard tier, term-based)
 *   SelfHosted — from $1,440/month base (annual subscription)
 */
import {
  INSTANA_PLANS,
  INSTANA_ADDONS,
  INSTANA_PPU_PRICE_PER_MVS_HOUR,
  INSTANA_SAAS_PRICE_PER_MVS_MONTH,
  INSTANA_SELFHOSTED_BASE_MONTH,
  type InstanaPurchaseModel,
  type InstanaTier,
  INSTANA_BEST_PRACTICES,
  INSTANA_QUICK_REFERENCE,
} from "./instana-data";

export interface InstanaInputs {
  model: InstanaPurchaseModel;
  tier: InstanaTier;            // Essentials (infra) or Standard (full-stack)
  mvsCount: number;             // number of managed virtual servers / hosts
  avgHoursPerMonth?: number;    // PayPerUse only — default 730 (full month)
  addManagedPoPs?: boolean;     // SaaS only: synthetic managed PoPs
  estimatedPoPrexecutions?: number; // estimated executions/month for PoPs add-on
  addLogsInContext?: boolean;   // SaaS or SelfHosted
  estimatedLogGB?: number;      // GB/month for log ingestion
  term?: "12-month" | "3-year";
}

export interface InstanaQuoteLine {
  label: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  monthlyList: number;
  annualList: number;
  notes: string;
}

export interface InstanaQuoteResult {
  model: InstanaPurchaseModel;
  tier: InstanaTier;
  mvsCount: number;
  lines: InstanaQuoteLine[];
  totalMonthlyList: number;
  totalAnnualList: number;
  flags: string[];
  bestPractices: typeof INSTANA_BEST_PRACTICES;
  quickReference: typeof INSTANA_QUICK_REFERENCE;
}

export function computeInstanaQuote(inputs: InstanaInputs): InstanaQuoteResult {
  const flags: string[] = [
    "Public-price estimate only — confirm final commercial terms with IBM and CPQ.",
  ];
  const lines: InstanaQuoteLine[] = [];
  const mvs = Math.max(1, Math.round(inputs.mvsCount));
  const tier = inputs.tier;

  if (inputs.model === "PayPerUse") {
    const hoursPerMonth = inputs.avgHoursPerMonth ?? 730;
    const monthlyUnit = INSTANA_PPU_PRICE_PER_MVS_HOUR * hoursPerMonth;
    const monthly = mvs * monthlyUnit;
    lines.push({
      label: `Instana ${tier} — Pay Per Use`,
      quantity: mvs,
      unitPrice: monthlyUnit,
      unit: `MVS/month (${hoursPerMonth}h × $${INSTANA_PPU_PRICE_PER_MVS_HOUR}/h)`,
      monthlyList: monthly,
      annualList: monthly * 12,
      notes: `No commitment. ${mvs} MVS × $${INSTANA_PPU_PRICE_PER_MVS_HOUR}/MVS/hour × ${hoursPerMonth}h/month. No add-ons on this model.`,
    });
    flags.push("PayPerUse: no add-ons available. Switch to SaaS model to add Managed PoPs or Logs in Context.");

    const total = monthly;
    return {
      model: "PayPerUse",
      tier,
      mvsCount: mvs,
      lines,
      totalMonthlyList: total,
      totalAnnualList: total * 12,
      flags,
      bestPractices: INSTANA_BEST_PRACTICES,
      quickReference: INSTANA_QUICK_REFERENCE,
    };
  }

  if (inputs.model === "SaaS") {
    const baseMonthly = INSTANA_SAAS_PRICE_PER_MVS_MONTH * mvs;
    lines.push({
      label: `Instana ${tier} — SaaS`,
      quantity: mvs,
      unitPrice: INSTANA_SAAS_PRICE_PER_MVS_MONTH,
      unit: "MVS/month",
      monthlyList: baseMonthly,
      annualList: baseMonthly * 12,
      notes: `IBM-hosted. ${mvs} MVS × $${INSTANA_SAAS_PRICE_PER_MVS_MONTH}/MVS/month (public list, ${tier} tier starting price). Unlimited users.`,
    });

    if (inputs.addManagedPoPs && (inputs.estimatedPoPrexecutions ?? 0) > 0) {
      const addon = INSTANA_ADDONS.find((a) => a.key === "managedPoPs")!;
      const execs = inputs.estimatedPoPrexecutions ?? 0;
      const monthly = addon.price * execs;
      lines.push({
        label: "Managed PoPs (Synthetic Tests)",
        quantity: execs,
        unitPrice: addon.price,
        unit: "per execution/month",
        monthlyList: monthly,
        annualList: monthly * 12,
        notes: `Synthetic test execution from IBM-managed global PoPs. ${execs.toLocaleString()} executions × $${addon.price}/execution.`,
      });
    }

    if (inputs.addLogsInContext && (inputs.estimatedLogGB ?? 0) > 0) {
      const addon = INSTANA_ADDONS.find((a) => a.key === "logsInContext")!;
      const gb = inputs.estimatedLogGB ?? 0;
      const monthly = addon.price * gb;
      lines.push({
        label: "Logs in Context",
        quantity: gb,
        unitPrice: addon.price,
        unit: "GB/month",
        monthlyList: monthly,
        annualList: monthly * 12,
        notes: `Log ingestion with 30/60/90-day retention. ${gb} GB/month × $${addon.price}/GB.`,
      });
    }
  }

  if (inputs.model === "SelfHosted") {
    const baseMonthly = INSTANA_SELFHOSTED_BASE_MONTH;
    lines.push({
      label: `Instana ${tier} — Self-Hosted`,
      quantity: 1,
      unitPrice: baseMonthly,
      unit: "per month (starting)",
      monthlyList: baseMonthly,
      annualList: baseMonthly * 12,
      notes: `Customer-managed deployment. Annual subscription required. Starting at $${baseMonthly.toLocaleString()}/month. Contact IBM for exact pricing at ${mvs} MVS scale.`,
    });
    if (inputs.addLogsInContext && (inputs.estimatedLogGB ?? 0) > 0) {
      const addon = INSTANA_ADDONS.find((a) => a.key === "logsInContext")!;
      const gb = inputs.estimatedLogGB ?? 0;
      const monthly = addon.price * gb;
      lines.push({
        label: "Logs in Context",
        quantity: gb,
        unitPrice: addon.price,
        unit: "GB/month",
        monthlyList: monthly,
        annualList: monthly * 12,
        notes: `Log ingestion. ${gb} GB/month × $${addon.price}/GB. Included in self-hosted but log volume may affect licensing — confirm with IBM.`,
      });
    }
    flags.push("Self-Hosted: annual subscription required. Contact IBM to confirm pricing at your MVS scale.");
  }

  const totalMonthlyList = lines.reduce((s, l) => s + l.monthlyList, 0);
  const totalAnnualList = lines.reduce((s, l) => s + l.annualList, 0);

  if ((inputs.term ?? "12-month") === "3-year") {
    flags.push("3-year term selected — multiply annual list × 3 for total opportunity value.");
  }

  if (tier === "Essentials") {
    flags.push("Essentials tier: infrastructure monitoring only. Upgrade to Standard for full APM, distributed tracing, synthetic, and LLM observability.");
  }

  flags.push(
    "Discount approval thresholds for IBM Instana are not published as a static authorization matrix in Seismic " +
    "(confirmed: the 'Part Numbers & Pricing – IBM Instana Observability' deck has no approval-threshold table). " +
    "Discount authority is managed in IBM Software CPQ — confirm approval requirements with your IBM pricing desk."
  );

  return {
    model: inputs.model,
    tier,
    mvsCount: mvs,
    lines,
    totalMonthlyList,
    totalAnnualList,
    flags,
    bestPractices: INSTANA_BEST_PRACTICES,
    quickReference: INSTANA_QUICK_REFERENCE,
  };
}
