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
    ask: "Which Vault outcome best matches the attach motion?",
    subtext: "Select all that clearly apply — Vault 2.0 prices on what it does, so this directly drives the estimate.",
    type: "multi",
    options: [
      { label: "Store passwords, API keys, or app secrets",  value: "static",  hint: "e.g. database passwords, API credentials" },
      { label: "Auto-rotate database or cloud credentials",  value: "dynamic", hint: "Vault generates and expires credentials automatically" },
      { label: "Automate certificate issuance and renewal",  value: "pki",     hint: "Automate certificate lifecycle for services" },
      { label: "Secure SSH access with short-lived keys",    value: "ssh",     hint: "Temporary SSH credentials instead of static keys" },
    ],
  },
  {
    key: "staticSecretCount",
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("static");
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
      return !!uc?.includes("dynamic");
    },
    ask: "How many different databases or cloud services would Vault rotate credentials for?",
    subtext: "Each distinct connection type counts as one role.",
    type: "single",
    allowOther: true,
    options: [
      { label: "Under 10", value: "5" },
      { label: "10 – 50", value: "25" },
      { label: "50 – 200", value: "100" },
      { label: "200+", value: "500" },
    ],
    placeholder: "Enter role count",
    unit: "roles",
  },
  {
    key: "pkiCertsPerMonth",
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("pki");
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
      return !!uc?.includes("pki");
    },
    ask: "How long do those certificates stay valid before expiring?",
    type: "single",
    options: [
      { label: "1 day or less — very short-lived (e.g. service mesh)", value: "24" },
      { label: "30 days", value: "720" },
      { label: "90 days", value: "2160" },
      { label: "1 year", value: "8760" },
    ],
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
  ...VERIFY_QUOTE_QUESTIONS,
];

export const MAAS360_QUESTIONS: Question[] = [
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
    key: "installCount",
    conditional: (a) => String(a.vaultAction ?? "quote") === "quote",
    ask: "How many production Vault clusters will they run?",
    subtext: "Most customers run 1 production cluster. Count production clusters only — each is 1 Install. Non-production is quoted separately.",
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
    subtext: "Select all that apply — I'll work out the usage and cost from your answers.",
    type: "multi",
    options: [
      { label: "Store passwords, API keys & app secrets",  value: "static",  hint: "e.g. database passwords, API credentials" },
      { label: "Auto-rotate database or cloud credentials", value: "dynamic", hint: "Vault generates and expires credentials automatically" },
      { label: "Issue & renew SSL/TLS certificates (PKI)",  value: "pki",     hint: "Automate certificate lifecycle for services" },
      { label: "Secure SSH access with short-lived keys",   value: "ssh",     hint: "Temporary SSH credentials instead of static keys" },
      { label: "Encrypt or tokenize data in transit",       value: "transit", hint: "Encrypt data without storing it in Vault" },
      { label: "Manage hardware encryption keys (KMIP)",    value: "kmse",    hint: "Key management for databases or storage systems" },
    ],
  },
  {
    key: "staticSecretCount",
    ask: "Roughly how many secrets — passwords, API keys, config values — will they store in Vault?",
    subtext: "Think of each unique credential or config value as one secret.",
    type: "single",
    allowOther: true,
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("static");
    },
    options: [
      { label: "Under 25",       value: "12",   hint: "Common starting point" },
      { label: "25 – 100",       value: "50" },
      { label: "100 – 500",      value: "250" },
      { label: "500 – 2,000",    value: "1000" },
      { label: "2,000+",         value: "2000" },
    ],
    placeholder: "Enter secret count",
    unit: "secrets",
  },
  {
    key: "dynamicRoles",
    ask: "How many different types of databases, cloud services, or systems will Vault auto-rotate credentials for?",
    subtext: "Each distinct connection type (e.g. one MySQL database, one AWS IAM role) counts as one role.",
    type: "single",
    allowOther: true,
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("dynamic");
    },
    options: [
      { label: "Under 10",      value: "5" },
      { label: "10 – 50",       value: "25" },
      { label: "50 – 200",      value: "100" },
      { label: "200+",          value: "500" },
    ],
    placeholder: "Enter role count",
    unit: "roles",
  },
  {
    key: "pkiCertsPerMonth",
    ask: "How many SSL/TLS certificates do they issue or renew per month?",
    subtext: "Count certificates actively being issued — each cert issued or renewed counts once.",
    type: "single",
    allowOther: true,
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("pki");
    },
    options: [
      { label: "Under 100/month",       value: "50" },
      { label: "100 – 500/month",       value: "250" },
      { label: "500 – 2,000/month",     value: "1000" },
      { label: "2,000+/month",          value: "2000" },
    ],
    placeholder: "Enter certs per month",
    unit: "certs/month",
  },
  {
    key: "pkiCertLifetime",
    ask: "How long do those certificates typically stay valid before expiring?",
    subtext: "Short-lived certs (used in service meshes) cost less than long-lived certs because fewer are active at once.",
    type: "single",
    conditional: (a) => {
      const uc = a.useCases as string[] | undefined;
      return !!uc?.includes("pki");
    },
    options: [
      { label: "1 day or less — very short-lived (e.g. service mesh)", value: "24" },
      { label: "30 days",   value: "720" },
      { label: "90 days",   value: "2160" },
      { label: "1 year",    value: "8760" },
    ],
  },
  {
    key: "includeNonProd",
    ask: "Should we include a non-production (dev/test) Vault environment?",
    type: "single",
    conditional: (a) => String(a.vaultAction ?? "quote") === "quote",
    options: [
      { label: "No", value: "no" },
      { label: "Yes", value: "yes" },
    ],
  },
];

// Model B is retired — Vault 2.0 (Model A / RU-based) is the only quoting path.
export const VAULT_QUESTIONS_MODEL_B: Question[] = [];

// ─── IBM INSTANA ──────────────────────────────────────────────────────────────

export const INSTANA_QUESTIONS: Question[] = [
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
    ask: "Do they need to monitor application code and transactions (APM), or just the servers and infrastructure?",
    subtext: "Application monitoring tracks how code performs — response times, errors, traces. Infrastructure monitoring covers CPU, memory, and host health only.",
    type: "single",
    options: [
      { label: "Both — monitor apps AND the infrastructure they run on", value: "Standard", hint: "Includes APM, distributed tracing, synthetic testing, and LLM/AI observability" },
      { label: "Infrastructure only — servers, VMs, Kubernetes nodes", value: "Essentials", hint: "Host health and resource utilisation only, no application tracing" },
    ],
  },
  {
    key: "instanaModel",
    conditional: (a) => String(a.instanaAction ?? "quote") === "quote",
    ask: "Does the client want IBM to manage the observability platform, or will they run it themselves?",
    type: "single",
    options: [
      { label: "IBM manages it (cloud-hosted SaaS)", value: "SaaS", hint: "From $21.20/host/month — no infrastructure to run, add-ons available" },
      { label: "They run it themselves (self-hosted)", value: "SelfHosted", hint: "From $1,440/month — full data control, runs in their own environment" },
      { label: "Pay as they go — no annual commitment", value: "PayPerUse", hint: "$0.03/host/hour — cancel anytime, no long-term lock-in" },
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
  // ── 1. New vs existing client ─────────────────────────────────────────────
  {
    key: "turbonomicClientType",
    conditional: (a) => String(a.turbonomicAction ?? "quote") === "quote",
    ask: "Is this a new client or an existing Turbonomic client?",
    type: "single",
    options: [
      { label: "New client", value: "new", hint: "No existing Turbonomic entitlement" },
      { label: "Existing client", value: "existing", hint: "Already has Turbonomic — renewal, expansion, or migration" },
    ],
  },
  // ── 2. Existing client motion ─────────────────────────────────────────────
  {
    key: "turbonomicExistingMotion",
    conditional: (a) =>
      String(a.turbonomicAction ?? "quote") === "quote" &&
      String(a.turbonomicClientType ?? "new") === "existing",
    ask: "What is the motion for this existing client?",
    type: "single",
    options: [
      { label: "Renewal — renewing existing entitlement", value: "renewal", hint: "Same scope, new term" },
      { label: "Add capacity — expanding MVS count or cloud spend", value: "addCapacity", hint: "Upsell / expand existing deployment" },
      { label: "Transition to SaaS — moving from On-Prem to SaaS", value: "toSaaS", hint: "Use Hosting Edition (D0HE7ZX) as bridge" },
    ],
  },
  // ── 3. Use case qualification ─────────────────────────────────────────────
  {
    key: "turbonomicUseCase",
    conditional: (a) => String(a.turbonomicAction ?? "quote") === "quote",
    ask: "What is the customer's primary use case?",
    subtext: "This determines the scoping approach and the right pricing metric.",
    type: "single",
    options: [
      { label: "VMware / virtual machine performance", value: "vmware", hint: "Right-size VMs, improve density, reduce manual tuning" },
      { label: "Kubernetes / container performance", value: "kubernetes", hint: "Right-size pods and nodes, prevent over-provisioning" },
      { label: "Cloud cost optimization (FinOps)", value: "finops", hint: "Reduce AWS/Azure/GCP waste — MVS or Monitored Costs pricing" },
      { label: "Workload Parking — auto-stop idle cloud workloads", value: "parking", hint: "$6.26/MVS pay-as-you-go — non-production environments" },
      { label: "Other / multiple Turbonomic capabilities", value: "other", hint: "Full platform — data center, AI workloads, hybrid cloud" },
    ],
  },
  // ── 4. Deployment / hosting ───────────────────────────────────────────────
  {
    key: "turbonomicDeployment",
    conditional: (a) =>
      String(a.turbonomicAction ?? "quote") === "quote" &&
      String(a.turbonomicUseCase ?? "vmware") !== "parking",
    ask: "How should Turbonomic be deployed?",
    subtext: "IBM-managed (SaaS) is the default for most deals. On-Prem is contact-for-quote.",
    type: "single",
    options: [
      { label: "IBM hosts it — standard commercial cloud (SaaS)", value: "SaaS", hint: "$18.80/MVS/month — IBM manages the platform" },
      { label: "IBM hosts it — US Federal / FedRAMP (SaaS Gov)", value: "SaaSGov", hint: "$23.50/MVS/month — US government agencies" },
      { label: "Customer self-managed — own data centre (On-Prem)", value: "OnPrem", hint: "Contact-for-quote — air-gapped or sovereign requirements" },
    ],
  },
  // ── 5. Scoping model ──────────────────────────────────────────────────────
  {
    key: "turbonomicScopingModel",
    conditional: (a) =>
      String(a.turbonomicAction ?? "quote") === "quote" &&
      (String(a.turbonomicDeployment ?? "SaaS") === "SaaS" || String(a.turbonomicDeployment ?? "SaaS") === "SaaSGov") &&
      String(a.turbonomicUseCase ?? "vmware") !== "parking",
    ask: "What does the client know better — their server/VM count or their annual cloud bill?",
    subtext: "Either way works. Minimum $1.6M cloud spend required for the Monitored Costs path.",
    type: "single",
    options: [
      { label: "They know how many servers / VMs / nodes they have", value: "mvs", hint: "$18.80/MVS/month (commercial) — enter the count next" },
      { label: "They know their annual AWS / Azure / GCP bill", value: "monitoredCosts", hint: "Tiered per $100K cloud spend — min $1.6M/yr" },
    ],
  },
  // ── 6. MVS count ──────────────────────────────────────────────────────────
  {
    key: "turbonomicMVS",
    conditional: (a) =>
      String(a.turbonomicAction ?? "quote") === "quote" &&
      (String(a.turbonomicDeployment ?? "SaaS") === "SaaS" || String(a.turbonomicDeployment ?? "SaaS") === "SaaSGov" || String(a.turbonomicUseCase ?? "vmware") === "parking") &&
      String(a.turbonomicScopingModel ?? "mvs") !== "monitoredCosts",
    ask: "How many hosts, VMs, or Kubernetes nodes are in scope?",
    subtext: "MVS counting: 1 VM = 1 MVS · 1 K8s worker node = 1 MVS · 1 physical server = 1 MVS. Pods/containers do NOT count separately. Use the same count as your Instana scope if Instana is in the deal.",
    type: "number",
    placeholder: "e.g. 500",
    unit: "MVS",
  },
  // ── 7. VMware vs Kubernetes breakdown ─────────────────────────────────────
  {
    key: "turbonomicInfraType",
    conditional: (a) =>
      String(a.turbonomicAction ?? "quote") === "quote" &&
      Number(a.turbonomicMVS ?? 0) > 0 &&
      String(a.turbonomicUseCase ?? "vmware") !== "parking" &&
      String(a.turbonomicUseCase ?? "vmware") !== "finops",
    ask: "What infrastructure is in scope for optimization?",
    subtext: "Select all that apply. This does not change the MVS count — it shapes the seller talking points.",
    type: "multi",
    options: [
      { label: "VMware / vSphere VMs", value: "vmware" },
      { label: "Kubernetes / OpenShift container nodes", value: "kubernetes" },
      { label: "Public cloud VMs (AWS, Azure, GCP)", value: "cloud" },
      { label: "Physical / bare-metal servers", value: "physical" },
      { label: "AI / GPU workloads", value: "ai" },
    ],
  },
  // ── 8. Annual cloud spend ─────────────────────────────────────────────────
  {
    key: "turbonomicCloudSpend",
    conditional: (a) =>
      String(a.turbonomicAction ?? "quote") === "quote" &&
      (String(a.turbonomicDeployment ?? "SaaS") === "SaaS" || String(a.turbonomicDeployment ?? "SaaS") === "SaaSGov") &&
      String(a.turbonomicScopingModel ?? "mvs") === "monitoredCosts",
    ask: "What is the client's estimated annual public cloud spend?",
    subtext: "Monitored Costs (D0I0GZX): tiered pricing per $100K cloud spend. Minimum $1,600,000 annual spend (16 units). Rate ranges from $3,000/unit/yr (small) down to $850.80/unit/yr (large).",
    type: "number",
    placeholder: "e.g. 4000000",
    unit: "USD / year",
  },
  // ── 9. Primary business driver ────────────────────────────────────────────
  {
    key: "turbonomicDriver",
    conditional: (a) => String(a.turbonomicAction ?? "quote") === "quote",
    ask: "What is the primary driver for this Turbonomic conversation?",
    type: "single",
    options: [
      { label: "Cloud cost reduction / FinOps", value: "cost" },
      { label: "Application performance assurance", value: "performance" },
      { label: "Both cost and performance", value: "both" },
    ],
  },
  // ── 10. APM / observability pain-point (cross-sell hook) ─────────────────
  {
    key: "turbonomicAPMNeed",
    conditional: (a) =>
      String(a.turbonomicAction ?? "quote") === "quote" &&
      String(a.turbonomicUseCase ?? "vmware") !== "parking",
    ask: "Does the customer want application-level visibility alongside resource optimization?",
    subtext: "Application performance monitoring (APM) paired with Turbonomic makes every resource decision application-aware — it won't right-size something causing latency or errors.",
    type: "single",
    options: [
      { label: "No — infrastructure optimization is sufficient", value: "no" },
      { label: "Yes — they want app-level performance insights too", value: "yes" },
      { label: "They already have an APM solution", value: "has_apm" },
    ],
  },
  // ── 11. Existing APM solution ─────────────────────────────────────────────
  {
    key: "turbonomicExistingAPM",
    conditional: (a) =>
      String(a.turbonomicAction ?? "quote") === "quote" &&
      String(a.turbonomicAPMNeed ?? "no") === "has_apm",
    ask: "What APM solution does the customer currently use?",
    type: "single",
    options: [
      { label: "IBM Instana", value: "instana", hint: "Native integration — one-click setup from Instana Optimizations tab" },
      { label: "Dynatrace", value: "dynatrace" },
      { label: "Datadog", value: "datadog" },
      { label: "AppDynamics / Cisco", value: "appdynamics" },
      { label: "New Relic", value: "newrelic" },
      { label: "Other / not sure", value: "other" },
    ],
  },
  // ── 12. Services — first-time or existing deployment ─────────────────────
  {
    key: "turbonomicDeploymentHistory",
    conditional: (a) =>
      String(a.turbonomicAction ?? "quote") === "quote" &&
      (String(a.turbonomicDeployment ?? "SaaS") === "SaaS" || String(a.turbonomicDeployment ?? "SaaS") === "SaaSGov") &&
      String(a.turbonomicUseCase ?? "vmware") !== "parking",
    ask: "Is this the customer's first Turbonomic deployment?",
    subtext: "Implementation services drive faster ROI, better adoption, and higher renewal rates.",
    type: "single",
    options: [
      { label: "Yes — first-time deployment", value: "first", hint: "Recommend Install + Build SaaS services" },
      { label: "No — expanding an existing deployment", value: "existing", hint: "Perform SaaS may be appropriate" },
    ],
  },
];

// ─── IBM HASHICORP TERRAFORM ──────────────────────────────────────────────────

export const TERRAFORM_QUESTIONS: Question[] = [
  {
    key: "terraformDeployment",
    conditional: (a) => String(a.terraformAction ?? "quote") === "quote",
    ask: "Does the client need to run Terraform inside their own data centre, or can IBM/HashiCorp host it?",
    type: "single",
    options: [
      { label: "IBM/HashiCorp hosts it — cloud SaaS", value: "HCP", hint: "Most common — nothing to install, includes a free tier" },
      { label: "Client hosts it themselves", value: "Enterprise", hint: "Required for air-gapped networks, sovereign clouds, or strict data residency rules" },
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
    ask: "Does the client need automated guardrails that block unsafe infrastructure changes before they are deployed?",
    subtext: "For example: 'no public S3 buckets', 'all resources must be tagged', or 'only approved regions allowed'. This is called policy-as-code.",
    type: "single",
    options: [
      { label: "No — teams just need a shared place to run Terraform", value: "none" },
      { label: "Yes — enforce rules that block bad changes before they go out", value: "governance", hint: "Policy-as-code with Sentinel or OPA" },
      { label: "Yes — plus a full audit trail of every change ever made", value: "audit", hint: "Required for SOC 2, PCI, or regulated environments" },
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
    key: "concertDeployment",
    conditional: (a) => String(a.concertAction ?? "quote") === "quote",
    ask: "Will IBM host Concert, or will the client run it in their own environment?",
    subtext: "This determines which IBM product and pricing model applies — SaaS and on-prem are priced very differently.",
    type: "single",
    options: [
      { label: "IBM hosts it — cloud SaaS", value: "saas", hint: "PID 5900BD6 — ~$1.06/RU/year" },
      { label: "Client hosts it — on-premises or self-managed", value: "onprem", hint: "PID 5900BBE — $212/RU/year subscription" },
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
    key: "concertResilience",
    conditional: (a) => String(a.concertAction ?? "quote") === "quote",
    ask: "Does the client need application resilience posture assessment?",
    subtext: "Concert Resilience evaluates app resilience posture (5 RU per app).",
    type: "single",
    options: [
      { label: "No", value: "no" },
      { label: "Yes — resilience posture assessment in scope", value: "yes" },
    ],
  },
  {
    key: "concertApplications",
    conditional: (a) => String(a.concertAction ?? "quote") === "quote",
    ask: "How many applications or services are in scope?",
    subtext: "Used to size Concert Protect (3 RU/app) and Concert Resilience (5 RU/app) if selected.",
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
    key: "concertWorkflows",
    conditional: (a) =>
      String(a.concertAction ?? "quote") === "quote" && String(a.concertAutomation ?? "no") === "yes",
    ask: "How many automated remediation workflows will be deployed in production?",
    subtext: "Concert Workflows: 5 RU per deployed workflow in production.",
    type: "number",
    placeholder: "e.g. 10",
    unit: "workflows",
  },
  {
    key: "concertMVS",
    conditional: (a) => String(a.concertAction ?? "quote") === "quote",
    ask: "How many hosts or VMs will Concert monitor and optimize?",
    subtext: "Used to size Concert Observe (1 RU/7 MVS Essentials or 1 RU/2 MVS Standard) and Concert Optimize (1 RU/5 MVS).",
    type: "number",
    placeholder: "e.g. 500",
    unit: "MVS (hosts / VMs)",
  },
  {
    key: "concertObserveTier",
    conditional: (a) =>
      String(a.concertAction ?? "quote") === "quote" && parseFloat(String(a.concertMVS ?? 0)) > 0,
    ask: "Does the client need to monitor application performance (response times, errors, traces) or just server and infrastructure health?",
    subtext: "Application performance monitoring tracks how code behaves end-to-end. Infrastructure monitoring tracks CPU, memory, and host health only.",
    type: "single",
    options: [
      { label: "Application performance AND infrastructure — full-stack visibility", value: "standard", hint: "Tracks code, transactions, and traces as well as host health" },
      { label: "Infrastructure health only — servers, VMs, Kubernetes nodes", value: "essentials", hint: "Host and resource monitoring only, no application tracing" },
    ],
  },
];

// ─── IBM WEBMETHODS ───────────────────────────────────────────────────────────

export const WEBMETHODS_QUESTIONS: Question[] = [
  {
    key: "webMethodsNeeds",
    conditional: (a) => String(a.webMethodsAction ?? "quote") === "quote",
    ask: "What integration capabilities does the client need?",
    subtext: "Select all that apply.",
    type: "multi",
    options: [
      { label: "Application integration (SaaS, cloud, on-prem)", value: "appIntegration", hint: "Budgetary reference: ~$92/1K txn/yr" },
      { label: "API management and governance", value: "apiManagement", hint: "Budgetary reference: ~$100/10K API txn/yr" },
      { label: "B2B / EDI partner integration", value: "b2b", hint: "Budgetary reference: ~$75/1K txn/yr" },
      { label: "Managed File Transfer (MFT)", value: "mft", hint: "Budgetary reference: ~$85/1K file txn/yr" },
      { label: "Event-driven / streaming integration", value: "eventDriven", hint: "Routes to IBM Event Automation (separate product)" },
    ],
  },
  {
    key: "webMethodsIntTxn",
    conditional: (a) => {
      const needs = Array.isArray(a.webMethodsNeeds) ? a.webMethodsNeeds as string[] : [];
      return String(a.webMethodsAction ?? "quote") === "quote" && needs.includes("appIntegration");
    },
    ask: "How many integration transactions does the client run per month?",
    subtext: "Budgetary reference rate: ~$92 per 1,000 transactions/year (IBM SaaS Calculator Oct 2024 snapshot — verify current rate with IBM before formal quoting).",
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
    subtext: "Budgetary reference rate: ~$100 per 10,000 API transactions/year (IBM SaaS Calculator Oct 2024 snapshot — verify current rate with IBM before formal quoting).",
    type: "number",
    placeholder: "e.g. 500000",
    unit: "API transactions / month",
  },
  {
    key: "webMethodsB2bTxn",
    conditional: (a) => {
      const needs = Array.isArray(a.webMethodsNeeds) ? a.webMethodsNeeds as string[] : [];
      return String(a.webMethodsAction ?? "quote") === "quote" && needs.includes("b2b");
    },
    ask: "How many B2B / EDI transactions does the client process per month?",
    subtext: "Budgetary reference rate: ~$75 per 1,000 transactions/year (IBM SaaS Calculator Oct 2024 snapshot — verify current rate with IBM before formal quoting).",
    type: "number",
    placeholder: "e.g. 50000",
    unit: "B2B transactions / month",
  },
  {
    key: "webMethodsMftTxn",
    conditional: (a) => {
      const needs = Array.isArray(a.webMethodsNeeds) ? a.webMethodsNeeds as string[] : [];
      return String(a.webMethodsAction ?? "quote") === "quote" && needs.includes("mft");
    },
    ask: "How many file transfer transactions does the client perform per month?",
    subtext: "Budgetary reference rate: ~$85 per 1,000 file-transfer transactions/year (IBM SaaS Calculator Oct 2024 snapshot — verify current rate with IBM before formal quoting).",
    type: "number",
    placeholder: "e.g. 50000",
    unit: "file transfer transactions / month",
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
