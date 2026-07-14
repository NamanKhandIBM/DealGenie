// NS1 quoting engine — sizing + ballpark pricing + part numbers
//
// FOUR TIERS:
//   Essentials — D10AYZX base $99/mo — 30M queries, 1K records, 1 filter chain, 2 monitors included
//                Add-on: queries only ($50/Request = $50/10M queries). No record/filter/monitor add-ons.
//   Standard   — D10AYZX base $349/mo — 50M queries, 1K records, 1 filter chain, 2 monitors, spike protection included
//                Add-ons: queries $50/Request, records $50/1K, filter chains $40/RU, monitors $1.30/Job
//   Premium    — D0GN* a la carte — Product 5900B4J — ARR $45K+
//   Hybrid     — D0GY*/D0GZ* bundles — Product 5900B5C — ARR $250K+
//
// Tier routing: MQ ≤ 30   → Essentials
//               MQ ≤ 1000 → Standard   (up to 1B queries)
//               MQ ≤ 10000→ Premium
//               MQ > 10000→ Hybrid
//
// Confirmed public prices (IBM.com product pages):
//   D10AYZX (Essentials): $99.00/mo base
//   D10AYZX (Standard):   $349.00/mo base  (same part, different tier price)
//   D10AZZX: $50.00/mo per Request (1 Request = 10M queries) — both Essentials and Standard
//   D10AWZX: $50.00/mo per 1,000 records — Standard only
//   D10AUZX: $40.00/mo per Resource Unit / filter chain — Standard only
//   D10B2ZX: $1.30/mo per Job / monitor — Standard only
//   D16MXZX: $75.00/mo per instance — all tiers
//
// Confirmed CPQ list prices (12-month term, sourced from IBM Software CPQ):
//   D0GNEZX: $1.343/mo per Request (10M queries)
//   D0GNGZX: $10.802/mo per Record (1,000 DNS records)
//   D0GNDZX: $0 (SLA — free, required)
//   D0GYUZX: $31.718/mo per Request (Enterprise bundle)
//   D0GZ2ZX: $0 (Hybrid SLA — free, required)
// DDoS/NXD: qty=1 each (not tied to DNS Request qty) — confirmed in CPQ
// Spike protection: INCLUDED in Standard — do NOT add as line item for Standard deals.
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

/** Look up the catalog entry for a part number. Returns undefined if not found. */
function catalogPart(partNumber: string) {
  const all = [...NS1_STANDARD_PARTS, ...NS1_PREMIUM_PARTS, ...NS1_HYBRID_PARTS];
  return all.find(p => p.partNumber === partNumber);
}

/**
 * Look up the confirmed list price for a part at a given quantity.
 * Uses graduated (GRAD) pricing from scaleQtyPrice if available;
 * falls back to the flat listPrice. Returns 0 if part not found.
 */
function catalogPrice(partNumber: string, quantity = 1): number {
  const part = catalogPart(partNumber);
  if (!part) return 0;
  if (part.scaleQtyPrice && part.scaleQtyPrice.length > 0) {
    // scaleQtyPrice is sorted descending by qty; find the first bracket where quantity >= qty
    for (const tier of part.scaleQtyPrice) {
      if (quantity >= tier.qty) return tier.price;
    }
    // quantity is below the smallest tier — use the smallest tier price
    return part.scaleQtyPrice[part.scaleQtyPrice.length - 1].price;
  }
  return part.listPrice;
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
  const listPrice = catalogPrice(partNumber, quantity);
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

  // ── 3. Tier routing ────────────────────────────────────────────────────────
  // Essentials: ≤30M (30M included) · Standard: 31M–999M (50M included) · Premium: ≥1B · Hybrid: >10B
  // Essentials has no record/filter/monitor add-ons — queries only.
  // Standard spike protection is INCLUDED; D10ATZX added as $0 line item when requested.
  let tier: NS1Tier;
  if (effectiveMQ > 10_000) {
    tier = "Hybrid";
  } else if (effectiveMQ >= 1_000) {
    tier = "Premium";
  } else if (effectiveMQ > 30) {
    tier = "Standard";
  } else {
    tier = "Essentials";
  }

  // ── Growth headroom flag ──────────────────────────────────────────────────
  if (inputs.expectedGrowthPct && inputs.expectedGrowthPct > 0) {
    flags.push(`${inputs.expectedGrowthPct}% growth headroom applied: ${inputs.queryVolumeMQ}M → ${effectiveMQ}M MQ effective.`);
  }
  if (inputs.growthMQ && inputs.growthMQ > 0) {
    flags.push(`+${inputs.growthMQ}M absolute growth headroom applied: ${inputs.queryVolumeMQ}M → ${effectiveMQ}M MQ effective.`);
  }

  // ── 4. Derived sizing ──────────────────────────────────────────────────────
  const billableRecords = Math.max(0, (inputs.recordCount ?? 1000) - 1000);
  const filterChains = inputs.filterChains ?? 0;
  const monitors = inputs.monitors ?? 0;

  const partNumbers: NS1PartLineItem[] = [];
  let rumPacks: number | undefined;

  // ── 5. Build part number list by tier ─────────────────────────────────────

  if (tier === "Essentials") {
    // ── ESSENTIALS: $99/mo base, query add-ons only ────────────────────────
    // Includes: 30M queries, 1K records, 1 filter chain, 2 monitors — NO add-ons for records/filters/monitors
    // Source: IBM.com public product page

    partNumbers.push({
      partNumber: "D10AYZX",
      description: "IBM NS1 Connect Essentials Access Per Month",
      quantity: 1,
      unit: "per month (base fee)",
      listPrice: 99,
      extendedPrice: 99,
      notes: "Required base. Includes: 30M queries, 1K records, 1 filter chain, 2 monitors, 100% uptime SLA. $99/mo (IBM.com public price).",
    });

    // Query add-on: $50/mo per Request (1 Request = 10M queries)
    const addOnMQ = Math.max(0, effectiveMQ - 30);
    if (addOnMQ > 0) {
      const addOnRequests = Math.ceil(addOnMQ / 10);
      partNumbers.push({
        partNumber: "D10AZZX",
        description: "IBM NS1 Connect Essentials Query Add-On Request Per Month",
        quantity: addOnRequests,
        unit: "per 10M queries/month",
        listPrice: 50,
        extendedPrice: 50 * addOnRequests,
        notes: `${effectiveMQ}M total − 30M included = ${addOnMQ}M add-on → ${addOnRequests} Requests × $50/mo. Source: IBM.com public price.`,
      });
    }

    // IBM Cloud Sync (optional, all tiers)
    if (inputs.cloudSync) {
      partNumbers.push({
        partNumber: "D16MXZX",
        description: "IBM Cloud Sync Add-on",
        quantity: 1,
        unit: "per instance/month",
        listPrice: 75,
        extendedPrice: 75,
        notes: "Multi-provider DNS sync. $75/mo per instance. Source: IBM.com public price.",
      });
    }

  } else if (tier === "Standard") {
    // ── STANDARD: $349/mo base, full add-on menu ───────────────────────────
    // Includes: 50M queries, 1K records, 1 filter chain, 2 monitors, spike protection included
    // Source: IBM.com public product page

    partNumbers.push({
      partNumber: "D10AYZX",
      description: "IBM NS1 Connect Standard Access Per Month",
      quantity: 1,
      unit: "per month (base fee)",
      listPrice: 349,
      extendedPrice: 349,
      notes: "Required base. Includes: 50M queries, 1K records, 1 filter chain, 2 monitors, spike/DDoS protection, zone backup/restore. $349/mo (IBM.com public price).",
    });

    // Query add-on: $50/mo per Request (1 Request = 10M queries)
    const addOnMQ = Math.max(0, effectiveMQ - 50);
    if (addOnMQ > 0) {
      const addOnRequests = Math.ceil(addOnMQ / 10);
      partNumbers.push({
        partNumber: "D10AZZX",
        description: "IBM NS1 Connect Standard Additional Queries Per Month",
        quantity: addOnRequests,
        unit: "per 10M queries/month",
        listPrice: 50,
        extendedPrice: 50 * addOnRequests,
        notes: `${effectiveMQ}M total − 50M included = ${addOnMQ}M add-on → ${addOnRequests} Requests × $50/mo. Source: IBM.com public price.`,
      });
    }

    // Additional DNS Records: $50/mo per 1,000 records (Standard only)
    if (billableRecords > 0) {
      const recordUnits = Math.ceil(billableRecords / 1000);
      partNumbers.push({
        partNumber: "D10AWZX",
        description: "IBM NS1 Connect Standard Records Add-On Per Month",
        quantity: recordUnits,
        unit: "per 1,000 records/month",
        listPrice: 50,
        extendedPrice: 50 * recordUnits,
        notes: `${(inputs.recordCount ?? 1000).toLocaleString()} total − 1,000 included = ${billableRecords.toLocaleString()} billable → ${recordUnits} × 1K units × $50/mo. Source: IBM.com public price.`,
      });
    }

    // Filter Chains: $40/mo per Resource Unit (Standard only)
    if (filterChains > 0) {
      partNumbers.push({
        partNumber: "D10AUZX",
        description: "IBM NS1 Connect Standard Filter Chains Per Month",
        quantity: filterChains,
        unit: "per filter chain/month",
        listPrice: 40,
        extendedPrice: 40 * filterChains,
        notes: `${filterChains} additional filter chains beyond the 1 included × $40/mo each. Source: IBM.com public price.`,
      });
    }

    // Monitors (Jobs): $1.30/mo per Job (Standard only)
    if (monitors > 0) {
      partNumbers.push({
        partNumber: "D10B2ZX",
        description: "IBM NS1 Connect Standard Monitors Per Month",
        quantity: monitors,
        unit: "per monitor/month",
        listPrice: 1.30,
        extendedPrice: 1.30 * monitors,
        notes: `${monitors} additional monitors beyond the 2 included × $1.30/mo each. Source: IBM.com public price.`,
      });
    }

    // DDoS/Spike protection is INCLUDED in Standard — add D10ATZX as a $0 line item to confirm.
    if (inputs.ddosProtection) {
      partNumbers.push({
        partNumber: "D10ATZX",
        description: "IBM NS1 Connect Standard Spike Protection",
        quantity: 1,
        unit: "included",
        listPrice: 0,
        extendedPrice: 0,
        notes: "Spike/DDoS protection is INCLUDED in NS1 Connect Standard at no extra charge ($0). No separate line item needed in CPQ.",
      });
    }

    // NOTE: NXD Waiver, RUM/GSLB, Dedicated DNS, Insights, China DNS are Premium-only features.

    // IBM Cloud Sync (optional, all tiers)
    if (inputs.cloudSync) {
      partNumbers.push({
        partNumber: "D16MXZX",
        description: "IBM Cloud Sync Add-on",
        quantity: 1,
        unit: "per instance/month",
        listPrice: 75,
        extendedPrice: 75,
        notes: "Multi-provider DNS sync. $75/mo per instance. Source: IBM.com public price.",
      });
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
    flags.push("D0GNDZX SLA (qty=1) is required on every Premium order — CPQ will not validate without it.");

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
      flags.push(`DNS Insights (D0GN6ZX) qty must equal Managed DNS Requests (D0GNEZX) = ${dnsRequests}.`);
    }

    // China DNS (1 Request = 10M queries)
    let chinaMQ = inputs.chinaMQ;
    if (chinaMQ !== undefined) {
      if (chinaMQ < 50) {
        flags.push(`China DNS: requested ${chinaMQ}M queries is below the minimum of 50M queries — bumped to 50M (5 Requests).`);
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
      if (inputs.dedicatedPoPs < 3) {
        flags.push(`Dedicated DNS: requested ${inputs.dedicatedPoPs} PoPs is below minimum — the minimum is 3 PoPs. Bumped to 3.`);
      }
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
    flags.push("D0GZ2ZX SLA (qty=1) is required on every Hybrid order — CPQ will not validate without it.");

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
