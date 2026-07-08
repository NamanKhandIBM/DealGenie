/**
 * compare-engine.ts
 *
 * Variable-selector scenario fan-out — zero AI, fully deterministic.
 *
 * Instead of hardcoded tiers, the seller picks 1–2 "fork variables"
 * (e.g. "Which capabilities?" or "How many users?").
 * The engine fans out every meaningful option for those variables
 * and computes a price for each combination using the existing engines.
 *
 * Results are ordered high → low price (anchoring).
 */

import { computeVerifyQuote } from "./verify-engine";
import { computeVaultQuote } from "./vault-engine";
import { computeNS1Quote } from "./ns1-engine";
import type { Product } from "./types";
import type { VerifyCapability } from "./data";

// ─── Public types ─────────────────────────────────────────────────────────────

/** A single forkable variable the seller can choose to compare across */
export interface ForkVariable {
  key: string;
  label: string;
  /** Short description of what this variable affects */
  impact: string;
  /** The options to fan out over */
  options: ForkOption[];
}

export interface ForkOption {
  label: string;
  /** The raw answer value (same format as ConversationState.answers[key]) */
  value: string | number | string[];
}

/** One computed scenario (one combination of fork variable values) */
export interface Scenario {
  /** Human-readable name built from the fork option labels */
  name: string;
  /** The answer overrides that produced this scenario */
  overrides: Record<string, string | number | boolean | string[]>;
  annualList: number;
  monthlyList: number;
  /** Key drivers shown under the price */
  drivers: string[];
}

export interface CompareResult {
  product: Product;
  forkVars: ForkVariable[];         // the variables that were forked
  scenarios: Scenario[];            // ordered high → low price
  baselineIdx: number;
  recommendedIdx: number;
  insightText: string;
  /** For the sensitivity slider */
  sliderVar: ForkVariable | null;
  sliderKey: string;
  sliderMin: number;
  sliderMax: number;
  sliderStep: number;
  sliderUnit: string;
  sliderCurrentValue: number;
}

// ─── Per-product fork variable definitions ────────────────────────────────────
// These mirror the actual question options in questions.ts.
// They are the "levers" a seller can choose to explore.

export function getForkVariables(
  product: Product,
  answers: Record<string, string | number | boolean | string[]>
): ForkVariable[] {
  if (product === "Verify") {
    return [
      {
        key: "capabilities",
        label: "Security capabilities",
        impact: "Biggest price driver — each capability adds RUs",
        options: [
          { label: "SSO only",                  value: ["SSO"] },
          { label: "SSO + MFA",                 value: ["SSO", "MFA"] },
          { label: "SSO + MFA + Adaptive",      value: ["SSO", "MFA", "Adaptive"] },
          { label: "Full suite (+ Lifecycle)",  value: ["SSO", "MFA", "Adaptive", "Lifecycle"] },
        ],
      },
      {
        key: "population",
        label: "User population",
        impact: "Drives MAU — crosses tier boundaries non-linearly",
        options: [
          { label: "1,000 users",    value: 1000 },
          { label: "5,000 users",    value: 5000 },
          { label: "10,000 users",   value: 10000 },
          { label: "50,000 users",   value: 50000 },
          { label: "100,000 users",  value: 100000 },
          { label: "500,000 users",  value: 500000 },
        ],
      },
      {
        key: "avgLogins",
        label: "Login frequency",
        impact: "Controls how many months/year count as active MAU",
        options: [
          { label: "Occasional (3 months/yr)",  value: 3 },
          { label: "Seasonal (6 months/yr)",    value: 6 },
          { label: "Regular (9 months/yr)",     value: 9 },
          { label: "Always-on (12 months/yr)",  value: 12 },
        ],
      },
      {
        key: "term",
        label: "Contract term",
        impact: "3-year commitments carry higher total value",
        options: [
          { label: "12-month", value: "12-month" },
          { label: "3-year",   value: "3-year" },
        ],
      },
    ];
  }

  if (product === "Vault") {
    const model = String(answers.vaultModel ?? "B");
    if (model === "B") {
      return [
        {
          key: "edition",
          label: "Vault edition",
          impact: "Edition sets the install price — Essentials vs Standard vs Premium",
          options: [
            { label: "Essentials", value: "Essentials" },
            { label: "Standard",   value: "Standard" },
            { label: "Premium",    value: "Premium" },
          ],
        },
        {
          key: "clientCount",
          label: "Client (app/service) count",
          impact: "Each connecting app or service = 1 client RVU at $1,296/yr",
          options: [
            { label: "50 clients",     value: 50 },
            { label: "250 clients",    value: 250 },
            { label: "1,000 clients",  value: 1000 },
            { label: "5,000 clients",  value: 5000 },
            { label: "10,000 clients", value: 10000 },
          ],
        },
        {
          key: "installCount",
          label: "Number of clusters",
          impact: "Each production cluster = one install fee",
          options: [
            { label: "1 cluster", value: 1 },
            { label: "2 clusters", value: 2 },
            { label: "3 clusters", value: 3 },
          ],
        },
      ];
    }
    // Model A
    return [
      {
        key: "rusMonthly",
        label: "Monthly resource units (RU)",
        impact: "Platform model charges per RU/month — usage drives cost directly",
        options: [
          { label: "100 RU/mo",    value: 100 },
          { label: "500 RU/mo",    value: 500 },
          { label: "1,000 RU/mo",  value: 1000 },
          { label: "5,000 RU/mo",  value: 5000 },
          { label: "10,000 RU/mo", value: 10000 },
        ],
      },
      {
        key: "installCount",
        label: "Number of clusters",
        impact: "Each production cluster = $96,000/yr install fee",
        options: [
          { label: "1 cluster", value: 1 },
          { label: "2 clusters", value: 2 },
          { label: "3 clusters", value: 3 },
        ],
      },
    ];
  }

  // NS1
  return [
    {
      key: "queryMQ",
      label: "Query volume",
      impact: "Biggest NS1 cost driver — tier pricing means non-linear jumps",
      options: [
        { label: "25M queries/mo",    value: 25 },
        { label: "100M queries/mo",   value: 100 },
        { label: "300M queries/mo",   value: 300 },
        { label: "700M queries/mo",   value: 700 },
        { label: "2,000M queries/mo", value: 2000 },
      ],
    },
    {
      key: "filterChainCount",
      label: "Traffic steering (GSLB filter chains)",
      impact: "Each steered DNS record adds a filter chain fee",
      options: [
        { label: "No GSLB (0)",     value: 0 },
        { label: "5 filter chains", value: 5 },
        { label: "25 filter chains", value: 25 },
        { label: "100 filter chains", value: 100 },
      ],
    },
    {
      key: "monitors",
      label: "Health monitors",
      impact: "Up/down checks per hostname — flat per-monitor fee",
      options: [
        { label: "No monitors (0)", value: 0 },
        { label: "25 monitors",     value: 25 },
        { label: "100 monitors",    value: 100 },
        { label: "200 monitors",    value: 200 },
      ],
    },
  ];
}

// ─── Price computation for one set of overrides ───────────────────────────────

export function computeScenarioPrice(
  product: Product,
  base: Record<string, string | number | boolean | string[]>,
  overrides: Record<string, string | number | boolean | string[]>
): number {
  const a = { ...base, ...overrides };

  if (product === "Verify") {
    const caps = (a.capabilities as string[]) ?? ["SSO"];
    const pop  = Number(a.population ?? 500);
    const logins = Number(a.avgLogins ?? 12);
    const managed = caps.includes("Lifecycle") ? Number(a.managedUsers ?? pop) : 0;
    const term  = String(a.term ?? "12-month") as "12-month" | "3-year";
    const result = computeVerifyQuote({ capabilities: caps as VerifyCapability[], population: pop, avgLoginsPerYear: logins, managedUsers: managed, term });
    return result.totalAnnualList;
  }

  if (product === "Vault") {
    const model = String(a.vaultModel ?? "B");
    const installs = Number(a.installCount ?? 1);
    if (model === "B") {
      const editionRaw = String(a.edition ?? "Standard");
      const edition = (["Essentials", "Standard", "Premium"].includes(editionRaw) ? editionRaw : "Standard") as "Essentials" | "Standard" | "Premium";
      const clients = Number(a.clientCount ?? 100);
      const result = computeVaultQuote({ model: "B-Clients", edition, installCount: installs, clientCount: clients });
      return result.totalAnnualList;
    }
    const ru = Number(a.rusMonthly ?? 100);
    const result = computeVaultQuote({ model: "A-Platform", installCount: installs, useCaseInputs: { staticSecretCount: ru } });
    return result.totalAnnualList;
  }

  // NS1
  const mq = Number(a.queryMQ ?? 50);
  const fc = Number(a.filterChainCount ?? 0);
  const mon = Number(a.monitors ?? 0);
  const result = computeNS1Quote({ queryVolumeMQ: mq, filterChains: fc, monitors: mon });
  return result.ballparkAnnual;
}

// ─── Sensitivity slider price (single variable sweep) ────────────────────────

export function computeSliderPrice(
  product: Product,
  base: Record<string, string | number | boolean | string[]>,
  overrides: Record<string, string | number | boolean | string[]>,
  sliderKey: string,
  sliderValue: number
): number {
  return computeScenarioPrice(product, base, { ...overrides, [sliderKey]: sliderValue });
}

// ─── Fan-out builder ──────────────────────────────────────────────────────────

/**
 * Given the current answers and 1–2 chosen fork variable keys,
 * build a CompareResult with one scenario per option combination.
 */
export function buildFanOut(
  product: Product,
  answers: Record<string, string | number | boolean | string[]>,
  selectedVarKeys: string[]
): CompareResult {
  const allVars = getForkVariables(product, answers);
  const forkVars = selectedVarKeys
    .map((k) => allVars.find((v) => v.key === k))
    .filter(Boolean) as ForkVariable[];

  // Generate all combinations of options across chosen variables
  type Combo = { labels: string[]; overrides: Record<string, string | number | boolean | string[]> };
  let combos: Combo[] = [{ labels: [], overrides: {} }];

  for (const fv of forkVars) {
    const expanded: Combo[] = [];
    for (const existing of combos) {
      for (const opt of fv.options) {
        expanded.push({
          labels: [...existing.labels, opt.label],
          overrides: { ...existing.overrides, [fv.key]: opt.value },
        });
      }
    }
    combos = expanded;
  }

  // Build scenarios
  const rawScenarios: Scenario[] = combos.map((c) => {
    const price = computeScenarioPrice(product, answers, c.overrides);
    return {
      name: c.labels.join(" · ") || "Baseline",
      overrides: c.overrides,
      annualList: price,
      monthlyList: Math.round(price / 12),
      drivers: c.labels,
    };
  });

  // Sort high → low (anchoring)
  rawScenarios.sort((a, b) => b.annualList - a.annualList);

  // Remove duplicates (same price — can happen when fork var has no effect)
  const unique = rawScenarios.filter((s, i, arr) =>
    arr.findIndex((x) => x.annualList === s.annualList && x.name === s.name) === i
  );

  const baseline = unique[unique.length - 1];
  const recommended = unique.length >= 3 ? unique[1] : unique[0];
  const baselineIdx = unique.length - 1;
  const recommendedIdx = unique.indexOf(recommended);

  // Insight text
  const topPrice = unique[0].annualList;
  const bottomPrice = baseline.annualList;
  const pct = bottomPrice > 0 ? Math.round(((topPrice - bottomPrice) / bottomPrice) * 100) : 0;
  const insightText = buildInsight(product, forkVars, pct, unique);

  // Slider — use the first numeric fork var, or fallback to product default
  const numericFork = forkVars.find((v) => typeof v.options[0].value === "number");
  const sliderForkVar = numericFork ?? allVars.find((v) => typeof v.options[0].value === "number") ?? null;

  const sliderKey = sliderForkVar?.key ?? "population";
  const sliderVals = sliderForkVar?.options.map((o) => Number(o.value)) ?? [1000, 500000];
  const sliderMin = Math.min(...sliderVals);
  const sliderMax = Math.max(...sliderVals);
  const sliderStep = sliderMax > 10000 ? 1000 : sliderMax > 1000 ? 100 : sliderMax > 100 ? 10 : 1;
  const sliderUnit = sliderForkVar
    ? sliderForkVar.label.toLowerCase().includes("user") ? "users"
    : sliderForkVar.label.toLowerCase().includes("query") ? "MQ/mo"
    : sliderForkVar.label.toLowerCase().includes("client") ? "clients"
    : sliderForkVar.label.toLowerCase().includes("ru") ? "RU/mo"
    : ""
    : "";
  const sliderCurrentValue = typeof answers[sliderKey] === "number"
    ? answers[sliderKey] as number
    : Number(answers[sliderKey] ?? sliderMin);

  return {
    product,
    forkVars,
    scenarios: unique,
    baselineIdx,
    recommendedIdx,
    insightText,
    sliderVar: sliderForkVar,
    sliderKey,
    sliderMin,
    sliderMax,
    sliderStep,
    sliderUnit,
    sliderCurrentValue: Math.min(Math.max(sliderCurrentValue, sliderMin), sliderMax),
  };
}

// ─── Insight text ─────────────────────────────────────────────────────────────

function buildInsight(
  product: Product,
  forkVars: ForkVariable[],
  pctDiff: number,
  scenarios: Scenario[]
): string {
  const varLabel = forkVars.map((v) => v.label).join(" and ");
  const top = scenarios[0];
  const bottom = scenarios[scenarios.length - 1];
  const diff = top.annualList - bottom.annualList;
  const diffStr = "$" + Math.round(diff).toLocaleString();

  if (product === "Verify") {
    if (forkVars.some((v) => v.key === "capabilities")) {
      return `Capability choice is the dominant driver — the difference between the simplest and most complete option is ${diffStr}/yr (${pctDiff}%). Lifecycle Management has the biggest single impact because it charges per managed user rather than per MAU.`;
    }
    if (forkVars.some((v) => v.key === "population")) {
      return `User population drives MAU, which determines the pricing tier. Watch for non-linear jumps at tier boundaries — a small increase in users can trigger a significant price step. The spread across these options is ${diffStr}/yr.`;
    }
  }
  if (product === "Vault") {
    if (forkVars.some((v) => v.key === "edition")) {
      return `Edition choice drives the per-cluster install fee (Essentials $24.9k → Premium $100k/cluster). The ${pctDiff}% spread of ${diffStr}/yr is dominated by install cost, with client RVUs as a secondary driver.`;
    }
    if (forkVars.some((v) => v.key === "clientCount")) {
      return `Client count (RVU) scales linearly at $1,296/client/yr — the ${pctDiff}% spread of ${diffStr}/yr is driven entirely by the number of connecting apps and services.`;
    }
    if (forkVars.some((v) => v.key === "rusMonthly")) {
      return `Platform-model (Model A) pricing scales with monthly RU consumption at $48/RU/month ($576/yr). The ${pctDiff}% spread of ${diffStr}/yr reflects different usage profiles. Volume discounts reduce the effective rate significantly at scale.`;
    }
  }
  if (product === "NS1") {
    return `NS1 pricing is tier-based on query volume — small increases near tier boundaries cause disproportionate price jumps. The ${pctDiff}% spread of ${diffStr}/yr across these options is driven by ${varLabel}.`;
  }

  return `The ${pctDiff}% price spread (${diffStr}/yr) across these scenarios is driven by differences in ${varLabel}.`;
}
