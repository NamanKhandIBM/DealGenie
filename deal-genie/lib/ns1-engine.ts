// NS1 quoting engine — sizing + ballpark pricing + part numbers
//
// THREE TIERS (source: NS1 Sales Decoder Ring §3–§6, Appendix E §17):
//   Standard  — D10A*/D10B*  — Product 5900B4J — ARR $4K–$40K
//   Premium   — D0GN*        — Product 5900B4J — ARR $45K–$250K
//   Hybrid    — D0GY*/D0GZ*  — Product 5900B5C — ARR $250K+ or MQ >10,000
//
// Tier routing: ballparkAnnual < 40_000 → Standard
//               ballparkAnnual 40_000–249_999 → Premium
//               ballparkAnnual >= 250_000 OR effectiveMQ > 10_000 → Hybrid
//
// CPQ metric conversions (ibid §8, §18):
//   1 Request     = 10M queries   (Standard & Premium managed DNS, China DNS)
//   1 Record      = 1,000 DNS records
//   1 Interaction = 1M RUM queries (Standard RUM min 1M; Advanced RUM min 5M, sold in 5M blocks)
//
// SLA rules (ibid §17):
//   Premium: D0GNDZX qty=1 required on every order
//   Hybrid:  D0GZ2ZX qty=1 required on every order; 10B QPM minimum (= 1,000 Requests)
//
// Confirmed CPQ list prices (12-month term, sourced from IBM Software CPQ):
//   D0GNEZX: $1.343/mo per Request (10M queries)
//   D0GNGZX: $10.802/mo per Record (1,000 DNS records)
//   D0GNDZX: $0 (SLA — free, required)
//   D0GYUZX: $31.718/mo per Request (Enterprise bundle)
//   D0GZ2ZX: $0 (Hybrid SLA — free, required)
// All other parts: listPrice still PENDING — confirm in CPQ.
// Discounting: ≤35% pre-auth; +10% with leadership; >45% needs product team.

import { NS1_PRICING_TIERS } from "./data";
import {
  NS1_PREMIUM_PARTS,
  NS1_HYBRID_PARTS,
  NS1_STANDARD_PARTS,
  NS1_BEST_PRACTICES,
  NS1_TUTORIAL_STEPS,
  NS1_QUICK_REFERENCE,
  type NS1Part
} from "./ns1-parts";

/** Look up the confirmed list price for a part number from the catalog. Returns 0 if not yet confirmed. */
function catalogPrice(partNumber: string): number {
  const all = [...NS1_STANDARD_PARTS, ...NS1_PREMIUM_PARTS, ...NS1_HYBRID_PARTS];
  return all.find(p => p.partNumber === partNumber)?.listPrice ?? 0;
}

export type NS1Tier = "Standard" | "Premium" | "Hybrid";

export interface NS1Inputs {
  queryVolumeMQ: number;        // millions of queries/month
  recordCount?: number;         // total DNS records (first 3,000 free on Standard; required on Premium)
  filterChains?: number;        // traffic steering / GSLB filter chains
  rumBased?: boolean;           // if true, RUM packs apply (Standard RUM = D0GZ0ZX, Advanced = D0GYYZX)
  rumAdvanced?: boolean;        // if true, use D0GYYZX (private data feed); min 5M, multiples of 5
  monitors?: number;            // up/down monitors
  dedicatedPoPs?: number;       // 0 = no Dedicated DNS; min 3 if enabled (Premium only)
  chinaMQ?: number;             // China-origin queries in MQ (min 50M if enabled)
  dnsInsights?: boolean;        // flat qty = DNS Requests (D0GN6ZX qty must equal D0GNEZX qty)
  ddosProtection?: boolean;     // D10ATZX (Standard) or D0GN5ZX qty=D0GNEZX (Premium)
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
  tier: NS1Tier;                // "Standard" | "Premium" | "Hybrid"
  effectiveMQ: number;          // after growth headroom
  billableRecords: number;
  filterChains: number;
  monitors: number;
  rumPacks?: number;            // interactions (1M each for Std RUM, 5M each for Adv RUM)
  chinaMQ?: number;
  dnsInsights: boolean;
  ballparkMRR: number;          // monthly, rough (illustrative for Standard; real for Premium/Hybrid)
  ballparkAnnual: number;
  totalMonthlyList: number;     // sum of extendedPrice across all line items (monthly)
  totalAnnualList: number;      // totalMonthlyList × 12
  hasPendingPrices: boolean;    // true if any line item still has listPrice=0
  rationale: string;
  flags: string[];
  partNumbers: NS1PartLineItem[]; // detailed line items ready to paste into CPQ
  bestPractices: typeof NS1_BEST_PRACTICES;
  tutorialSteps: typeof NS1_TUTORIAL_STEPS;
  quickReference: typeof NS1_QUICK_REFERENCE;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Find the NS1 pricing tier that covers a given MQ volume. */
function getNS1Tier(mq: number): { tierBase: number; mrrBase: number; tierMRR: number; overage: number } {
  let best: { tierBase: number; mrrBase: number; tierMRR: number; overage: number } = NS1_PRICING_TIERS[0];
  for (const tier of NS1_PRICING_TIERS) {
    if (mq >= tier.tierBase) best = tier;
    else break;
  }
  return best;
}

function partLine(
  partNumber: string,
  description: string,
  quantity: number,
  unit: string,
  notes: string
): NS1PartLineItem {
  const listPrice = catalogPrice(partNumber);
  const extendedPrice = listPrice * quantity;
  return { partNumber, description, quantity, unit, listPrice, extendedPrice, notes };
}

// ─── MAIN ENGINE ─────────────────────────────────────────────────────────────

export function computeNS1Quote(inputs: NS1Inputs): NS1SizingResult {
  const flags: string[] = [
    "All prices are LIST. Real pricing, discounts, and approvals happen in CPQ.",
  ];

  // ── 1. Apply growth headroom ───────────────────────────────────────────────
  const growthFactor = 1 + (inputs.expectedGrowthPct ?? 0) / 100;
  const effectiveMQ = Math.ceil(inputs.queryVolumeMQ * growthFactor);

  if (inputs.expectedGrowthPct && inputs.expectedGrowthPct > 0) {
    flags.push(`Query volume sized with ${inputs.expectedGrowthPct}% growth headroom to avoid overages.`);
  }

  // ── 2. Ballpark MRR/Annual for tier routing ───────────────────────────────
  const pricingTier = getNS1Tier(effectiveMQ);
  const ballparkMRR = Math.round(effectiveMQ * pricingTier.tierMRR);
  const ballparkAnnual = ballparkMRR * 12;

  const rationale =
    `${effectiveMQ.toLocaleString()} MQ → tier base ${pricingTier.tierBase.toLocaleString()} → ` +
    `Tier MRR $${pricingTier.tierMRR} → ${effectiveMQ.toLocaleString()} × $${pricingTier.tierMRR} = ` +
    `$${ballparkMRR.toLocaleString()}/month`;

  // ── 3. Tier routing ────────────────────────────────────────────────────────
  // Source: Decoder Ring §3–§6, §11–§12, Appendix D
  let tier: NS1Tier;
  if (effectiveMQ > 10_000 || ballparkAnnual >= 250_000) {
    tier = "Hybrid";
  } else if (ballparkAnnual >= 40_000) {
    tier = "Premium";
  } else {
    tier = "Standard";
  }

  flags.push(
    `Tier routed to ${tier} (ballpark ACV ~$${ballparkAnnual.toLocaleString()}/yr).` +
    (tier === "Hybrid" ? " Confirm with Tony Nicolakis / Nick Lammert." :
     tier === "Premium" ? " Contact NS1 sales team for pricing." : "")
  );

  // ── 4. Derived sizing ──────────────────────────────────────────────────────
  const billableRecords = Math.max(0, (inputs.recordCount ?? 0) - 3000);
  const filterChains = inputs.filterChains ?? 0;
  const monitors = inputs.monitors ?? 0;

  const partNumbers: NS1PartLineItem[] = [];
  let rumPacks: number | undefined;

  // ── 5. Build part number list by tier ─────────────────────────────────────

  if (tier === "Standard") {
    // ── STANDARD tier: D10A*/D10B* (Product 5900B4J) ──────────────────────
    // 1 Request = 10M queries; 1 Record = 1,000 DNS records

    // Base access (required)
    partNumbers.push(partLine(
      "D10AYZX",
      "IBM NS1 Connect Standard Access Per Month",
      1,
      "per month (base fee)",
      "Required base subscription for every Standard deal."
    ));

    // Committed query volume in 10M-query (1 Request) blocks
    const queryRequests = Math.ceil(effectiveMQ / 10);
    partNumbers.push(partLine(
      "D10AZZX",
      "IBM NS1 Connect Standard 10M Query Add-On Request Per Month",
      queryRequests,
      "per 10M queries/month",
      `${effectiveMQ.toLocaleString()} MQ ÷ 10 = ${queryRequests} Requests. Add overage SKU D10B0ZX for reference.`
    ));

    // Additional DNS Records
    if (billableRecords > 0) {
      const recordUnits = Math.ceil(billableRecords / 1000);
      partNumbers.push(partLine(
        "D10AWZX",
        "IBM NS1 Connect Standard Records Add-On 1000 Records Per Month",
        recordUnits,
        "per 1,000 records/month",
        `${billableRecords.toLocaleString()} billable records (after 3,000 free) → ${recordUnits} × 1,000-record units. Also add overage D10AXZX.`
      ));
      flags.push(`${billableRecords.toLocaleString()} billable records → ${recordUnits} × 1,000-record blocks.`);
    }

    // Filter Chains (Resource Units)
    if (filterChains > 0) {
      partNumbers.push(partLine(
        "D10AUZX",
        "IBM NS1 Connect Standard Filter Chains Add-On Resource Unit Per Month",
        filterChains,
        "per filter chain/month",
        `${filterChains} traffic steering policies. Also add overage D10AVZX.`
      ));
    }

    // RUM-based traffic steering — Standard uses D0GZ0ZX (1M-query Interactions, min 1M)
    if (inputs.rumBased && filterChains > 0) {
      const rumInteractions = Math.max(1, effectiveMQ); // 1 Interaction = 1M queries
      rumPacks = rumInteractions;
      partNumbers.push(partLine(
        "D0GZ0ZX",
        "IBM NS1 Connect GSLB Standard — RUM Traffic Steering Interaction Per Month",
        rumInteractions,
        "per 1M RUM queries/month",
        `${effectiveMQ.toLocaleString()}M queries → ${rumInteractions.toLocaleString()} Interactions (1 Interaction = 1M queries). Min 1. Confirm pricing with Tony/Nick.`
      ));
      flags.push(`GSLB RUM Standard (D0GZ0ZX): ${rumInteractions.toLocaleString()} Interactions — confirm pricing with Tony/Nick.`);
    }

    // Monitors
    if (monitors > 0) {
      partNumbers.push(partLine(
        "D10B2ZX",
        "IBM NS1 Connect Standard Monitors Add-On Job Per Month",
        monitors,
        "per monitor/month",
        `${monitors} health-check monitors. Also add overage D10B3ZX.`
      ));
    }

    // DDoS / Spike Protection (Standard uses flat per-month SKU)
    if (inputs.ddosProtection) {
      partNumbers.push(partLine(
        "D10ATZX",
        "IBM NS1 Connect Standard Spike Protection / DDoS Add-On Per Month",
        1,
        "per month",
        "Spike and DDoS protection. Confirm pricing with NS1 team."
      ));
      flags.push("Spike/DDoS protection (D10ATZX) — confirm pricing with NS1 team.");
    }

  } else if (tier === "Premium") {
    // ── PREMIUM tier: D0GN* a la carte (Product 5900B4J) ──────────────────
    // 1 Request = 10M queries; 1 Record = 1,000 DNS records; 1 Interaction = 1M RUM queries

    // SLA — REQUIRED on every Premium order
    partNumbers.push(partLine(
      "D0GNDZX",
      "IBM NS1 Connect Service Level Agreement",
      1,
      "per month (required)",
      "Required SLA part on every NS1 Connect Premium order. CPQ will not validate without this."
    ));
    flags.push("D0GNDZX (SLA) qty=1 is required on all Premium orders — do not omit.");

    // Managed DNS Requests (1 Request = 10M queries)
    const dnsRequests = Math.max(1, Math.ceil(effectiveMQ / 10));
    partNumbers.push(partLine(
      "D0GNEZX",
      "IBM NS1 Connect Managed DNS Request per Month",
      dnsRequests,
      "per 10M queries/month",
      `${effectiveMQ.toLocaleString()} MQ ÷ 10 = ${dnsRequests} Requests. Required on all orders. Min 10M (1 Request).`
    ));

    // Managed DNS Records (1 Record = 1,000 DNS records)
    const dnsRecords = Math.max(1, Math.ceil((inputs.recordCount ?? 1000) / 1000));
    partNumbers.push(partLine(
      "D0GNGZX",
      "IBM NS1 Connect Managed DNS Record per Month",
      dnsRecords,
      "per 1,000 DNS records/month",
      `${(inputs.recordCount ?? 1000).toLocaleString()} DNS records ÷ 1,000 = ${dnsRecords} IBM Records. Required on all orders. Min 1K (1 Record).`
    ));

    // Monitors (1 Job = 1 monitor)
    if (monitors > 0) {
      partNumbers.push(partLine(
        "D0GNIZX",
        "IBM NS1 Connect Managed DNS Jobs per Month",
        monitors,
        "per monitor/month",
        `${monitors} health-check monitors. 1 Job = 1 monitor.`
      ));
    }

    // Filter Chains (1 Resource Unit = 1 filter chain, non-RUM)
    if (filterChains > 0 && !inputs.rumBased) {
      partNumbers.push(partLine(
        "D0GNKZX",
        "IBM NS1 Connect Managed DNS Resource Unit per Month",
        filterChains,
        "per filter chain/month",
        `${filterChains} standard (non-RUM) filter chains. 1 Resource Unit = 1 filter chain.`
      ));
    }

    // RUM Traffic Steering — Standard (D0GNQZX) vs Advanced (D0GNNZX)
    if (inputs.rumBased && filterChains > 0) {
      if (inputs.rumAdvanced) {
        // Advanced: min 5M queries, sold in 5M blocks (5 Interactions min)
        const rumRaw = Math.max(5, effectiveMQ);
        const rumAdv = Math.ceil(rumRaw / 5) * 5; // round up to nearest 5
        rumPacks = rumAdv;
        partNumbers.push(partLine(
          "D0GNNZX",
          "IBM NS1 Connect RUM Traffic Steering Advanced Interaction per Month",
          rumAdv,
          "per 1M RUM queries/month (5M blocks)",
          `${effectiveMQ.toLocaleString()}M queries → ${rumAdv} Interactions (1M each). Min 5, must be multiple of 5. Private RUM data feed. Confirm with Tony/Nick.`
        ));
        flags.push(`RUM Advanced (D0GNNZX): ${rumAdv} Interactions — min 5, multiples of 5. Confirm pricing with Tony/Nick.`);
      } else {
        // Standard RUM: min 1M queries (1 Interaction min), sold per 1M blocks
        const rumStd = Math.max(1, effectiveMQ);
        rumPacks = rumStd;
        partNumbers.push(partLine(
          "D0GNQZX",
          "IBM NS1 Connect RUM Traffic Steering Standard Interaction per Month",
          rumStd,
          "per 1M RUM queries/month",
          `${effectiveMQ.toLocaleString()}M queries → ${rumStd} Interactions (1M each). Min 1M (1 Interaction). NS1-provided RUM data. Confirm with Tony/Nick.`
        ));
        flags.push(`RUM Standard (D0GNQZX): ${rumStd} Interactions — min 1. Confirm pricing with Tony/Nick.`);
      }
    }

    // DDoS — Premium: qty MUST equal D0GNEZX qty
    if (inputs.ddosProtection) {
      partNumbers.push(partLine(
        "D0GN5ZX",
        "IBM NS1 Connect DDoS Overage Protection Request per Month",
        dnsRequests,
        "per 10M queries/month",
        `Qty must equal D0GNEZX (${dnsRequests} Requests). Confirm pricing with NS1 team.`
      ));
      flags.push(`DDoS (D0GN5ZX) qty must equal Managed DNS Requests (${dnsRequests}) — CPQ rule.`);
    }

    // DNS Insights — qty MUST equal D0GNEZX qty
    if (inputs.dnsInsights) {
      partNumbers.push(partLine(
        "D0GN6ZX",
        "IBM NS1 Connect DNS Insights Request per Month",
        dnsRequests,
        "per 10M queries/month",
        `Qty must equal Managed DNS Requests (D0GNEZX = ${dnsRequests}). This is a CPQ requirement.`
      ));
      flags.push(`DNS Insights (D0GN6ZX) qty must equal Managed DNS Requests (${dnsRequests}) — CPQ rule.`);
    }

    // China DNS (1 Request = 10M queries)
    let chinaMQ = inputs.chinaMQ;
    if (chinaMQ !== undefined) {
      if (chinaMQ < 50) {
        chinaMQ = 50;
        flags.push("DNS for China has a minimum of 50M queries — sized to 50 MQ.");
      }
      const chinaRequests = Math.ceil(chinaMQ / 10);
      partNumbers.push(partLine(
        "D0GN8ZX",
        "IBM NS1 Connect DNS for China Request per Month",
        chinaRequests,
        "per 10M China-origin queries/month",
        `${chinaMQ}M China-origin queries ÷ 10 = ${chinaRequests} Requests. Min 50M (5 Requests). Confirm pricing with Tony Nicolakis.`
      ));
      flags.push(`DNS for China (D0GN8ZX): ${chinaRequests} Requests (${chinaMQ}M queries) — confirm pricing with Tony Nicolakis.`);

      // Reattach updated value so it surfaces in result
      (inputs as NS1Inputs).chinaMQ = chinaMQ;
    }

    // Dedicated DNS (Premium: Small = D0GNBZX, Large = D0GNAZX)
    if (inputs.dedicatedPoPs !== undefined && inputs.dedicatedPoPs > 0) {
      const pops = Math.max(3, Math.min(12, inputs.dedicatedPoPs));
      const recordCount = inputs.recordCount ?? 0;
      const dedicatedPart = recordCount >= 200_000 ? "D0GNAZX" : "D0GNBZX";
      const dedicatedDesc = recordCount >= 200_000
        ? "IBM NS1 Connect Dedicated DNS Large Location per Month (≥200K records)"
        : "IBM NS1 Connect Dedicated DNS Small Location per Month (<200K records)";
      partNumbers.push(partLine(
        dedicatedPart,
        dedicatedDesc,
        pops,
        "PoPs/month",
        `Dedicated DNS. ${pops} PoPs (min 3, max 12). Confirm pricing with Tony/Nick.`
      ));
      if (inputs.dedicatedPoPs < 3) flags.push("Dedicated DNS minimum is 3 PoPs — sized to 3 PoPs.");
      else if (inputs.dedicatedPoPs > 12) flags.push("Dedicated DNS maximum is 12 PoPs — capped at 12 PoPs.");
    }

  } else {
    // ── HYBRID tier: D0GY*/D0GZ* (Product 5900B5C) ────────────────────────
    // Bundle choice: <200K records → D0GYUZX (Enterprise), 200K–2M → D0GYWZX (Enterprise Plus)
    // 1 Request = 10M queries; 10B QPM minimum (= 1,000 Requests)

    // SLA — REQUIRED on every Hybrid order
    partNumbers.push(partLine(
      "D0GZ2ZX",
      "IBM Hybrid Cloud DNS Service Level Agreement",
      1,
      "per month (required)",
      "Required SLA part on every Hybrid Cloud DNS order. CPQ will not validate without this."
    ));
    flags.push("D0GZ2ZX (SLA) qty=1 is required on all Hybrid Cloud DNS orders — do not omit.");

    // Bundle selection based on record count
    const recordCount = inputs.recordCount ?? 0;
    const hybridPart = recordCount >= 200_000 ? "D0GYWZX" : "D0GYUZX";
    const hybridDesc = recordCount >= 200_000
      ? "IBM Hybrid Cloud DNS Enterprise Plus Request per Month (200K–2M records)"
      : "IBM Hybrid Cloud DNS Enterprise Request per Month (under 200K records)";

    // 10B QPM minimum = 1,000 Requests
    const hybridRequests = Math.max(1_000, Math.ceil(effectiveMQ / 10));
    partNumbers.push(partLine(
      hybridPart,
      hybridDesc,
      hybridRequests,
      "per 10M queries/month",
      `${effectiveMQ.toLocaleString()} MQ ÷ 10 = ${hybridRequests} Requests (min 1,000 = 10B QPM). ` +
      (recordCount >= 200_000 ? "Enterprise Plus: 200K–2M records included." : "Enterprise: up to 200K records included.") +
      " Confirm pricing with Tony Nicolakis / Nick Lammert."
    ));

    if (effectiveMQ < 10_000) {
      flags.push(`Hybrid bundle requires minimum 10B QPM (10,000 MQ / 1,000 Requests) — sized to minimum. Confirm with Tony/Nick.`);
    }
    flags.push(
      `Hybrid bundle: ${recordCount >= 200_000 ? "Enterprise Plus (D0GYWZX)" : "Enterprise (D0GYUZX)"} — ` +
      `includes Dedicated DNS, DNS Insights, NXD Waiver, DDoS, Enhanced Monitor Interval, Vanity Name Server. ` +
      `Min ACV: ${recordCount >= 200_000 ? "~$670K" : "~$350K"} pre-discount. Confirm with Tony/Nick.`
    );

    // GSLB upsell on Hybrid (RUM Standard = D0GZ0ZX, Advanced = D0GYYZX)
    if (inputs.rumBased && filterChains > 0) {
      if (inputs.rumAdvanced) {
        // Advanced: min 5B queries (5,000 Interactions of 1M each), sold in 5M blocks
        const rumRaw = Math.max(5_000, effectiveMQ);
        const rumAdv = Math.ceil(rumRaw / 5) * 5;
        rumPacks = rumAdv;
        partNumbers.push(partLine(
          "D0GYYZX",
          "IBM Hybrid Cloud DNS GSLB Advanced Interaction per Month",
          rumAdv,
          "per 1M RUM queries/month (5M blocks)",
          `${effectiveMQ.toLocaleString()}M → ${rumAdv} Interactions. Min 5,000 (5B queries), multiples of 5. Private RUM data feed. Confirm with Tony/Nick.`
        ));
        flags.push(`GSLB Advanced (D0GYYZX): ${rumAdv} Interactions. Min 5,000, multiples of 5. Confirm pricing with Tony/Nick.`);
      } else {
        // Standard: min 1B queries (1,000 Interactions), sold per 1M blocks
        const rumStd = Math.max(1_000, effectiveMQ);
        rumPacks = rumStd;
        partNumbers.push(partLine(
          "D0GZ0ZX",
          "IBM Hybrid Cloud DNS GSLB Standard Interaction per Month",
          rumStd,
          "per 1M RUM queries/month",
          `${effectiveMQ.toLocaleString()}M → ${rumStd} Interactions. Min 1,000 (1B queries). NS1-provided RUM data. Confirm with Tony/Nick.`
        ));
        flags.push(`GSLB Standard (D0GZ0ZX): ${rumStd} Interactions. Min 1,000. Confirm pricing with Tony/Nick.`);
      }
    }

    // China DNS (Hybrid — 1 Request = 10M queries)
    let chinaMQ = inputs.chinaMQ;
    if (chinaMQ !== undefined) {
      if (chinaMQ < 50) {
        chinaMQ = 50;
        flags.push("DNS for China has a minimum of 50M queries — sized to 50 MQ.");
      }
      const chinaRequests = Math.ceil(chinaMQ / 10);
      partNumbers.push(partLine(
        "D0GN8ZX",
        "IBM NS1 Connect DNS for China Request per Month",
        chinaRequests,
        "per 10M China-origin queries/month",
        `${chinaMQ}M China-origin queries ÷ 10 = ${chinaRequests} Requests. Confirm with Tony Nicolakis.`
      ));
      flags.push(`DNS for China (D0GN8ZX): ${chinaRequests} Requests (${chinaMQ}M queries) — confirm with Tony Nicolakis.`);
      (inputs as NS1Inputs).chinaMQ = chinaMQ;
    }
  }

  // ── 6. Compute totals and pending-price flag ───────────────────────────────
  const totalMonthlyList = Math.round(
    partNumbers.reduce((sum, p) => sum + p.extendedPrice, 0) * 100
  ) / 100;
  const totalAnnualList = Math.round(totalMonthlyList * 12 * 100) / 100;
  const hasPendingPrices = partNumbers.some(p => p.listPrice === 0 && p.partNumber !== "D0GNDZX" && p.partNumber !== "D0GZ2ZX");

  if (hasPendingPrices) {
    flags.push("⚠️ Some parts still have PENDING list prices ($0) — confirm those in IBM Software CPQ before sharing with a customer.");
  }

  return {
    tier,
    effectiveMQ,
    billableRecords,
    filterChains,
    monitors,
    rumPacks,
    chinaMQ: inputs.chinaMQ,
    dnsInsights: inputs.dnsInsights ?? false,
    ballparkMRR,
    ballparkAnnual,
    totalMonthlyList,
    totalAnnualList,
    hasPendingPrices,
    rationale,
    flags,
    partNumbers,
    bestPractices: NS1_BEST_PRACTICES,
    tutorialSteps: NS1_TUTORIAL_STEPS,
    quickReference: NS1_QUICK_REFERENCE,
  };
}
