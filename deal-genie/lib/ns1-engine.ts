// NS1 quoting engine — sizing + ballpark pricing + part numbers
//
// FOUR TIERS (as shown in IBM Software CPQ configurator):
//   Essentials — D10AYZX base — 30M queries, 1K records, 2 monitors, 1 filter chain included
//   Standard   — D10AYZX base — 50M queries, 1K records, 2 monitors, 1 filter chain included; add-ons D10AWZX/D10AUZX/D10B2ZX
//   Premium    — D0GN* a la carte — Product 5900B4J — ARR $45K+
//   Hybrid     — D0GY*/D0GZ* bundles — Product 5900B5C — ARR $250K+
//
// Tier routing: MQ ≤ 30  → Essentials
//               MQ ≤ 50  → Standard
//               MQ ≤ 10,000 → Premium
//               MQ > 10,000 → Hybrid
//
// CPQ metric conversions:
//   Standard queries: entered in millions directly (qty 10 = 10M queries, multiples of 10, range 10–70)
//   Premium/Hybrid:   1 Request = 10M queries; 1 Record = 1,000 DNS records
//   1 Interaction = 1M RUM queries
//
// Confirmed CPQ list prices (12-month term, sourced from IBM Software CPQ):
//   D0GNEZX: $1.343/mo per Request (10M queries)
//   D0GNGZX: $10.802/mo per Record (1,000 DNS records)
//   D0GNDZX: $0 (SLA — free, required)
//   D0GYUZX: $31.718/mo per Request (Enterprise bundle)
//   D0GZ2ZX: $0 (Hybrid SLA — free, required)
// All other parts: listPrice still PENDING — confirm in CPQ.
// DDoS/NXD: qty=1 each (not tied to DNS Request qty) — confirmed in CPQ
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

export type NS1Tier = "Essentials" | "Standard" | "Premium" | "Hybrid";

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
  ddosProtection?: boolean;     // D10ATZX (Standard) or D0GN5ZX qty=1 (Premium) — confirmed in CPQ
  nxdWaiver?: boolean;          // D0GNMZX qty=1 — Premium only — confirmed in CPQ
  cloudSync?: boolean;          // D16MXZX — available all tiers
  expectedGrowthPct?: number;   // % headroom to add to MQ (legacy)
  growthMQ?: number;            // absolute MQ headroom to add (replaces expectedGrowthPct)
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
  // Prefer absolute MQ headroom (growthMQ); fall back to percentage for legacy callers
  const growthAddMQ = inputs.growthMQ ?? 0;
  const growthFactor = 1 + (inputs.expectedGrowthPct ?? 0) / 100;
  const effectiveMQ = Math.ceil(inputs.queryVolumeMQ * growthFactor) + growthAddMQ;


  // ── 2. Ballpark MRR/Annual (used for display only — tier routing now MQ-based) ──
  const pricingTier = getNS1Tier(effectiveMQ);
  const ballparkMRR = Math.round(effectiveMQ * pricingTier.tierMRR);
  const ballparkAnnual = ballparkMRR * 12;

  const rationale =
    `${effectiveMQ.toLocaleString()} MQ → ` +
    `ballpark $${ballparkMRR.toLocaleString()}/month`;

  // ── 3. Tier routing — aligned with NS1 package tiers per Nick Lammert ────
  // Essentials: <50M · Standard: 50M–1B · Premium: >1B · Hybrid: enterprise bundles
  let tier: NS1Tier;
  if (effectiveMQ > 10_000) {
    tier = "Hybrid";
  } else if (effectiveMQ >= 1_000) {
    tier = "Premium";
  } else if (effectiveMQ >= 50) {
    tier = "Standard";
  } else {
    tier = "Essentials";
  }


  // ── 4. Derived sizing ──────────────────────────────────────────────────────
  // Standard/Essentials: 1K records included; Premium: 1K records minimum required
  const billableRecords = Math.max(0, (inputs.recordCount ?? 1000) - 1000);
  const filterChains = inputs.filterChains ?? 0;
  const monitors = inputs.monitors ?? 0;

  const partNumbers: NS1PartLineItem[] = [];
  let rumPacks: number | undefined;

  // ── 5. Build part number list by tier ─────────────────────────────────────

  if (tier === "Essentials" || tier === "Standard") {
    // ── ESSENTIALS / STANDARD tier: D10A*/D10B* (Product 5900B4J) ─────────
    // CPQ: Essentials = 30M base, Standard = 50M base
    // Add-on queries entered in millions directly (multiples of 10, range 10–70)
    // 1K records included; 2 monitors included; 1 filter chain included

    const tierLabel = tier === "Essentials"
      ? "Essentials (30M queries, 1K records, 2 monitors, 1 filter chain)"
      : "Standard (50M queries, 1K records, 2 monitors, 1 filter chain)";

    // Base access (required)
    partNumbers.push(partLine(
      "D10AYZX",
      `IBM NS1 Connect ${tier} Access Per Month`,
      1,
      "per month (base fee)",
      `Required base. Includes: ${tierLabel}.`
    ));

    // Add-on query volume (in millions directly, multiples of 10)
    const baseIncludedMQ = tier === "Essentials" ? 30 : 50;
    const addOnMQ = Math.max(0, effectiveMQ - baseIncludedMQ);
    if (addOnMQ > 0) {
      const addOnQty = Math.ceil(addOnMQ / 10) * 10; // round up to nearest 10M
      partNumbers.push(partLine(
        "D10AZZX",
        "IBM NS1 Connect Standard 10M Query Add-On Request Per Month",
        addOnQty,
        "million queries/month (multiples of 10)",
        `${effectiveMQ}M total − ${baseIncludedMQ}M included = ${addOnMQ}M add-on, rounded to ${addOnQty}M. Enter ${addOnQty} in CPQ.`
      ));
    }

    // Additional DNS Records (beyond 1K included)
    if (billableRecords > 0) {
      const recordUnits = Math.ceil(billableRecords / 1000);
      partNumbers.push(partLine(
        "D10AWZX",
        "IBM NS1 Connect Standard Records Add-On 1000 Records Per Month",
        recordUnits,
        "per 1,000 records/month (1-9)",
        `${(inputs.recordCount ?? 1000).toLocaleString()} total − 1,000 included = ${billableRecords.toLocaleString()} billable → ${recordUnits} × 1K-record units.`
      ));
    }

    // Filter Chains / Resource Units (beyond 1 included)
    if (filterChains > 0) {
      partNumbers.push(partLine(
        "D10AUZX",
        "IBM NS1 Connect Standard Filter Chains Add-On Resource Unit Per Month",
        filterChains,
        "per filter chain/month (1-99)",
        `${filterChains} additional filter chains beyond the 1 included. Max 99.`
      ));
    }

    // Monitors / Jobs (beyond 2 included)
    if (monitors > 0) {
      partNumbers.push(partLine(
        "D10B2ZX",
        "IBM NS1 Connect Standard Monitors Add-On Job Per Month",
        monitors,
        "per monitor/month (1-98)",
        `${monitors} additional monitors beyond the 2 included. Max 98.`
      ));
    }

    // DDoS / Spike Protection
    if (inputs.ddosProtection) {
      partNumbers.push(partLine(
        "D10ATZX",
        "IBM NS1 Connect Standard Spike Protection / DDoS Add-On Per Month",
        1,
        "per month",
        "Spike and DDoS protection add-on."
      ));
    }

    // IBM Cloud Sync
    if (inputs.cloudSync) {
      partNumbers.push(partLine(
        "D16MXZX",
        "IBM Cloud Sync Add-on",
        1,
        "per instance",
        "Syncs NS1 DNS zones with IBM Cloud."
      ));
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
      }
    }

    // DDoS — Premium: qty=1 (confirmed in CPQ — not tied to DNS Request qty)
    if (inputs.ddosProtection) {
      partNumbers.push(partLine(
        "D0GN5ZX",
        "IBM NS1 Connect DDoS Overage Protection Request per Month",
        1,
        "per month",
        "DDoS overage protection. Qty=1 (confirmed in CPQ)."
      ));
    }

    // NXD Waiver — qty=1 (confirmed in CPQ)
    if (inputs.nxdWaiver) {
      partNumbers.push(partLine(
        "D0GNMZX",
        "IBM NS1 Connect NXD Waiver Request per Month",
        1,
        "per month",
        "Non-Existent Domain waiver. Qty=1 (confirmed in CPQ)."
      ));
    }

    // IBM Cloud Sync
    if (inputs.cloudSync) {
      partNumbers.push(partLine(
        "D16MXZX",
        "IBM Cloud Sync Add-on",
        1,
        "per instance",
        "Syncs NS1 DNS zones with IBM Cloud."
      ));
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
    }

    // China DNS (1 Request = 10M queries)
    let chinaMQ = inputs.chinaMQ;
    if (chinaMQ !== undefined) {
      if (chinaMQ < 50) {
        chinaMQ = 50;
      }
      const chinaRequests = Math.ceil(chinaMQ / 10);
      partNumbers.push(partLine(
        "D0GN8ZX",
        "IBM NS1 Connect DNS for China Request per Month",
        chinaRequests,
        "per 10M China-origin queries/month",
        `${chinaMQ}M China-origin queries ÷ 10 = ${chinaRequests} Requests. Min 50M (5 Requests).`
      ));

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
      }
    }

    // China DNS (Hybrid — 1 Request = 10M queries)
    let chinaMQ = inputs.chinaMQ;
    if (chinaMQ !== undefined) {
      if (chinaMQ < 50) {
        chinaMQ = 50;
      }
      const chinaRequests = Math.ceil(chinaMQ / 10);
      partNumbers.push(partLine(
        "D0GN8ZX",
        "IBM NS1 Connect DNS for China Request per Month",
        chinaRequests,
        "per 10M China-origin queries/month",
        `${chinaMQ}M China-origin queries ÷ 10 = ${chinaRequests} Requests. Min 50M (5 Requests).`
      ));
      (inputs as NS1Inputs).chinaMQ = chinaMQ;
    }
  }

  // ── 6. Compute totals, pending-price warnings, and $0 part warnings ───────
  const totalMonthlyList = Math.round(
    partNumbers.reduce((sum, p) => sum + p.extendedPrice, 0) * 100
  ) / 100;
  const totalAnnualList = Math.round(totalMonthlyList * 12 * 100) / 100;

  // Free parts that are legitimately $0 — don't warn on these
  const FREE_PARTS = new Set(["D0GNDZX", "D0GZ2ZX"]);
  // Known exception: Standard Query Add-On has no visible part number in CPQ
  const KNOWN_EXCEPTIONS = new Set(["D10AZZX"]);

  const hasPendingPrices = partNumbers.some(
    p => p.listPrice === 0 && !FREE_PARTS.has(p.partNumber) && !KNOWN_EXCEPTIONS.has(p.partNumber)
  );


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
