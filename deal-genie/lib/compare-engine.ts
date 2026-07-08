/**
 * compare-engine.ts
 *
 * Deterministic, zero-AI scenario generator.
 * Each product has a hardcoded set of 2–3 "named tiers" that represent
 * meaningful Good / Better / Best configurations.
 *
 * The shared answers (population, term, etc.) are provided by the caller.
 * The engine computes prices by calling the existing pricing engines directly.
 */

import { computeVerifyQuote, type VerifyInputs } from "./verify-engine";
import { computeVaultQuote, type VaultInputsModelA, type VaultInputsModelB } from "./vault-engine";
import { computeNS1Quote, type NS1Inputs } from "./ns1-engine";
import type { Product } from "./types";
import type { VerifyCapability } from "./data";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Scenario {
  /** Human-facing tier name — ordered Premium → Standard → Entry */
  name: string;
  /** Short sentence about what's in this tier */
  tagline: string;
  /** Annual list price computed by the deterministic engine */
  annualList: number;
  /** Monthly equivalent */
  monthlyList: number;
  /** Key differences vs entry scenario (auto-derived) */
  drivers: string[];
  /** Which inputs were used (for display in diff table) */
  inputs: Record<string, string | number | boolean | string[]>;
}

export interface CompareResult {
  product: Product;
  scenarios: Scenario[];      // always ordered high → low price (anchoring)
  /** Cheapest scenario index (always last after sort) */
  baselineIdx: number;
  /** Recommended scenario index (middle, or [1] when 3 exist) */
  recommendedIdx: number;
  /** One-line plain-English explanation of the biggest price driver */
  insightText: string;
  /** The slider variable for the sensitivity panel */
  sliderKey: string;
  sliderLabel: string;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
  sliderUnit: string;
}

// ─── Verify ───────────────────────────────────────────────────────────────────

const VERIFY_TIERS: {
  name: string;
  tagline: string;
  capabilities: VerifyCapability[];
  managedUsersFraction: number; // fraction of population to use as managedUsers
  addOnSms: boolean;
}[] = [
  {
    name: "Authentication Only",
    tagline: "SSO for every user — the essential starting point",
    capabilities: ["SSO"],
    managedUsersFraction: 0,
    addOnSms: false,
  },
  {
    name: "Secure Workforce",
    tagline: "SSO + Adaptive MFA — strong protection without complexity",
    capabilities: ["SSO", "MFA", "Adaptive"],
    managedUsersFraction: 0,
    addOnSms: false,
  },
  {
    name: "Full Identity Platform",
    tagline: "SSO + MFA + Lifecycle — govern the full identity lifecycle",
    capabilities: ["SSO", "MFA", "Adaptive", "Lifecycle"],
    managedUsersFraction: 1.0,
    addOnSms: false,
  },
];

export function buildVerifyScenarios(
  population: number,
  avgLogins: number,
  term: "12-month" | "3-year"
): CompareResult {
  const scenarios: Scenario[] = VERIFY_TIERS.map((tier) => {
    const managedUsers = Math.round(population * tier.managedUsersFraction);
    const inputs: VerifyInputs = {
      capabilities: tier.capabilities,
      population,
      avgLoginsPerYear: avgLogins,
      managedUsers,
      term,
    };
    const result = computeVerifyQuote(inputs);
    return {
      name: tier.name,
      tagline: tier.tagline,
      annualList: result.totalAnnualList,
      monthlyList: Math.round(result.totalAnnualList / 12),
      drivers: tier.capabilities.map((c) => `${c} enabled`),
      inputs: {
        Capabilities: tier.capabilities.join(", "),
        "Managed Users": managedUsers.toLocaleString(),
        Population: population.toLocaleString(),
        "Avg Logins / yr": avgLogins,
        Term: term,
      },
    };
  });

  // Sort high → low (anchoring)
  scenarios.sort((a, b) => b.annualList - a.annualList);

  const topPrice = scenarios[0].annualList;
  const bottomPrice = scenarios[scenarios.length - 1].annualList;
  const diff = topPrice - bottomPrice;
  const pct = bottomPrice > 0 ? Math.round((diff / bottomPrice) * 100) : 0;

  return {
    product: "Verify",
    scenarios,
    baselineIdx: scenarios.length - 1,
    recommendedIdx: 1,
    insightText: `Adding full identity lifecycle management (Lifecycle capability) accounts for most of the ${pct}% price difference — it drives managed-user RUs for all ${population.toLocaleString()} identities.`,
    sliderKey: "population",
    sliderLabel: "User Population",
    sliderMin: 1000,
    sliderMax: Math.max(population * 4, 100000),
    sliderStep: 1000,
    sliderUnit: "users",
  };
}

// ─── Vault ────────────────────────────────────────────────────────────────────

export function buildVaultScenarios(
  model: "A" | "B",
  installCount: number,
  clientCount: number,
  rusMonthly: number
): CompareResult {
  if (model === "B") {
    const editions: Array<{ edition: "Essentials" | "Standard" | "Premium"; name: string; tagline: string }> = [
      { edition: "Essentials", name: "Essentials", tagline: "Core secrets management — entry tier" },
      { edition: "Standard",   name: "Standard",   tagline: "Full secrets + namespaces + DR replication" },
      { edition: "Premium",    name: "Premium",     tagline: "Full platform + HSM, Sentinel, performance replication" },
    ];
    const scenarios: Scenario[] = editions.map(({ edition, name, tagline }) => {
      const inputs: VaultInputsModelB = { model: "B-Clients", edition, installCount, clientCount };
      const result = computeVaultQuote(inputs);
      return {
        name,
        tagline,
        annualList: result.totalAnnualList,
        monthlyList: Math.round(result.totalAnnualList / 12),
        drivers: [`${edition} edition`, `${installCount} install(s)`, `${clientCount.toLocaleString()} clients`],
        inputs: { Edition: edition, Installs: installCount, Clients: clientCount.toLocaleString() },
      };
    });
    scenarios.sort((a, b) => b.annualList - a.annualList);
    return {
      product: "Vault",
      scenarios,
      baselineIdx: scenarios.length - 1,
      recommendedIdx: 1,
      insightText: `Edition choice is the primary price driver — Premium includes HSM and performance replication. Moving from Essentials to Standard doubles the install cost but unlocks namespace isolation.`,
      sliderKey: "clientCount",
      sliderLabel: "Client Count",
      sliderMin: 10,
      sliderMax: Math.max(clientCount * 4, 500),
      sliderStep: 10,
      sliderUnit: "clients",
    };
  }

  // Model A — vary RU size: half, actual, double
  const ruVariants = [
    { label: "Low Usage",    ru: Math.max(1, Math.round(rusMonthly * 0.5)),  tagline: "Half the estimated monthly RU consumption" },
    { label: "Expected",     ru: rusMonthly,                                  tagline: "Based on your stated usage inputs" },
    { label: "Peak / Scale", ru: rusMonthly * 2,                              tagline: "Double capacity for peak load or growth" },
  ];
  const scenarios: Scenario[] = ruVariants.map(({ label, ru, tagline }) => {
    const inputs: VaultInputsModelA = {
      model: "A-Platform",
      installCount,
      useCaseInputs: { staticSecretCount: ru },
    };
    const result = computeVaultQuote(inputs);
    return {
      name: label,
      tagline,
      annualList: result.totalAnnualList,
      monthlyList: Math.round(result.totalAnnualList / 12),
      drivers: [`${ru.toLocaleString()} RU/month`],
      inputs: { "RU / month": ru.toLocaleString(), Installs: installCount },
    };
  });
  scenarios.sort((a, b) => b.annualList - a.annualList);
  return {
    product: "Vault",
    scenarios,
    baselineIdx: scenarios.length - 1,
    recommendedIdx: 1,
    insightText: `RU consumption is the main driver on the Platform model — each additional RU/month adds $${(48 * 12).toLocaleString()} per year at list price.`,
    sliderKey: "rusMonthly",
    sliderLabel: "RU / Month",
    sliderMin: 1,
    sliderMax: Math.max(rusMonthly * 4, 500),
    sliderStep: 1,
    sliderUnit: "RU/mo",
  };
}

// ─── NS1 ──────────────────────────────────────────────────────────────────────

export function buildNS1Scenarios(queryMQ: number, filterChains: number): CompareResult {
  const tiers = [
    { name: "Managed DNS Only",    tagline: "Pure DNS resolution — no traffic steering",    mq: queryMQ, fc: 0,            monitors: 0  },
    { name: "DNS + Traffic Steering", tagline: "DNS + GSLB filter chains for load balancing", mq: queryMQ, fc: filterChains || 5, monitors: 0  },
    { name: "Full Observability",  tagline: "DNS + GSLB + health monitors",                 mq: queryMQ, fc: filterChains || 5, monitors: 10 },
  ];
  const scenarios: Scenario[] = tiers.map(({ name, tagline, mq, fc, monitors }) => {
    const inputs: NS1Inputs = { queryVolumeMQ: mq, filterChains: fc, monitors };
    const result = computeNS1Quote(inputs);
    return {
      name,
      tagline,
      annualList: result.ballparkAnnual,
      monthlyList: result.ballparkMRR,
      drivers: [`${mq}M queries/mo`, fc > 0 ? `${fc} filter chains` : "No GSLB", monitors > 0 ? `${monitors} monitors` : "No monitors"].filter(Boolean),
      inputs: { "Queries (MQ)": `${mq}M`, "Filter Chains": fc, Monitors: monitors },
    };
  });
  scenarios.sort((a, b) => b.annualList - a.annualList);
  return {
    product: "NS1",
    scenarios,
    baselineIdx: scenarios.length - 1,
    recommendedIdx: 1,
    insightText: `Query volume sets the base price tier — traffic steering (GSLB filter chains) and monitors add incrementally on top. Most customers start with DNS + GSLB and add monitors as observability matures.`,
    sliderKey: "queryMQ",
    sliderLabel: "Query Volume",
    sliderMin: 5,
    sliderMax: Math.max(queryMQ * 4, 100),
    sliderStep: 5,
    sliderUnit: "MQ/mo",
  };
}
