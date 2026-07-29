/**
 * pricing-accuracy.test.ts
 *
 * Hard-coded spot-check tests against known IBM public list prices.
 * These are the ground-truth regression guards — any pricing engine change
 * that shifts these numbers is a breaking change requiring explicit sign-off.
 *
 * Sources:
 *   Vault 2.0:   IBM Vault Platform Parts deck (D15FQZX $96K/cluster, D15FKZX $48/RU/mo)
 *   NS1:         IBM NS1 marketplace prices (confirmed)
 *   Verify:      IBM Security Verify public pricing
 */

import { computeVaultQuote } from "../vault-engine";
import { computeNS1Quote } from "../ns1-engine";
import { computeVerifyQuote } from "../verify-engine";

// ─── Vault 2.0 ───────────────────────────────────────────────────────────────

describe("Pricing accuracy — Vault 2.0 (Model A)", () => {
  test("PA-V01: 1 cluster install fee = $96,000/yr (D15FQZX)", () => {
    const r = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 0 } });
    expect(r.lines.find(l => l.part === "D15FQZX")?.annualList).toBeCloseTo(96000, 0);
  });

  test("PA-V02: RU rate = $48/RU/month = $576/RU/yr (D15FKZX)", () => {
    const one   = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 1 } });
    const onehK = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 1001 } });
    expect(onehK.totalAnnualList - one.totalAnnualList).toBeCloseTo(1000 * 576, -2);
  });

  test("PA-V03: Non-prod cluster = $48,000/yr (D155GZX)", () => {
    const no  = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 100 }, includeNonProd: false });
    const yes = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 100 }, includeNonProd: true });
    expect(yes.totalAnnualList - no.totalAnnualList).toBeCloseTo(48000, 0);
  });

  test("PA-V04: KMIP install = $360K/cluster vs standard $96K = $264K delta (D155LZX)", () => {
    const no  = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 100 }, includeKMIP: false });
    const yes = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 100 }, includeKMIP: true });
    expect(yes.totalAnnualList - no.totalAnnualList).toBeCloseTo(264000, 0);
  });

  test("PA-V05: 2 clusters = 2× install fee ($192K) + shared RU cost", () => {
    const one = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 100 } });
    const two = computeVaultQuote({ model: "A-Platform", installCount: 2, useCaseInputs: { staticSecretCount: 100 } });
    expect(two.totalAnnualList - one.totalAnnualList).toBeCloseTo(96000, -2);
  });
});

// ─── NS1 ─────────────────────────────────────────────────────────────────────

describe("Pricing accuracy — NS1", () => {
  test("PA-N01: Standard tier (< 1000 MQ) — positive price", () => {
    const r = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 0 });
    expect(r.totalAnnualList).toBeGreaterThan(0);
    expect(r.tier).toBe("Standard");
  });

  test("PA-N02: Premium tier at ≥ 1000 MQ — correctly flagged as Premium", () => {
    const pre = computeNS1Quote({ queryVolumeMQ: 1000, filterChains: 0, monitors: 0, recordCount: 0 });
    expect(pre.tier).toBe("Premium");
  });

  test("PA-N03: Standard DDoS is $0 (included) — no price change for ddosProtection flag", () => {
    const no  = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 0, ddosProtection: false });
    const yes = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 0, ddosProtection: true });
    expect(yes.totalAnnualList).toBe(no.totalAnnualList);
    const preDdos   = computeNS1Quote({ queryVolumeMQ: 2000, filterChains: 0, monitors: 0, recordCount: 0, ddosProtection: true });
    const preNoDdos = computeNS1Quote({ queryVolumeMQ: 2000, filterChains: 0, monitors: 0, recordCount: 0, ddosProtection: false });
    expect(preDdos.totalAnnualList).toBeGreaterThan(preNoDdos.totalAnnualList);
  });
});

// ─── Verify ───────────────────────────────────────────────────────────────────

describe("Pricing accuracy — IBM Security Verify", () => {
  test("PA-VY01: SSO only 10K users 12mo — positive price", () => {
    const r = computeVerifyQuote({ capabilities: ["SSO"], population: 10000, avgLoginsPerYear: 12, term: "12-month", regions: 1 });
    expect(r.totalAnnualList).toBeGreaterThan(0);
  });

  test("PA-VY02: 3-year term ≤ 12-month term (no penalty for commitment)", () => {
    const yr1 = computeVerifyQuote({ capabilities: ["SSO"], population: 10000, avgLoginsPerYear: 12, term: "12-month", regions: 1 });
    const yr3 = computeVerifyQuote({ capabilities: ["SSO"], population: 10000, avgLoginsPerYear: 12, term: "3-year",   regions: 1 });
    expect(yr3.totalAnnualList).toBeLessThanOrEqual(yr1.totalAnnualList);
  });

  test("PA-VY03: Full suite (SSO+MFA+Adaptive+Lifecycle) > SSO only", () => {
    const sso  = computeVerifyQuote({ capabilities: ["SSO"],                             population: 10000, avgLoginsPerYear: 12, managedUsers: 0,     term: "12-month", regions: 1 });
    const full = computeVerifyQuote({ capabilities: ["SSO","MFA","Adaptive","Lifecycle"], population: 10000, avgLoginsPerYear: 12, managedUsers: 10000, term: "12-month", regions: 1 });
    expect(full.totalAnnualList).toBeGreaterThan(sso.totalAnnualList);
  });

  test("PA-VY04: Multi-region multiplies price", () => {
    const r1 = computeVerifyQuote({ capabilities: ["SSO"], population: 5000, avgLoginsPerYear: 12, term: "12-month", regions: 1 });
    const r3 = computeVerifyQuote({ capabilities: ["SSO"], population: 5000, avgLoginsPerYear: 12, term: "12-month", regions: 3 });
    expect(r3.totalAnnualList).toBeCloseTo(r1.totalAnnualList * 3, -2);
  });
});
