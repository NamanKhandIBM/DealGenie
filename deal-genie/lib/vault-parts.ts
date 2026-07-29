// Vault part numbers, best practices, and guided tutorial for SAP CPQ quoting

export interface VaultPartNumber {
  partNumber: string;
  description: string;
  unit: string;
  category: 'Vault 2.0 - Consumption/RU' | 'Add-ons';
  notes?: string;
}

export const VAULT_ALL_PARTS: VaultPartNumber[] = [
  // Vault 2.0 — Consumption/RU-based (the only quoting model)
  {
    partNumber: 'D15FQZX',
    description: 'Vault 2.0 Standard Install',
    unit: 'per Install/year',
    category: 'Vault 2.0 - Consumption/RU',
    notes: 'Required, min 1 per production cluster'
  },
  {
    partNumber: 'D15FKZX',
    description: 'Vault 2.0 Resource Unit (RU)',
    unit: 'per RU/month',
    category: 'Vault 2.0 - Consumption/RU',
    notes: 'Consumption unit — priced on secrets stored, certs issued, credentials rotated'
  },
  {
    partNumber: 'D155GZX',
    description: 'Vault 2.0 Non-Production Install',
    unit: 'per Install/year',
    category: 'Vault 2.0 - Consumption/RU',
    notes: 'Dev/test environment'
  },
  {
    partNumber: 'D155LZX',
    description: 'Vault 2.0 Standard incl. KMIP Install',
    unit: 'per Install/year',
    category: 'Vault 2.0 - Consumption/RU',
    notes: 'Replaces standard install when KMIP key management is needed'
  },
  {
    partNumber: 'D1556ZX',
    description: 'Vault 2.0 Custom Plugin Install',
    unit: 'per Plugin/year',
    category: 'Vault 2.0 - Consumption/RU',
    notes: 'Per custom plugin required'
  },
  {
    partNumber: 'D15FNZX',
    description: 'Vault 2.0 RU Monthly License',
    unit: 'per RU/month',
    category: 'Vault 2.0 - Consumption/RU',
    notes: 'Short-term only, max 3 months/calendar year'
  },

  // Add-ons
  {
    partNumber: 'D1406ZX',
    description: 'Vault PKI Certificate Add-On Install',
    unit: 'per Install/year',
    category: 'Add-ons',
    notes: 'Requires Vault Install+Clients & v1.21+'
  },
  {
    partNumber: 'D1405ZX',
    description: 'Vault Client PKI Certificate Add-On RVU',
    unit: 'per RVU/year',
    category: 'Add-ons',
    notes: 'Per PKI certificate issued'
  },
  {
    partNumber: 'D1013ZX',
    description: 'Vault ADP – Key Management',
    unit: 'per Install/year',
    category: 'Add-ons',
    notes: 'Per cluster needing KMIP'
  },
  {
    partNumber: 'D1014ZX',
    description: 'Vault ADP – Transform',
    unit: 'per RVU (Client)/year',
    category: 'Add-ons',
    notes: 'Subset of total Vault Clients'
  }
];

export interface VaultBestPractice {
  category: string;
  question: string;
  rationale: string;
  tips: string[];
}

export const VAULT_BEST_PRACTICES: VaultBestPractice[] = [
  {
    category: 'Vault 2.0 — Consumption-Based Pricing',
    question: 'How does Vault 2.0 pricing work?',
    rationale: 'Vault 2.0 charges based on what Vault does — secrets stored, credentials rotated, certificates issued, API calls made — not how many apps connect. This makes it far more predictable for Kubernetes and cloud-native environments where the number of clients can explode.',
    tips: [
      'Requires Vault 2.0 (April 2026 release) and Census reporting enabled',
      'Census = automated monthly license utilisation reporting to IBM — required for this model',
      'Two parts: Install (D15FQZX, $96K/cluster/yr) + Resource Units (D15FKZX, $48/RU/month)',
      'Right-size at renewal using actual Census data from the Vault API or Sigma reports',
      'Ask: "Is the client on Vault 2.0 or willing to upgrade before signing?" — if no, contact IBM'
    ]
  },
  {
    category: 'Use Case Discovery',
    question: 'What secrets management use cases does the client need?',
    rationale: 'Different use cases drive different RU consumption patterns in Model A. Understanding all use cases ensures accurate sizing.',
    tips: [
      'Static secrets: Application passwords, API keys, database credentials',
      'Dynamic credentials: Database users, cloud IAM roles that rotate automatically',
      'PKI certificates: TLS/SSL certificates for services, microservices mesh',
      'SSH credentials: Temporary SSH access for servers',
      'Encryption operations: Transit encryption, data transformation',
      'KMIP: External key management for databases, storage systems',
      'Ask: "What types of secrets do you need to manage?" and "How often do they change?"'
    ]
  },
  {
    category: 'Sizing - Model A (RU)',
    question: 'How do we calculate Resource Units (RU) for Model A?',
    rationale: 'RU calculation is based on actual usage patterns. The tool derives RU automatically from plain inputs - sellers never calculate RU manually.',
    tips: [
      'Static secrets: 1 secret = 1 RU (monthly high-water mark)',
      'Dynamic roles: 1 role = 1 RU',
      'PKI certs: RU = CEIL(certs/month × (lifetime_hours ÷ 730))',
      'SSH creds: Same formula as PKI',
      'Transit/Transform: 150,000 API calls = 1 RU',
      'KMIP keys: 1 key = 1 RU (monthly high-water)',
      'Example: 1000 static secrets + 50 dynamic roles + 500 PKI certs/month (720h lifetime) = 1000 + 50 + 493 = 1,543 RU/month'
    ]
  },
  {
    category: 'Sizing - Model B (Clients)',
    question: 'How do we count Clients for Model B?',
    rationale: 'A "Client" is any unique application, service, or user that authenticates to Vault. Accurate client counting is critical for pricing.',
    tips: [
      'Count unique applications/services, not instances (10 instances of same app = 1 client)',
      'Count unique users if using Vault for user authentication',
      'Include all environments (prod + non-prod) in client count',
      'Ask: "How many unique applications or services will connect to Vault?"',
      'Ask: "Do you have microservices? How many unique services?"',
      'Common mistake: Counting container instances instead of unique services'
    ]
  },
  {
    category: 'Edition Selection (Model B)',
    question: 'Which edition should the client choose?',
    rationale: 'Essentials, Standard, and Premium offer different features and discount levels. Premium requires ≥2 installs for DR/replication.',
    tips: [
      'Essentials: Basic features, 50% discount on install',
      'Standard: Most common, includes namespaces, 55% discount',
      'Premium: DR replication, performance replication, 60% discount, requires ≥2 installs',
      'Ask: "Do you need disaster recovery or multi-region deployment?" → Premium',
      'Ask: "Do you need namespace isolation for teams?" → Standard or Premium',
      'Most customers choose Standard unless they need DR'
    ]
  },
  {
    category: 'High Availability & DR',
    question: 'Does the client need HA or disaster recovery?',
    rationale: 'Production deployments typically need HA (3-5 nodes in one cluster). DR requires Premium edition with ≥2 installs.',
    tips: [
      'HA (single cluster): 3-5 nodes recommended, counts as 1 install',
      'DR (multi-cluster): Requires Premium edition, ≥2 installs (primary + DR)',
      'Performance replication: Premium only, for read-heavy workloads across regions',
      'Ask: "What are your uptime requirements?" (HA)',
      'Ask: "Do you need to survive a datacenter failure?" (DR)',
      'Non-production: Usually single node, use D155GZX or D1018ZX'
    ]
  },
  {
    category: 'Add-ons & Advanced Features',
    question: 'Does the client need PKI, KMIP, or Transform capabilities?',
    rationale: 'Advanced features require additional SKUs. PKI and Transform are common add-ons.',
    tips: [
      'PKI Add-on: For issuing certificates, requires v1.21+, use D1406ZX + D1405ZX',
      'KMIP (Model A): Included with D155LZX install (replaces standard install)',
      'KMIP (Model B): Separate add-on D1013ZX per cluster',
      'Transform: Data tokenization/masking, use D1014ZX (subset of clients)',
      'Ask: "Do you need to issue TLS certificates?" → PKI',
      'Ask: "Do you need to encrypt data in databases or storage?" → KMIP or Transform',
      'Custom plugins: D1556ZX per plugin, for specialized integrations'
    ]
  }
];

export interface VaultTutorialStep {
  step: number;
  title: string;
  description: string;
  example: string;
  commonMistakes: string[];
}

export const VAULT_TUTORIAL_STEPS: VaultTutorialStep[] = [
  {
    step: 1,
    title: 'Choose the Pricing Model',
    description: 'Determine whether Model A (Platform/RU) or Model B (Clients/RVU) fits the client\'s needs. This is the most critical decision.',
    example: 'Client has 50 microservices with predictable usage → Model B. Client has variable workload with 1000+ secrets that change frequently → Model A.',
    commonMistakes: [
      'Mixing models for the same customer (not allowed)',
      'Choosing Model A when client count is known and stable',
      'Not asking about usage patterns before selecting model'
    ]
  },
  {
    step: 2,
    title: 'Discover Use Cases',
    description: 'Identify all secrets management use cases: static secrets, dynamic credentials, PKI, SSH, encryption, KMIP.',
    example: 'Client needs: 500 static secrets (API keys), 20 dynamic database roles, 100 PKI certificates/month with 30-day lifetime.',
    commonMistakes: [
      'Only asking about static secrets',
      'Not discovering PKI or dynamic credential needs',
      'Forgetting to ask about certificate lifetimes'
    ]
  },
  {
    step: 3,
    title: 'Size the Deployment (Model A)',
    description: 'For Model A, collect plain usage numbers. The tool will calculate RU automatically.',
    example: 'Input: 500 static secrets, 20 dynamic roles, 100 PKI certs/month (720h lifetime) → Tool calculates: 500 + 20 + 99 = 619 RU/month',
    commonMistakes: [
      'Trying to calculate RU manually',
      'Using peak instead of average for dynamic workloads',
      'Not accounting for growth over the contract term'
    ]
  },
  {
    step: 4,
    title: 'Count Clients (Model B)',
    description: 'For Model B, count unique applications/services that will authenticate to Vault.',
    example: 'Client has 30 microservices (each counts as 1 client), 5 legacy apps, 10 CI/CD pipelines = 45 clients total.',
    commonMistakes: [
      'Counting container instances instead of unique services',
      'Forgetting CI/CD pipelines, monitoring tools',
      'Not including non-production environments in client count'
    ]
  },
  {
    step: 5,
    title: 'Select Edition (Model B only)',
    description: 'Choose Essentials, Standard, or Premium based on features needed.',
    example: 'Client needs DR across two datacenters → Premium edition, 2 installs minimum.',
    commonMistakes: [
      'Choosing Premium without buying ≥2 installs',
      'Not asking about DR requirements upfront',
      'Underestimating the value of namespace isolation (Standard+)'
    ]
  },
  {
    step: 6,
    title: 'Add Non-Production & Add-ons',
    description: 'Include non-production environments and any advanced features (PKI, KMIP, Transform, custom plugins).',
    example: 'Add D155GZX (Model A) or D1018ZX (Model B) for dev/test. Add D1406ZX + D1405ZX for PKI certificates.',
    commonMistakes: [
      'Forgetting non-production environments',
      'Not asking about PKI certificate needs',
      'Missing KMIP requirements for database encryption'
    ]
  },
  {
    step: 7,
    title: 'Review & Validate',
    description: 'Review the complete quote with the client. Confirm all use cases are covered and sizing is accurate.',
    example: 'Walk through each line item: "This covers your 500 static secrets and 20 database roles. The PKI add-on handles your certificate issuance needs."',
    commonMistakes: [
      'Not explaining RU or Client calculations to the customer',
      'Forgetting to mention that models cannot be mixed',
      'Not planning for growth (recommend 20-30% buffer)'
    ]
  }
];

export interface VaultQuickReference {
  topic: string;
  content: string;
}

export const VAULT_QUICK_REFERENCE: VaultQuickReference[] = [
  {
    topic: 'Vault 2.0 Pricing Model',
    content: 'Consumption-based: priced on what Vault does. Install (D15FQZX, $96K/cluster/yr) + Resource Units (D15FKZX, $48/RU/month). Requires Vault 2.0 + Census reporting enabled.'
  },
  {
    topic: 'RU Calculation',
    content: '1 static secret = 1 RU | 1 dynamic role = 1 RU | PKI: CEIL(certs/mo × lifetime_hrs ÷ 730) | Transit: 150K calls = 1 RU | 1 KMIP key = 1 RU'
  },
  {
    topic: 'Census Requirement',
    content: 'Census is mandatory for Vault 2.0 — sends monthly licence utilisation to IBM automatically. Must be enabled at or before contract signing. No exceptions.'
  },
  {
    topic: 'Common Add-ons',
    content: 'Non-prod: D155GZX | PKI: D1406ZX install + D1405ZX per cert | KMIP (with KMIP Install): D155LZX | Custom plugins: D1556ZX'
  }
];

// Made with Bob
