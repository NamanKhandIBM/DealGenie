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

export const VERIFY_QUOTE_QUESTIONS: Question[] = [
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

export const VERIFY_CROSS_SELL_QUESTIONS: Question[] = [
  {
    key: "verifyPopulation",
    ask: "How many users need identity and access controls?",
    subtext: "Use the total user population that would rely on SSO, MFA, or adaptive access.",
    type: "number",
    placeholder: "e.g. 5000",
    unit: "users",
  },
  {
    key: "verifyNeedsSSO",
    ask: "Does the client need single sign-on for business applications?",
    type: "single",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    key: "verifyNeedsMFA",
    ask: "Is stronger authentication such as MFA clearly required?",
    type: "single",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    key: "verifyNeedsAdaptive",
    ask: "Should access decisions account for device posture, risk, location, or behavior?",
    subtext: "This is the strongest signal for adaptive access in the Verify attach motion.",
    type: "single",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    key: "verifyNeedsLifecycle",
    ask: "Do they also need provisioning or deprovisioning of user accounts?",
    subtext: "Use this only when lifecycle management is part of the opportunity.",
    type: "single",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    key: "verifyManagedUsers",
    conditional: (a) => String(a.verifyNeedsLifecycle ?? "no") === "yes",
    ask: "How many of those users will be actively managed by lifecycle workflows?",
    type: "number",
    placeholder: "e.g. 2500",
    unit: "managed users",
  },
  {
    key: "verifyCrossSellReason",
    ask: "What is the main reason to attach Verify here?",
    subtext: "This helps position the right identity story around the adjacent quote.",
    type: "single",
    options: [
      { label: "Identity-aware access for managed devices", value: "device-trust" },
      { label: "SSO and MFA modernization", value: "access-modernization" },
      { label: "Adaptive zero trust policy", value: "adaptive-zero-trust" },
      { label: "Lifecycle and identity governance", value: "lifecycle" },
      { label: "Unified human and machine identity story", value: "human-machine-identity" },
      { label: "Privileged access and operator trust", value: "privileged-access" },
    ],
  },
];

export const VAULT_CROSS_SELL_QUESTIONS: Question[] = [
  {
    key: "vaultModel",
    ask: "Is this a new Vault motion or an existing renewal / mature deployment?",
    subtext: "Use new when you are opening a fresh attach from Verify. Use existing if the client already runs Vault and you need the renewal-style model.",
    type: "single",
    options: [
      { label: "New or expanding Vault motion", value: "A" },
      { label: "Existing Vault renewal / mature deployment", value: "B" },
    ],
  },
  {
    key: "installCount",
    ask: "How many production Vault clusters are likely in scope?",
    subtext: "For most cross-sell motions, 1 production cluster is the right starting point.",
    type: "single",
    allowOther: true,
    options: [
      { label: "1 cluster", value: "1" },
      { label: "2 clusters", value: "2" },
      { label: "3 clusters", value: "3" },
      { label: "4+ clusters", value: "4" },
    ],
    placeholder: "Enter exact number of production clusters",
    unit: "production clusters",
  },
  {
    key: "useCases",
    conditional: (a) => String(a.vaultModel ?? "A") === "A",
    ask: "Which Vault outcome best matches the attach motion?",
    subtext: "Select all that clearly apply so the quote sizes the right machine-identity and secrets motion.",
    type: "multi",
    options: [
      { label: "Store passwords, API keys, or app secrets", value: "static" },
      { label: "Auto-rotate database or cloud credentials", value: "dynamic" },
      { label: "Automate certificate issuance and renewal", value: "pki" },
      { label: "Secure SSH access and ephemeral credentials", value: "ssh" },
    ],
  },
  {
    key: "staticSecretCount",
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return String(a.vaultModel ?? "A") === "A" && !!uc?.includes("static");
    },
    ask: "Roughly how many secrets would Vault manage?",
    type: "single",
    allowOther: true,
    options: [
      { label: "Under 25", value: "12" },
      { label: "25 – 100", value: "50" },
      { label: "100 – 500", value: "250" },
      { label: "500+", value: "1000" },
    ],
    placeholder: "Enter secret count",
    unit: "secrets",
  },
  {
    key: "dynamicRoles",
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return String(a.vaultModel ?? "A") === "A" && !!uc?.includes("dynamic");
    },
    ask: "How many dynamic credential roles are likely needed?",
    subtext: "Use one role per distinct database, cloud, or privileged access pattern.",
    type: "single",
    allowOther: true,
    options: [
      { label: "Under 50", value: "25" },
      { label: "50 – 200", value: "100" },
      { label: "200 – 1,000", value: "500" },
      { label: "1,000+", value: "1000" },
    ],
    placeholder: "Enter role count",
    unit: "roles",
  },
  {
    key: "pkiCertsPerMonth",
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return String(a.vaultModel ?? "A") === "A" && !!uc?.includes("pki");
    },
    ask: "How many certificates per month would they issue or renew?",
    type: "single",
    allowOther: true,
    options: [
      { label: "Under 100/month", value: "50" },
      { label: "100 – 500/month", value: "250" },
      { label: "500 – 2,000/month", value: "1000" },
      { label: "2,000+/month", value: "2000" },
    ],
    placeholder: "Enter certs per month",
    unit: "certs/month",
  },
  {
    key: "pkiCertLifetime",
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return String(a.vaultModel ?? "A") === "A" && !!uc?.includes("pki");
    },
    ask: "What's the average certificate lifetime?",
    subtext: "Shorter lifetimes increase active certificate load.",
    type: "single",
    options: [
      { label: "30 days", value: "720" },
      { label: "90 days", value: "2160" },
      { label: "1 year", value: "8760" },
    ],
  },
  {
    key: "clientCount",
    conditional: (a) => String(a.vaultModel ?? "A") === "B",
    ask: "How many unique applications, services, or users authenticate to Vault today?",
    subtext: "Use this when the attach is really a renewal-style or mature existing Vault environment.",
    type: "number",
    placeholder: "e.g. 50",
    unit: "clients",
  },
  {
    key: "includeNonProd",
    ask: "Should we include a non-production Vault environment?",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes" },
    ],
  },
  {
    key: "vaultCrossSellReason",
    ask: "What is the main reason to attach Vault here?",
    subtext: "This helps position Vault as the machine-identity and secrets side of the story.",
    type: "single",
    options: [
      { label: "Secrets sprawl across apps and infrastructure", value: "secrets-sprawl" },
      { label: "Machine identities and certificates need governance", value: "machine-identity" },
      { label: "Privileged or operator access needs tighter control", value: "privileged-access" },
      { label: "Zero trust needs to extend beyond workforce identity", value: "zero-trust-expansion" },
    ],
  },
];

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
  ...VERIFY_QUOTE_QUESTIONS,
];

export const MAAS360_QUESTIONS: Question[] = [
  {
    key: "maas360Action",
    ask: "What would you like to do?",
    subtext: "Choose whether to explore best practices or build a public-price estimate.",
    type: "single",
    options: [
      { label: "📚 Best Practices", value: "bestpractices", hint: "UEM discovery guide & seller FAQs" },
      { label: "💰 Public Price Estimate", value: "quote", hint: "Estimate MaaS360 using public pricing" },
    ],
  },
  {
    key: "maas360Devices",
    conditional: (a) => String(a.maas360Action ?? "quote") === "quote",
    ask: "How many managed client devices are in scope?",
    subtext: "Use the number of devices you expect to actively manage with MaaS360.",
    type: "number",
    placeholder: "e.g. 2500",
    unit: "devices",
  },
  {
    key: "maas360SecureMail",
    conditional: (a) => String(a.maas360Action ?? "quote") === "quote",
    ask: "Does the client need secure business email or containerized business apps/data on mobile devices?",
    subtext: "This is the main step-up from core UEM into Deluxe territory.",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes" },
    ],
  },
  {
    key: "maas360AdvancedApps",
    conditional: (a) => String(a.maas360Action ?? "quote") === "quote",
    ask: "Do they need secure browser access, content management, app security, or protected enterprise app access?",
    subtext: "These requirements usually move the recommendation into Premier.",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes" },
    ],
  },
  {
    key: "maas360ThreatDefense",
    conditional: (a) => String(a.maas360Action ?? "quote") === "quote",
    ask: "Is advanced mobile threat protection or stronger endpoint security a clear requirement?",
    subtext: "This is the strongest signal for Enterprise and/or the threat defense add-on motion.",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes" },
    ],
  },
  {
    key: "maas360RemoteSupport",
    conditional: (a) => String(a.maas360Action ?? "quote") === "quote",
    ask: "Does IT need remote troubleshooting support for distributed users or field devices?",
    subtext: "Use this to decide whether TeamViewer Remote Support should be attached.",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes" },
    ],
  },
  {
    key: "maas360Concierge",
    conditional: (a) => String(a.maas360Action ?? "quote") === "quote",
    ask: "Should we include the one-time concierge setup service?",
    subtext: "Useful for new deployments that need IBM guidance for enrollment and policy setup.",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes", hint: "$500 one-time" },
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
    subtext: "Essentials: ≤30M ($99/mo) · Standard: 31M–1B ($349/mo+) · Premium: >1B (custom)",
    type: "single",
    allowOther: true,
    options: [
      { label: "≤ 30M",       value: "25",   hint: "Essentials — $99/mo base" },
      { label: "31M – 200M",  value: "100",  hint: "Standard — $349/mo base" },
      { label: "200M – 500M", value: "300",  hint: "Standard — $349/mo base" },
      { label: "500M – 1B",   value: "700",  hint: "Standard — $349/mo base" },
      { label: "1B – 5B",     value: "2000", hint: "Premium — custom pricing" },
      { label: "5B+",         value: "7500", hint: "Premium — custom pricing" },
    ],
    placeholder: "Enter exact millions (e.g. 150)",
    unit: "million queries/month",
  },
  {
    key: "recordCount",
    ask: "How many DNS records do they manage?",
    subtext: "1K records included on all tiers. Standard: $50/mo per additional 1K. Essentials: records capped at 1K.",
    type: "single",
    allowOther: true,
    options: [
      { label: "Under 1,000 (included)", value: "500" },
      { label: "1,000 – 5,000",          value: "3000" },
      { label: "5,000 – 10,000",         value: "7500" },
      { label: "10,000+ (Premium only)", value: "25000" },
    ],
    placeholder: "Enter exact record count",
    unit: "records",
  },
  {
    key: "filterChainCount",
    ask: "How many Filter Chains do they need?",
    subtext: "One traffic steering policy = 1 filter chain. 1 included on all tiers. Standard: $40/mo per additional chain. Essentials: no add-ons.",
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
  {
    key: "monitors",
    ask: "How many Monitors do they need?",
    subtext: "One health-checked hostname = 1 monitor. 2 included on all tiers. Standard: $1.30/mo per additional monitor. Essentials: no add-ons.",
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
  {
    key: "ddos",
    ask: "Do they need DDoS overage protection or NXD Waiver?",
    subtext: "Premium only. DDoS (D0GN5ZX) covers query spikes beyond contract. NXD Waiver (D0GNMZX) waives failed-lookup charges. Spike protection is already included in Standard at no charge.",
    conditional: (a) => Number(a.queryMQ ?? 0) > 1000,
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
    subtext: "Premium and Hybrid only. RUM-based geo/latency/performance routing.",
    conditional: (a) => Number(a.queryMQ ?? 0) > 1000,
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
    subtext: "Premium only (D0GN6ZX). Qty in CPQ must equal Managed DNS Requests. Included in Hybrid bundles.",
    conditional: (a) => Number(a.queryMQ ?? 0) > 1000,
    type: "single",
    options: [
      { label: "No",   value: "no" },
      { label: "Yes",  value: "yes" },
    ],
  },
  {
    key: "dedicated",
    ask: "Do they need Dedicated DNS (single-tenant infrastructure)?",
    subtext: "Premium only. D0GNAZX (Large) or D0GNBZX (Small). Min 3 PoPs, max 12. Included in Hybrid bundles.",
    conditional: (a) => Number(a.queryMQ ?? 0) > 1000,
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
    subtext: "Premium only (D0GN8ZX). Minimum 50M China-origin queries/month.",
    conditional: (a) => Number(a.queryMQ ?? 0) > 1000,
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
      { label: "📚 Best Practices", value: "bestpractices", hint: "Discovery guide & seller FAQs" },
      { label: "📋 View Part Numbers", value: "parts", hint: "See all Vault SKUs" },
      { label: "💰 Start Quoting", value: "quote", hint: "Begin the quoting process" },
    ],
  },
  {
    key: "vaultModel",
    conditional: (a) => String(a.vaultAction ?? "quote") === "quote",
    ask: "Is this a new Vault deployment or an existing renewal?",
    subtext: "This determines the pricing model. Models cannot be mixed in the same contract. Usage-based (Model A) requires Vault 2.0 and Census reporting enabled.",
    type: "single",
    options: [
      { label: "New or expanding deployment",  value: "A", hint: "Usage-based: priced on what Vault does (secrets, certs, keys) — requires Vault 2.0 + Census" },
      { label: "Existing renewal / stable env", value: "B", hint: "Client-based: priced on who connects (unique apps/services/users)" },
    ],
  },
  {
    key: "installCount",
    conditional: (a) => String(a.vaultAction ?? "quote") === "quote",
    ask: "How many production Vault clusters will they run?",
    subtext: "Most customers run 1 production cluster. Count production clusters only — each = 1 Install. Non-production is quoted separately.",
    type: "single",
    allowOther: true,
    options: [
      { label: "1 cluster",  value: "1", hint: "Typical for most customers" },
      { label: "2 clusters", value: "2" },
      { label: "3 clusters", value: "3" },
      { label: "4 clusters", value: "4" },
      { label: "5 clusters", value: "5" },
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
    ask: "What's the average certificate lifetime?",
    subtext: "Shorter lifetime = more concurrent certificate load.",
    type: "single",
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("pki");
    },
    options: [
      { label: "30 days",   value: "720" },
      { label: "90 days",   value: "2160" },
      { label: "1 year",    value: "8760" },
    ],
  },
];

export const VAULT_QUESTIONS_MODEL_B: Question[] = [
  {
    key: "edition",
    ask: "Which Vault edition best fits the deployment?",
    type: "single",
    conditional: (a) => String(a.vaultModel ?? "A") === "B",
    options: [
      { label: "Essentials", value: "1" },
      { label: "Standard", value: "2", hint: "Most common" },
      { label: "Premium", value: "3", hint: "DR / replication" },
    ],
  },
  {
    key: "clientCount",
    ask: "How many unique applications, services, or users will authenticate to Vault?",
    subtext: "Count unique clients, not container or VM instances.",
    type: "number",
    conditional: (a) => String(a.vaultModel ?? "A") === "B",
    placeholder: "e.g. 50",
    unit: "clients",
  },
  {
    key: "includeNonProd",
    ask: "Should we include a non-production Vault environment?",
    type: "single",
    conditional: (a) => String(a.vaultModel ?? "A") === "B",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes" },
    ],
  },
];

// ─── IBM INSTANA ──────────────────────────────────────────────────────────────

export const INSTANA_QUESTIONS: Question[] = [
  {
    key: "instanaAction",
    ask: "What would you like to do?",
    subtext: "Choose an option to get started with Instana.",
    type: "single",
    options: [
      { label: "📚 Best Practices", value: "bestpractices", hint: "Discovery guide & seller FAQs" },
      { label: "💰 Build an Estimate", value: "quote", hint: "Size the deal by MVS count and model" },
    ],
  },
  {
    key: "instanaMVS",
    conditional: (a) => String(a.instanaAction ?? "quote") === "quote",
    ask: "How many hosts (servers, VMs, nodes) will Instana monitor?",
    subtext: "Each monitored host = 1 Managed Virtual Server (MVS). Kubernetes worker nodes each count as 1 MVS — containers do not add to the count.",
    type: "number",
    placeholder: "e.g. 250",
    unit: "MVS (hosts)",
  },
  {
    key: "instanaTier",
    conditional: (a) => String(a.instanaAction ?? "quote") === "quote",
    ask: "What level of observability does the client need?",
    subtext: "Essentials is infrastructure-only. Standard adds full APM, distributed tracing, synthetic, and LLM/GenAI observability.",
    type: "single",
    options: [
      { label: "Standard (full-stack observability)", value: "Standard", hint: "Recommended — APM, traces, synthetic, LLM observability" },
      { label: "Essentials (infrastructure monitoring only)", value: "Essentials", hint: "VMs, Kubernetes, cloud infra only" },
    ],
  },
  {
    key: "instanaModel",
    conditional: (a) => String(a.instanaAction ?? "quote") === "quote",
    ask: "How does the client prefer to purchase?",
    type: "single",
    options: [
      { label: "SaaS (IBM-hosted)", value: "SaaS", hint: "From $21.20/MVS/month — flexible billing, add-ons available" },
      { label: "Self-Hosted (customer-managed)", value: "SelfHosted", hint: "From $1,440/month — annual subscription, full data control" },
      { label: "Pay Per Use", value: "PayPerUse", hint: "$0.03/MVS/hour — no commitment, cancel anytime, no add-ons" },
    ],
  },
  {
    key: "instanaLogsInContext",
    conditional: (a) => String(a.instanaAction ?? "quote") === "quote" && String(a.instanaModel ?? "SaaS") === "SaaS",
    ask: "Do they need Logs in Context (log ingestion and retention)?",
    subtext: "SaaS add-on: ingest logs from any source with 30, 60, or 90-day retention. Starts at $0.351/GB.",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes" },
    ],
  },
  {
    key: "instanaLogGB",
    conditional: (a) =>
      String(a.instanaAction ?? "quote") === "quote" &&
      String(a.instanaModel ?? "SaaS") === "SaaS" &&
      String(a.instanaLogsInContext ?? "no") === "yes",
    ask: "How many GB of logs per month will they ingest?",
    type: "number",
    placeholder: "e.g. 500",
    unit: "GB/month",
  },
];

// ─── IBM TURBONOMIC ───────────────────────────────────────────────────────────

export const TURBONOMIC_QUESTIONS: Question[] = [
  {
    key: "turbonomicAction",
    ask: "What would you like to do?",
    subtext: "IBM Turbonomic SaaS: $23.50/MVS/month (D11Q7ZX) list price. I can build a scoping estimate or best-practices guide.",
    type: "single",
    options: [
      { label: "📚 Best Practices", value: "bestpractices", hint: "Discovery guide & seller FAQs" },
      { label: "💰 Build an Estimate", value: "quote", hint: "Size by MVS count or annual cloud spend" },
    ],
  },
  {
    key: "turbonomicDeployment",
    conditional: (a) => String(a.turbonomicAction ?? "quote") === "quote",
    ask: "What deployment model does the client need?",
    type: "single",
    options: [
      { label: "SaaS — Commercial (IBM-hosted)", value: "SaaS", hint: "$18.80/MVS/month (D09ECZX) — IBM manages the platform" },
      { label: "SaaS — Government / FedRAMP", value: "SaaSGov", hint: "$23.50/MVS/month (D11Q7ZX) — FedRAMP-authorized deployment" },
      { label: "On-Premises (self-hosted)", value: "OnPrem", hint: "Contact-for-quote — air-gapped or sovereign environments" },
      { label: "Parking Edition (cloud cost savings only)", value: "Parking", hint: "Contact-for-quote — auto-stop/start idle cloud workloads" },
    ],
  },
  {
    key: "turbonomicScopingModel",
    conditional: (a) => String(a.turbonomicAction ?? "quote") === "quote" && String(a.turbonomicDeployment ?? "SaaS") === "SaaS",
    ask: "How would you like to size this deal?",
    subtext: "Choose based on what the customer knows today.",
    type: "single",
    options: [
      { label: "By MVS count (host / VM count)", value: "mvs", hint: "$23.50/MVS/month — use if you know the server/node count" },
      { label: "By annual cloud spend (Essentials edition)", value: "essentials", hint: "$50,000/instance/year — 1 instance covers up to $2M annual cloud spend" },
    ],
  },
  {
    key: "turbonomicMVS",
    conditional: (a) =>
      String(a.turbonomicAction ?? "quote") === "quote" &&
      String(a.turbonomicDeployment ?? "SaaS") === "SaaS" &&
      String(a.turbonomicScopingModel ?? "mvs") === "mvs",
    ask: "How many hosts or VMs are in scope for optimization?",
    subtext: "Use the same MVS count as your Instana scope if Instana is already in the deal. D11Q7ZX: $23.50/MVS/month list.",
    type: "number",
    placeholder: "e.g. 500",
    unit: "MVS (hosts)",
  },
  {
    key: "turbonomicCloudSpend",
    conditional: (a) =>
      String(a.turbonomicAction ?? "quote") === "quote" &&
      String(a.turbonomicDeployment ?? "SaaS") === "SaaS" &&
      String(a.turbonomicScopingModel ?? "mvs") === "essentials",
    ask: "What is the client's estimated annual public cloud spend?",
    subtext: "Essentials edition: $50,000/instance/year. Each instance covers up to $2M in annual cloud spend.",
    type: "number",
    placeholder: "e.g. 4000000",
    unit: "USD / year",
  },
  {
    key: "turbonomicCloud",
    conditional: (a) => String(a.turbonomicAction ?? "quote") === "quote",
    ask: "Does the client have public cloud resources to optimize?",
    subtext: "AWS, Azure, and/or Google Cloud — Turbonomic natively connects to all three.",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes" },
    ],
  },
  {
    key: "turbonomicKubernetes",
    conditional: (a) => String(a.turbonomicAction ?? "quote") === "quote",
    ask: "Does the client run Kubernetes or container workloads?",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes" },
    ],
  },
  {
    key: "turbonomicDriver",
    conditional: (a) => String(a.turbonomicAction ?? "quote") === "quote",
    ask: "What is the primary driver for this conversation?",
    type: "single",
    options: [
      { label: "Cloud cost reduction / FinOps", value: "cost" },
      { label: "Application performance assurance", value: "performance" },
      { label: "Both cost and performance", value: "both" },
    ],
  },
  {
    key: "turbonomicInstana",
    conditional: (a) => String(a.turbonomicAction ?? "quote") === "quote",
    ask: "Does the client already have IBM Instana (or is it part of this deal)?",
    subtext: "Turbonomic natively integrates with Instana for application-aware optimization — a key differentiator.",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes — already owned", value: "yes" },
    ],
  },
];

// ─── IBM HASHICORP TERRAFORM ──────────────────────────────────────────────────

export const TERRAFORM_QUESTIONS: Question[] = [
  {
    key: "terraformAction",
    ask: "What would you like to do?",
    subtext: "HCP Terraform paid-plan pricing is contact-for-quote. I can recommend the right plan and scope the deal.",
    type: "single",
    options: [
      { label: "📚 Best Practices", value: "bestpractices", hint: "IaC discovery guide & seller FAQs" },
      { label: "📋 Recommend a Plan", value: "quote", hint: "Identify the right HCP Terraform edition" },
    ],
  },
  {
    key: "terraformDeployment",
    conditional: (a) => String(a.terraformAction ?? "quote") === "quote",
    ask: "Does the client need a cloud-hosted or self-hosted Terraform platform?",
    type: "single",
    options: [
      { label: "HCP Terraform (IBM/HashiCorp-hosted SaaS)", value: "HCP", hint: "Most common — includes free tier" },
      { label: "Terraform Enterprise (self-hosted)", value: "Enterprise", hint: "Air-gapped, regulated, or on-prem environments" },
    ],
  },
  {
    key: "terraformResources",
    conditional: (a) => String(a.terraformAction ?? "quote") === "quote",
    ask: "How many Terraform-managed cloud or infrastructure resources are in scope?",
    subtext: "A managed resource is any cloud object that Terraform provisions and manages (VMs, buckets, databases, etc.). Free plan includes 500.",
    type: "single",
    allowOther: true,
    options: [
      { label: "Under 500 (Free plan eligible)", value: "250", hint: "HCP Terraform Free covers this" },
      { label: "500 – 5,000", value: "2500" },
      { label: "5,000 – 25,000", value: "10000" },
      { label: "25,000+", value: "50000" },
    ],
    placeholder: "Enter approximate resource count",
    unit: "managed resources",
  },
  {
    key: "terraformTeam",
    conditional: (a) => String(a.terraformAction ?? "quote") === "quote",
    ask: "How many engineers will use Terraform?",
    type: "single",
    allowOther: true,
    options: [
      { label: "1 – 4 engineers", value: "3" },
      { label: "5 – 9 engineers", value: "7" },
      { label: "10 – 25 engineers", value: "15" },
      { label: "25+ engineers", value: "30" },
    ],
    placeholder: "Enter team size",
    unit: "engineers",
  },
  {
    key: "terraformGovernance",
    conditional: (a) => String(a.terraformAction ?? "quote") === "quote",
    ask: "Does the client need policy-as-code (Sentinel / OPA) or audit logging?",
    subtext: "Policy enforcement is Standard+. Audit logging requires Premium.",
    type: "single",
    options: [
      { label: "No — basic provisioning only", value: "none" },
      { label: "Yes — policy-as-code (Sentinel/OPA)", value: "governance" },
      { label: "Yes — audit logging as well", value: "audit" },
    ],
  },
  {
    key: "terraformVault",
    conditional: (a) => String(a.terraformAction ?? "quote") === "quote",
    ask: "Is IBM HashiCorp Vault already in scope or owned by the client?",
    subtext: "Terraform + Vault is IBM's flagship ILM+SLM story — they are typically sold together.",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes — already owned", value: "yes" },
    ],
  },
];

// ─── IBM CONCERT ──────────────────────────────────────────────────────────────

export const CONCERT_QUESTIONS: Question[] = [
  {
    key: "concertAction",
    ask: "What would you like to do?",
    subtext: "Concert pricing is contact-for-quote. I can recommend the right modules and build the seller positioning.",
    type: "single",
    options: [
      { label: "📚 Best Practices", value: "bestpractices", hint: "Discovery guide & seller FAQs" },
      { label: "📋 Scope the Deal", value: "quote", hint: "Recommend Concert modules and positioning" },
    ],
  },
  {
    key: "concertPain",
    conditional: (a) => String(a.concertAction ?? "quote") === "quote",
    ask: "What is the client's biggest operational challenge?",
    type: "single",
    options: [
      { label: "Alert fatigue — too many alerts, not enough context", value: "alertFatigue" },
      { label: "Slow MTTR — takes too long to find and fix problems", value: "slowMTTR" },
      { label: "Cloud cost and resource optimization", value: "costOptimization" },
      { label: "Risk posture — vulnerabilities, compliance, change impact", value: "riskPosture" },
      { label: "All of the above", value: "all" },
    ],
  },
  {
    key: "concertInstana",
    conditional: (a) => String(a.concertAction ?? "quote") === "quote",
    ask: "Does the client already have IBM Instana (or is it part of this deal)?",
    subtext: "Instana is Concert's strongest data source — the Instana→Concert telemetry feed is a key differentiator.",
    type: "single",
    options: [
      { label: "No — they use other monitoring tools", value: "no" },
      { label: "Yes — already owned or in this deal", value: "yes" },
    ],
  },
  {
    key: "concertAutomation",
    conditional: (a) => String(a.concertAction ?? "quote") === "quote",
    ask: "Do they need automated remediation workflows (ITSM integration, AI-driven actions)?",
    type: "single",
    options: [
      { label: "No — dashboards and insights are sufficient", value: "no" },
      { label: "Yes — they want to automate remediation actions", value: "yes" },
    ],
  },
  {
    key: "concertApplications",
    conditional: (a) => String(a.concertAction ?? "quote") === "quote",
    ask: "How many applications or services are in scope?",
    subtext: "Used to estimate Concert Protect RU consumption (3 RU per app, vulnerability management use case).",
    type: "single",
    allowOther: true,
    options: [
      { label: "Under 20", value: "10" },
      { label: "20 – 100", value: "50" },
      { label: "100 – 500", value: "250" },
      { label: "500+", value: "750" },
    ],
    placeholder: "Enter application count",
    unit: "applications",
  },
  {
    key: "concertMVS",
    conditional: (a) => String(a.concertAction ?? "quote") === "quote",
    ask: "How many hosts or VMs will Concert optimize?",
    subtext: "Used to estimate Concert Optimize RU consumption (1 RU per 5 MVS). Enter 0 if not using resource optimization.",
    type: "number",
    placeholder: "e.g. 500",
    unit: "MVS (hosts)",
  },
];

// ─── IBM WEBMETHODS ───────────────────────────────────────────────────────────

export const WEBMETHODS_QUESTIONS: Question[] = [
  {
    key: "webMethodsAction",
    ask: "What would you like to do?",
    subtext: "webMethods pricing is contact-for-quote. I can scope the deal and build the seller positioning.",
    type: "single",
    options: [
      { label: "📚 Best Practices", value: "bestpractices", hint: "Discovery guide & seller FAQs" },
      { label: "📋 Scope the Deal", value: "quote", hint: "Identify capabilities and positioning" },
    ],
  },
  {
    key: "webMethodsNeeds",
    conditional: (a) => String(a.webMethodsAction ?? "quote") === "quote",
    ask: "What integration capabilities does the client need?",
    subtext: "Select all that apply.",
    type: "multi",
    options: [
      { label: "Application integration (SaaS, cloud, on-prem)", value: "appIntegration", hint: "1 RVU = 1,000 txn/month" },
      { label: "API management and governance", value: "apiManagement", hint: "1 RVU = 10,000 API txn/month" },
      { label: "B2B / EDI partner integration", value: "b2b" },
      { label: "Event-driven / streaming integration", value: "eventDriven" },
    ],
  },
  {
    key: "webMethodsIntTxn",
    conditional: (a) => {
      const needs = Array.isArray(a.webMethodsNeeds) ? a.webMethodsNeeds as string[] : [];
      return String(a.webMethodsAction ?? "quote") === "quote" && needs.includes("appIntegration");
    },
    ask: "How many integration transactions does the client run per month?",
    subtext: "SaaS estimate: 1 RVU = 1,000 integration transactions/month × $11.54/RVU/year.",
    type: "number",
    placeholder: "e.g. 100000",
    unit: "transactions / month",
  },
  {
    key: "webMethodsApiTxn",
    conditional: (a) => {
      const needs = Array.isArray(a.webMethodsNeeds) ? a.webMethodsNeeds as string[] : [];
      return String(a.webMethodsAction ?? "quote") === "quote" && needs.includes("apiManagement");
    },
    ask: "How many API transactions does the client handle per month?",
    subtext: "SaaS estimate: 1 RVU = 10,000 API transactions/month × $11.54/RVU/year.",
    type: "number",
    placeholder: "e.g. 500000",
    unit: "API transactions / month",
  },
  {
    key: "webMethodsDeployment",
    conditional: (a) => String(a.webMethodsAction ?? "quote") === "quote",
    ask: "Does the client prefer a cloud-hosted iPaaS or an on-premises / hybrid deployment?",
    type: "single",
    options: [
      { label: "SaaS (IBM-hosted iPaaS)", value: "saas" },
      { label: "On-Premises or Hybrid", value: "onPrem" },
      { label: "Not sure yet", value: "unknown" },
    ],
  },
  {
    key: "webMethodsIndustry",
    conditional: (a) => String(a.webMethodsAction ?? "quote") === "quote",
    ask: "What industry vertical is this customer in?",
    subtext: "Industry context helps position B2B/EDI strength and compliance requirements.",
    type: "single",
    options: [
      { label: "Financial services / banking", value: "financial" },
      { label: "Healthcare / life sciences", value: "healthcare" },
      { label: "Manufacturing / supply chain", value: "manufacturing" },
      { label: "Retail / consumer", value: "retail" },
      { label: "Other", value: "other" },
    ],
  },
  {
    key: "webMethodsVerify",
    conditional: (a) => String(a.webMethodsAction ?? "quote") === "quote",
    ask: "Is IBM Security Verify already in scope or owned by the client?",
    subtext: "webMethods + Verify is the 'governed integration fabric' cross-play — APIs managed by webMethods need Verify's identity governance.",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes — already owned or in this deal", value: "yes" },
    ],
  },
];
