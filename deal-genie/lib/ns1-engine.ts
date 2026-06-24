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
    "NS1 part numbers are PENDING — pull from CPQ or confirm with Tony Nicolakis / Nick Lammert.",
    "All NS1 prices are ILLUSTRATIVE from a seller deck — confirm in CPQ before quoting.",
    "All prices are LIST. Real pricing, discounts, and approvals happen in CPQ.",
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

  // Core: Managed DNS Query Volume
  partNumbers.push({
    partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
    description: "NS1 Managed DNS - Query Volume",
    quantity: effectiveMQ,
    unit: "million queries/month",
    listPrice: tier.tierMRR,
    extendedPrice: ballparkMRR,
    notes: `Tiered pricing at $${tier.tierMRR}/MQ for ${tier.tierBase}M+ tier. Includes first 3,000 DNS records.`
  });

  // Core: Additional DNS Records (if applicable)
  if (billableRecords > 0) {
    partNumbers.push({
      partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
      description: "NS1 DNS Records (beyond 3,000)",
      quantity: billableRecords,
      unit: "records/month",
      listPrice: 0, // TBD from CPQ
      extendedPrice: 0,
      notes: `${billableRecords.toLocaleString()} billable records after 3,000 free records.`
    });
    flags.push(`${billableRecords.toLocaleString()} billable records (after 3,000 free).`);
  }

  // GSLB: Filter Chains
  if (filterChains > 0) {
    partNumbers.push({
      partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
      description: "NS1 GSLB - Filter Chains",
      quantity: filterChains,
      unit: "filter chains/month",
      listPrice: 0, // TBD from CPQ
      extendedPrice: 0,
      notes: `Traffic steering and intelligent routing policies. Requires Managed DNS.`
    });
  }

  // GSLB: RUM packs
  let rumPacks: number | undefined;
  if (inputs.rumBased && filterChains > 0) {
    rumPacks = Math.ceil((effectiveMQ * 1_000_000) / 5_000_000); // 5M-query packs
    partNumbers.push({
      partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
      description: "NS1 GSLB - RUM (Real User Monitoring) Packs",
      quantity: rumPacks,
      unit: "5M query packs/month",
      listPrice: 0, // TBD from CPQ
      extendedPrice: 0,
      notes: `Required for RUM-based filter chains. Each pack covers 5M queries.`
    });
    flags.push(`GSLB RUM packs: ~${rumPacks} × 5M-query packs (confirm exact count with NS1 team).`);
  }

  // GSLB: Monitors
  if (monitors > 0) {
    partNumbers.push({
      partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
      description: "NS1 GSLB - Up/Down Monitors",
      quantity: monitors,
      unit: "monitors/month",
      listPrice: 0, // TBD from CPQ
      extendedPrice: 0,
      notes: `Health check monitors for endpoint availability.`
    });
  }

  // Premium: Dedicated DNS
  if (inputs.dedicatedPoPs !== undefined && inputs.dedicatedPoPs > 0) {
    const pops = Math.max(3, Math.min(12, inputs.dedicatedPoPs)); // Enforce 3-12 range
    partNumbers.push({
      partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
      description: "NS1 Dedicated DNS",
      quantity: pops,
      unit: "PoPs/month",
      listPrice: 0, // TBD from CPQ
      extendedPrice: 0,
      notes: `Dedicated infrastructure. Minimum 3 PoPs, maximum 12 PoPs.`
    });
    
    if (inputs.dedicatedPoPs < 3) {
      flags.push(`Dedicated DNS minimum is 3 PoPs — sized to 3 PoPs.`);
    } else if (inputs.dedicatedPoPs > 12) {
      flags.push(`Dedicated DNS maximum is 12 PoPs — capped at 12 PoPs.`);
    }
  }

  // Premium: China DNS
  let chinaMQ = inputs.chinaMQ;
  if (chinaMQ !== undefined) {
    if (chinaMQ < 50) {
      chinaMQ = 50;
      flags.push("DNS for China has a minimum of 50M queries — sized to 50 MQ.");
    }
    partNumbers.push({
      partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
      description: "NS1 DNS for China",
      quantity: chinaMQ,
      unit: "million queries/month",
      listPrice: 0, // TBD from CPQ
      extendedPrice: 0,
      notes: `Specialized routing for China-origin queries. Minimum 50M queries/month.`
    });
  }

  // Premium: DNS Insights
  if (inputs.dnsInsights) {
    const insightsVolume = Math.ceil(effectiveMQ * 0.20); // 20% of query volume
    partNumbers.push({
      partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
      description: "NS1 DNS Insights",
      quantity: insightsVolume,
      unit: "million queries/month",
      listPrice: 0, // TBD from CPQ
      extendedPrice: 0,
      notes: `Analytics and visibility. Typically ~20% of total query volume (list), negotiable to ~10%.`
    });
    flags.push("DNS Insights: ~20% of total queries (list); negotiable to ~10%.");
  }

  // Premium: DDoS Protection
  if (inputs.ddosProtection) {
    partNumbers.push({
      partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
      description: "NS1 DDoS / Spike Protection",
      quantity: 1,
      unit: "instance/month",
      listPrice: 0, // TBD from CPQ
      extendedPrice: 0,
      notes: `Protection against traffic spikes and DDoS attacks. Pricing varies by requirements.`
    });
    flags.push("DDoS / spike protection add-on selected — confirm pricing with NS1 team.");
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
