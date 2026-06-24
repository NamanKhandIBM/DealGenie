// Structured question definitions — plain English, seller-friendly.
// Sellers never see "RU", "MAU", or any IBM-internal metric names.

export type QuestionType = "single" | "multi" | "number" | "free";

export interface QuestionOption {
  label: string;       // Display text
  value: string;       // Internal value passed to engine
  hint?: string;       // Optional sub-label (e.g. price note)
}

export interface Question {
  key: string;
  ask: string;
  subtext?: string;
  type: QuestionType;
  options?: QuestionOption[];
  allowOther?: boolean;    // Adds "Other / enter exact" escape hatch
  placeholder?: string;    // For number/free inputs
  unit?: string;           // e.g. "users", "certs/month"
  conditional?: (answers: Record<string, unknown>) => boolean;
}

// ─── IBM SECURITY VERIFY ─────────────────────────────────────────────────────

export const VERIFY_QUESTIONS: Question[] = [
  {
    key: "verifyAction",
    ask: "What would you like to do?",
    subtext: "Choose an option to get started with Verify quoting",
    type: "single",
    options: [
      { label: "📚 View Best Practices", value: "guide", hint: "Learn what to ask clients" },
      { label: "📋 View Part Numbers", value: "parts", hint: "See all Verify SKUs" },
      { label: "💰 Start Quoting", value: "quote", hint: "Begin the quoting process" },
    ],
  },
  {
    key: "capabilities",
    conditional: (a) => String(a.verifyAction ?? "quote") === "quote",
    ask: "Which security features does the client need?",
    subtext: "Select all that apply.",
    type: "multi",
    options: [
      { label: "Single Sign-On (SSO)",             value: "SSO",       hint: "One login for all apps" },
      { label: "Multi-Factor Authentication (MFA)", value: "MFA",       hint: "Extra login verification" },
      { label: "Adaptive Access",                  value: "Adaptive",   hint: "Risk-based access control" },
      { label: "Lifecycle Management",             value: "Lifecycle",  hint: "Provision / deprovision users" },
      { label: "Analytics",                        value: "Analytics",  hint: "Identity & access reporting" },
    ],
  },
  {
    key: "population",
    conditional: (a) => String(a.verifyAction ?? "quote") === "quote",
    ask: "How many users will this cover?",
    subtext: "Total user population — employees, contractors, customers, etc.",
    type: "single",
    allowOther: true,
    options: [
      { label: "Up to 500",         value: "500" },
      { label: "500 – 5,000",       value: "2500" },
      { label: "5,000 – 10,000",    value: "7500" },
      { label: "10,000 – 100,000",  value: "50000" },
      { label: "100,000 – 500,000", value: "250000" },
      { label: "500,000+",          value: "500000" },
    ],
    placeholder: "Enter exact number",
    unit: "users",
  },
  {
    key: "avgLogins",
    conditional: (a) => String(a.verifyAction ?? "quote") === "quote",
    ask: "How often does a typical user log in?",
    subtext: "This determines how many 'monthly active users' to size for.",
    type: "single",
    allowOther: true,
    options: [
      { label: "Multiple times a day",  value: "365", hint: "≥ 12×/year — full population counts" },
      { label: "About once a week",     value: "52",  hint: "≥ 12×/year — full population counts" },
      { label: "About once a month",    value: "12",  hint: "Full population counts" },
      { label: "A few times a year",    value: "6",   hint: "Roughly half the population is active monthly" },
      { label: "Once or twice a year",  value: "1.5", hint: "Small fraction active each month" },
    ],
    placeholder: "Enter avg logins per year",
    unit: "logins/year",
  },
  {
    key: "managedUsers",
    ask: "How many users will be actively managed (provisioned / deprovisioned)?",
    subtext: "For Lifecycle Management and Analytics sizing.",
    type: "single",
    allowOther: true,
    conditional: (a) => {
      if (String(a.verifyAction ?? "quote") !== "quote") return false;
      const caps = a.capabilities as string[] | undefined;
      return !!caps && (caps.includes("Lifecycle") || caps.includes("Analytics"));
    },
    options: [
      { label: "Up to 500",         value: "500" },
      { label: "500 – 5,000",       value: "2500" },
      { label: "5,000 – 10,000",    value: "7500" },
      { label: "10,000 – 100,000",  value: "50000" },
      { label: "100,000+",          value: "100000" },
    ],
    placeholder: "Enter exact number",
    unit: "managed users",
  },
  {
    key: "regions",
    conditional: (a) => String(a.verifyAction ?? "quote") === "quote",
    ask: "How many geographic regions will this be deployed in?",
    type: "single",
    allowOther: true,
    options: [
      { label: "1 region",   value: "1" },
      { label: "2 regions",  value: "2" },
      { label: "3 regions",  value: "3" },
      { label: "4 regions",  value: "4" },
      { label: "5+ regions", value: "5" },
    ],
    placeholder: "Enter number of regions",
  },
  {
    key: "addOns",
    ask: "Any add-ons needed?",
    subtext: "Select all that apply, or skip.",
    type: "multi",
    options: [
      { label: "SMS / Email MFA",           value: "D02T6ZX", hint: "$33.70 per 1,000 events" },
      { label: "Hosted Application Gateway", value: "D01UQZX", hint: "$22,500/instance/month" },
      { label: "Vanity Domain",             value: "D01URZX", hint: "$562/instance/month" },
      { label: "Non-Production (with SLA)", value: "D22PGLL", hint: "$2,810/instance/month" },
      { label: "Non-Production (no SLA)",   value: "D21CWLL", hint: "$1,410/instance/month" },
      { label: "None",                      value: "none" },
    ],
  },
  {
    key: "term",
    ask: "What's the contract term?",
    type: "single",
    options: [
      { label: "12 months",  value: "12-month", hint: "Standard" },
      { label: "3 years",    value: "3-year",   hint: "Higher total value" },
    ],
  },
];

// ─── NS1 CONNECT ─────────────────────────────────────────────────────────────

export const NS1_QUESTIONS: Question[] = [
  {
    key: "ns1Action",
    ask: "What would you like to do?",
    subtext: "View the guide first, or jump straight into quoting?",
    type: "single",
    options: [
      { label: "📚 View Best Practices & Tutorial", value: "guide", hint: "Learn how to gather requirements" },
      { label: "📋 View Part Numbers Reference", value: "parts", hint: "See all NS1 part numbers" },
      { label: "💰 Start Quoting", value: "quote", hint: "Begin the discovery questions" },
    ],
  },
  {
    key: "currentDNS",
    ask: "Who is the client's current DNS provider?",
    type: "single",
    allowOther: true,
    conditional: (a) => String(a.ns1Action ?? "quote") === "quote",
    options: [
      { label: "Self-hosted (BIND, etc.)",       value: "Self-hosted" },
      { label: "Domain registrar",               value: "Registrar" },
      { label: "AWS Route 53",                   value: "AWS Route53" },
      { label: "Azure DNS / Google Cloud DNS",   value: "Azure/GCP DNS" },
      { label: "Cloudflare / Akamai",            value: "Cloudflare/Akamai" },
      { label: "Not sure",                       value: "Unknown" },
    ],
    placeholder: "Describe their current DNS setup",
  },
  {
    key: "queryMQ",
    ask: "How many DNS queries does the client handle per month?",
    subtext: "Millions of queries (MQ). Estimate is fine — we'll add headroom.",
    type: "single",
    allowOther: true,
    options: [
      { label: "< 50 million",          value: "25" },
      { label: "50 – 200 million",      value: "100" },
      { label: "200 – 500 million",     value: "300" },
      { label: "500M – 1 billion",      value: "700" },
      { label: "1 – 5 billion",         value: "2000" },
      { label: "5B+",                   value: "7500" },
    ],
    placeholder: "Enter exact MQ (millions)",
    unit: "million queries/month",
  },
  {
    key: "recordCount",
    ask: "Roughly how many DNS records do they manage?",
    subtext: "First 3,000 are included free.",
    type: "single",
    allowOther: true,
    options: [
      { label: "Under 3,000 (all free)", value: "2000" },
      { label: "3,000 – 10,000",        value: "6000" },
      { label: "10,000 – 50,000",       value: "25000" },
      { label: "50,000+",               value: "50000" },
    ],
    placeholder: "Enter record count",
    unit: "records",
  },
  {
    key: "gslb",
    ask: "Do they need traffic steering or GSLB (Global Server Load Balancing)?",
    subtext: "Used for geo-routing, failover, or multi-CDN/cloud performance routing.",
    type: "single",
    allowOther: true,
    options: [
      { label: "No",                              value: "no" },
      { label: "Yes — basic failover / geo",      value: "yes-basic" },
      { label: "Yes — RUM-based performance routing", value: "yes-rum" },
    ],
    placeholder: "Describe their steering needs",
  },
  {
    key: "filterChainCount",
    ask: "How many DNS records need traffic steering?",
    subtext: "Each steered record = 1 filter chain.",
    type: "single",
    allowOther: true,
    conditional: (a) => String(a.gslb ?? "no") !== "no",
    options: [
      { label: "1 – 10",    value: "5" },
      { label: "10 – 50",   value: "25" },
      { label: "50 – 200",  value: "100" },
      { label: "200+",      value: "200" },
    ],
    placeholder: "Enter number of steered records",
    unit: "filter chains",
  },
  {
    key: "monitors",
    ask: "Do they need up/down health monitoring?",
    subtext: "One monitor per hostname or IP address.",
    type: "single",
    allowOther: true,
    options: [
      { label: "No",              value: "0" },
      { label: "Yes — < 50",      value: "25" },
      { label: "Yes — 50–200",    value: "100" },
      { label: "Yes — 200+",      value: "200" },
    ],
    placeholder: "Enter number of hostnames/IPs to monitor",
    unit: "monitors",
  },
  {
    key: "dedicated",
    ask: "Do they need Dedicated DNS (single-tenant)?",
    subtext: "Provides an isolated, single-tenant DNS layer. Minimum 3 PoPs.",
    type: "single",
    options: [
      { label: "No",         value: "no" },
      { label: "Yes — 3 PoPs",  value: "3" },
      { label: "Yes — 6 PoPs",  value: "6" },
      { label: "Yes — 12 PoPs", value: "12" },
    ],
  },
  {
    key: "china",
    ask: "Do they need DNS coverage in mainland China?",
    subtext: "DNS for China is a separate add-on with a minimum of 50M China-origin queries.",
    type: "single",
    options: [
      { label: "No",   value: "no" },
      { label: "Yes",  value: "yes" },
    ],
  },
  {
    key: "insights",
    ask: "Do they need DNS Insights (observability & analytics)?",
    type: "single",
    options: [
      { label: "No",   value: "no" },
      { label: "Yes",  value: "yes", hint: "~20% of query volume (list); negotiable to 10%" },
    ],
  },
  {
    key: "growth",
    ask: "How much query growth do you want to size headroom for?",
    subtext: "Adding headroom prevents overage charges.",
    type: "single",
    options: [
      { label: "None",   value: "0" },
      { label: "10%",    value: "10" },
      { label: "20%",    value: "20" },
      { label: "50%",    value: "50" },
    ],
  },
  {
    key: "term",
    ask: "What's the contract term?",
    type: "single",
    options: [
      { label: "12 months", value: "12-month" },
      { label: "3 years",   value: "3-year", hint: "Higher total value" },
    ],
  },
];

// ─── IBM HASHICORP VAULT ──────────────────────────────────────────────────────

export const VAULT_QUESTIONS_COMMON: Question[] = [
  {
    key: "vaultAction",
    ask: "What would you like to do?",
    subtext: "Choose an option to get started with Vault quoting",
    type: "single",
    options: [
      { label: "📚 View Best Practices", value: "guide", hint: "Learn what to ask clients" },
      { label: "📋 View Part Numbers", value: "parts", hint: "See all Vault SKUs" },
      { label: "💰 Start Quoting", value: "quote", hint: "Begin the quoting process" },
    ],
  },
  {
    key: "vaultModel",
    conditional: (a) => String(a.vaultAction ?? "quote") === "quote",
    ask: "Is this a new Vault deployment or an existing renewal?",
    subtext: "This determines the pricing model. The two models cannot be mixed.",
    type: "single",
    options: [
      { label: "New or expanding deployment",  value: "A", hint: "Platform / usage-based model" },
      { label: "Existing renewal / stable env", value: "B", hint: "Clients / per-seat model" },
    ],
  },
  {
    key: "installCount",
    conditional: (a) => String(a.vaultAction ?? "quote") === "quote",
    ask: "How many Vault servers or clusters will they run?",
    subtext: "Each production cluster = 1 Install.",
    type: "single",
    allowOther: true,
    options: [
      { label: "1",     value: "1" },
      { label: "2",     value: "2" },
      { label: "3 – 5", value: "3" },
      { label: "6 – 10",value: "6" },
      { label: "10+",   value: "10" },
    ],
    placeholder: "Enter exact number",
    unit: "clusters",
  },
];

export const VAULT_QUESTIONS_MODEL_A: Question[] = [
  {
    key: "useCases",
    ask: "What will they use Vault for?",
    subtext: "Select all that apply — I'll calculate the resource usage from your answers.",
    type: "multi",
    options: [
      { label: "Store passwords, API keys & secrets",  value: "static",   hint: "Static secret management" },
      { label: "Auto-rotate database credentials",     value: "dynamic",  hint: "Dynamic secrets" },
      { label: "Manage SSL/TLS certificates (PKI)",    value: "pki",      hint: "Certificate lifecycle" },
      { label: "Manage SSH access & credentials",      value: "ssh",      hint: "SSH secrets engine" },
      { label: "Encrypt / tokenize data",              value: "transit",  hint: "Transit / Transform engine" },
      { label: "Manage encryption keys (KMIP)",        value: "kmse",     hint: "Key management service" },
    ],
  },
  {
    key: "staticSecretCount",
    ask: "How many secrets (passwords, API keys, config values) will they store in Vault?",
    type: "single",
    allowOther: true,
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("static");
    },
    options: [
      { label: "< 500",          value: "250" },
      { label: "500 – 2,000",    value: "1000" },
      { label: "2,000 – 10,000", value: "5000" },
      { label: "10,000+",        value: "10000" },
    ],
    placeholder: "Enter secret count",
    unit: "secrets",
  },
  {
    key: "dynamicRoles",
    ask: "How many auto-rotating credential roles will Vault manage?",
    subtext: "E.g. one role per database connection or AWS IAM role.",
    type: "single",
    allowOther: true,
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("dynamic");
    },
    options: [
      { label: "< 50",       value: "25" },
      { label: "50 – 200",   value: "100" },
      { label: "200 – 1,000",value: "500" },
      { label: "1,000+",     value: "1000" },
    ],
    placeholder: "Enter role count",
    unit: "roles",
  },
  {
    key: "pkiCertsPerMonth",
    ask: "How many SSL/TLS certificates do they issue or renew per month?",
    type: "single",
    allowOther: true,
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("pki");
    },
    options: [
      { label: "< 100/month",        value: "50" },
      { label: "100 – 500/month",    value: "250" },
      { label: "500 – 2,000/month",  value: "1000" },
      { label: "2,000+/month",       value: "2000" },
    ],
    placeholder: "Enter certs per month",
    unit: "certs/month",
  },
  {
    key: "pkiCertLifetime",
    ask: "What is the typical certificate lifetime?",
    subtext: "Shorter-lived certs = more renewals = higher usage.",
    type: "single",
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("pki");
    },
    options: [
      { label: "1 day",     value: "24",   hint: "Very short-lived (mTLS, service mesh)" },
      { label: "30 days",   value: "720" },
      { label: "90 days",   value: "2160", hint: "Common for public certs" },
      { label: "1 year",    value: "8760" },
      { label: "2+ years",  value: "17520" },
    ],
  },
  {
    key: "transitCallsPerMonth",
    ask: "How many encrypt/decrypt or tokenization operations per month?",
    subtext: "Every 150,000 operations = 1 resource unit.",
    type: "single",
    allowOther: true,
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("transit");
    },
    options: [
      { label: "< 150K/month",        value: "75000" },
      { label: "150K – 1.5M/month",   value: "750000" },
      { label: "1.5M – 15M/month",    value: "7500000" },
      { label: "15M+/month",          value: "15000000" },
    ],
    placeholder: "Enter operations per month",
    unit: "operations/month",
  },
  {
    key: "kmseKeyCount",
    ask: "How many encryption keys will Vault manage?",
    type: "single",
    allowOther: true,
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("kmse");
    },
    options: [
      { label: "< 100",       value: "50" },
      { label: "100 – 500",   value: "250" },
      { label: "500 – 2,000", value: "1000" },
      { label: "2,000+",      value: "2000" },
    ],
    placeholder: "Enter key count",
    unit: "keys",
  },
  {
    key: "includeNonProd",
    ask: "Do they need a non-production (dev/test) environment?",
    type: "single",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No",  value: "no" },
    ],
  },
  {
    key: "includeKMIP",
    ask: "Do they need KMIP support (Key Management Interoperability Protocol)?",
    subtext: "Required for legacy apps that use the KMIP standard for key management.",
    type: "single",
    options: [
      { label: "Yes — switches to KMIP-included install", value: "yes", hint: "$360K/cluster vs $96K" },
      { label: "No",  value: "no" },
    ],
  },
];

export const VAULT_QUESTIONS_MODEL_B: Question[] = [
  {
    key: "edition",
    ask: "Which Vault edition does the client need?",
    type: "single",
    options: [
      { label: "Essentials",  value: "1", hint: "$24,960/cluster/year — core secret management" },
      { label: "Standard",    value: "2", hint: "$90,000/cluster/year — adds replication & namespaces" },
      { label: "Premium",     value: "3", hint: "$99,960/cluster/year — required for DR & performance replication" },
    ],
  },
  {
    key: "clientCount",
    ask: "How many apps, services, or users connect to Vault?",
    subtext: "Each unique app, service, or user = 1 Client (RVU).",
    type: "single",
    allowOther: true,
    options: [
      { label: "< 100",         value: "50" },
      { label: "100 – 500",     value: "250" },
      { label: "500 – 1,500",   value: "1000" },
      { label: "1,500 – 10,000",value: "5000" },
      { label: "10,000+",       value: "10000" },
    ],
    placeholder: "Enter client count",
    unit: "clients",
  },
  {
    key: "includeNonProd",
    ask: "Do they need a non-production (dev/test) environment?",
    type: "single",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No",  value: "no" },
    ],
  },
  {
    key: "pkiAddon",
    ask: "Do they need PKI certificate management as an add-on?",
    subtext: "Requires Vault v1.21+ and an existing Install + Clients.",
    type: "single",
    allowOther: true,
    options: [
      { label: "No",            value: "0" },
      { label: "Yes — < 100",   value: "50" },
      { label: "Yes — 100–500", value: "250" },
      { label: "Yes — 500+",    value: "500" },
    ],
    placeholder: "Enter PKI certificate count",
    unit: "certificates",
  },
  {
    key: "adpKeyMgmt",
    ask: "Do they need ADP Key Management (KMIP for legacy apps)?",
    type: "single",
    allowOther: true,
    options: [
      { label: "No",                value: "0" },
      { label: "Yes — 1 cluster",   value: "1" },
      { label: "Yes — 2 clusters",  value: "2" },
      { label: "Yes — 3+ clusters", value: "3" },
    ],
    placeholder: "Enter cluster count needing KMIP",
    unit: "clusters",
  },
];
