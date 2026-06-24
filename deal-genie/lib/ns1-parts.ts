// NS1 Part Numbers and Pricing Data
// Source: CPQ + Tony Nicolakis / Nick Lammert validation

export interface NS1Part {
  partNumber: string;
  description: string;
  listPrice: number;
  unit: string;
  category: "Core" | "Add-on" | "Premium";
  notes?: string;
  minimums?: {
    quantity?: number;
    description?: string;
  };
}

// Core NS1 Managed DNS Parts
export const NS1_CORE_PARTS: NS1Part[] = [
  {
    partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
    description: "NS1 Managed DNS - Query Volume",
    listPrice: 0, // Tiered pricing - see NS1_PRICING_TIERS
    unit: "per million queries/month",
    category: "Core",
    notes: "Tiered pricing based on query volume. First 3,000 DNS records included free."
  },
  {
    partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
    description: "NS1 DNS Records (beyond 3,000)",
    listPrice: 0, // Variable pricing
    unit: "per record/month",
    category: "Core",
    notes: "First 3,000 records are included free with Managed DNS"
  }
];

// NS1 GSLB (Global Server Load Balancing) Parts
export const NS1_GSLB_PARTS: NS1Part[] = [
  {
    partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
    description: "NS1 GSLB - Filter Chains",
    listPrice: 0,
    unit: "per filter chain/month",
    category: "Add-on",
    notes: "Requires Managed DNS. Used for traffic steering and intelligent routing."
  },
  {
    partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
    description: "NS1 GSLB - RUM (Real User Monitoring) Packs",
    listPrice: 0,
    unit: "per 5M query pack/month",
    category: "Add-on",
    notes: "Required when using RUM-based filter chains. Sold in 5M query increments."
  },
  {
    partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
    description: "NS1 GSLB - Up/Down Monitors",
    listPrice: 0,
    unit: "per monitor/month",
    category: "Add-on",
    notes: "Health check monitors for endpoints"
  }
];

// NS1 Premium Add-ons
export const NS1_PREMIUM_PARTS: NS1Part[] = [
  {
    partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
    description: "NS1 Dedicated DNS",
    listPrice: 0,
    unit: "per PoP/month",
    category: "Premium",
    notes: "Dedicated infrastructure for high-volume or compliance needs",
    minimums: {
      quantity: 3,
      description: "Minimum 3 PoPs required. Maximum 12 PoPs available."
    }
  },
  {
    partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
    description: "NS1 DNS for China",
    listPrice: 0,
    unit: "per million queries/month",
    category: "Premium",
    notes: "Specialized routing for China-origin queries",
    minimums: {
      quantity: 50,
      description: "Minimum 50M queries/month required"
    }
  },
  {
    partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
    description: "NS1 DNS Insights",
    listPrice: 0,
    unit: "per million queries/month",
    category: "Premium",
    notes: "Analytics and visibility. Typically ~20% of total query volume (list), negotiable to ~10%"
  },
  {
    partNumber: "D0XXXZX", // PLACEHOLDER - Get from CPQ
    description: "NS1 DDoS / Spike Protection",
    listPrice: 0,
    unit: "per instance/month",
    category: "Premium",
    notes: "Protection against traffic spikes and DDoS attacks. Pricing varies by requirements."
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
    example: "Part D0XXXZX: 200M queries/month (150M actual + 33% growth headroom), Part D0XXXZX: 2,000 records (5,000 total - 3,000 free)",
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
      "Tiered pricing based on query volume (millions/month)",
      "First 3,000 DNS records included free",
      "GSLB components priced separately (filter chains, monitors, RUM packs)",
      "Premium add-ons have minimums (China: 50M queries, Dedicated: 3 PoPs)"
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
