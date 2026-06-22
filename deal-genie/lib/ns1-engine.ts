// NS1 quoting engine — sizing + ballpark pricing only. Part numbers are PENDING.
import { NS1_PRICING_TIERS } from "./data";

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

  // GSLB RUM packs
  let rumPacks: number | undefined;
  if (inputs.rumBased && filterChains > 0) {
    rumPacks = Math.ceil((effectiveMQ * 1_000_000) / 5_000_000); // 5M-query packs
    flags.push(`GSLB RUM packs: ~${rumPacks} × 5M-query packs (confirm exact count with NS1 team).`);
  }

  // China
  let chinaMQ = inputs.chinaMQ;
  if (chinaMQ !== undefined) {
    if (chinaMQ < 50) {
      chinaMQ = 50;
      flags.push("DNS for China has a minimum of 50M queries — sized to 50 MQ.");
    }
  }

  if (inputs.dnsInsights) {
    flags.push("DNS Insights: ~20% of total queries (list); negotiable to ~10%.");
  }

  if (inputs.dedicatedPoPs !== undefined) {
    if (inputs.dedicatedPoPs < 3) {
      flags.push(`Dedicated DNS minimum is 3 PoPs — please confirm PoP count with the NS1 team.`);
    } else if (inputs.dedicatedPoPs > 12) {
      flags.push(`Dedicated DNS maximum is 12 PoPs — capped at 12.`);
    }
  }

  if (inputs.ddosProtection) {
    flags.push("DDoS / spike protection add-on selected — confirm pricing with NS1 team.");
  }

  if (billableRecords > 0) {
    flags.push(`${billableRecords.toLocaleString()} billable records (after 3,000 free).`);
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
  };
}
