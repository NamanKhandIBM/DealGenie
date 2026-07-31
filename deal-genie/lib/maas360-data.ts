import type { Product } from "./types";

export interface MaaS360Plan {
  key: string;
  label: string;
  monthlyPerDevice: number;
  annualPerDevice: number;
  summary: string;
  includes: string[];
}

export interface MaaS360Addon {
  key: string;
  label: string;
  monthlyPerDevice?: number;
  annualPerDevice?: number;
  oneTime?: number;
  summary: string;
}

export const MAAS360_PLANS: MaaS360Plan[] = [
  {
    key: "Essentials",
    label: "Essentials",
    monthlyPerDevice: 4.24,
    annualPerDevice: 50.88,
    summary: "Core UEM for users, smartphones, tablets, laptops, and apps.",
    includes: [
      "Device Mgmt & App Mgmt",
      "Identity Management",
      "AI & Analytics Advisor",
      "Policy Recommendation Engine",
      "User Risk Management",
      "Mobile Expense Management",
      "Granular Patch Management",
    ],
  },
  {
    key: "Deluxe",
    label: "Deluxe",
    monthlyPerDevice: 5.3,
    annualPerDevice: 63.6,
    summary: "Adds email and chat containerization for separated business data.",
    includes: [
      "Essentials+",
      "Security-rich Mobile Mail",
      "Enterprise Email",
      "AI Chatbot & Voice Assistant",
    ],
  },
  {
    key: "Premier",
    label: "Premier",
    monthlyPerDevice: 6.63,
    annualPerDevice: 79.56,
    summary: "Adds enterprise browser, application security, and protected network access.",
    includes: [
      "Deluxe+",
      "Business Dashboard for Apps",
      "OS VPN & Enterprise Browser",
      "App Security",
      "Content Management",
      "Gateway: Browser, Docs & Apps",
      "Enterprise Container",
    ],
  },
  {
    key: "Enterprise",
    label: "Enterprise",
    monthlyPerDevice: 9.54,
    annualPerDevice: 114.48,
    summary: "Top package for enterprise protection and productivity.",
    includes: [
      "Premier+",
      "Mobile Threat Management",
      "Application Patching",
      "Mobile Document Editor",
      "Mobile Document Sync",
    ],
  },
];

export const MAAS360_ADDONS: MaaS360Addon[] = [
  {
    key: "mtdAdvanced",
    label: "Mobile Threat Defense Advanced",
    monthlyPerDevice: 3.71,
    annualPerDevice: 44.52,
    summary: "Adds advanced endpoint threat analytics and policy protection.",
  },
  {
    key: "teamViewer",
    label: "TeamViewer Remote Support",
    monthlyPerDevice: 1,
    annualPerDevice: 12,
    summary: "Adds secure remote support for mobile devices and laptops.",
  },
  {
    key: "conciergeSetup",
    label: "Concierge customer setup service",
    oneTime: 500,
    summary: "One-time deployment assistance for enrollment, policies, and setup.",
  },
];

export const MAAS360_OVERAGE_MONTHLY_PER_DEVICE = 4.66;

export const VERIFY_MAAS360_VALUE_POINTS = [
  "Identity policy plus device posture gives sellers a strong zero-trust story.",
  "Helps reduce unmanaged-device access gaps before they become compliance or breach issues.",
  "Creates a cleaner conversation with CISOs and IT operations by connecting user trust and endpoint trust.",
];

export function formatMaaS360PlanLabel(planKey: string): string {
  return MAAS360_PLANS.find((plan) => plan.key === planKey)?.label ?? planKey;
}

export function getProductDisplayName(product: Product): string {
  if (product === "Verify") return "IBM Security Verify";
  if (product === "NS1") return "NS1 Connect";
  if (product === "Vault") return "IBM HashiCorp Vault";
  if (product === "Instana") return "IBM Instana Observability";
  if (product === "Turbonomic") return "IBM Turbonomic";
  if (product === "Terraform") return "IBM HashiCorp Terraform";
  if (product === "Concert") return "IBM Concert";
  if (product === "webMethods") return "IBM webMethods Integration";
  return "IBM MaaS360";
}
