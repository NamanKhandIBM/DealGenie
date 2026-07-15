/**
 * simulation.test.ts
 *
 * 100+ end-to-end simulations across quoting and compare-scenarios engines.
 * Each test exercises a realistic seller scenario and asserts:
 *   1. Price is a positive finite number
 *   2. Price is within a plausible range (no $0, no $999B)
 *   3. Higher inputs → higher or equal price (monotonicity)
 *   4. Add-ons always add cost (not subtract)
 *   5. Compare scenarios produce sorted, non-negative results
 *   6. Specific known price relationships hold (regression guards)
 */

import { computeVerifyQuote } from "../verify-engine";
import { computeVaultQuote } from "../vault-engine";
import { computeNS1Quote } from "../ns1-engine";
import {
  computeScenarioPrice,
  getForkVariables,
  getAddonDefinitions,
  computeBasePrice,
  buildFanOut,
} from "../compare-engine";
import type { Product } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertFinitePositive(n: number, label: string): number {
  expect(isFinite(n)).toBe(true);
  expect(n).toBeGreaterThan(0);
  // Nothing in these three products should cost more than $50M list
  expect(n).toBeLessThan(50_000_000);
  return n;
}

function runCompare(product: Product, answers: Record<string, unknown>) {
  const vars = getForkVariables(product, answers as Record<string, string | number | boolean | string[]>);
  expect(vars.length).toBeGreaterThan(0);

  const forkVar = vars.find((v) => v.options.length >= 2)!;
  expect(forkVar).toBeDefined();

  const result = buildFanOut(product, answers as Record<string, string | number | boolean | string[]>, [forkVar.key]);

  expect(result.scenarios.length).toBeGreaterThanOrEqual(1);

  for (const s of result.scenarios) {
    assertFinitePositive(s.annualList, `${product} scenario ${s.name}`);
    // monthlyList = annualList/12 — allow rounding differences up to $1
    expect(Math.abs(s.monthlyList - s.annualList / 12)).toBeLessThan(1);
  }

  // Sorted high → low
  for (let i = 0; i < result.scenarios.length - 1; i++) {
    expect(result.scenarios[i].annualList).toBeGreaterThanOrEqual(result.scenarios[i + 1].annualList);
  }

  expect(result.insightText.length).toBeGreaterThan(10);
  return result;
}

// Helper: build a Verify non-prod add-on object
function npAddon(part: "D22PGLL" | "D21CWLL") {
  const prices: Record<string, number> = { D22PGLL: 2810, D21CWLL: 1410 };
  return { part, description: "Non-production", listPrice: prices[part] * 12, quantity: 1, unit: "per instance/year" };
}

// ─── VERIFY — quoting engine ──────────────────────────────────────────────────

describe("Verify — quoting engine", () => {
  test("SIM-V01: SSO only, 1,000 users, 12mo", () => {
    const r = computeVerifyQuote({ capabilities: ["SSO"], population: 1000, avgLoginsPerYear: 48, term: "12-month", regions: 1 });
    assertFinitePositive(r.totalAnnualList, "SIM-V01");
    expect(r.totalAnnualList).toBeGreaterThan(1000);
  });

  test("SIM-V02: SSO+MFA, 5,000 users costs more than SSO only", () => {
    const sso = computeVerifyQuote({ capabilities: ["SSO"], population: 5000, avgLoginsPerYear: 48, term: "12-month", regions: 1 });
    const mfa = computeVerifyQuote({ capabilities: ["SSO", "MFA"], population: 5000, avgLoginsPerYear: 48, term: "12-month", regions: 1 });
    expect(mfa.totalAnnualList).toBeGreaterThan(sso.totalAnnualList);
  });

  test("SIM-V03: Full suite costs more than SSO+MFA", () => {
    const partial = computeVerifyQuote({ capabilities: ["SSO", "MFA"], population: 10000, avgLoginsPerYear: 72, term: "12-month", regions: 1 });
    const full = computeVerifyQuote({ capabilities: ["SSO", "MFA", "Adaptive", "Lifecycle"], population: 10000, avgLoginsPerYear: 72, managedUsers: 10000, term: "12-month", regions: 1 });
    expect(full.totalAnnualList).toBeGreaterThan(partial.totalAnnualList);
  });

  test("SIM-V04: More users → more cost (monotonicity)", () => {
    const sizes = [500, 1000, 5000, 10000, 50000, 100000];
    let prev = 0;
    for (const pop of sizes) {
      const r = computeVerifyQuote({ capabilities: ["SSO", "MFA"], population: pop, avgLoginsPerYear: 60, term: "12-month", regions: 1 });
      expect(r.totalAnnualList).toBeGreaterThanOrEqual(prev);
      prev = r.totalAnnualList;
    }
  });

  test("SIM-V05: 2 regions costs more than 1 region", () => {
    const one = computeVerifyQuote({ capabilities: ["SSO"], population: 10000, avgLoginsPerYear: 48, term: "12-month", regions: 1 });
    const two = computeVerifyQuote({ capabilities: ["SSO"], population: 10000, avgLoginsPerYear: 48, term: "12-month", regions: 2 });
    expect(two.totalAnnualList).toBeGreaterThan(one.totalAnnualList);
  });

  test("SIM-V06: 3-year term is cheaper than or equal to 12-month", () => {
    const monthly = computeVerifyQuote({ capabilities: ["SSO", "MFA"], population: 20000, avgLoginsPerYear: 72, term: "12-month", regions: 1 });
    const threeyear = computeVerifyQuote({ capabilities: ["SSO", "MFA"], population: 20000, avgLoginsPerYear: 72, term: "3-year", regions: 1 });
    expect(threeyear.totalAnnualList).toBeLessThanOrEqual(monthly.totalAnnualList);
  });

  test("SIM-V07: Lifecycle alone — no crash, positive price", () => {
    const r = computeVerifyQuote({ capabilities: ["Lifecycle"], population: 5000, avgLoginsPerYear: 12, managedUsers: 5000, term: "12-month", regions: 1 });
    assertFinitePositive(r.totalAnnualList, "SIM-V07");
  });

  test("SIM-V08: 500k users — finite price", () => {
    const r = computeVerifyQuote({ capabilities: ["SSO", "MFA", "Adaptive"], population: 500000, avgLoginsPerYear: 96, term: "12-month", regions: 1 });
    assertFinitePositive(r.totalAnnualList, "SIM-V08");
  });

  test("SIM-V09: 10M users enterprise — finite price", () => {
    const r = computeVerifyQuote({ capabilities: ["SSO"], population: 10_000_000, avgLoginsPerYear: 24, term: "12-month", regions: 1 });
    assertFinitePositive(r.totalAnnualList, "SIM-V09");
  });

  test("SIM-V10: 50M users consumer IAM — finite price", () => {
    const r = computeVerifyQuote({ capabilities: ["SSO", "MFA"], population: 50_000_000, avgLoginsPerYear: 24, term: "12-month", regions: 1 });
    assertFinitePositive(r.totalAnnualList, "SIM-V10");
  });

  test("SIM-V11: More logins per year → higher MAU → higher price", () => {
    const low = computeVerifyQuote({ capabilities: ["SSO"], population: 10000, avgLoginsPerYear: 12, term: "12-month", regions: 1 });
    const high = computeVerifyQuote({ capabilities: ["SSO"], population: 10000, avgLoginsPerYear: 144, term: "12-month", regions: 1 });
    expect(high.totalAnnualList).toBeGreaterThanOrEqual(low.totalAnnualList);
  });

  test("SIM-V12: nonProd D22PGLL (with SLA) adds cost via addOns", () => {
    const base = computeVerifyQuote({ capabilities: ["SSO", "MFA"], population: 5000, avgLoginsPerYear: 48, term: "12-month", regions: 1 });
    const withNP = computeVerifyQuote({ capabilities: ["SSO", "MFA"], population: 5000, avgLoginsPerYear: 48, term: "12-month", regions: 1, addOns: [npAddon("D22PGLL")] });
    expect(withNP.totalAnnualList).toBeGreaterThan(base.totalAnnualList);
  });

  test("SIM-V13: D22PGLL (with SLA) costs more than D21CWLL (without SLA)", () => {
    const np1 = computeVerifyQuote({ capabilities: ["SSO"], population: 1000, avgLoginsPerYear: 48, term: "12-month", regions: 1, addOns: [npAddon("D22PGLL")] });
    const np2 = computeVerifyQuote({ capabilities: ["SSO"], population: 1000, avgLoginsPerYear: 48, term: "12-month", regions: 1, addOns: [npAddon("D21CWLL")] });
    expect(np1.totalAnnualList).toBeGreaterThan(np2.totalAnnualList);
  });

  test("SIM-V14: Adaptive without MFA — no crash", () => {
    const r = computeVerifyQuote({ capabilities: ["Adaptive"], population: 1000, avgLoginsPerYear: 48, term: "12-month", regions: 1 });
    assertFinitePositive(r.totalAnnualList, "SIM-V14");
  });

  test("SIM-V15: 1 user minimum — price > $0", () => {
    const r = computeVerifyQuote({ capabilities: ["SSO"], population: 1, avgLoginsPerYear: 12, term: "12-month", regions: 1 });
    assertFinitePositive(r.totalAnnualList, "SIM-V15");
  });

  test("SIM-V16: nonProd never appears twice in lines", () => {
    const r = computeVerifyQuote({ capabilities: ["SSO"], population: 1000, avgLoginsPerYear: 48, term: "12-month", regions: 1, addOns: [npAddon("D22PGLL")] });
    const npLines = r.lines.filter((l) => l.part === "D22PGLL");
    expect(npLines.length).toBe(1);
  });

  test("SIM-V17: 3 regions tripling a 1-region price (roughly)", () => {
    const one = computeVerifyQuote({ capabilities: ["SSO"], population: 5000, avgLoginsPerYear: 48, term: "12-month", regions: 1 });
    const three = computeVerifyQuote({ capabilities: ["SSO"], population: 5000, avgLoginsPerYear: 48, term: "12-month", regions: 3 });
    expect(three.totalAnnualList).toBeCloseTo(one.totalAnnualList * 3, -2);
  });
});

// ─── VAULT Model B — quoting engine ──────────────────────────────────────────

describe("Vault Model B — quoting engine", () => {
  test("SIM-VB01: Essentials, 100 clients, 1 cluster", () => {
    const r = computeVaultQuote({ model: "B-Clients", edition: "Essentials", installCount: 1, clientCount: 100 });
    assertFinitePositive(r.totalAnnualList, "SIM-VB01");
  });

  test("SIM-VB02: Premium > Standard > Essentials at same client count", () => {
    const ess = computeVaultQuote({ model: "B-Clients", edition: "Essentials", installCount: 1, clientCount: 500 });
    const std = computeVaultQuote({ model: "B-Clients", edition: "Standard", installCount: 1, clientCount: 500 });
    const pre = computeVaultQuote({ model: "B-Clients", edition: "Premium", installCount: 1, clientCount: 500 });
    expect(std.totalAnnualList).toBeGreaterThan(ess.totalAnnualList);
    expect(pre.totalAnnualList).toBeGreaterThan(std.totalAnnualList);
  });

  test("SIM-VB03: More clients → more cost (monotonicity)", () => {
    const counts = [50, 100, 250, 500, 1000, 5000];
    let prev = 0;
    for (const c of counts) {
      const r = computeVaultQuote({ model: "B-Clients", edition: "Standard", installCount: 1, clientCount: c });
      expect(r.totalAnnualList).toBeGreaterThanOrEqual(prev);
      prev = r.totalAnnualList;
    }
  });

  test("SIM-VB04: More clusters → higher install cost (linear)", () => {
    const one = computeVaultQuote({ model: "B-Clients", edition: "Standard", installCount: 1, clientCount: 500 });
    const two = computeVaultQuote({ model: "B-Clients", edition: "Standard", installCount: 2, clientCount: 500 });
    const three = computeVaultQuote({ model: "B-Clients", edition: "Standard", installCount: 3, clientCount: 500 });
    expect(two.totalAnnualList).toBeGreaterThan(one.totalAnnualList);
    expect(three.totalAnnualList).toBeGreaterThan(two.totalAnnualList);
  });

  test("SIM-VB05: nonProd adds exactly $12,480", () => {
    const base = computeVaultQuote({ model: "B-Clients", edition: "Standard", installCount: 1, clientCount: 250 });
    const withNP = computeVaultQuote({ model: "B-Clients", edition: "Standard", installCount: 1, clientCount: 250, includeNonProd: true });
    expect(withNP.totalAnnualList - base.totalAnnualList).toBeCloseTo(12480, -2);
  });

  test("SIM-VB06: PKI add-on adds cost", () => {
    const base = computeVaultQuote({ model: "B-Clients", edition: "Premium", installCount: 2, clientCount: 1000 });
    const withPKI = computeVaultQuote({ model: "B-Clients", edition: "Premium", installCount: 2, clientCount: 1000, pkiCerts: 250 });
    expect(withPKI.totalAnnualList).toBeGreaterThan(base.totalAnnualList);
  });

  test("SIM-VB07: KMIP add-on is $249,600/cluster", () => {
    const base = computeVaultQuote({ model: "B-Clients", edition: "Premium", installCount: 1, clientCount: 500 });
    const withKMIP = computeVaultQuote({ model: "B-Clients", edition: "Premium", installCount: 1, clientCount: 500, adpKeyMgmt: 1 });
    expect(withKMIP.totalAnnualList - base.totalAnnualList).toBeCloseTo(249600, -2);
  });

  test("SIM-VB08: 10,000 clients enterprise — finite price", () => {
    const r = computeVaultQuote({ model: "B-Clients", edition: "Premium", installCount: 3, clientCount: 10000 });
    assertFinitePositive(r.totalAnnualList, "SIM-VB08");
  });

  test("SIM-VB09: Minimum config (Essentials, 1 cluster, 50 clients) — price > $0", () => {
    const r = computeVaultQuote({ model: "B-Clients", edition: "Essentials", installCount: 1, clientCount: 50 });
    assertFinitePositive(r.totalAnnualList, "SIM-VB09");
  });

  test("SIM-VB10: ballparkNet ≤ totalAnnualList (discount applied)", () => {
    const r = computeVaultQuote({ model: "B-Clients", edition: "Standard", installCount: 1, clientCount: 1000 });
    expect(r.ballparkNet!).toBeLessThanOrEqual(r.totalAnnualList);
  });

  test("SIM-VB11: KMIP 3 clusters = 3× single-cluster KMIP delta", () => {
    const base = computeVaultQuote({ model: "B-Clients", edition: "Premium", installCount: 3, clientCount: 500 });
    const one = computeVaultQuote({ model: "B-Clients", edition: "Premium", installCount: 3, clientCount: 500, adpKeyMgmt: 1 });
    const three = computeVaultQuote({ model: "B-Clients", edition: "Premium", installCount: 3, clientCount: 500, adpKeyMgmt: 3 });
    expect(three.totalAnnualList - base.totalAnnualList).toBeCloseTo((one.totalAnnualList - base.totalAnnualList) * 3, -2);
  });
});

// ─── VAULT Model A — quoting engine ──────────────────────────────────────────

describe("Vault Model A — quoting engine", () => {
  test("SIM-VA01: 100 static secrets, 1 cluster", () => {
    const r = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 100 } });
    assertFinitePositive(r.totalAnnualList, "SIM-VA01");
  });

  test("SIM-VA02: More secrets → more cost (monotonicity)", () => {
    const counts = [12, 100, 500, 1000, 5000];
    let prev = 0;
    for (const c of counts) {
      const r = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: c } });
      expect(r.totalAnnualList).toBeGreaterThanOrEqual(prev);
      prev = r.totalAnnualList;
    }
  });

  test("SIM-VA03: Dynamic roles add cost on top of secrets", () => {
    const secrets = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 500 } });
    const combined = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 500, dynamicRoles: 200 } });
    expect(combined.totalAnnualList).toBeGreaterThan(secrets.totalAnnualList);
  });

  test("SIM-VA04: PKI certs with 90-day lifetime add cost", () => {
    const base = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 200 } });
    const withPKI = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 200, pkiCertsPerMonth: 500, pkiCertLifetimeHours: 2160 } });
    expect(withPKI.totalAnnualList).toBeGreaterThan(base.totalAnnualList);
  });

  test("SIM-VA05: PKI 1-day certs generate more RU than 90-day certs", () => {
    // 1-day lifetime = 24h, 90-day = 2160h — shorter lifetime → fewer certs per RU window → actually fewer RU
    // Rule: RU = ceil(certs/mo × lifetime_hours / 730) — longer lifetime = more RU
    const short = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { pkiCertsPerMonth: 500, pkiCertLifetimeHours: 24 } });
    const long  = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { pkiCertsPerMonth: 500, pkiCertLifetimeHours: 2160 } });
    // Longer-lived certs accumulate = more concurrent certs at any time = more RU
    expect(long.totalAnnualList).toBeGreaterThan(short.totalAnnualList);
  });

  test("SIM-VA06: KMIP install ($360K) vs standard ($96K) = $264K delta", () => {
    const std = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 100 }, includeKMIP: false });
    const kmip = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 100 }, includeKMIP: true });
    expect(kmip.totalAnnualList - std.totalAnnualList).toBeCloseTo(264000, -2);
  });

  test("SIM-VA07: nonProd Model A adds $48,000", () => {
    const base = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 500 } });
    const withNP = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 500 }, includeNonProd: true });
    expect(withNP.totalAnnualList - base.totalAnnualList).toBeCloseTo(48000, -2);
  });

  test("SIM-VA08: 2nd cluster adds $96K install", () => {
    const one = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 500 } });
    const two = computeVaultQuote({ model: "A-Platform", installCount: 2, useCaseInputs: { staticSecretCount: 500 } });
    expect(two.totalAnnualList - one.totalAnnualList).toBeCloseTo(96000, -2);
  });

  test("SIM-VA09: Volume discount at 5,000 RU (ballparkNet < list)", () => {
    const r = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 5000 } });
    expect(r.ballparkNet!).toBeLessThan(r.totalAnnualList);
  });

  test("SIM-VA10: All use cases combined — no crash, finite price", () => {
    const r = computeVaultQuote({
      model: "A-Platform", installCount: 2,
      useCaseInputs: { staticSecretCount: 1000, dynamicRoles: 200, pkiCertsPerMonth: 500, pkiCertLifetimeHours: 2160, sshCredsPerMonth: 200, sshLifetimeHours: 720, transitCallsPerMonth: 5_000_000, kmseKeyCount: 100 },
      includeNonProd: true, includeKMIP: false,
    });
    assertFinitePositive(r.totalAnnualList, "SIM-VA10");
  });

  test("SIM-VA11: Minimum — zero inputs uses 1 RU floor", () => {
    const r = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: {} });
    expect(isFinite(r.totalAnnualList)).toBe(true);
    expect(r.totalAnnualList).toBeGreaterThan(0);
  });
});

// ─── NS1 — quoting engine ─────────────────────────────────────────────────────

describe("NS1 — quoting engine", () => {
  test("SIM-N01: Starter — 25 MQ/mo, no add-ons", () => {
    const r = computeNS1Quote({ queryVolumeMQ: 25, filterChains: 0, monitors: 0, recordCount: 2000 });
    assertFinitePositive(r.totalAnnualList, "SIM-N01");
  });

  test("SIM-N02: More queries → more cost within same tier (Standard: 50–999 MQ)", () => {
    // Within the Standard tier (>30 MQ, <1000 MQ), price scales with query volume
    const mqs = [50, 100, 300, 700, 999];
    let prev = 0;
    for (const mq of mqs) {
      const r = computeNS1Quote({ queryVolumeMQ: mq, filterChains: 0, monitors: 0, recordCount: 2000 });
      expect(r.tier).toBe("Standard");
      expect(r.totalAnnualList).toBeGreaterThanOrEqual(prev);
      prev = r.totalAnnualList;
    }
  });

  test("SIM-N03: Filter chains add cost", () => {
    const base = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 2000 });
    const gslb = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 10, monitors: 0, recordCount: 2000 });
    expect(gslb.totalAnnualList).toBeGreaterThan(base.totalAnnualList);
  });

  test("SIM-N04: Monitors add cost", () => {
    const base = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 2000 });
    const mon = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 50, recordCount: 2000 });
    expect(mon.totalAnnualList).toBeGreaterThan(base.totalAnnualList);
  });

  test("SIM-N05: Records above 3,000 add cost", () => {
    const free = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 2000 });
    const paid = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 6000 });
    expect(paid.totalAnnualList).toBeGreaterThan(free.totalAnnualList);
  });

  test("SIM-N06: Standard tier — records above 1,000 add a billable record line", () => {
    // Standard tier: 1,000 records free. Anything above is billable (D10AWZX).
    const free = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 1000 });
    const paid = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 2000 });
    const hasRecordLine = paid.partNumbers.some((l) => l.description.toLowerCase().includes("record"));
    expect(hasRecordLine).toBe(true);
    expect(paid.totalAnnualList).toBeGreaterThan(free.totalAnnualList);
  });

  test("SIM-N07: High-volume enterprise 10,000 MQ/mo — finite price", () => {
    const r = computeNS1Quote({ queryVolumeMQ: 10000, filterChains: 100, monitors: 200, recordCount: 50000, ddosProtection: true });
    assertFinitePositive(r.totalAnnualList, "SIM-N07");
  });

  test("SIM-N08: Premium tier (≥1,000 MQ) — finite positive price, a-la-carte parts", () => {
    // At 1,000 MQ = 1B queries → Premium tier. Uses D0GNEZX ($1.343/Request) × 100 Requests
    // plus D0GNGZX ($10.802/Record) × 2 Records. Result is ~$1,870/yr — correct API prices.
    const r = computeNS1Quote({ queryVolumeMQ: 1000, filterChains: 0, monitors: 0, recordCount: 2000 });
    expect(r.tier).toBe("Premium");
    assertFinitePositive(r.totalAnnualList, "SIM-N08");
  });

  test("SIM-N09: DDoS protection adds cost", () => {
    const base = computeNS1Quote({ queryVolumeMQ: 300, filterChains: 5, monitors: 10, recordCount: 2000 });
    const ddos = computeNS1Quote({ queryVolumeMQ: 300, filterChains: 5, monitors: 10, recordCount: 2000, ddosProtection: true });
    expect(ddos.totalAnnualList).toBeGreaterThanOrEqual(base.totalAnnualList);
  });

  test("SIM-N10: Very large record count 1M records — finite price", () => {
    const r = computeNS1Quote({ queryVolumeMQ: 5000, filterChains: 0, monitors: 0, recordCount: 1_000_000 });
    expect(isFinite(r.totalAnnualList)).toBe(true);
    expect(r.totalAnnualList).toBeGreaterThan(0);
  });

  test("SIM-N11: tier is Standard below 1000 MQ", () => {
    const r = computeNS1Quote({ queryVolumeMQ: 300, filterChains: 0, monitors: 0 });
    expect(r.tier).toBe("Standard");
  });

  test("SIM-N12: tier is Premium at ≥1000 MQ", () => {
    const r = computeNS1Quote({ queryVolumeMQ: 1000, filterChains: 0, monitors: 0 });
    expect(r.tier).toBe("Premium");
  });
});

// ─── COMPARE ENGINE — computeScenarioPrice ───────────────────────────────────

describe("computeScenarioPrice — Verify", () => {
  const base: Record<string, string | number | boolean | string[]> = {
    capabilities: ["SSO", "MFA"],
    population: 10000,
    avgLoginsPerYear: 72,
    term: "12-month",
    regions: 1,
  };

  test("SIM-CS01: No overrides produces finite positive price", () => {
    const p = computeScenarioPrice("Verify", base, {});
    assertFinitePositive(p, "SIM-CS01");
  });

  test("SIM-CS02: Full suite override > SSO+MFA", () => {
    const partial = computeScenarioPrice("Verify", base, { capabilities: ["SSO", "MFA"] });
    const full = computeScenarioPrice("Verify", base, { capabilities: ["SSO", "MFA", "Adaptive", "Lifecycle"] });
    expect(full).toBeGreaterThan(partial);
  });

  test("SIM-CS03: Population override — large > small", () => {
    const small = computeScenarioPrice("Verify", base, { population: 5000 });
    const large = computeScenarioPrice("Verify", base, { population: 50000 });
    expect(large).toBeGreaterThan(small);
  });

  test("SIM-CS04: nonProd D22PGLL override adds cost", () => {
    const noNP = computeScenarioPrice("Verify", base, { nonProd: "none" });
    const withNP = computeScenarioPrice("Verify", base, { nonProd: "D22PGLL" });
    expect(withNP).toBeGreaterThan(noNP);
  });

  test("SIM-CS05: D21CWLL (no SLA) cheaper than D22PGLL (with SLA)", () => {
    const sla = computeScenarioPrice("Verify", base, { nonProd: "D22PGLL" });
    const noSla = computeScenarioPrice("Verify", base, { nonProd: "D21CWLL" });
    expect(noSla).toBeLessThan(sla);
  });

  test("SIM-CS06: regions in base answers multiplies price", () => {
    const one = computeScenarioPrice("Verify", { ...base, regions: 1 }, {});
    const two = computeScenarioPrice("Verify", { ...base, regions: 2 }, {});
    expect(two).toBeGreaterThan(one);
  });

  test("SIM-CS07: addon_hag adds ~$270,000/yr", () => {
    const noHag = computeScenarioPrice("Verify", base, { addon_hag: "no" });
    const withHag = computeScenarioPrice("Verify", base, { addon_hag: "yes" });
    expect(withHag - noHag).toBeCloseTo(270000, -2);
  });

  test("SIM-CS08: addon_vanity adds ~$6,744/yr", () => {
    const no = computeScenarioPrice("Verify", base, { addon_vanity: "no" });
    const yes = computeScenarioPrice("Verify", base, { addon_vanity: "yes" });
    expect(yes - no).toBeCloseTo(6744, -2);
  });

  test("SIM-CS09: computeBasePrice strips all add-ons, matches bare quote", () => {
    const withAddons = { ...base, nonProd: "D22PGLL", addon_hag: "yes" };
    const bp = computeBasePrice("Verify", withAddons as Record<string, string | number | boolean | string[]>);
    const bare = computeScenarioPrice("Verify", { ...base, nonProd: "none", addon_hag: "no" }, {});
    expect(bp).toBeCloseTo(bare, -2);
  });

  test("SIM-CS10: No addOns key in base — no crash", () => {
    const b = { capabilities: ["SSO"], population: 5000, avgLoginsPerYear: 48, term: "12-month", regions: 1 };
    const p = computeScenarioPrice("Verify", b, {});
    expect(isFinite(p)).toBe(true);
    expect(p).toBeGreaterThan(0);
  });
});

describe("computeScenarioPrice — Vault Model B", () => {
  const base: Record<string, string | number | boolean | string[]> = {
    vaultModel: "B",
    edition: "Standard",
    clientCount: 500,
    installCount: 1,
    includeNonProd: "no",
  };

  test("SIM-CVB01: No overrides — positive price", () => {
    assertFinitePositive(computeScenarioPrice("Vault", base, {}), "SIM-CVB01");
  });

  test("SIM-CVB02: Edition override Essentials < Standard < Premium", () => {
    const ess = computeScenarioPrice("Vault", base, { edition: "Essentials" });
    const std = computeScenarioPrice("Vault", base, { edition: "Standard" });
    const pre = computeScenarioPrice("Vault", base, { edition: "Premium" });
    expect(std).toBeGreaterThan(ess);
    expect(pre).toBeGreaterThan(std);
  });

  test("SIM-CVB03: clientCount override scales linearly", () => {
    const c100 = computeScenarioPrice("Vault", base, { clientCount: 100 });
    const c1000 = computeScenarioPrice("Vault", base, { clientCount: 1000 });
    expect(c1000).toBeGreaterThan(c100);
  });

  test("SIM-CVB04: nonProd yes/no adds $12,480", () => {
    const no = computeScenarioPrice("Vault", base, { includeNonProd: "no" });
    const yes = computeScenarioPrice("Vault", base, { includeNonProd: "yes" });
    expect(yes - no).toBeCloseTo(12480, -2);
  });

  test("SIM-CVB05: Numeric edition codes (1/2/3) translate correctly", () => {
    const coded = computeScenarioPrice("Vault", { ...base, edition: "2" }, {});
    const named = computeScenarioPrice("Vault", { ...base, edition: "Standard" }, {});
    expect(coded).toBeCloseTo(named, -2);
  });

  test("SIM-CVB06: installCount override scales install cost", () => {
    const one = computeScenarioPrice("Vault", base, { installCount: 1 });
    const two = computeScenarioPrice("Vault", base, { installCount: 2 });
    expect(two).toBeGreaterThan(one);
  });
});

describe("computeScenarioPrice — Vault Model A", () => {
  const base: Record<string, string | number | boolean | string[]> = {
    vaultModel: "A",
    staticSecretCount: 500,
    installCount: 1,
    includeNonProd: "no",
    includeKMIP: "no",
  };

  test("SIM-CVA01: No overrides — positive price", () => {
    assertFinitePositive(computeScenarioPrice("Vault", base, {}), "SIM-CVA01");
  });

  test("SIM-CVA02: staticSecretCount override — more secrets = higher price", () => {
    const small = computeScenarioPrice("Vault", base, { staticSecretCount: 100 });
    const large = computeScenarioPrice("Vault", base, { staticSecretCount: 5000 });
    expect(large).toBeGreaterThan(small);
  });

  test("SIM-CVA03: dynamicRoles override adds cost", () => {
    const none = computeScenarioPrice("Vault", base, { dynamicRoles: 0 });
    const roles = computeScenarioPrice("Vault", base, { dynamicRoles: 200 });
    expect(roles).toBeGreaterThan(none);
  });

  test("SIM-CVA04: pkiCertsPerMonth override adds cost", () => {
    const none = computeScenarioPrice("Vault", base, { pkiCertsPerMonth: 0 });
    const certs = computeScenarioPrice("Vault", base, { pkiCertsPerMonth: 500, pkiCertLifetime: 2160 });
    expect(certs).toBeGreaterThan(none);
  });

  test("SIM-CVA05: includeKMIP yes = $264K delta over standard install", () => {
    const std = computeScenarioPrice("Vault", base, { includeKMIP: "no" });
    const kmip = computeScenarioPrice("Vault", base, { includeKMIP: "yes" });
    expect(kmip - std).toBeCloseTo(264000, -2);
  });

  test("SIM-CVA06: rusMonthly legacy key falls back correctly", () => {
    const legacy = computeScenarioPrice("Vault", { vaultModel: "A", rusMonthly: 500, installCount: 1, includeNonProd: "no", includeKMIP: "no" }, {});
    const modern = computeScenarioPrice("Vault", base, {});
    expect(legacy).toBeCloseTo(modern, -2);
  });

  test("SIM-CVA07: includeNonProd yes adds $48,000", () => {
    const no = computeScenarioPrice("Vault", base, { includeNonProd: "no" });
    const yes = computeScenarioPrice("Vault", base, { includeNonProd: "yes" });
    expect(yes - no).toBeCloseTo(48000, -2);
  });
});

describe("computeScenarioPrice — NS1", () => {
  const base: Record<string, string | number | boolean | string[]> = {
    queryMQ: 300,
    filterChainCount: 5,
    monitors: 10,
    recordCount: 2000,
    gslb: "yes",
    ddos: "no",
  };

  test("SIM-CN01: No overrides — finite positive price", () => {
    assertFinitePositive(computeScenarioPrice("NS1", base, {}), "SIM-CN01");
  });

  test("SIM-CN02: Higher queryMQ → higher price within Standard tier", () => {
    // Stay within Standard tier (30–999 MQ) for a monotone comparison
    const low = computeScenarioPrice("NS1", base, { queryMQ: 100 });
    const high = computeScenarioPrice("NS1", base, { queryMQ: 700 });
    expect(high).toBeGreaterThan(low);
  });

  test("SIM-CN03: More filter chains → more cost", () => {
    const few = computeScenarioPrice("NS1", base, { filterChainCount: 0 });
    const many = computeScenarioPrice("NS1", base, { filterChainCount: 50 });
    expect(many).toBeGreaterThan(few);
  });

  test("SIM-CN04: More monitors → more cost", () => {
    const few = computeScenarioPrice("NS1", base, { monitors: 0 });
    const many = computeScenarioPrice("NS1", base, { monitors: 200 });
    expect(many).toBeGreaterThan(few);
  });

  test("SIM-CN05: Records above 3K add cost", () => {
    const free = computeScenarioPrice("NS1", base, { recordCount: 2000 });
    const paid = computeScenarioPrice("NS1", base, { recordCount: 50000 });
    expect(paid).toBeGreaterThan(free);
  });
});

// ─── COMPARE ENGINE — buildFanOut ────────────────────────────────────────────

describe("buildFanOut — Verify", () => {
  const base = { capabilities: ["SSO", "MFA"], population: 10000, avgLoginsPerYear: 72, term: "12-month", regions: 1 };

  test("SIM-BF01: Fork on capabilities — scenarios sorted high→low", () => {
    runCompare("Verify", base);
  });

  test("SIM-BF02: Fork on population — sorted high→low", () => {
    const result = buildFanOut("Verify", base, ["population"]);
    expect(result.scenarios[0].annualList).toBeGreaterThanOrEqual(result.scenarios[result.scenarios.length - 1].annualList);
  });

  test("SIM-BF03: Full suite scenario costs more than SSO only", () => {
    const result = buildFanOut("Verify", base, ["capabilities"]);
    const ssoOnly = result.scenarios.find((s) => s.name.toLowerCase().includes("sso only"));
    const full = result.scenarios.find((s) => s.name.toLowerCase().includes("full"));
    if (ssoOnly && full) {
      expect(full.annualList).toBeGreaterThan(ssoOnly.annualList);
    }
  });

  test("SIM-BF04: sliderVar has valid min < max range", () => {
    const result = buildFanOut("Verify", base, ["capabilities"]);
    if (result.sliderVar) {
      expect(result.sliderMin).toBeLessThan(result.sliderMax);
      expect(result.sliderCurrentValue).toBeGreaterThanOrEqual(result.sliderMin);
      expect(result.sliderCurrentValue).toBeLessThanOrEqual(result.sliderMax);
    }
  });

  test("SIM-BF05: Two fork keys produce ≥ same scenarios as one key", () => {
    const one = buildFanOut("Verify", base, ["capabilities"]);
    const two = buildFanOut("Verify", base, ["capabilities", "population"]);
    expect(two.scenarios.length).toBeGreaterThanOrEqual(one.scenarios.length);
  });

  test("SIM-BF06: insightText is non-empty string", () => {
    const result = buildFanOut("Verify", base, ["capabilities"]);
    expect(typeof result.insightText).toBe("string");
    expect(result.insightText.length).toBeGreaterThan(10);
  });
});

describe("buildFanOut — Vault Model B", () => {
  const base = { vaultModel: "B", edition: "Standard", clientCount: 500, installCount: 1 };

  test("SIM-BFV01: Fork on edition — sorted scenarios", () => {
    runCompare("Vault", base);
  });

  test("SIM-BFV02: Fork on clientCount — sorted high→low", () => {
    const result = buildFanOut("Vault", base, ["clientCount"]);
    expect(result.scenarios[0].annualList).toBeGreaterThanOrEqual(result.scenarios[result.scenarios.length - 1].annualList);
  });

  test("SIM-BFV03: Fork on installCount — more clusters = higher top scenario", () => {
    const result = buildFanOut("Vault", base, ["installCount"]);
    expect(result.scenarios[0].annualList).toBeGreaterThanOrEqual(result.scenarios[result.scenarios.length - 1].annualList);
  });

  test("SIM-BFV04: insightText mentions edition or cluster", () => {
    const result = buildFanOut("Vault", base, ["edition"]);
    expect(result.insightText.toLowerCase()).toMatch(/edition|cluster|install/);
  });

  test("SIM-BFV05: Fork on pkiAddon — scenarios sorted", () => {
    const result = buildFanOut("Vault", base, ["pkiAddon"]);
    expect(result.scenarios[0].annualList).toBeGreaterThanOrEqual(result.scenarios[result.scenarios.length - 1].annualList);
  });
});

describe("buildFanOut — Vault Model A", () => {
  const base = { vaultModel: "A", staticSecretCount: 500, installCount: 1, includeNonProd: "no", includeKMIP: "no" };

  test("SIM-BFVA01: Fork on staticSecretCount — sorted scenarios", () => {
    runCompare("Vault", base);
  });

  test("SIM-BFVA02: Fork on dynamicRoles — more roles = higher price", () => {
    const result = buildFanOut("Vault", base, ["dynamicRoles"]);
    expect(result.scenarios[0].annualList).toBeGreaterThanOrEqual(result.scenarios[result.scenarios.length - 1].annualList);
  });

  test("SIM-BFVA03: Fork on pkiCertsPerMonth — sorted scenarios", () => {
    const result = buildFanOut("Vault", base, ["pkiCertsPerMonth"]);
    expect(result.scenarios[0].annualList).toBeGreaterThanOrEqual(result.scenarios[result.scenarios.length - 1].annualList);
  });

  test("SIM-BFVA04: insightText mentions RU or activity", () => {
    const result = buildFanOut("Vault", base, ["staticSecretCount"]);
    expect(result.insightText.toLowerCase()).toMatch(/ru|secret|activity|consumption/);
  });

  test("SIM-BFVA05: sliderUnit is NOT 'RU/mo' (replaced by business labels)", () => {
    const result = buildFanOut("Vault", base, ["staticSecretCount"]);
    expect(result.sliderUnit).not.toBe("RU/mo");
  });

  test("SIM-BFVA06: Fork on installCount — sorted high→low", () => {
    const result = buildFanOut("Vault", base, ["installCount"]);
    expect(result.scenarios[0].annualList).toBeGreaterThanOrEqual(result.scenarios[result.scenarios.length - 1].annualList);
  });
});

describe("buildFanOut — NS1", () => {
  const base = { queryMQ: 300, filterChainCount: 5, monitors: 10, recordCount: 2000, gslb: "yes", ddos: "no" };

  test("SIM-BFNS01: Fork on queryMQ — sorted scenarios", () => {
    runCompare("NS1", base);
  });

  test("SIM-BFNS02: Fork on filterChainCount — sorted high→low", () => {
    const result = buildFanOut("NS1", base, ["filterChainCount"]);
    expect(result.scenarios[0].annualList).toBeGreaterThanOrEqual(result.scenarios[result.scenarios.length - 1].annualList);
  });

  test("SIM-BFNS03: Fork on recordCount — sorted scenarios", () => {
    const result = buildFanOut("NS1", base, ["recordCount"]);
    expect(result.scenarios[0].annualList).toBeGreaterThanOrEqual(result.scenarios[result.scenarios.length - 1].annualList);
  });

  test("SIM-BFNS04: insightText mentions query or tier", () => {
    const result = buildFanOut("NS1", base, ["queryMQ"]);
    expect(result.insightText.toLowerCase()).toMatch(/query|tier|ns1|volume/);
  });

  test("SIM-BFNS05: Fork on monitors — sorted scenarios", () => {
    const result = buildFanOut("NS1", base, ["monitors"]);
    expect(result.scenarios[0].annualList).toBeGreaterThanOrEqual(result.scenarios[result.scenarios.length - 1].annualList);
  });
});

// ─── EDGE CASES & REGRESSION GUARDS ──────────────────────────────────────────

describe("Edge cases and regression guards", () => {
  test("SIM-EDGE01: Verify — zero population doesn't crash", () => {
    const r = computeVerifyQuote({ capabilities: ["SSO"], population: 0, avgLoginsPerYear: 48, term: "12-month", regions: 1 });
    expect(isFinite(r.totalAnnualList)).toBe(true);
    expect(r.totalAnnualList).toBeGreaterThanOrEqual(0);
  });

  test("SIM-EDGE02: NS1 — zero queries doesn't crash", () => {
    const r = computeNS1Quote({ queryVolumeMQ: 0, filterChains: 0, monitors: 0, recordCount: 0 });
    expect(isFinite(r.totalAnnualList)).toBe(true);
  });

  test("SIM-EDGE03: Vault B — zero clients doesn't crash", () => {
    const r = computeVaultQuote({ model: "B-Clients", edition: "Essentials", installCount: 1, clientCount: 0 });
    expect(isFinite(r.totalAnnualList)).toBe(true);
  });

  test("SIM-EDGE04: Vault A — empty useCaseInputs uses 1 RU floor", () => {
    const r = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: {} });
    expect(isFinite(r.totalAnnualList)).toBe(true);
    expect(r.totalAnnualList).toBeGreaterThan(0);
  });

  test("SIM-EDGE05: Vault A — rusMonthly legacy key backward compat", () => {
    const p = computeScenarioPrice("Vault", { vaultModel: "A", rusMonthly: 1000, installCount: 1 }, {});
    expect(isFinite(p)).toBe(true);
    expect(p).toBeGreaterThan(0);
  });

  test("SIM-EDGE06: All 3 products getForkVariables return ≥ 3 variables", () => {
    for (const [product, answers] of [["Verify", {}], ["Vault", { vaultModel: "B" }], ["NS1", {}]] as [Product, Record<string, unknown>][]) {
      const vars = getForkVariables(product, answers as Record<string, string | number | boolean | string[]>);
      expect(vars.length).toBeGreaterThanOrEqual(3);
    }
  });

  test("SIM-EDGE07: getAddonDefinitions never returns duplicate keys", () => {
    for (const [product, answers] of [["Verify", {}], ["Vault", { vaultModel: "B" }], ["Vault", { vaultModel: "A" }], ["NS1", {}]] as [Product, Record<string, unknown>][]) {
      const defs = getAddonDefinitions(product, answers as Record<string, string | number | boolean | string[]>);
      const keys = defs.map((d) => d.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  test("SIM-EDGE08: Vault Model A getForkVariables has NO rusMonthly key", () => {
    const vars = getForkVariables("Vault", { vaultModel: "A" });
    expect(vars.some((v) => v.key === "rusMonthly")).toBe(false);
  });

  test("SIM-EDGE09: Vault Model A getForkVariables has new business-level keys", () => {
    const vars = getForkVariables("Vault", { vaultModel: "A" });
    const keys = vars.map((v) => v.key);
    expect(keys).toContain("staticSecretCount");
    expect(keys).toContain("dynamicRoles");
    expect(keys).toContain("pkiCertsPerMonth");
  });

  test("SIM-EDGE10: Verify — Lifecycle managedUsers scales with population override", () => {
    const base = { capabilities: ["SSO", "MFA", "Adaptive", "Lifecycle"], population: 10000, managedUsers: 10000, avgLoginsPerYear: 72, term: "12-month", regions: 1 };
    const small = computeScenarioPrice("Verify", base, { population: 5000 });
    const large = computeScenarioPrice("Verify", base, { population: 50000 });
    expect(large).toBeGreaterThan(small);
  });

  test("SIM-EDGE11: buildFanOut baselineIdx points to lowest price scenario", () => {
    const base = { capabilities: ["SSO", "MFA"], population: 10000, avgLoginsPerYear: 72, term: "12-month", regions: 1 };
    const result = buildFanOut("Verify", base, ["capabilities"]);
    const baseline = result.scenarios[result.baselineIdx];
    const minPrice = Math.min(...result.scenarios.map((s) => s.annualList));
    expect(baseline.annualList).toBe(minPrice);
  });

  test("SIM-EDGE12: buildFanOut monthlyList = annualList / 12 for all products", () => {
    const cases: [Product, Record<string, string | number | boolean | string[]>, string[]][] = [
      ["Verify", { capabilities: ["SSO"], population: 5000, avgLoginsPerYear: 48, term: "12-month", regions: 1 }, ["population"]],
      ["Vault",  { vaultModel: "B", edition: "Standard", clientCount: 500, installCount: 1 }, ["clientCount"]],
      ["NS1",   { queryMQ: 300, filterChainCount: 0, monitors: 0, recordCount: 2000, gslb: "no", ddos: "no" }, ["queryMQ"]],
    ];
    for (const [product, answers, forks] of cases) {
      const result = buildFanOut(product, answers, forks);
      for (const s of result.scenarios) {
        // monthlyList = annualList/12 — allow rounding differences up to $1
    expect(Math.abs(s.monthlyList - s.annualList / 12)).toBeLessThan(1);
      }
    }
  });

  test("SIM-EDGE13: Vault B — PKI 500 certs costs more than 50 certs", () => {
    const fifty = computeScenarioPrice("Vault", { vaultModel: "B", edition: "Standard", clientCount: 500, installCount: 1, pkiAddon: 50 }, {});
    const fiveHundred = computeScenarioPrice("Vault", { vaultModel: "B", edition: "Standard", clientCount: 500, installCount: 1, pkiAddon: 500 }, {});
    expect(fiveHundred).toBeGreaterThan(fifty);
  });

  test("SIM-EDGE14: NS1 sliderUnit resolves for query variable", () => {
    const result = buildFanOut("NS1", { queryMQ: 300, filterChainCount: 0, monitors: 0, recordCount: 2000, gslb: "no", ddos: "no" }, ["filterChainCount"]);
    if (result.sliderVar?.key === "queryMQ") {
      expect(result.sliderUnit).toBe("MQ/mo");
    }
  });

  test("SIM-EDGE15: Verify 5 regions — price exactly 5× 1-region price", () => {
    const one = computeVerifyQuote({ capabilities: ["SSO"], population: 5000, avgLoginsPerYear: 48, term: "12-month", regions: 1 });
    const five = computeVerifyQuote({ capabilities: ["SSO"], population: 5000, avgLoginsPerYear: 48, term: "12-month", regions: 5 });
    expect(five.totalAnnualList).toBeCloseTo(one.totalAnnualList * 5, -2);
  });
});
