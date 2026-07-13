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
      { label: "📚 Best Practices", value: "bestpractices", hint: "Discovery guide & seller FAQs" },
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
    ],
  },
  {
    key: "population",
    conditional: (a) => String(a.verifyAction ?? "quote") === "quote",
    ask: "How many users will this cover?",
    subtext: "Total user population — employees, contractors, customers, etc.",
    type: "number",
    placeholder: "e.g. 5000",
    unit: "users",
  },
  {
    key: "avgLogins",
    conditional: (a) => String(a.verifyAction ?? "quote") === "quote",
    ask: "How many months out of the year will a typical user log in?",
    subtext: "A user active in a month counts once regardless of how many times they log in that month.",
    type: "number",
    placeholder: "Enter a number between 1 and 12",
    unit: "months/year",
  },
  {
    key: "managedUsers",
    ask: "How many users will be actively managed (provisioned / deprovisioned)?",
    subtext: "For Lifecycle Management sizing.",
    type: "number",
    conditional: (a) => {
      if (String(a.verifyAction ?? "quote") !== "quote") return false;
      const caps = a.capabilities as string[] | undefined;
      return !!caps && caps.includes("Lifecycle");
    },
    placeholder: "e.g. 2500",
    unit: "managed users",
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
      { label: "None of the above",         value: "none" },
    ],
  },
  {
    key: "nonProd",
    ask: "Do they need a non-production (dev/test) environment?",
    subtext: "Choose one — with SLA gives an uptime guarantee, without SLA is cheaper.",
    type: "single",
    conditional: (a) => String(a.verifyAction ?? "quote") === "quote",
    options: [
      { label: "No",                            value: "none",    },
      { label: "Yes — with SLA (D22PGLL)",      value: "D22PGLL", hint: "$2,810/instance/month" },
      { label: "Yes — without SLA (D21CWLL)",   value: "D21CWLL", hint: "$1,410/instance/month" },
    ],
  },
  {
    key: "regions",
    ask: "Is this a multi-region or multi-tenant deployment?",
    subtext: "Each region/tenant needs its own Verify tenant — price multiplied per region.",
    type: "single",
    conditional: (a) => String(a.verifyAction ?? "quote") === "quote",
    options: [
      { label: "No — single region / tenant", value: "1" },
      { label: "Yes — 2 regions",             value: "2" },
      { label: "Yes — 3 regions",             value: "3" },
      { label: "Yes — 4+ regions",            value: "4" },
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
  // ── Action selector ───────────────────────────────────────────────────────
  {
    key: "ns1Action",
    ask: "What would you like to do?",
    subtext: "View the guide first, or jump straight into quoting?",
    type: "single",
    options: [
      { label: "📚 Best Practices", value: "bestpractices", hint: "Discovery guide & seller FAQs" },
      { label: "📋 View Part Numbers Reference", value: "parts", hint: "See all NS1 part numbers" },
      { label: "💰 Start Quoting", value: "quote", hint: "Begin the discovery questions" },
    ],
  },
  // ── Context ───────────────────────────────────────────────────────────────
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
  // ── Core sizing — Q1 Queries ──────────────────────────────────────────────
  {
    key: "queryMQ",
    ask: "How many DNS queries does the client handle per month?",
    subtext: "Essentials: <50M · Standard: 50M–1B · Premium: >1B",
    type: "single",
    allowOther: true,
    options: [
      { label: "< 50M",       value: "25",   hint: "NS1 Connect Essentials" },
      { label: "50M – 200M",  value: "100",  hint: "NS1 Connect Standard" },
      { label: "200M – 500M", value: "300",  hint: "NS1 Connect Standard" },
      { label: "500M – 1B",   value: "700",  hint: "NS1 Connect Standard" },
      { label: "1B – 5B",     value: "2000", hint: "NS1 Connect Premium" },
      { label: "5B+",         value: "7500", hint: "NS1 Connect Premium" },
    ],
    placeholder: "Enter exact millions (e.g. 150)",
    unit: "million queries/month",
  },
  // ── Core sizing — Q2 Records ──────────────────────────────────────────────
  {
    key: "recordCount",
    ask: "How many DNS records do they manage?",
    subtext: "1K records included on all tiers.",
    type: "single",
    allowOther: true,
    options: [
      { label: "Under 1,000",      value: "500" },
      { label: "1,000 – 10,000",   value: "5000" },
      { label: "10,000+ / Custom", value: "25000" },
    ],
    placeholder: "Enter exact record count",
    unit: "records",
  },
  // ── Core sizing — Q3 Filter Chains ───────────────────────────────────────
  {
    key: "filterChainCount",
    ask: "How many Filter Chains do they need?",
    subtext: "A Filter Chain = one traffic steering policy (failover, geo, load balance). 1 included on Essentials/Standard.",
    type: "single",
    allowOther: true,
    options: [
      { label: "None (use included 1)", value: "0" },
      { label: "1 – 5",                value: "3" },
      { label: "6 – 10",               value: "8" },
      { label: "11 – 20",              value: "15" },
      { label: "21+",                  value: "25" },
    ],
    placeholder: "Enter number of filter chains",
    unit: "filter chains",
  },
  // ── Core sizing — Q4 Monitors ─────────────────────────────────────────────
  {
    key: "monitors",
    ask: "How many Monitors do they need?",
    subtext: "A Monitor checks the health of one hostname or IP. 2 included on Essentials/Standard.",
    type: "single",
    allowOther: true,
    options: [
      { label: "None (use included 2)", value: "0" },
      { label: "1 – 5",                value: "3" },
      { label: "6 – 10",               value: "8" },
      { label: "11 – 20",              value: "15" },
      { label: "21+",                  value: "25" },
    ],
    placeholder: "Enter number of monitors",
    unit: "monitors",
  },
  // ── Advanced Features ─────────────────────────────────────────────────────
  {
    key: "ddos",
    ask: "Do they need DDoS + NXD Protection?",
    subtext: "DDoS: covers query spikes beyond contracted volume (D0GN5ZX). NXD Waiver: waives failed-lookup charges (D0GNMZX). Both Premium only. Note: spike protection is already included in Standard.",
    type: "single",
    options: [
      { label: "No",                   value: "no" },
      { label: "DDoS only",            value: "ddos" },
      { label: "NXD Waiver only",      value: "nxd" },
      { label: "DDoS + NXD both",      value: "both" },
    ],
  },
  {
    key: "gslb",
    ask: "Do they need GSLB (Global Server Load Balancing / Pulsar)?",
    subtext: "RUM-based geo/performance routing. Available on Premium and Hybrid.",
    type: "single",
    options: [
      { label: "No",                                     value: "no" },
      { label: "Yes — Standard RUM (NS1-provided data)", value: "yes-rum" },
      { label: "Yes — Advanced RUM (private data feed)", value: "yes-rum-advanced" },
    ],
  },
  {
    key: "insights",
    ask: "Do they need DNS Insights (observability & analytics)?",
    subtext: "D0GN6ZX — Premium only. Qty in CPQ must equal Managed DNS Requests.",
    type: "single",
    options: [
      { label: "No",   value: "no" },
      { label: "Yes",  value: "yes" },
    ],
  },
  {
    key: "dedicated",
    ask: "Do they need Dedicated DNS (single-tenant infrastructure)?",
    subtext: "D0GNAZX (Large) or D0GNBZX (Small). Min 3 PoPs, max 12. Premium only.",
    type: "single",
    options: [
      { label: "No",            value: "no" },
      { label: "Yes — 3 PoPs",  value: "3" },
      { label: "Yes — 6 PoPs",  value: "6" },
      { label: "Yes — 12 PoPs", value: "12" },
    ],
  },
  {
    key: "china",
    ask: "Do they need DNS coverage in mainland China?",
    subtext: "D0GN8ZX — minimum 50M China-origin queries/month.",
    type: "single",
    options: [
      { label: "No",   value: "no" },
      { label: "Yes",  value: "yes" },
    ],
  },
  {
    key: "chinaMQ",
    ask: "How many China-origin queries per month?",
    subtext: "Minimum 50M. Handled by the China-specific NS1 network.",
    type: "single",
    allowOther: true,
    conditional: (a) => String(a.china ?? "no") === "yes",
    options: [
      { label: "50M (minimum)", value: "50" },
      { label: "100M",          value: "100" },
      { label: "500M",          value: "500" },
      { label: "1B+",           value: "1000" },
    ],
    placeholder: "Enter China-origin MQ",
    unit: "million queries/month",
  },
  {
    key: "cloudSync",
    ask: "Do they need IBM Cloud Sync?",
    subtext: "D16MXZX — syncs NS1 DNS zones with IBM Cloud. Available on all tiers.",
    type: "single",
    options: [
      { label: "No",   value: "no" },
      { label: "Yes",  value: "yes" },
    ],
  },
  // ── Growth headroom ───────────────────────────────────────────────────────
  {
    key: "growthMQ",
    ask: "How much additional query headroom do you want to size for?",
    subtext: "Added on top of current volume to prevent overage charges during the contract term.",
    type: "single",
    allowOther: true,
    options: [
      { label: "None",    value: "0" },
      { label: "+ 10M",   value: "10" },
      { label: "+ 50M",   value: "50" },
      { label: "+ 100M",  value: "100" },
      { label: "+ 200M",  value: "200" },
    ],
    placeholder: "Enter additional MQ (millions)",
    unit: "million queries/month",
  },
  // ── Term ──────────────────────────────────────────────────────────────────
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
//
// Source: Kris Ditmore meeting transcript (July 13 2026)
//
// Vault 1.0  (current, still most deals)
//   Metric: cluster + client model
//   - 1 production cluster is typical
//   - A "client" = any unique app/service/user that AUTHENTICATES to Vault (via alias)
//   - Once authenticated, the client can access unlimited secrets — secret count doesn't matter
//   - Analogy: Vault = hotel front desk; client = a room key; secrets = what you access with it
//   - Priced on: # production clusters (Installs) + # unique clients (RVUs)
//   - NOT relevant: secret count, access frequency, secret type
//
// Vault 2.0  (new, ~2 months old as of July 2026, direction IBM is moving)
//   Metric: consumption / secret model
//   - Driven by: secret type, # secrets stored, how often accessed/rotated
//   - Motivation: Kubernetes clusters can have 1000s of machine clients — charging per-client
//     is not cost-effective. Vault 2.0 charges per secret instead.
//   - Official pricing spreadsheet exists but has NOT been shared yet (Kris to send)
//   - Contact: #vault-pricing-deals Slack channel + Vault product managers
//   - NOT relevant: per-seat client count
//
// Gap analysis (from Kris meeting)
// ─────────────────────────────────────────────────────────────────────────────
// | Question          | Vault 1.0 (B-Clients) | Vault 2.0 (consumption)   |
// |-------------------|-----------------------|---------------------------|
// | Cluster count     | Required (usually 1)  | TBD                       |
// | Client count      | Required (often ≤5)   | Not used                  |
// | Secret type       | Not used              | Required (PKI vs API etc) |
// | Secret count      | Not used              | Required (most have 10–15)|
// | Access frequency  | Not used              | Required                  |
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️  Vault 2.0 BLOCKERS — do not build engine until resolved:
//   1. Get the official Vault 2.0 pricing spreadsheet from Kris / #vault-pricing-deals
//   2. Confirm part numbers for Vault 2.0 SKUs with the Vault product managers
//   3. Confirm exact formula: secret count × access frequency × type multiplier?

export const VAULT_QUESTIONS_COMMON: Question[] = [
  {
    key: "vaultAction",
    ask: "What would you like to do?",
    subtext: "Choose an option to get started with Vault quoting",
    type: "single",
    options: [
      { label: "📚 Best Practices", value: "bestpractices", hint: "Discovery guide & seller FAQs" },
      { label: "📋 View Part Numbers", value: "parts", hint: "See all Vault SKUs" },
      { label: "💰 Start Quoting", value: "quote", hint: "Begin the quoting process" },
    ],
  },
  {
    // Model A (Platform/RU) = usage/consumption-based → aligns with what IBM calls "Vault 2.0 direction"
    // Model B (Clients/RVU) = per-seat/client-based → classic Vault 1.0 model
    // Both have full part numbers and a working engine. The "Vault 2.0" name is directional —
    // Model A already implements the consumption methodology Kris described.
    key: "vaultModel",
    conditional: (a) => String(a.vaultAction ?? "quote") === "quote",
    ask: "Is this a new Vault deployment or an existing renewal?",
    subtext: "This determines the pricing model. The two models cannot be mixed for the same customer.",
    type: "single",
    options: [
      { label: "New or expanding deployment",  value: "A", hint: "Usage-based: priced on what Vault does (secrets, certs, keys)" },
      { label: "Existing renewal / stable env", value: "B", hint: "Client-based: priced on who connects (unique apps/services/users)" },
    ],
  },
  {
    key: "installCount",
    conditional: (a) => String(a.vaultAction ?? "quote") === "quote",
    ask: "How many production Vault clusters will they run?",
    // Kris Ditmore (July 13 2026): "typically a customer will have one production cluster"
    subtext: "Most customers run 1 production cluster. Count production clusters only — each = 1 Install. Non-production is quoted separately.",
    type: "single",
    allowOther: true,
    options: [
      { label: "1 cluster",      value: "1",  hint: "Typical for most customers" },
      { label: "2 clusters",     value: "2" },
      { label: "3 – 5 clusters", value: "3" },
      { label: "6 – 10 clusters",value: "6" },
      { label: "10+ clusters",   value: "10" },
    ],
    placeholder: "Enter exact number of production clusters",
    unit: "production clusters",
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
    // Kris Ditmore (July 13 2026): ranges were "a little high" — scaled back ~50%.
    // Many customers have just 10–15 secrets. Upper range dropped from 10,000+ to 2,000+.
    type: "single",
    allowOther: true,
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("static");
    },
    options: [
      { label: "< 25",         value: "12",  hint: "Common — many customers have 10–15" },
      { label: "25 – 100",     value: "50" },
      { label: "100 – 500",    value: "250" },
      { label: "500 – 2,000",  value: "1000" },
      { label: "2,000+",       value: "2000" },
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
    key: "sshCredsPerMonth",
    ask: "How many SSH credentials will Vault issue per month?",
    subtext: "Count SSH certificates or OTPs issued/renewed. Uses the same formula as PKI — shorter lifetime = more RU.",
    type: "single",
    allowOther: true,
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("ssh");
    },
    options: [
      { label: "< 100/month",        value: "50" },
      { label: "100 – 500/month",    value: "250" },
      { label: "500 – 2,000/month",  value: "1000" },
      { label: "2,000+/month",       value: "2000" },
    ],
    placeholder: "Enter SSH credentials per month",
    unit: "creds/month",
  },
  {
    key: "sshLifetime",
    ask: "What is the typical SSH credential lifetime?",
    subtext: "Shorter lifetimes mean more frequent issuance = higher RU usage.",
    type: "single",
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("ssh");
    },
    options: [
      { label: "1 hour",    value: "1",    hint: "Very short-lived (just-in-time access)" },
      { label: "8 hours",   value: "8",    hint: "One working shift" },
      { label: "1 day",     value: "24" },
      { label: "7 days",    value: "168" },
      { label: "30 days",   value: "720" },
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

// Vault 1.0 — client-based pricing (current licensing model)
// Secret count is NOT a pricing input for Vault 1.0; do not ask for it here.
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
    // Most Vault 1.0 customers have ≤ 5 distinct clients; lower ranges are reflected
    // in the first two options. Use allowOther for larger deployments.
    subtext: "Each unique app, service, or user = 1 Client (RVU). Most customers have 5 or fewer clients.",
    type: "single",
    allowOther: true,
    options: [
      { label: "1 – 5",         value: "3",     hint: "Typical for most customers" },
      { label: "6 – 25",        value: "15" },
      { label: "26 – 100",      value: "50" },
      { label: "101 – 500",     value: "250" },
      { label: "500+",          value: "500" },
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
  {
    key: "adpTransform",
    ask: "Do they need ADP Transform (tokenisation / format-preserving encryption)?",
    subtext: "Used for masking PII, credit card numbers, SSNs in transit. Charged per app/service using it.",
    type: "single",
    allowOther: true,
    options: [
      { label: "No",            value: "0" },
      { label: "Yes — < 10",    value: "5" },
      { label: "Yes — 10–50",   value: "25" },
      { label: "Yes — 50+",     value: "50" },
    ],
    placeholder: "Enter number of Transform clients",
    unit: "clients",
  },
];

// ─── VAULT 2.0 — consumption-based (upcoming licensing model) ─────────────────
//
// Source: Kris Ditmore meeting transcript (July 13 2026)
//
// ⚠️  PRICING ENGINE NOT YET BUILDABLE — official spreadsheet not received.
//     These questions capture the right inputs based on what Kris described.
//
//     BLOCKERS before this can produce real quotes:
//       1. Get Vault 2.0 pricing spreadsheet from Kris Ditmore (he offered to send)
//       2. Join #vault-pricing-deals Slack channel — Vault product managers are there
//       3. Confirm exact pricing formula (secret count × access freq × type multiplier?)
//       4. Obtain part numbers for Vault 2.0 SKUs
//
// What Kris confirmed Vault 2.0 is priced on:
//   - Type of secrets (PKI certs vs API keys are charged differently)
//   - Number of secrets stored
//   - How often secrets are accessed / rotated
//   - "There's a whole spreadsheet" — more nuance than just these three inputs
//
// Secret count IS a required input for Vault 2.0 (unlike Vault 1.0).
// Client count is NOT used in Vault 2.0.
// Kris: secret ranges should be small — many customers have only 10–15 secrets.

export const VAULT_QUESTIONS_VAULT2: Question[] = [
  {
    key: "v2SecretTypes",
    ask: "What types of secrets will they store in Vault?",
    // Kris: "we charge different for PKI keys versus API calls"
    subtext: "Select all that apply — Vault 2.0 charges differently by secret type.",
    type: "multi",
    options: [
      { label: "Static secrets (passwords, API keys, config values)", value: "static",  hint: "Key/value secrets engine" },
      { label: "Dynamic credentials (auto-rotating DB, cloud creds)", value: "dynamic", hint: "Database, AWS, Azure engines" },
      { label: "PKI certificates",                                     value: "pki",     hint: "Certificate lifecycle — priced separately from API keys" },
      { label: "SSH credentials",                                      value: "ssh",     hint: "SSH secrets engine" },
      { label: "Encryption keys (KMIP / Transit)",                     value: "kmse",    hint: "Key management / tokenisation" },
    ],
  },
  {
    key: "v2SecretCount",
    ask: "How many secrets will they store in Vault?",
    // Secret count is a core pricing input for Vault 2.0 — NOT used in Vault 1.0.
    // Kris: "there are many customers that just have 10, 15 secrets" — keep ranges small.
    subtext: "Count all unique secrets across all types. Most customers have fewer than you'd expect.",
    type: "single",
    allowOther: true,
    options: [
      { label: "< 25",          value: "12",   hint: "Common — many customers have 10–15" },
      { label: "25 – 100",      value: "50" },
      { label: "100 – 500",     value: "250" },
      { label: "500 – 2,000",   value: "1000" },
      { label: "2,000+",        value: "2000" },
    ],
    placeholder: "Enter total secret count",
    unit: "secrets",
  },
  {
    key: "v2AccessFrequency",
    ask: "How often will secrets be accessed or rotated?",
    // Kris: "how many times are you going to rotate the secret" is a key Vault 2.0 input.
    // Kris: "we charge different for...how often they're accessed"
    subtext: "Estimate average secret reads/writes per day across all applications.",
    type: "single",
    allowOther: true,
    options: [
      { label: "Low — < 1,000 operations/day",        value: "500" },
      { label: "Medium — 1,000 – 10,000/day",         value: "5000" },
      { label: "High — 10,000 – 100,000/day",         value: "50000" },
      { label: "Very high — 100,000+/day",             value: "100000" },
    ],
    placeholder: "Enter estimated operations per day",
    unit: "operations/day",
  },
  {
    key: "v2IncludeNonProd",
    ask: "Do they need a non-production (dev/test) environment?",
    type: "single",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No",  value: "no" },
    ],
  },
];
