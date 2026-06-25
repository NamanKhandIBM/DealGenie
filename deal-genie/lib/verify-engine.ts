// Verify quoting engine — MAU calculation and graduated bracket RU math.
import {
  VERIFY_RU_TIERS,
  VERIFY_RU_PRICE,
  VERIFY_PARTS,
  type VerifyCapability,
  VERIFY_MAU_CAPABILITIES,
  VERIFY_MANAGED_CAPABILITIES,
} from "./data";
import {
  VERIFY_ALL_PARTS,
  VERIFY_BEST_PRACTICES,
  VERIFY_TUTORIAL_STEPS,
  VERIFY_QUICK_REFERENCE,
  type VerifyPartNumber,
  type VerifyBestPractice,
  type VerifyTutorialStep,
  type VerifyQuickReference
} from "./verify-parts";

export interface VerifyInputs {
  capabilities: VerifyCapability[];
  population: number;
  avgLoginsPerYear: number;
  managedUsers?: number;
  regions?: number;
  addOns?: VerifyAddOn[];
  term?: "12-month" | "3-year";
}

export interface VerifyAddOn {
  part: string;
  quantity: number;
  description: string;
  listPrice: number;
  unit: string;
}

export interface QuoteLine {
  part: string;
  description: string;
  quantity: number;
  unitPrice: number;
  annualList: number;
  rationale: string;
}

export interface VerifyQuoteResult {
  mau: number;
  managedUsers: number;
  lines: QuoteLine[];
  totalRU: number;
  totalAnnualList: number;
  flags: string[];
  partNumbers?: VerifyPartNumber[];
  bestPractices?: VerifyBestPractice[];
  tutorialSteps?: VerifyTutorialStep[];
  quickReference?: VerifyQuickReference[];
}

/**
 * Derive Monthly Active Users.
 *
 * A user who logs in at least once in a given month counts as 1 MAU for that month,
 * regardless of how many times they log in. The driver is the number of distinct
 * months per year the user is active (1–12), not raw login volume.
 *
 * MAU = ROUNDUP(population × MIN(activeMonthsPerYear, 12) / 12)
 */
export function deriveMAU(population: number, activeMonthsPerYear: number): number {
  return Math.ceil((population * Math.min(activeMonthsPerYear, 12)) / 12);
}

/**
 * Apply graduated bracket RU math for a single capability and driver count.
 * Returns { ru, rationale } — RU is already rounded up (cumulative).
 */
function computeCapabilityRU(
  capability: VerifyCapability,
  driverCount: number
): { ru: number; rationale: string } {
  const capKey = capability as keyof (typeof VERIFY_RU_TIERS)[0];

  let remaining = driverCount;
  let totalRaw = 0;
  let prevMax = 0;
  const bracketDetails: string[] = [];

  for (const tier of VERIFY_RU_TIERS) {
    if (remaining <= 0) break;
    const bracketSize = tier.maxUnits - prevMax;
    const unitsInBracket = Math.min(remaining, bracketSize);
    const rate = tier[capKey] as number;
    const contribution = unitsInBracket * rate;
    bracketDetails.push(`${unitsInBracket.toLocaleString()} × ${rate} (tier ${tier.tier})`);
    totalRaw += contribution;
    remaining -= unitsInBracket;
    prevMax = tier.maxUnits;
  }

  const ru = Math.ceil(totalRaw);
  const rationale = bracketDetails.join(" + ") + ` = ${ru} RU`;
  return { ru, rationale };
}

export function computeVerifyQuote(inputs: VerifyInputs): VerifyQuoteResult {
  const regions = inputs.regions ?? 1;
  const mau = deriveMAU(inputs.population, inputs.avgLoginsPerYear);
  const managedUsers = inputs.managedUsers ?? 0;

  let totalRU = 0;
  const capabilityLines: { capability: VerifyCapability; ru: number; rationale: string }[] = [];
  const flags: string[] = [];

  for (const cap of inputs.capabilities) {
    const driver = VERIFY_MAU_CAPABILITIES.includes(cap as typeof VERIFY_MAU_CAPABILITIES[0])
      ? mau
      : managedUsers;

    if (
      VERIFY_MANAGED_CAPABILITIES.includes(cap as typeof VERIFY_MANAGED_CAPABILITIES[0]) &&
      managedUsers === 0
    ) {
      flags.push(
        `${cap}: No managed users provided — using 0. Please confirm the managed user count.`
      );
    }

    const { ru, rationale } = computeCapabilityRU(cap, driver);
    capabilityLines.push({ capability: cap, ru, rationale });
    totalRU += ru;
  }

  totalRU = Math.ceil(totalRU);

  const corePrice = VERIFY_PARTS[0].listPrice; // D0231ZX
  const annualListCore = totalRU * corePrice * regions;

  const lines: QuoteLine[] = [
    {
      part: "D0231ZX",
      description: "IBM Security Verify SaaS Resource Unit (RU)",
      quantity: totalRU,
      unitPrice: corePrice,
      annualList: annualListCore,
      rationale: capabilityLines
        .map((c) => `${c.capability}: ${c.rationale}`)
        .join("; ") + (regions > 1 ? ` × ${regions} region(s)` : ""),
    },
  ];

  let totalAnnualList = annualListCore;

  // Add-ons
  for (const addOn of inputs.addOns ?? []) {
    const addOnAnnual = addOn.listPrice * addOn.quantity;
    lines.push({
      part: addOn.part,
      description: addOn.description,
      quantity: addOn.quantity,
      unitPrice: addOn.listPrice,
      annualList: addOnAnnual,
      rationale: `${addOn.quantity} × $${addOn.listPrice.toLocaleString()} (${addOn.unit})`,
    });
    totalAnnualList += addOnAnnual;
  }

  flags.push("All prices are LIST — confirm exact pricing, discounts, and approval in CPQ.");
  if (regions > 1) flags.push(`Region multiplier applied: ${regions} regions.`);
  if ((inputs.term ?? "12-month") === "3-year") {
    flags.push("3-year term selected — multiply annual list × 3 for total opportunity value.");
  }

  return {
    mau,
    managedUsers,
    lines,
    totalRU,
    totalAnnualList,
    flags,
    partNumbers: VERIFY_ALL_PARTS,
    bestPractices: VERIFY_BEST_PRACTICES,
    tutorialSteps: VERIFY_TUTORIAL_STEPS,
    quickReference: VERIFY_QUICK_REFERENCE
  };
}
