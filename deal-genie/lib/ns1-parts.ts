// NS1 Part Numbers and Pricing Data
// Source: NS1 Sales Decoder Ring – CPQ.pdf (IBM Seismic, 2025) + IBM.com public product pages
//
// TWO SEPARATE PRODUCTS:
//   1. NS1 Connect Standard  — Product ID 5900B4J  — D10A*/D10B* SKUs  — ARR $4K–$40K
//   2. NS1 Connect Premium / Hybrid Cloud DNS — Product ID 5900B5C — D0GN*/D0GY*/D0GZ* SKUs — ARR $45K–$1M+
//
// Prices confirmed from IBM.com public product pages (monthly list, US pricing):
//   D10AYZX (Essentials base): $99.00/mo  ($1,188/yr annual)
//   D10AYZX (Standard base):   $349.00/mo ($4,188/yr annual)  — same part, different tier
//   D10AZZX (query add-on):    $50.00/mo per Request (1 Request = 10M queries) — same rate for both tiers
//   D10AWZX (records):         $50.00/mo per 1,000 records (Standard only)
//   D10AUZX (filter chains):   $40.00/mo per Resource Unit / filter chain (Standard only)
//   D10B2ZX (monitors/jobs):   $1.30/mo per Job / monitor (Standard only)
//   D16MXZX (Cloud Sync):      $75.00/mo per instance (both tiers)
//
// Prices confirmed from IBM Software CPQ (12-month term):
//   D0GNEZX: $77,362.80/yr at 4,800 qty  → $1.343/mo per 10M queries
//   D0GNGZX: $777,750.00/yr at 6,000 qty → $10.802/mo per 1K records
//   D0GNDZX: $0 (SLA — included/free)
//   D0GYUZX: $380,619.60/yr at 1,000 qty → $31.718/mo per 10M queries (Enterprise bundle)
//   D0GZ2ZX: $0 (Hybrid SLA — included/free)
// Discounting policy: up to 35% pre-authorized; +10% with sales leadership approval; beyond that requires product team.

export interface NS1Part {
  partNumber: string;
  description: string;
  listPrice: number;       // entry-level list price; use scaleQtyPrice for graduated pricing
  unit: string;
  category: "Core" | "Add-on" | "Premium" | "Hybrid Bundle" | "GSLB" | "Standard";
  notes?: string;
  minimums?: {
    quantity?: number;
    description?: string;
  };
  /** IBM Marketplace graduated pricing tiers (descending qty order: first bracket ≥ qty applies) */
  scaleQtyPrice?: Array<{ qty: number; price: number }>;
}

// ─── NS1 CONNECT STANDARD (Product ID 5900B4J) ───────────────────────────────
// ARR: $4K–$40K/yr · Up to 1B queries, 10K records, 100 monitors/filter chains
// Sold: direct, IBM.com, partners, AWS Marketplace

export const NS1_STANDARD_PARTS: NS1Part[] = [
  {
    partNumber: "D10AYZX",
    description: "IBM NS1 Connect Essentials / Standard Access Per Month",
    listPrice: 99, // Essentials: $99.00/mo. Standard: $349.00/mo. Same part, price differs by tier. Source: IBM.com public product page.
    unit: "per month (base access)",
    category: "Standard",
    notes: "Required base subscription. Essentials = $99/mo (30M queries, 1K records, 1 filter chain, 2 monitors). Standard = $349/mo (50M queries, 1K records, 1 filter chain, 2 monitors, spike protection included)."
  },
  {
    partNumber: "D10AZZX",
    description: "IBM NS1 Connect Query Add-On Request Per Month",
    listPrice: 50, // $50.00/mo per Request. 1 Request = 10M queries. Source: IBM.com public product page (same rate for Essentials and Standard).
    unit: "per 10M queries/month",
    category: "Standard",
    notes: "$50/mo per Request (1 Request = 10M queries). Same rate for both Essentials and Standard. Quantity = CEIL((effectiveMQ − baseIncluded) / 10)."
  },
  {
    partNumber: "D10B0ZX",
    description: "IBM NS1 Connect Standard 10M Query Add-On Request Overage",
    listPrice: 0, // Overage rate — billed monthly. Confirm exact rate in CPQ.
    unit: "per 10M queries/month (overage)",
    category: "Standard",
    notes: "Overage SKU — fires when actual queries exceed committed D10AZZX band. Include alongside D10AZZX for reference."
  },
  {
    partNumber: "D1250ZX",
    description: "IBM NS1 Connect Standard Access 10M Queries Pay Per Use",
    listPrice: 0, // Pay-per-use variant — confirm in CPQ.
    unit: "per 10M queries (pay-per-use)",
    category: "Standard",
    notes: "Pay-per-use alternative. Use for short-term or variable workloads."
  },
  {
    partNumber: "D10AWZX",
    description: "IBM NS1 Connect Standard Records Add-On 1000 Records Per Month",
    listPrice: 50, // $50.00/mo per 1,000 records. Source: IBM.com Standard product page.
    unit: "per 1,000 records/month",
    category: "Standard",
    notes: "First 1,000 records included in base. $50/mo per 1,000 records above that. Quantity = CEIL(billableRecords / 1000). Standard only — Essentials has no record add-on."
  },
  {
    partNumber: "D10AXZX",
    description: "IBM NS1 Connect Standard Records Add-On 1000 Records Overage",
    listPrice: 0, // Overage rate — billed monthly.
    unit: "per 1,000 records/month (overage)",
    category: "Standard",
    notes: "Overage SKU for records. Include alongside D10AWZX for reference."
  },
  {
    partNumber: "D10AUZX",
    description: "IBM NS1 Connect Standard Filter Chains Add-On Resource Unit Per Month",
    listPrice: 40, // $40.00/mo per Resource Unit (1 RU = 1 filter chain). Source: IBM.com Standard product page.
    unit: "per filter chain/month",
    category: "Standard",
    notes: "$40/mo per filter chain (Resource Unit). 1 filter chain included in base. Up to 100 filter chains on Standard. Standard only — Essentials has no filter chain add-on."
  },
  {
    partNumber: "D10AVZX",
    description: "IBM NS1 Connect Standard Filter Chains Add-On Resource Unit Overage",
    listPrice: 0, // Overage rate — billed monthly.
    unit: "per filter chain/month (overage)",
    category: "Standard",
    notes: "Overage SKU for filter chains. Include alongside D10AUZX for reference."
  },
  {
    partNumber: "D10B2ZX",
    description: "IBM NS1 Connect Standard Monitors Add-On Job Per Month",
    listPrice: 1.30, // $1.30/mo per Job (1 Job = 1 monitor). Source: IBM.com Standard product page.
    unit: "per monitor/month",
    category: "Standard",
    notes: "$1.30/mo per monitor (Job). 2 monitors included in base. Up to 100 monitors on Standard. Standard only — Essentials has no monitor add-on."
  },
  {
    partNumber: "D10B3ZX",
    description: "IBM NS1 Connect Standard Monitors Add-On Job Overage",
    listPrice: 0, // Overage rate — billed monthly.
    unit: "per monitor/month (overage)",
    category: "Standard",
    notes: "Overage SKU for monitors. Include alongside D10B2ZX for reference."
  },
  {
    partNumber: "D10ATZX",
    description: "IBM NS1 Connect Standard Spike Protection",
    listPrice: 0, // Included in Standard tier — $0 add-on cost. Source: IBM.com Standard product page.
    unit: "included",
    category: "Standard",
    notes: "Spike/DDoS protection is INCLUDED in NS1 Connect Standard at no extra charge. Do not add as a line item for Standard deals."
  },
  {
    partNumber: "D16MXZX",
    description: "IBM Cloud Sync Add-on",
    listPrice: 75, // $75.00/mo per instance. Source: IBM.com product pages (both Essentials and Standard).
    unit: "per instance/month",
    category: "Add-on",
    notes: "$75/mo per instance. Available on all tiers. Multi-provider DNS sync (Route 53, NS1) and backup/restore to S3."
  }
];

// ─── NS1 CONNECT PREMIUM (Product ID 5900B4J) ────────────────────────────────
// A la carte menu. ARR: $45K ASP. Target: mid-market, new IBM customers.
// All parts below use 1 Request = 10M queries, 1 Record = 1,000 DNS records.

export const NS1_PREMIUM_PARTS: NS1Part[] = [
  {
    partNumber: "D0GNDZX",
    description: "IBM NS1 Connect Service Level Agreement",
    listPrice: 0, // $0 — SLA included/free. Confirmed in CPQ.
    unit: "per month",
    category: "Core",
    notes: "Required SLA part on all NS1 Connect Premium orders. List price $0 — confirmed in CPQ."
  },
  {
    partNumber: "D0GNGZX",
    description: "IBM NS1 Connect Managed DNS Record per Month",
    listPrice: 10.802, // $10.802/mo per unit. Source: CPQ $777,750/yr ÷ 12 ÷ 6,000 qty. 12-month term.
    unit: "per 1,000 DNS records/month",
    category: "Core",
    notes: "Baseline DNS records. 1 IBM Record = 1,000 DNS records. Required on all orders. Min: 1K records. List price $10.802/mo per unit (CPQ verified)."
  },
  {
    partNumber: "D0GNEZX",
    description: "IBM NS1 Connect Managed DNS Request per Month",
    listPrice: 1.343, // $1.343/mo per unit. Source: CPQ $77,362.80/yr ÷ 12 ÷ 4,800 qty. 12-month term.
    unit: "per 10M queries/month",
    category: "Core",
    notes: "Baseline DNS QPM. 1 Request = 10M queries. Required on all orders. Min: 10M queries. List price $1.343/mo per unit (CPQ verified)."
  },
  {
    partNumber: "D0GNIZX",
    description: "IBM NS1 Connect Managed DNS Jobs per Month",
    listPrice: 2.44, // $2.44/mo per job at qty<50 (graduated: $0.64 at high volume). Source: IBM Marketplace API.
    unit: "per monitor/month",
    category: "Add-on",
    notes: "Health-check monitors. 1 Job = 1 monitor. Graduated pricing: $2.44/mo (<50), $1.35 (50–249), $0.92 (250–499), $0.64 (500+). Source: IBM Marketplace API (confirmed).",
    scaleQtyPrice: [
      { qty: 1000000000, price: 0.64 }, { qty: 500, price: 0.92 },
      { qty: 250, price: 1.35 }, { qty: 50, price: 2.44 }
    ]
  },
  {
    partNumber: "D0GNKZX",
    description: "IBM NS1 Connect Managed DNS Resource Unit per Month",
    listPrice: 73.10, // $73.10/mo per RU at qty<10 (graduated: $3.82 at very high volume). Source: IBM Marketplace API.
    unit: "per filter chain/month",
    category: "Add-on",
    notes: "Standard (non-RUM) filter chains. 1 Resource Unit = 1 filter chain. Graduated: $73.10 (<10), $51.20 (10–24), $23.05 (25–49), $19.60 (50–249), $11.75 (250–499), $6.47 (500–999), $5.82 (1K–2.4K), $5.24 (2.5K–4.9K), $4.71 (5K–9.9K), $4.24 (10K–24.9K), $3.82 (25K+). Source: IBM Marketplace API.",
    scaleQtyPrice: [
      { qty: 1000000000, price: 3.82 }, { qty: 25000, price: 4.24 },
      { qty: 10000, price: 4.71 }, { qty: 5000, price: 5.24 },
      { qty: 2500, price: 5.82 }, { qty: 1000, price: 6.47 },
      { qty: 500, price: 11.75 }, { qty: 250, price: 19.60 },
      { qty: 50, price: 23.05 }, { qty: 25, price: 51.20 },
      { qty: 10, price: 73.10 }
    ]
  },
  {
    partNumber: "D0GN5ZX",
    description: "IBM NS1 Connect DDoS Overage Protection Request per Month",
    listPrice: 13.65, // $13.65/mo per Request at qty<10 (graduated: $0.64 at high volume). Source: IBM Marketplace API.
    unit: "per 10M queries/month",
    category: "Add-on",
    notes: "DDoS overage protection. 1 Request = 10M queries. Graduated pricing (same rate schedule as D0GNEZX). Qty=1 in CPQ (confirmed). Source: IBM Marketplace API.",
    scaleQtyPrice: [
      { qty: 1000000000, price: 0.64 }, { qty: 5000, price: 0.67 },
      { qty: 2500, price: 0.74 }, { qty: 1000, price: 0.88 },
      { qty: 500, price: 1.03 }, { qty: 250, price: 1.88 },
      { qty: 100, price: 2.68 }, { qty: 50, price: 3.83 },
      { qty: 25, price: 5.47 }, { qty: 10, price: 13.65 }
    ]
  },
  {
    partNumber: "D0GNMZX",
    description: "IBM NS1 Connect NXD Waiver Request per Month",
    listPrice: 13.65, // $13.65/mo per Request at qty<10 (graduated: $0.64 at high volume). Source: IBM Marketplace API.
    unit: "per 10M queries/month",
    category: "Add-on",
    notes: "NXDOMAIN request waiver. 1 Request = 10M queries. Same graduated rate as D0GN5ZX. Qty=1 in CPQ (confirmed). Source: IBM Marketplace API.",
    scaleQtyPrice: [
      { qty: 1000000000, price: 0.64 }, { qty: 5000, price: 0.67 },
      { qty: 2500, price: 0.74 }, { qty: 1000, price: 0.88 },
      { qty: 500, price: 1.03 }, { qty: 250, price: 1.88 },
      { qty: 100, price: 2.68 }, { qty: 50, price: 3.83 },
      { qty: 25, price: 5.47 }, { qty: 10, price: 13.65 }
    ]
  },
  {
    partNumber: "D0GNCZX",
    description: "IBM NS1 Connect Enhanced Monitor Interval Access per Month",
    listPrice: 1120, // $1,120/mo flat. Source: IBM Marketplace API (VALU pricing model).
    unit: "per month (0 or 1)",
    category: "Add-on",
    notes: "Upgrades monitor check interval from 30s to 5s. Flat rate $1,120/mo (qty 0 or 1). Source: IBM Marketplace API (confirmed)."
  },
  {
    partNumber: "D0GNRZX",
    description: "IBM NS1 Connect Vanity Name Server Access per Month",
    listPrice: 2250, // $2,250/mo flat. Source: IBM Marketplace API (VALU pricing model).
    unit: "per month (0 or 1)",
    category: "Add-on",
    notes: "Custom branded nameservers. Flat rate $2,250/mo (qty 0 or 1). Source: IBM Marketplace API (confirmed)."
  },
  {
    partNumber: "D0GN8ZX",
    description: "IBM NS1 Connect DNS for China Request per Month",
    listPrice: 182, // $182/mo per Request at qty<10 (graduated: $5.19 at very high volume). Source: IBM Marketplace API.
    unit: "per 10M queries/month",
    category: "Add-on",
    notes: "China-origin DNS traffic. 1 Request = 10M queries. Min: 50M queries (5 Requests). Graduated pricing. Source: IBM Marketplace API (confirmed).",
    minimums: { quantity: 5, description: "Minimum 50M queries (5 Requests = 5 × 10M)" },
    scaleQtyPrice: [
      { qty: 1000000000, price: 5.19 }, { qty: 25000, price: 6.11 },
      { qty: 10000, price: 7.19 }, { qty: 5000, price: 8.45 },
      { qty: 2500, price: 9.94 }, { qty: 1000, price: 11.70 },
      { qty: 500, price: 13.80 }, { qty: 250, price: 25.00 },
      { qty: 100, price: 35.70 }, { qty: 50, price: 51.10 },
      { qty: 25, price: 72.90 }, { qty: 10, price: 182 }
    ]
  },
  {
    partNumber: "D0GN6ZX",
    description: "IBM NS1 Connect DNS Insights Request per Month",
    listPrice: 13.65, // $13.65/mo per Request at qty<10 (graduated: $0.64 at high volume). Source: IBM Marketplace API.
    unit: "per 10M queries/month",
    category: "Add-on",
    notes: "DNS Insights analytics. Qty must equal D0GNEZX (Managed DNS Requests). Same graduated rate as D0GN5ZX. Source: IBM Marketplace API (confirmed).",
    scaleQtyPrice: [
      { qty: 10000, price: 0.64 }, { qty: 5000, price: 0.67 },
      { qty: 2500, price: 0.74 }, { qty: 1000, price: 0.88 },
      { qty: 500, price: 1.03 }, { qty: 250, price: 1.88 },
      { qty: 100, price: 2.68 }, { qty: 50, price: 3.83 },
      { qty: 25, price: 5.47 }, { qty: 10, price: 13.65 }
    ]
  },
  {
    partNumber: "D0GN7ZX",
    description: "IBM NS1 Connect DNS Insights Job per Month",
    listPrice: 106, // $106/mo per Job at qty<10 (graduated: $54.20 at high volume). Source: IBM Marketplace API.
    unit: "per custom policy/month",
    category: "Add-on",
    notes: "Custom DNS Insights policies beyond the 3 included in base package. Graduated: $106 (<10), $74.20 (10–24), $66.80 (25–49), $60.10 (50–99), $54.20 (100+). Source: IBM Marketplace API (confirmed).",
    scaleQtyPrice: [
      { qty: 1000000000, price: 54.20 }, { qty: 100, price: 60.10 },
      { qty: 50, price: 66.80 }, { qty: 25, price: 74.20 },
      { qty: 10, price: 106 }
    ]
  },
  {
    partNumber: "D0GNQZX",
    description: "IBM NS1 Connect RUM Traffic Steering Standard Interaction per Month",
    listPrice: 14.40, // $14.40/mo per Interaction at qty<10 (graduated: $1.09 at high volume). Source: IBM Marketplace API.
    unit: "per 1M RUM queries/month",
    category: "Add-on",
    notes: "RUM-based GSLB using NS1-provided data. 1 Interaction = 1M queries. Min: 1M queries. Graduated pricing. Source: IBM Marketplace API (confirmed).",
    scaleQtyPrice: [
      { qty: 1000000000, price: 1.09 }, { qty: 25000, price: 1.36 },
      { qty: 10000, price: 1.81 }, { qty: 5000, price: 2.27 },
      { qty: 2500, price: 2.83 }, { qty: 1000, price: 3.77 },
      { qty: 500, price: 4.72 }, { qty: 250, price: 5.90 },
      { qty: 100, price: 7.38 }, { qty: 50, price: 9.22 },
      { qty: 25, price: 11.55 }, { qty: 10, price: 14.40 }
    ]
  },
  {
    partNumber: "D0GNNZX",
    description: "IBM NS1 Connect RUM Traffic Steering Advanced Interaction per Month",
    listPrice: 22.90, // $22.90/mo per Interaction at qty<10 (graduated: $1.73 at high volume). Source: IBM Marketplace API.
    unit: "per 1M RUM queries/month",
    category: "Add-on",
    notes: "RUM-based GSLB using customer-ingested private data. 1 Interaction = 1M queries. Min: 5M queries (5 Interactions). Must be multiple of 5. Source: IBM Marketplace API (confirmed).",
    minimums: { quantity: 5, description: "Minimum 5M queries (5 Interactions = 5 × 1M)" },
    scaleQtyPrice: [
      { qty: 1000000000, price: 1.73 }, { qty: 25000, price: 2.16 },
      { qty: 10000, price: 2.88 }, { qty: 5000, price: 3.60 },
      { qty: 2500, price: 4.49 }, { qty: 1000, price: 6.00 },
      { qty: 500, price: 7.49 }, { qty: 250, price: 9.37 },
      { qty: 100, price: 11.70 }, { qty: 50, price: 14.65 },
      { qty: 25, price: 18.35 }, { qty: 10, price: 22.90 }
    ]
  },
  {
    partNumber: "D0GNAZX",
    description: "IBM NS1 Connect Dedicated DNS Large Location per Month",
    listPrice: 2430, // $2,430/mo per PoP flat. Source: IBM Marketplace API (QNTY pricing model).
    unit: "per PoP/month",
    category: "Premium",
    notes: "Large Dedicated DNS instance: 64GB RAM, 16 cores, up to 50M records, up to 75B QPM. $2,430/mo per PoP. Min 3, max 12 PoPs. Source: IBM Marketplace API (confirmed).",
    minimums: { quantity: 3, description: "Minimum 3 PoPs, maximum 12 PoPs" }
  },
  {
    partNumber: "D0GNBZX",
    description: "IBM NS1 Connect Dedicated DNS Small Location per Month",
    listPrice: 1220, // $1,220/mo per PoP flat. Source: IBM Marketplace API (QNTY pricing model).
    unit: "per PoP/month",
    category: "Premium",
    notes: "Standard Dedicated DNS instance: 8GB RAM, 4 cores, up to 2.5M records, up to 10B QPM. $1,220/mo per PoP. Min 3, max 12 PoPs. Source: IBM Marketplace API (confirmed).",
    minimums: { quantity: 3, description: "Minimum 3 PoPs, maximum 12 PoPs" }
  }
];

// ─── HYBRID CLOUD DNS BUNDLES (Product ID 5900B5C) ───────────────────────────
// Pre-packaged bundles. ARR: $250K–$1M+. Target: Whales, existing IBM customers.
// Minimum 10B queries/month for both bundles.
// Example minimum pre-discount pricing: Enterprise ~$350K ACV, Enterprise Plus ~$670K ACV.

export const NS1_HYBRID_PARTS: NS1Part[] = [
  {
    partNumber: "D0GZ2ZX",
    description: "IBM Hybrid Cloud DNS Service Level Agreement",
    listPrice: 0, // $0 — SLA included/free. Confirmed in CPQ.
    unit: "per month",
    category: "Hybrid Bundle",
    notes: "Required SLA part on all Hybrid Cloud DNS orders. List price $0 — confirmed in CPQ."
  },
  {
    partNumber: "D0GYUZX",
    description: "IBM Hybrid Cloud DNS Enterprise Request per Month",
    listPrice: 31.718, // $31.718/mo per unit. Source: CPQ $380,619.60/yr ÷ 12 ÷ 1,000 qty. 12-month term.
    unit: "per 10M queries/month",
    category: "Hybrid Bundle",
    notes: "Enterprise bundle baseline QPM. 1 Request = 10M queries. Min: 10B queries (1,000 Requests). Includes: up to 200K records, 250 filter chains, 500 monitors, 5 Dedicated DNS Standard (8GB/4-core, 2.5M records, 10B QPM each), DNS Insights + 10 policies, NXD Waiver, DDoS Overage Protection, Enhanced Monitor Interval (5s), Vanity Name Server. List price $31.718/mo per unit (CPQ verified). Min pre-discount ACV ~$380K/yr.",
    minimums: { quantity: 1000, description: "Minimum 10B queries/month (1,000 Requests × 10M)" }
  },
  {
    partNumber: "D0GYWZX",
    description: "IBM Hybrid Cloud DNS Enterprise Plus Request per Month",
    listPrice: 91.20, // $91.20/mo per Request at qty<10 (graduated: $3.45 at high volume). Source: IBM Marketplace API.
    unit: "per 10M queries/month",
    category: "Hybrid Bundle",
    notes: "Enterprise Plus bundle QPM. 1 Request = 10M queries. Min: 10B queries (1,000 Requests). Includes: up to 2M records, 1,000 filter chains, 2,000 monitors, 5 Dedicated DNS Large. Graduated pricing. Source: IBM Marketplace API (confirmed).",
    minimums: { quantity: 1000, description: "Minimum 10B queries/month (1,000 Requests × 10M)" },
    scaleQtyPrice: [
      { qty: 1000000000, price: 3.45 }, { qty: 25000, price: 3.63 },
      { qty: 10000, price: 4.03 }, { qty: 5000, price: 4.47 },
      { qty: 2500, price: 4.97 }, { qty: 1000, price: 5.85 },
      { qty: 500, price: 6.88 }, { qty: 250, price: 12.50 },
      { qty: 100, price: 17.85 }, { qty: 50, price: 25.50 },
      { qty: 25, price: 36.50 }, { qty: 10, price: 91.20 }
    ]
  },
  {
    partNumber: "D0GZ0ZX",
    description: "IBM Hybrid Cloud DNS GSLB Standard Interaction per Month",
    listPrice: 14.40, // $14.40/mo per Interaction at qty<10 (graduated: $1.09 at high volume). Source: IBM Marketplace API.
    unit: "per 1M GSLB queries/month",
    category: "GSLB",
    notes: "GSLB upsell using NS1-provided RUM data. 1 Interaction = 1M queries. Min: 1B queries (1,000 Interactions). Same rate schedule as D0GNQZX. Source: IBM Marketplace API (confirmed).",
    minimums: { quantity: 1000, description: "Minimum 1B queries (1,000 Interactions × 1M)" },
    scaleQtyPrice: [
      { qty: 1000000000, price: 1.09 }, { qty: 25000, price: 1.36 },
      { qty: 10000, price: 1.81 }, { qty: 5000, price: 2.27 },
      { qty: 2500, price: 2.83 }, { qty: 1000, price: 3.77 },
      { qty: 500, price: 4.72 }, { qty: 250, price: 5.90 },
      { qty: 100, price: 7.38 }, { qty: 50, price: 9.22 },
      { qty: 25, price: 11.55 }, { qty: 10, price: 14.40 }
    ]
  },
  {
    partNumber: "D0GYYZX",
    description: "IBM Hybrid Cloud DNS GSLB Advanced Interaction per Month",
    listPrice: 22.90, // $22.90/mo per Interaction at qty<10 (graduated: $1.73 at high volume). Source: IBM Marketplace API.
    unit: "per 1M GSLB queries/month",
    category: "GSLB",
    notes: "GSLB upsell using customer-ingested private RUM data. 1 Interaction = 1M queries. Min: 5B queries (5,000 Interactions). Multiple of 5. Same rate schedule as D0GNNZX. Source: IBM Marketplace API (confirmed).",
    minimums: { quantity: 5000, description: "Minimum 5B queries (5,000 Interactions × 1M); must be multiple of 5" },
    scaleQtyPrice: [
      { qty: 1000000000, price: 1.73 }, { qty: 25000, price: 2.16 },
      { qty: 10000, price: 2.88 }, { qty: 5000, price: 3.60 },
      { qty: 2500, price: 4.49 }, { qty: 1000, price: 6.00 },
      { qty: 500, price: 7.49 }, { qty: 250, price: 9.37 },
      { qty: 100, price: 11.70 }, { qty: 50, price: 14.65 },
      { qty: 25, price: 18.35 }, { qty: 10, price: 22.90 }
    ]
  }
];

// All NS1 parts combined (for the parts reference view)
export const NS1_ALL_PARTS = [
  ...NS1_STANDARD_PARTS,
  ...NS1_PREMIUM_PARTS,
  ...NS1_HYBRID_PARTS,
];

// Legacy exports kept for backward compatibility with ns1-engine.ts
export const NS1_CORE_PARTS = NS1_PREMIUM_PARTS.filter(p => p.category === "Core");
export const NS1_GSLB_PARTS = NS1_HYBRID_PARTS.filter(p => p.category === "GSLB");

// Best Practices Guide for NS1 Quoting
export interface NS1BestPractice {
  category: string;
  question: string;
  why: string;
  tips: string[];
}

export const NS1_BEST_PRACTICES: NS1BestPractice[] = [
  {
    category: "Tier Selection (Standard vs Premium vs Hybrid)",
    question: "What is the customer's expected annual contract value and scale?",
    why: "NS1 has three distinct product tiers — Standard ($4K–$40K ARR), Premium ($45K+ ARR), and Hybrid Cloud DNS ($250K–$1M+ ARR) — each with different part numbers and CPQ flows.",
    tips: [
      "Standard (D10A*/D10B* parts): Up to 1B queries, 10K records, 100 monitors/filter chains. Self-serve.",
      "Premium (D0GN* parts): A la carte, customizable, seller-assisted. Target mid-market/new IBM customers.",
      "Hybrid Cloud DNS (D0GY*/D0GZ* parts): Pre-packaged Enterprise/Enterprise Plus bundles. Target whales and existing IBM customers. Min 10B queries.",
      "Pick Standard for deals under $40K. Pick Premium for $45K–$200K. Hybrid for $250K+.",
      "Parts are completely different between tiers — do not mix D10A* and D0GN* on the same quote."
    ]
  },
  {
    category: "Query Volume Discovery",
    question: "What is your current monthly DNS query volume — average AND peak?",
    why: "Query volume is the primary pricing driver (1 IBM Request = 10M queries). Accurate sizing prevents overages and sets the right tier.",
    tips: [
      "Always ask for average AND peak monthly query volumes",
      "Request historical data from current DNS provider (CloudFlare, Route53, Akamai, etc.)",
      "If unknown: estimate from web traffic (page views × ~5–10 DNS lookups per page)",
      "Add 20–30% growth headroom to avoid first-year overages",
      "Consider seasonal spikes (retail holidays, sports events, product launches)",
      "Hybrid Cloud DNS bundles have a 10B query/month minimum — verify the customer qualifies"
    ]
  },
  {
    category: "DNS Records",
    question: "How many DNS records do you manage across all zones?",
    why: "1 IBM Record = 1,000 DNS records. First records are included in base; extras are billed. Bundle selection (Enterprise vs Enterprise Plus) depends on whether records exceed 200K.",
    tips: [
      "Export from current DNS provider to get exact count — count ALL types (A, AAAA, CNAME, MX, TXT, SRV, etc.)",
      "Under 200K records → Enterprise bundle (D0GYUZX); 200K–2M → Enterprise Plus (D0GYWZX); 2M+ → use Premium a la carte",
      "Include production AND staging/dev records if they'll be in NS1",
      "Zones ≠ records — don't count zones, count individual resource records"
    ]
  },
  {
    category: "GSLB / Traffic Steering",
    question: "Do you need intelligent traffic routing — geo, latency-based, failover, or multi-CDN?",
    why: "GSLB requires additional SKUs. RUM-based routing (Pulsar) is a separate upsell with its own part numbers and minimums.",
    tips: [
      "Standard filter chains (non-RUM): D0GNKZX (Premium) or D10AUZX (Standard) — 1 Resource Unit = 1 filter chain",
      "RUM Standard (NS1 data): D0GNQZX/D0GZ0ZX — 1 Interaction = 1M RUM queries, min 1M",
      "RUM Advanced (customer data): D0GNNZX/D0GYYZX — min 5M queries, must be multiple of 5",
      "Ask: will they use NS1's pre-configured RUM data, or bring their own data feeds?",
      "RUM queries must be a subset of total Managed DNS query count"
    ]
  },
  {
    category: "Geographic / Compliance Requirements",
    question: "Do you serve users in mainland China, or have compliance needs for dedicated infrastructure?",
    why: "China DNS (D0GN8ZX) and Dedicated DNS (D0GNAZX/D0GNBZX) are separate add-ons with minimums and special CPQ flows.",
    tips: [
      "China DNS: min 50M queries/month (5 Requests). Must check China box in CPQ BEFORE Managed DNS section.",
      "Dedicated DNS Small (D0GNBZX): 8GB/4-core, up to 2.5M records, 10B QPM per instance. Min 3, max 12 PoPs.",
      "Dedicated DNS Large (D0GNAZX): 64GB/16-core, up to 50M records, 75B QPM per instance. Min 3, max 12 PoPs.",
      "Hybrid bundles include Dedicated DNS — don't add separate Dedicated SKUs for bundle customers"
    ]
  },
  {
    category: "Analytics & Observability",
    question: "Does the customer's security or ops team need DNS query visibility and analytics?",
    why: "DNS Insights (D0GN6ZX) is an add-on that must equal the Managed DNS query count. Included automatically in both Hybrid bundles.",
    tips: [
      "DNS Insights quantity must equal D0GNEZX (Managed DNS Requests) — CPQ auto-calculates this",
      "Included in both Hybrid Cloud DNS bundles (no separate entry needed for bundle customers)",
      "Custom policies beyond the included 3: use D0GN7ZX (DNS Insights Job) — no minimum",
      "Good upsell angle: security teams, capacity planning, SRE/observability use cases"
    ]
  },
  {
    category: "Contract Terms & Discounting",
    question: "What contract term fits the customer's budget cycle — and what's the procurement path?",
    why: "Contract terms range 12–60 months. Discounting policy has clear pre-authorization tiers.",
    tips: [
      "12–60 month contracts available. Annual invoicing preferred.",
      "Most contracts default to auto-renewal — flag this to the customer.",
      "Discount policy: up to 35% pre-authorized; +10% with sales leadership justification; beyond 45% requires product team approval.",
      "Standard tier: available self-serve on IBM.com and AWS Marketplace.",
      "Premium/Hybrid: seller-assisted. Always add services (architecture, implementation, training).",
      "Example minimum ACVs (pre-discount): Enterprise ~$350K, Enterprise Plus ~$670K, GSLB Standard ~$55K, GSLB Advanced ~$87K."
    ]
  }
];

// Guided Tutorial Steps
export interface NS1TutorialStep {
  step: number;
  title: string;
  description: string;
  action: string;
  example?: string;
  commonMistakes?: string[];
}

export const NS1_TUTORIAL_STEPS: NS1TutorialStep[] = [
  {
    step: 1,
    title: "Determine the Right Product Tier",
    description: "NS1 has three tiers with completely different CPQ part numbers. Getting this wrong means starting over.",
    action: "Ask: 'What is the expected annual value and query scale?' Then map to Standard (<$40K), Premium ($45K–$200K), or Hybrid Cloud DNS ($250K+).",
    example: "Customer has 500M queries/month and $80K budget → NS1 Connect Premium (D0GN* parts).",
    commonMistakes: [
      "Mixing D10A* (Standard) and D0GN* (Premium) parts on the same quote",
      "Quoting Hybrid Cloud DNS bundles for customers under 10B queries/month",
      "Using Standard self-serve pricing for enterprise deals that need seller assistance"
    ]
  },
  {
    step: 2,
    title: "Gather Query Volume Data",
    description: "Query volume is the #1 pricing driver (1 Request = 10M queries). Get accurate average AND peak numbers.",
    action: "Ask: 'Can you pull your monthly DNS query volume from your current provider's dashboard?' Request at least 3 months of data.",
    example: "Customer provides: '150M average, 200M peak during launches' → quote 200M with 20% headroom = 240M (24 Requests).",
    commonMistakes: [
      "Using only average without peak",
      "Not adding 20–30% growth headroom",
      "Confusing web page views with DNS queries",
      "Quoting Hybrid bundles before confirming customer exceeds 10B QPM minimum"
    ]
  },
  {
    step: 3,
    title: "Count DNS Records and Pick Bundle",
    description: "Record count determines Enterprise vs Enterprise Plus for Hybrid customers.",
    action: "Ask for a DNS record export. Count all record types across all zones.",
    example: "Customer has 180K records → Enterprise (D0GYUZX). Customer has 400K records → Enterprise Plus (D0GYWZX).",
    commonMistakes: [
      "Counting zones instead of individual records",
      "Forgetting staging/dev records",
      "Using 200K threshold wrong — it's total DNS records, not zones"
    ]
  },
  {
    step: 4,
    title: "Identify GSLB / Traffic Steering Needs",
    description: "Determine if basic filter chains are enough or if RUM-based GSLB is needed.",
    action: "Ask: 'Do you route traffic based on geography, latency, or real user performance data?'",
    example: "Customer wants latency-based CDN routing with NS1 data → GSLB Standard (D0GZ0ZX / D0GNQZX).",
    commonMistakes: [
      "Not asking whether they'll use NS1 RUM data vs. their own feeds",
      "Forgetting RUM queries must be a subset of total Managed DNS queries",
      "Missing the 5M minimum and must-be-multiple-of-5 rule for RUM Advanced"
    ]
  },
  {
    step: 5,
    title: "Check Add-ons: China, Dedicated DNS, Insights",
    description: "Each add-on has specific minimums and CPQ ordering rules.",
    action: "Work through the add-on checklist: China DNS? Dedicated PoPs? DNS Insights? Enhanced monitors? Vanity nameservers?",
    example: "Customer expanding to China next quarter → add D0GN8ZX, min 5 Requests (50M queries). Check China box in CPQ BEFORE Managed DNS.",
    commonMistakes: [
      "Checking China/Insights boxes after entering Managed DNS in CPQ (must be before)",
      "Not flagging China 50M minimum or Dedicated 3-PoP minimum",
      "Adding Dedicated DNS to a Hybrid bundle customer (already included)"
    ]
  },
  {
    step: 6,
    title: "Set Contract Term and Review Discounts",
    description: "12–60 month terms. Discount pre-authorization limits apply.",
    action: "Confirm term length, billing frequency, and whether discount exceeds 35% pre-auth threshold.",
    example: "3-year term with 30% discount → fully pre-authorized. 50% discount → requires product team approval.",
    commonMistakes: [
      "Forgetting to add services (architecture, implementation, training) — always recommended",
      "Not flagging auto-renewal default to the customer",
      "Discounting beyond 35% without escalation path ready"
    ]
  },
  {
    step: 7,
    title: "Enter Quote in CPQ and Document Assumptions",
    description: "CPQ converts your inputs into IBM metrics automatically. Document what you entered and why.",
    action: "For Premium: enter queries → CPQ converts to Requests. Enter records → CPQ converts to Records. For Hybrid: enter queries → CPQ converts to Requests for the bundle.",
    example: "240M queries → 24 Requests (D0GNEZX qty 24). 8,000 records → 8 Records (D0GNGZX qty 8). 5 monitors → D0GNIZX qty 5.",
    commonMistakes: [
      "Not documenting growth assumptions for future upsell conversations",
      "Forgetting the required SLA part (D0GNDZX for Premium, D0GZ2ZX for Hybrid)",
      "Not adding the services line items"
    ]
  }
];

// Quick Reference Guide
export interface NS1QuickRef {
  topic: string;
  keyPoints: string[];
}

export const NS1_QUICK_REFERENCE: NS1QuickRef[] = [
  {
    topic: "Metric Conversions",
    keyPoints: [
      "1 IBM Request = 10 million DNS queries/month",
      "1 IBM Record = 1,000 DNS records",
      "1 IBM Interaction = 1 million RUM/GSLB queries/month",
      "1 IBM Job = 1 monitor",
      "1 IBM Resource Unit = 1 filter chain"
    ]
  },
  {
    topic: "Tier Quick-Pick",
    keyPoints: [
      "Standard (D10A*/D10B*): <$40K ARR, up to 1B QPM, self-serve",
      "Premium (D0GN*): $45K–$200K ARR, a la carte, seller-assisted",
      "Hybrid Cloud DNS (D0GY*/D0GZ*): $250K–$1M+ ARR, bundles, Enterprise/Enterprise Plus",
      "Enterprise bundle (D0GYUZX): <200K records, min 10B QPM, ~$350K ACV",
      "Enterprise Plus bundle (D0GYWZX): 200K–2M records, min 10B QPM, ~$670K ACV"
    ]
  },
  {
    topic: "Minimums to Remember",
    keyPoints: [
      "Hybrid Cloud DNS bundles: 10B queries/month minimum",
      "China DNS: 50M queries minimum (5 Requests)",
      "Dedicated DNS: minimum 3 PoPs, maximum 12 PoPs",
      "GSLB Standard: 1B query minimum (1,000 Interactions)",
      "GSLB Advanced: 5B query minimum (5,000 Interactions), multiple of 5",
      "RUM Advanced: min 5M queries/month, must be multiple of 5"
    ]
  },
  {
    topic: "Discounting & CPQ Tips",
    keyPoints: [
      "Up to 35% discount pre-authorized",
      "+10% with sales leadership justification",
      "Beyond 45%: product team approval required",
      "Always add services (architecture, implementation, training)",
      "China/Insights: check the box BEFORE entering Managed DNS section in CPQ",
      "DNS Insights quantity must equal Managed DNS Requests (CPQ auto-calculates)",
      "DDoS/NXD Waiver quantity must also equal Managed DNS Requests"
    ]
  }
];
