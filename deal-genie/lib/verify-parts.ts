// Verify part numbers, best practices, and guided tutorial for SAP CPQ quoting

export interface VerifyPartNumber {
  partNumber: string;
  description: string;
  unit: string;
  category: 'Core' | 'Add-ons';
  notes?: string;
}

export const VERIFY_ALL_PARTS: VerifyPartNumber[] = [
  // Core
  {
    partNumber: 'D0231ZX',
    description: 'IBM Security Verify SaaS Resource Unit (RU)',
    unit: 'per RU/year',
    category: 'Core',
    notes: 'Required - Usage-based pricing for all capabilities'
  },
  
  // Add-ons
  {
    partNumber: 'D02T6ZX',
    description: 'SMS and Email MFA Only',
    unit: 'per event per thousand',
    category: 'Add-ons',
    notes: 'For SMS/Email MFA authentication events'
  },
  {
    partNumber: 'D01UQZX',
    description: 'Hosted Application Gateway',
    unit: 'per instance/month',
    category: 'Add-ons',
    notes: 'For legacy app integration'
  },
  {
    partNumber: 'D01URZX',
    description: 'Vanity Domain',
    unit: 'per instance/month',
    category: 'Add-ons',
    notes: 'Custom branded domain for login pages'
  },
  {
    partNumber: 'D22PGLL',
    description: 'Non-Production with SLA',
    unit: 'per instance/month',
    category: 'Add-ons',
    notes: 'Dev/test environment with SLA'
  },
  {
    partNumber: 'D21CWLL',
    description: 'Non-Production without SLA',
    unit: 'per instance/month',
    category: 'Add-ons',
    notes: 'Dev/test environment without SLA'
  }
];

export interface VerifyBestPractice {
  category: string;
  question: string;
  rationale: string;
  tips: string[];
}

export const VERIFY_BEST_PRACTICES: VerifyBestPractice[] = [
  {
    category: 'User Population Discovery',
    question: 'What is the total user population and login frequency?',
    rationale: 'Verify pricing is based on Monthly Active Users (MAU), which is calculated from total population and average logins per year. Accurate population and login frequency are critical for sizing.',
    tips: [
      'Ask: "How many total users will have access to the system?" (employees, customers, partners)',
      'Ask: "How often do users typically log in per year?" (daily = 250, weekly = 52, monthly = 12)',
      'MAU formula: ROUNDUP(population × MIN(avgLogins, 12) ÷ 12)',
      'Example: 10,000 users logging in 100 times/year → MAU = CEIL(10,000 × 12 ÷ 12) = 10,000',
      'Example: 50,000 users logging in 4 times/year → MAU = CEIL(50,000 × 4 ÷ 12) = 16,667',
      'Common mistake: Using total population instead of MAU'
    ]
  },
  {
    category: 'Capability Selection',
    question: 'Which Verify capabilities does the client need?',
    rationale: 'Verify offers 5 capabilities: SSO, MFA, Adaptive Access, Lifecycle Management, and Analytics. Each capability consumes RU based on graduated tiers. Understanding all needed capabilities ensures accurate pricing.',
    tips: [
      'SSO: Single sign-on for web/mobile apps (most common)',
      'MFA: Multi-factor authentication (TOTP, SMS, email, biometric)',
      'Adaptive Access: Risk-based authentication, context-aware policies',
      'Lifecycle: User provisioning, deprovisioning, access reviews (requires managed users)',
      'Analytics: User behavior analytics, reporting, dashboards (requires managed users)',
      'Ask: "Do you need single sign-on?" → SSO',
      'Ask: "Do you need multi-factor authentication?" → MFA',
      'Ask: "Do you need risk-based authentication?" → Adaptive',
      'Ask: "Do you need to manage user accounts and access?" → Lifecycle',
      'Ask: "Do you need user activity reporting?" → Analytics'
    ]
  },
  {
    category: 'MAU vs Managed Users',
    question: 'Does the client need Lifecycle or Analytics capabilities?',
    rationale: 'SSO, MFA, and Adaptive use MAU as the driver. Lifecycle and Analytics use Managed Users (subset of population that Verify actively manages). This distinction is critical for RU calculation.',
    tips: [
      'MAU capabilities: SSO, MFA, Adaptive (based on login activity)',
      'Managed User capabilities: Lifecycle, Analytics (based on accounts managed)',
      'Managed Users ≤ Total Population (usually much smaller)',
      'Ask: "How many user accounts will Verify create and manage?" → Managed Users',
      'Example: 100,000 total users, but only 5,000 employees managed by Verify → 5,000 managed users',
      'Common mistake: Using MAU for Lifecycle/Analytics (should use managed users)',
      'If client needs Lifecycle/Analytics, MUST ask for managed user count'
    ]
  },
  {
    category: 'RU Calculation',
    question: 'How are Resource Units (RU) calculated?',
    rationale: 'Verify uses graduated bracket pricing (like tax brackets). Each capability has different rates per tier. The tool calculates RU automatically using the graduated formula.',
    tips: [
      'RU calculation uses graduated tiers (not flat rate)',
      'Lower tiers have higher per-unit rates, higher tiers have lower rates',
      'Example tiers: 0-500 (Tier 1), 501-5,000 (Tier 2), 5,001-10,000 (Tier 3), etc.',
      'SSO example: 1,000 MAU → (500 × 0.10) + (500 × 0.08) = 50 + 40 = 90 RU',
      'Multiple capabilities: RU adds up (SSO + MFA for 1,000 MAU = 90 + 90 = 180 RU)',
      'The tool handles all bracket math automatically - sellers never calculate manually',
      'Always round UP the final RU (CEIL function)'
    ]
  },
  {
    category: 'Multi-Region Deployments',
    question: 'Does the client need Verify in multiple regions?',
    rationale: 'Verify can be deployed in multiple geographic regions for performance and data residency. Each region multiplies the RU cost.',
    tips: [
      'Ask: "Do you need Verify deployed in multiple geographic regions?"',
      'Ask: "Do you have data residency requirements?" (GDPR, data sovereignty)',
      'Common regions: US, EU, Asia-Pacific, Canada, Australia',
      'Region multiplier: Total RU × number of regions',
      'Example: 100 RU in 3 regions = 100 × 3 = 300 RU total',
      'Most customers use 1 region unless they have compliance requirements',
      'Multi-region adds cost but improves performance for global users'
    ]
  },
  {
    category: 'Add-ons & Advanced Features',
    question: 'Does the client need SMS/Email MFA, Application Gateway, or Vanity Domain?',
    rationale: 'Common add-ons include SMS/Email MFA (per-event pricing), Application Gateway (for legacy apps), and Vanity Domain (custom branding). These are separate SKUs.',
    tips: [
      'SMS/Email MFA (D02T6ZX): Per-event pricing, use when TOTP/biometric not sufficient',
      'Application Gateway (D01UQZX): For legacy apps that can\'t use modern auth protocols',
      'Vanity Domain (D01URZX): Custom branded login URL (login.company.com)',
      'Non-Production: D22PGLL (with SLA) or D21CWLL (without SLA)',
      'Ask: "Do you need SMS or email for MFA?" → D02T6ZX',
      'Ask: "Do you have legacy applications that need SSO?" → D01UQZX',
      'Ask: "Do you want a custom branded login page?" → D01URZX',
      'Ask: "Do you need a dev/test environment?" → D22PGLL or D21CWLL'
    ]
  },
  {
    category: 'Contract Term',
    question: 'What contract term does the client prefer?',
    rationale: 'Verify offers 12-month and 3-year terms. 3-year terms provide better pricing but require longer commitment.',
    tips: [
      'Standard term: 12 months (annual renewal)',
      '3-year term: Better pricing, longer commitment',
      'Ask: "Are you comfortable with a 3-year commitment for better pricing?"',
      'For 3-year: Multiply annual list × 3 for total opportunity value',
      'Most customers start with 12-month, move to 3-year on renewal',
      'Growth planning: Recommend 20-30% buffer for user growth over term'
    ]
  }
];

export interface VerifyTutorialStep {
  step: number;
  title: string;
  description: string;
  example: string;
  commonMistakes: string[];
}

export const VERIFY_TUTORIAL_STEPS: VerifyTutorialStep[] = [
  {
    step: 1,
    title: 'Discover User Population',
    description: 'Identify the total user population and their login frequency. This determines MAU.',
    example: 'Client has 25,000 employees who log in daily (250 times/year) → MAU = CEIL(25,000 × 12 ÷ 12) = 25,000',
    commonMistakes: [
      'Not asking about login frequency',
      'Using total population instead of MAU',
      'Forgetting to cap avgLogins at 12 in the formula'
    ]
  },
  {
    step: 2,
    title: 'Identify Required Capabilities',
    description: 'Determine which of the 5 capabilities the client needs: SSO, MFA, Adaptive, Lifecycle, Analytics.',
    example: 'Client needs SSO for 50 apps, MFA for security, and Adaptive for risk-based auth → Select SSO, MFA, Adaptive',
    commonMistakes: [
      'Only asking about SSO, missing MFA/Adaptive needs',
      'Not explaining the difference between capabilities',
      'Assuming all capabilities are needed'
    ]
  },
  {
    step: 3,
    title: 'Determine Managed Users (if needed)',
    description: 'If client needs Lifecycle or Analytics, ask how many users Verify will actively manage.',
    example: 'Client has 100,000 customers (MAU) but only 2,000 employees managed by Verify → 2,000 managed users for Lifecycle',
    commonMistakes: [
      'Using MAU for Lifecycle/Analytics (should use managed users)',
      'Not asking about managed users when Lifecycle/Analytics selected',
      'Confusing managed users with total population'
    ]
  },
  {
    step: 4,
    title: 'Calculate RU',
    description: 'The tool calculates RU using graduated bracket pricing. Review the breakdown to ensure it makes sense.',
    example: 'SSO for 5,000 MAU: (500 × 0.10) + (4,500 × 0.08) = 50 + 360 = 410 RU',
    commonMistakes: [
      'Trying to calculate RU manually',
      'Using flat rate instead of graduated tiers',
      'Not rounding up the final RU'
    ]
  },
  {
    step: 5,
    title: 'Check for Multi-Region',
    description: 'Ask if the client needs Verify in multiple geographic regions for performance or compliance.',
    example: 'Client needs US and EU regions for GDPR compliance → 2 regions, multiply RU × 2',
    commonMistakes: [
      'Not asking about data residency requirements',
      'Forgetting to apply region multiplier',
      'Assuming all customers need multi-region'
    ]
  },
  {
    step: 6,
    title: 'Add Optional Features',
    description: 'Identify if client needs SMS/Email MFA, Application Gateway, Vanity Domain, or Non-Production.',
    example: 'Client wants SMS MFA for 10,000 events/month and custom branded login → Add D02T6ZX and D01URZX',
    commonMistakes: [
      'Not asking about SMS/Email MFA needs',
      'Forgetting Application Gateway for legacy apps',
      'Not offering Vanity Domain for branding'
    ]
  },
  {
    step: 7,
    title: 'Review & Validate',
    description: 'Walk through the complete quote with the client. Confirm MAU calculation, capabilities, and add-ons.',
    example: 'Review: "Based on 25,000 users logging in daily, your MAU is 25,000. With SSO and MFA, your total is 450 RU at $281.40/RU = $126,630/year."',
    commonMistakes: [
      'Not explaining MAU calculation to customer',
      'Not planning for user growth',
      'Forgetting to mention 3-year term option for better pricing'
    ]
  }
];

export interface VerifyQuickReference {
  topic: string;
  content: string;
}

export const VERIFY_QUICK_REFERENCE: VerifyQuickReference[] = [
  {
    topic: 'MAU Calculation',
    content: 'MAU = ROUNDUP(population × MIN(avgLogins, 12) ÷ 12). Example: 10,000 users × 100 logins/year = CEIL(10,000 × 12 ÷ 12) = 10,000 MAU'
  },
  {
    topic: 'Capabilities',
    content: 'SSO/MFA/Adaptive: Use MAU | Lifecycle/Analytics: Use Managed Users | Select only what client needs | Multiple capabilities add up RU'
  },
  {
    topic: 'RU Pricing',
    content: 'Graduated tiers (like tax brackets). Lower tiers = higher rate, higher tiers = lower rate. Tool calculates automatically. Always round UP final RU.'
  },
  {
    topic: 'Common Add-ons',
    content: 'SMS/Email MFA: D02T6ZX | App Gateway: D01UQZX | Vanity Domain: D01URZX | Non-Prod with SLA: D22PGLL | Non-Prod no SLA: D21CWLL'
  }
];

// Made with Bob
