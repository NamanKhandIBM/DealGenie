import { MAAS360_ADDONS, MAAS360_PLANS, type MaaS360Addon } from "./maas360-data";

export interface MaaS360RecommendationInput {
  secureMail: boolean;
  advancedApps: boolean;
  threatDefense: boolean;
  remoteSupport: boolean;
}

export interface MaaS360RecommendationResult {
  planKey: string;
  reasons: string[];
  addOnKeys: string[];
}

export interface MaaS360EstimateInput {
  devices: number;
  planKey: string;
  addOnKeys: string[];
  includeConcierge: boolean;
}

export interface MaaS360EstimateLine {
  label: string;
  quantity: number;
  annualList: number;
  notes: string;
}

export interface MaaS360EstimateResult {
  planLabel: string;
  devices: number;
  monthlyList: number;
  annualList: number;
  lines: MaaS360EstimateLine[];
  flags: string[];
}

function findAddon(key: string): MaaS360Addon | undefined {
  return MAAS360_ADDONS.find((addon) => addon.key === key);
}

export function recommendMaaS360Plan(input: MaaS360RecommendationInput): MaaS360RecommendationResult {
  if (input.threatDefense) {
    return {
      planKey: "Enterprise",
      reasons: [
        "advanced mobile threat protection is a stated requirement",
        "the client is asking for the deepest endpoint security posture",
      ],
      addOnKeys: ["mtdAdvanced", ...(input.remoteSupport ? ["teamViewer"] : [])],
    };
  }

  if (input.advancedApps) {
    return {
      planKey: "Premier",
      reasons: [
        "the client needs secure browser, protected enterprise app access, content management, or app security",
      ],
      addOnKeys: input.remoteSupport ? ["teamViewer"] : [],
    };
  }

  if (input.secureMail) {
    return {
      planKey: "Deluxe",
      reasons: [
        "the client needs secure business email or containerized business apps and data",
      ],
      addOnKeys: input.remoteSupport ? ["teamViewer"] : [],
    };
  }

  return {
    planKey: "Essentials",
    reasons: [
      "the current requirements point to core UEM and policy management rather than advanced app or threat capabilities",
    ],
    addOnKeys: input.remoteSupport ? ["teamViewer"] : [],
  };
}

export function computeMaaS360Estimate(input: MaaS360EstimateInput): MaaS360EstimateResult {
  const devices = Math.max(1, Math.round(input.devices || 1));
  const plan = MAAS360_PLANS.find((item) => item.key === input.planKey) ?? MAAS360_PLANS[0];
  const addOnKeys = Array.from(new Set(input.addOnKeys.filter(Boolean)));
  const lines: MaaS360EstimateLine[] = [
    {
      label: `${plan.label} subscription`,
      quantity: devices,
      annualList: plan.annualPerDevice * devices,
      notes: `$${plan.monthlyPerDevice.toFixed(2)}/device/month public list`,
    },
  ];

  for (const key of addOnKeys) {
    const addon = findAddon(key);
    if (!addon) continue;
    if (addon.annualPerDevice) {
      lines.push({
        label: addon.label,
        quantity: devices,
        annualList: addon.annualPerDevice * devices,
        notes: `$${(addon.monthlyPerDevice ?? addon.annualPerDevice / 12).toFixed(2)}/device/month public add-on`,
      });
    }
  }

  if (input.includeConcierge) {
    const concierge = findAddon("conciergeSetup");
    if (concierge?.oneTime) {
      lines.push({
        label: concierge.label,
        quantity: 1,
        annualList: concierge.oneTime,
        notes: "One-time setup service",
      });
    }
  }

  const annualList = lines.reduce((sum, line) => sum + line.annualList, 0);
  const monthlyList = annualList / 12;

  return {
    planLabel: plan.label,
    devices,
    monthlyList,
    annualList,
    lines,
    flags: [
      "Public-price estimate only — confirm final commercial terms with IBM pricing and CPQ.",
      "MaaS360 release-1 output does not include internal SKU or part-number fidelity.",
    ],
  };
}
