// NS1 Part Numbers and Pricing Data
// Source: IBM NS1 Connect Sales Kit (sourced via Seismic, 2025)
// List prices: PENDING — confirm in IBM Software CPQ (not hardware CPQ Hub)
// Part number structure: base subscription + committed add-ons + overage SKUs
//
// TODO: Get list prices from IBM Software CPQ — ask Dennis Weru or Tony Nicolakis
//       for the correct CPQ URL (NOT the IBM CPQ Hub hardware tool).
//       Once prices are confirmed, remove all listPrice: 0 entries below.
//
// GSLB bundles D0GZ0ZX / D0GYYZX and Hybrid bundles D0GYUZX / D0GYWZX —
// pricing not found in Seismic docs. Confirm with Tony Nicolakis / Nick Lammert.

export interface NS1Part {
  partNumber: string;
  description: string;
  listPrice: number;       // 0 = price pending; confirm in IBM Software CPQ
  unit: string;
  category: "Core" | "Add-on" | "Premium";
  notes?: string;
  minimums?: {
    quantity?: number;
    description?: string;
  };
}

// ── Core: Base access + query volume ─────────────────────────────────────────
// NS1 uses a base subscription + committed add-on + overage model.
// Every deal starts with D10AYZX (base access), then D10AZZX per 10M committed
// queries, and D10B0ZX fires for any queries above the committed band.
export const NS1_CORE_PARTS: NS1Part[] = [
  {
    partNumber: "D10AYZX",
    description: "IBM NS1 Connect Standard Access Per Month",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    unit: "per month (base fee)",
    category: "Core",
    notes: "Required base subscription for every NS1 deal. Add query volume via D10AZZX."
  },
  {
    partNumber: "D10AZZX",
    description: "IBM NS1 Connect Standard 10M Query Add-On Per Month",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    unit: "per 10M queries/month (committed)",
    category: "Core",
    notes: "Committed query volume in 10M increments. Quantity = CEIL(effectiveMQ / 10)."
  },
  {
    partNumber: "D10B0ZX",
    description: "IBM NS1 Connect Standard 10M Query Add-On Overage",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    unit: "per 10M queries/month (overage)",
    category: "Core",
    notes: "Overage SKU — fires when actual queries exceed committed D10AZZX band. Include for reference."
  },
  {
    partNumber: "D1250ZX",
    description: "IBM NS1 Connect Standard Access 10M Queries Pay Per Use",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    unit: "per 10M queries (pay-per-use)",
    category: "Core",
    notes: "Pay-per-use alternative to committed D10AZZX. Use for short-term or variable workloads."
  },
  {
    partNumber: "D10AWZX",
    description: "IBM NS1 Connect Standard Records Add-On 1000 Records Per Month",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    unit: "per 1,000 records/month (committed)",
    category: "Core",
    notes: "First 3,000 records free. Quantity = CEIL(billableRecords / 1000)."
  },
  {
    partNumber: "D10AXZX",
    description: "IBM NS1 Connect Standard Records Add-On 1000 Records Overage",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    unit: "per 1,000 records/month (overage)",
    category: "Core",
    notes: "Overage SKU for records. Include for reference alongside D10AWZX."
  }
];

// ── GSLB: Filter chains, monitors, RUM ───────────────────────────────────────
export const NS1_GSLB_PARTS: NS1Part[] = [
  {
    partNumber: "D10AUZX",
    description: "IBM NS1 Connect Standard Filter Chains Add-On Resource Unit Per Month",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    unit: "per filter chain/month (committed)",
    category: "Add-on",
    notes: "One filter chain = one traffic steering policy. Requires base D10AYZX."
  },
  {
    partNumber: "D10AVZX",
    description: "IBM NS1 Connect Standard Filter Chains Add-On Resource Unit Overage",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    unit: "per filter chain/month (overage)",
    category: "Add-on",
    notes: "Overage SKU for filter chains. Include for reference alongside D10AUZX."
  },
  {
    partNumber: "D0GZ0ZX",
    description: "NS1 GSLB Standard (using NS1 Real User Monitoring data)",
    listPrice: 0, // PENDING — confirm pricing with Tony Nicolakis / Nick Lammert
    unit: "per month",
    category: "Add-on",
    notes: "GSLB with NS1-provided RUM data. Pricing not found in Seismic docs — confirm with Tony/Nick."
  },
  {
    partNumber: "D0GYYZX",
    description: "NS1 GSLB Advanced (customer-configured private RUM tests)",
    listPrice: 0, // PENDING — confirm pricing with Tony Nicolakis / Nick Lammert
    unit: "per month",
    category: "Add-on",
    notes: "GSLB with customer's own private RUM data. Pricing not found in Seismic docs — confirm with Tony/Nick."
  },
  {
    partNumber: "D10B2ZX",
    description: "IBM NS1 Connect Standard Monitors Add-On Job Per Month",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    unit: "per monitor/month (committed)",
    category: "Add-on",
    notes: "One monitor = one health-checked hostname or IP."
  },
  {
    partNumber: "D10B3ZX",
    description: "IBM NS1 Connect Standard Monitors Add-On Job Overage",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    unit: "per monitor/month (overage)",
    category: "Add-on",
    notes: "Overage SKU for monitors. Include for reference alongside D10B2ZX."
  }
];

// ── Premium: Dedicated DNS, China, Spike Protection ──────────────────────────
export const NS1_PREMIUM_PARTS: NS1Part[] = [
  {
    partNumber: "D0GYUZX",
    description: "NS1 Hybrid Cloud DNS Enterprise Bundle (under 200k DNS records)",
    listPrice: 0, // PENDING — confirm pricing with Tony Nicolakis / Nick Lammert
    unit: "per month",
    category: "Premium",
    notes: "Dedicated/Hybrid DNS bundle for <200k records. Confirm scope and PoP count with Tony/Nick.",
    minimums: {
      quantity: 3,
      description: "Minimum 3 PoPs required. Maximum 12 PoPs."
    }
  },
  {
    partNumber: "D0GYWZX",
    description: "NS1 Hybrid Cloud DNS Enterprise Plus Bundle (200k–2M DNS records)",
    listPrice: 0, // PENDING — confirm pricing with Tony Nicolakis / Nick Lammert
    unit: "per month",
    category: "Premium",
    notes: "Dedicated/Hybrid DNS bundle for 200k–2M records. Confirm scope and PoP count with Tony/Nick.",
    minimums: {
      quantity: 3,
      description: "Minimum 3 PoPs required. Maximum 12 PoPs."
    }
  },
  {
    partNumber: "D10ATZX",
    description: "IBM NS1 Connect Standard Spike Protection Add-On Per Month",
    listPrice: 0, // PENDING — confirm in IBM Software CPQ
    unit: "per month",
    category: "Premium",
    notes: "DDoS and traffic spike protection. Pricing varies by threat profile — confirm with NS1 team."
  }
];

// All NS1 parts combined
export const NS1_ALL_PARTS = [
  ...NS1_CORE_PARTS,
  ...NS1_GSLB_PARTS,
  ...NS1_PREMIUM_PARTS
];

// Best Practices Guide for NS1 Quoting
export interface NS1BestPractice {
  category: string;
  question: string;
  why: string;
  tips: string[];
}

export const NS1_BEST_PRACTICES: NS1BestPractice[] = [
  {
    category: "Query Volume Discovery",
    question: "What is your current monthly DNS query volume?",
    why: "Query volume is the primary pricing driver for NS1. Accurate sizing prevents overages.",
    tips: [
      "Ask for average AND peak monthly query volumes",
      "Request historical data from their current DNS provider (CloudFlare, Route53, etc.)",
      "If they don't know: estimate based on web traffic (page views × DNS lookups per page)",
      "Add 20-30% growth headroom to avoid overages in first year",
      "Consider seasonal spikes (e.g., retail during holidays)"
    ]
  },
  {
    category: "DNS Records",
    question: "How many DNS records (zones, A records, CNAMEs, etc.) do you manage?",
    why: "First 3,000 records are free. Additional records incur charges.",
    tips: [
      "Export from current DNS provider to get exact count",
      "Count ALL record types: A, AAAA, CNAME, MX, TXT, SRV, etc.",
      "Include both production and staging/dev records if they'll be in NS1",
      "Ask about planned growth (new services, acquisitions, etc.)"
    ]
  },
  {
    category: "GSLB / Traffic Steering",
    question: "Do you need intelligent traffic routing or load balancing?",
    why: "GSLB features require additional components (filter chains, monitors, RUM packs).",
    tips: [
      "Ask about multi-region deployments or CDN usage",
      "Identify if they need: geographic routing, latency-based routing, weighted routing, failover",
      "Each routing policy = 1 filter chain",
      "RUM-based routing requires RUM packs (5M query increments)",
      "Health monitoring requires up/down monitors (per endpoint)"
    ]
  },
  {
    category: "Geographic Requirements",
    question: "Do you serve users in China or need dedicated infrastructure?",
    why: "China and Dedicated DNS have special requirements and pricing.",
    tips: [
      "China DNS: minimum 50M queries/month, special licensing",
      "Dedicated DNS: minimum 3 PoPs, maximum 12 PoPs",
      "Dedicated DNS is for: compliance requirements, very high volume, or SLA needs",
      "Ask about other geographic compliance needs (GDPR, data residency)"
    ]
  },
  {
    category: "Analytics & Visibility",
    question: "Do you need query analytics and DNS insights?",
    why: "DNS Insights adds ~20% of query volume to pricing but provides valuable visibility.",
    tips: [
      "Useful for: security teams, performance optimization, capacity planning",
      "List price is ~20% of query volume, often negotiable to ~10%",
      "Ask what metrics they currently track from DNS",
      "Consider if they have other analytics tools that overlap"
    ]
  },
  {
    category: "DDoS Protection",
    question: "Have you experienced DNS-based attacks or traffic spikes?",
    why: "DDoS protection is a separate add-on with variable pricing.",
    tips: [
      "Ask about historical attack patterns",
      "Identify if they have other DDoS protection (CloudFlare, Akamai)",
      "NS1 DDoS protection pricing varies by threat profile",
      "May require NS1 security team consultation for sizing"
    ]
  },
  {
    category: "Contract Terms",
    question: "What contract term works best for your budget cycle?",
    why: "12-month vs 3-year terms affect pricing and flexibility.",
    tips: [
      "3-year terms typically offer better pricing",
      "12-month terms offer more flexibility for growth/changes",
      "Consider alignment with other IBM contract renewals",
      "Ask about budget approval cycles and fiscal year"
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
    title: "Understand the Customer's DNS Infrastructure",
    description: "Before quoting, you need to understand their current DNS setup and requirements.",
    action: "Ask: 'Who is your current DNS provider?' and 'What DNS services are you using today?'",
    example: "Customer might say: 'We use AWS Route53 for our production DNS and CloudFlare for our website.'",
    commonMistakes: [
      "Assuming they only have one DNS provider",
      "Not asking about both authoritative DNS and recursive DNS",
      "Forgetting to ask about DNS for different environments (prod, staging, dev)"
    ]
  },
  {
    step: 2,
    title: "Gather Query Volume Data",
    description: "Query volume is the #1 pricing driver. Get accurate numbers.",
    action: "Request: 'Can you provide your monthly DNS query volume from your current provider's dashboard?'",
    example: "Customer provides: '150 million queries per month average, with peaks up to 200 million during product launches.'",
    commonMistakes: [
      "Using only average without considering peaks",
      "Not adding growth headroom (recommend 20-30%)",
      "Confusing web traffic with DNS queries",
      "Not accounting for API traffic or mobile apps"
    ]
  },
  {
    step: 3,
    title: "Count DNS Records",
    description: "First 3,000 records are free. Additional records cost extra.",
    action: "Ask: 'How many DNS records do you currently manage?' Request an export if possible.",
    example: "Customer says: 'We have about 5,000 DNS records across all our zones.'",
    commonMistakes: [
      "Only counting zones instead of individual records",
      "Forgetting to include all record types (A, AAAA, CNAME, MX, TXT, etc.)",
      "Not accounting for wildcard records"
    ]
  },
  {
    step: 4,
    title: "Identify GSLB Requirements",
    description: "Determine if they need intelligent traffic routing beyond basic DNS.",
    action: "Ask: 'Do you need to route traffic based on geography, latency, or health checks?'",
    example: "Customer: 'Yes, we have servers in US, EU, and APAC. We want users routed to the nearest region.'",
    commonMistakes: [
      "Not explaining what GSLB actually does",
      "Forgetting to count filter chains (one per routing policy)",
      "Not asking about health monitoring needs",
      "Missing RUM pack requirements for RUM-based routing"
    ]
  },
  {
    step: 5,
    title: "Check for Special Requirements",
    description: "Identify needs for China, Dedicated DNS, Analytics, or DDoS protection.",
    action: "Ask: 'Do you serve users in China? Do you have compliance requirements for dedicated infrastructure?'",
    example: "Customer: 'We're expanding to China next quarter and need DNS that works there.'",
    commonMistakes: [
      "Not mentioning China DNS minimum (50M queries)",
      "Not explaining Dedicated DNS minimums (3 PoPs)",
      "Forgetting to ask about analytics needs",
      "Not discussing DDoS protection history"
    ]
  },
  {
    step: 6,
    title: "Calculate and Present the Quote",
    description: "Use the gathered information to size the NS1 deployment.",
    action: "Input all gathered data into the quoting tool to generate part numbers and quantities.",
    example: "Based on 200M queries (with headroom), 5,000 records, 3 filter chains, and China DNS (50M queries).",
    commonMistakes: [
      "Not explaining the tiered pricing model",
      "Forgetting to mention that prices are list (discounts happen in CPQ)",
      "Not providing a ballpark total",
      "Not documenting assumptions for the customer"
    ]
  },
  {
    step: 7,
    title: "Document and Transfer to CPQ",
    description: "Create a clear summary for CPQ entry and customer records.",
    action: "Document all part numbers, quantities, and the rationale behind each line item.",
    example: "D10AYZX: 1 (base), D10AZZX: 20 × 10M blocks (200M MQ with headroom), D10AWZX: 2 × 1,000-record blocks (5,000 total - 3,000 free)",
    commonMistakes: [
      "Not documenting the customer's actual requirements vs. what was quoted",
      "Not noting growth assumptions",
      "Forgetting to flag items that need NS1 team validation",
      "Not saving the discovery conversation for future reference"
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
    topic: "Pricing Model",
    keyPoints: [
      "Base subscription (D10AYZX) + committed add-ons + overage SKUs",
      "Query volume: D10AZZX per 10M committed blocks + D10B0ZX overage",
      "First 3,000 DNS records free; D10AWZX per 1,000 additional records",
      "GSLB: D10AUZX filter chains, D0GZ0ZX/D0GYYZX RUM, D10B2ZX monitors",
      "List prices PENDING — confirm in IBM Software CPQ"
    ]
  },
  {
    topic: "Common Sizing Scenarios",
    keyPoints: [
      "Small business: 5-25M queries/month, <3,000 records, no GSLB",
      "Mid-market: 50-200M queries/month, 3,000-10,000 records, basic GSLB",
      "Enterprise: 500M+ queries/month, 10,000+ records, full GSLB + premium features",
      "Global enterprise: 1B+ queries/month, Dedicated DNS, China, full analytics"
    ]
  },
  {
    topic: "Key Contacts",
    keyPoints: [
      "Part numbers: Pull from CPQ or contact Tony Nicolakis / Nick Lammert",
      "Technical sizing: NS1 Solutions Engineering team",
      "China DNS: Requires special approval and licensing",
      "DDoS protection: NS1 Security team consultation"
    ]
  },
  {
    topic: "Red Flags",
    keyPoints: [
      "Customer doesn't know query volume → Help them estimate or get data from current provider",
      "Mixing up web traffic with DNS queries → Educate on the difference",
      "Underestimating growth → Always add 20-30% headroom",
      "Not considering seasonal spikes → Ask about peak periods",
      "Assuming all DNS is the same → Explain NS1's GSLB and premium features"
    ]
  }
];

// Made with Bob
