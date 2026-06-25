// NS1 quoting engine — sizing + ballpark pricing + part numbers
import { NS1_PRICING_TIERS } from "./data";
import {
  NS1_CORE_PARTS,
  NS1_GSLB_PARTS,
  NS1_PREMIUM_PARTS,
  NS1_BEST_PRACTICES,
  NS1_TUTORIAL_STEPS,
  NS1_QUICK_REFERENCE,
  type NS1Part
} from "./ns1-parts";

export interface NS1Inputs {
  queryVolumeMQ: number;        // millions of queries/month
  recordCount?: number;         // total DNS records (first 3,000 free)
  filterChains?: number;        // traffic steering / GSLB filter chains
  rumBased?: boolean;           // if true, GSLB RUM packs apply
  monitors?: number;            // up/down monitors
  dedicatedPoPs?: number;       // 0 = no Dedicated DNS; min 3 if enabled
  chinaMQ?: number;             // China-origin queries (min 50M if enabled)
  dnsInsights?: boolean;        // flat 20% of total queries
  ddosProtection?: boolean;
  expectedGrowthPct?: number;   // % headroom to add to MQ
  term?: "12-month" | "3-year";
}

export interface NS1PartLineItem {
  partNumber: string;
  description: string;
  quantity: number;
  unit: string;
  listPrice: number;
  extendedPrice: number;
  notes: string;
}

export interface NS1SizingResult {
  effectiveMQ: number;          // after growth headroom
  billableRecords: number;
  filterChains: number;
  monitors: number;
  rumPacks?: number;            // 5M-query packs
  chinaMQ?: number;
  dnsInsights: boolean;
  ballparkMRR: number;          // monthly, rough
  ballparkAnnual: number;
  rationale: string;
  flags: string[];
  partNumbers: NS1PartLineItem[]; // NEW: Detailed part number breakdown
  bestPractices: typeof NS1_BEST_PRACTICES; // NEW: Best practices guide
  tutorialSteps: typeof NS1_TUTORIAL_STEPS; // NEW: Guided tutorial
  quickReference: typeof NS1_QUICK_REFERENCE; // NEW: Quick reference
}

/** Find the best NS1 tier for a given MQ volume (largest tier base <= MQ). */
function getNS1Tier(mq: number): { tierBase: number; mrrBase: number; tierMRR: number; overage: number } {
  let best: { tierBase: number; mrrBase: number; tierMRR: number; overage: number } = NS1_PRICING_TIERS[0];
  for (const tier of NS1_PRICING_TIERS) {
    if (mq >= tier.tierBase) best = tier;
    else break;
  }
  return best;
}

export function computeNS1Quote(inputs: NS1Inputs): NS1SizingResult {
  const flags: string[] = [
    "NS1 list prices are PENDING — confirm in IBM Software CPQ before quoting (ask Dennis/Tony for the correct CPQ URL).",
    "All prices are LIST. Real pricing, discounts, and approvals happen in CPQ.",
    "GSLB pricing (D0GZ0ZX / D0GYYZX) and Hybrid DNS bundles (D0GYUZX / D0GYWZX) — confirm with Tony Nicolakis / Nick Lammert.",
  ];

  // Apply growth headroom
  const growthFactor = 1 + (inputs.expectedGrowthPct ?? 0) / 100;
  const effectiveMQ = Math.ceil(inputs.queryVolumeMQ * growthFactor);

  const billableRecords = Math.max(0, (inputs.recordCount ?? 0) - 3000);
  const filterChains = inputs.filterChains ?? 0;
  const monitors = inputs.monitors ?? 0;

  // Managed DNS pricing
  const tier = getNS1Tier(effectiveMQ);
  const ballparkMRR = Math.round(effectiveMQ * tier.tierMRR);
  const ballparkAnnual = ballparkMRR * 12;

  let rationale =
    `${effectiveMQ.toLocaleString()} MQ → tier base ${tier.tierBase.toLocaleString()} → Tier MRR $${tier.tierMRR} → ` +
    `${effectiveMQ.toLocaleString()} × $${tier.tierMRR} = $${ballparkMRR.toLocaleString()}/month`;

  if (inputs.expectedGrowthPct && inputs.expectedGrowthPct > 0) {
    rationale += ` (includes ${inputs.expectedGrowthPct}% growth headroom)`;
    flags.push(`Query volume sized with ${inputs.expectedGrowthPct}% growth headroom to avoid overages.`);
  }

  // Build part number line items
  const partNumbers: NS1PartLineItem[] = [];

  // Core: Base access (required on every deal)
  partNumbers.push({
    partNumber: "D10AYZX",
    description: "IBM NS1 Connect Standard Access Per Month",
    quantity: 1,
    unit: "per month (base fee)",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    extendedPrice: 0,
    notes: "Required base subscription for every NS1 deal."
  });

  // Core: Committed query volume in 10M blocks
  const queryBlocks = Math.ceil(effectiveMQ / 10);
  partNumbers.push({
    partNumber: "D10AZZX",
    description: "IBM NS1 Connect Standard 10M Query Add-On Per Month",
    quantity: queryBlocks,
    unit: "per 10M queries/month",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    extendedPrice: 0,
    notes: `${effectiveMQ.toLocaleString()} MQ → ${queryBlocks} × 10M blocks. Also add overage SKU D10B0ZX for reference.`
  });

  // Core: Additional DNS Records (if applicable)
  if (billableRecords > 0) {
    const recordBlocks = Math.ceil(billableRecords / 1000);
    partNumbers.push({
      partNumber: "D10AWZX",
      description: "IBM NS1 Connect Standard Records Add-On 1000 Records Per Month",
      quantity: recordBlocks,
      unit: "per 1,000 records/month",
      listPrice: 0, // PENDING — confirm in IBM Software CPQ
      extendedPrice: 0,
      notes: `${billableRecords.toLocaleString()} billable records (after 3,000 free) → ${recordBlocks} × 1,000 blocks. Also add overage SKU D10AXZX for reference.`
    });
    flags.push(`${billableRecords.toLocaleString()} billable records (after 3,000 free) → ${recordBlocks} × 1,000-record blocks.`);
  }

  // GSLB: Filter Chains
  if (filterChains > 0) {
    partNumbers.push({
      partNumber: "D10AUZX",
      description: "IBM NS1 Connect Standard Filter Chains Add-On Resource Unit Per Month",
      quantity: filterChains,
      unit: "per filter chain/month",
      listPrice: 0, // PENDING — confirm in IBM Software CPQ
      extendedPrice: 0,
      notes: `${filterChains} traffic steering policies. Also add overage SKU D10AVZX for reference.`
    });
  }

  // GSLB: RUM — Standard (NS1 RUM data) or Advanced (private RUM)
  let rumPacks: number | undefined;
  if (inputs.rumBased && filterChains > 0) {
    rumPacks = Math.ceil((effectiveMQ * 1_000_000) / 5_000_000);
    const rumPart = inputs.rumBased === true ? "D0GZ0ZX" : "D0GYYZX";
    const rumDesc = inputs.rumBased === true
      ? "NS1 GSLB Standard (using NS1 Real User Monitoring data)"
      : "NS1 GSLB Advanced (customer-configured private RUM tests)";
    partNumbers.push({
      partNumber: rumPart,
      description: rumDesc,
      quantity: rumPacks,
      unit: "per month",
      listPrice: 0, // PENDING — confirm with Tony Nicolakis / Nick Lammert
      extendedPrice: 0,
      notes: `RUM-based GSLB. ~${rumPacks} × 5M-query packs. Confirm pricing with Tony/Nick.`
    });
    flags.push(`GSLB RUM (${rumPart}): ~${rumPacks} × 5M-query packs — confirm pricing with Tony/Nick.`);
  }

  // GSLB: Monitors
  if (monitors > 0) {
    partNumbers.push({
      partNumber: "D10B2ZX",
      description: "IBM NS1 Connect Standard Monitors Add-On Job Per Month",
      quantity: monitors,
      unit: "per monitor/month",
      listPrice: 0, // PENDING — confirm in IBM Software CPQ
      extendedPrice: 0,
      notes: `${monitors} health-check monitors. Also add overage SKU D10B3ZX for reference.`
    });
  }

  // Premium: Dedicated / Hybrid DNS
  if (inputs.dedicatedPoPs !== undefined && inputs.dedicatedPoPs > 0) {
    const pops = Math.max(3, Math.min(12, inputs.dedicatedPoPs));
    // Choose bundle based on record count: <200k → D0GYUZX, 200k-2M → D0GYWZX
    const recordCount = inputs.recordCount ?? 0;
    const dedicatedPart = recordCount >= 200000 ? "D0GYWZX" : "D0GYUZX";
    const dedicatedDesc = recordCount >= 200000
      ? "NS1 Hybrid Cloud DNS Enterprise Plus Bundle (200k–2M DNS records)"
      : "NS1 Hybrid Cloud DNS Enterprise Bundle (under 200k DNS records)";
    partNumbers.push({
      partNumber: dedicatedPart,
      description: dedicatedDesc,
      quantity: pops,
      unit: "PoPs/month",
      listPrice: 0, // PENDING — confirm with Tony Nicolakis / Nick Lammert
      extendedPrice: 0,
      notes: `Dedicated/Hybrid DNS. ${pops} PoPs (min 3, max 12). Confirm pricing with Tony/Nick.`
    });
    if (inputs.dedicatedPoPs < 3) flags.push(`Dedicated DNS minimum is 3 PoPs — sized to 3 PoPs.`);
    else if (inputs.dedicatedPoPs > 12) flags.push(`Dedicated DNS maximum is 12 PoPs — capped at 12 PoPs.`);
  }

  // Premium: China DNS (note: no dedicated China SKU found — use Managed DNS + flag)
  let chinaMQ = inputs.chinaMQ;
  if (chinaMQ !== undefined) {
    if (chinaMQ < 50) {
      chinaMQ = 50;
      flags.push("DNS for China has a minimum of 50M queries — sized to 50 MQ.");
    }
    flags.push(`DNS for China: ${chinaMQ}M China-origin queries. No standalone China SKU found in Sales Kit — confirm with Tony Nicolakis whether this is quoted via the Hybrid bundle or a separate China-specific part.`);
  }

  // Premium: DNS Insights (no standalone SKU found — flag for confirmation)
  if (inputs.dnsInsights) {
    const insightsVolume = Math.ceil(effectiveMQ * 0.20);
    flags.push(`DNS Insights: ~${insightsVolume}M queries (20% of ${effectiveMQ}M). No standalone Insights SKU found in Sales Kit — confirm part number with Tony Nicolakis / Nick Lammert.`);
  }

  // Premium: Spike / DDoS Protection
  if (inputs.ddosProtection) {
    partNumbers.push({
      partNumber: "D10ATZX",
      description: "IBM NS1 Connect Standard Spike Protection Add-On Per Month",
      quantity: 1,
      unit: "per month",
      listPrice: 0, // PENDING — confirm in IBM Software CPQ
      extendedPrice: 0,
      notes: "Spike and DDoS protection. Pricing varies by threat profile — confirm with NS1 team."
    });
    flags.push("Spike/DDoS protection (D10ATZX) — confirm pricing with NS1 team.");
  }

  return {
    effectiveMQ,
    billableRecords,
    filterChains,
    monitors,
    rumPacks,
    chinaMQ,
    dnsInsights: inputs.dnsInsights ?? false,
    ballparkMRR,
    ballparkAnnual,
    rationale,
    flags,
    partNumbers,
    bestPractices: NS1_BEST_PRACTICES,
    tutorialSteps: NS1_TUTORIAL_STEPS,
    quickReference: NS1_QUICK_REFERENCE,
  };
}
