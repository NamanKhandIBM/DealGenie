/**
 * pricing-accuracy.test.ts
 *
 * Hard-coded spot-check tests against known IBM public list prices.
 * These are the ground-truth regression guards — any pricing engine change
 * that shifts these numbers is a breaking change requiring explicit sign-off.
 *
 * Sources:
 *   Instana:     ibm.com/products/instana/pricing (July 2026)
 *   Turbonomic:  Seismic pricing deck Jul 9, 2026
 *   Terraform:   IBM HashiCorp Pricing Guidance Jun 18, 2026
 *   Concert:     IBM Concert GA Jul 7, 2026 (SaaS), Jun 12, 2026 (On-Prem)
 *   Vault 2.0:   IBM Vault Platform Parts deck (D15FQZX $96K/cluster, D15FKZX $48/RU/mo)
 *   MaaS360:     IBM MaaS360 public list (Apr 2024 Seismic, still current)
 *   webMethods:  IBM SaaS Calculator Oct 2024
 *   NS1:         IBM NS1 marketplace prices (confirmed)
 *   Verify:      IBM Security Verify public pricing
 */

import { computeInstanaQuote } from "../instana-engine";
import { computeTurbonomicScope } from "../turbonomic-engine";
import { computeTerraformRecommendation } from "../terraform-engine";
import { computeConcertRecommendation } from "../concert-engine";
import { computeVaultQuote } from "../vault-engine";
import { computeMaaS360Estimate } from "../maas360-engine";
import { computeWebMethodsScope } from "../webmethods-engine";
import { computeNS1Quote } from "../ns1-engine";
import { computeVerifyQuote } from "../verify-engine";

// ─── Instana ──────────────────────────────────────────────────────────────────

describe("Pricing accuracy — Instana SaaS", () => {
  test("PA-I01: Essentials SaaS 100 MVS = $21.20 × 100 × 12 = $25,440/yr", () => {
    const r = computeInstanaQuote({ model: "SaaS", tier: "Essentials", mvsCount: 100 });
    expect(r.totalAnnualList).toBeCloseTo(21.20 * 100 * 12, 0);
  });

  test("PA-I02: Standard SaaS 100 MVS = $79.50 × 100 × 12 = $95,400/yr", () => {
    const r = computeInstanaQuote({ model: "SaaS", tier: "Standard", mvsCount: 100 });
    expect(r.totalAnnualList).toBeCloseTo(79.50 * 100 * 12, 0);
  });

  test("PA-I03: Standard/Essentials ratio = 79.50 / 21.20 ≈ 3.75×", () => {
    const ess = computeInstanaQuote({ model: "SaaS", tier: "Essentials", mvsCount: 500 });
    const std = computeInstanaQuote({ model: "SaaS", tier: "Standard", mvsCount: 500 });
    expect(std.totalAnnualList / ess.totalAnnualList).toBeCloseTo(79.50 / 21.20, 1);
  });

  test("PA-I04: PayPerUse 730h/mo = $0.03 × 730 × 100 MVS × 12 mo = $26,280/yr", () => {
    const r = computeInstanaQuote({ model: "PayPerUse", tier: "Standard", mvsCount: 100, avgHoursPerMonth: 730 });
    expect(r.totalAnnualList).toBeCloseTo(0.03 * 730 * 100 * 12, 0);
  });
});

// ─── Turbonomic ───────────────────────────────────────────────────────────────

describe("Pricing accuracy — Turbonomic", () => {
  test("PA-T01: Commercial SaaS 500 MVS = $18.80 × 500 × 12 = $112,800/yr", () => {
    const r = computeTurbonomicScope({ deployment: "SaaS", estimatedMVS: 500, scopingModel: "mvs" });
    expect(r.totalAnnualList).toBeCloseTo(18.80 * 500 * 12, 0);
  });

  test("PA-T02: Government SaaS 500 MVS = $23.50 × 500 × 12 = $141,000/yr", () => {
    const r = computeTurbonomicScope({ deployment: "SaaS", estimatedMVS: 500, isGovernment: true, scopingModel: "mvs" });
    expect(r.totalAnnualList).toBeCloseTo(23.50 * 500 * 12, 0);
  });

  test("PA-T03: Gov/commercial rate ratio = 23.50 / 18.80 ≈ 1.25×", () => {
    const com = computeTurbonomicScope({ deployment: "SaaS", estimatedMVS: 1000, scopingModel: "mvs" });
    const gov = computeTurbonomicScope({ deployment: "SaaS", estimatedMVS: 1000, isGovernment: true, scopingModel: "mvs" });
    expect(gov.totalAnnualList / com.totalAnnualList).toBeCloseTo(23.50 / 18.80, 2);
  });

  test("PA-T04: Monitored Costs — $2M cloud spend = 20 units × $3,000/yr = $60,000/yr", () => {
    // 1 unit = $100K cloud spend. $2M / $100K = 20 units. Tier 1–25: $3,000/unit/yr. 20 × $3,000 = $60,000
    const r = computeTurbonomicScope({ deployment: "SaaS", estimatedMVS: 0, scopingModel: "monitoredCosts", annualCloudSpend: 2_000_000 });
    expect(r.scopingModel).toBe("monitoredCosts");
    expect(r.totalAnnualList).toBeCloseTo(60000, 0);
  });

  test("PA-T05: Monitored Costs — $10M cloud spend = 100 units × $1,908/yr = $190,800/yr", () => {
    // $10M / $100K = 100 units. Tier 76–100: $1,908/unit/yr. 100 × $1,908 = $190,800
    const r = computeTurbonomicScope({ deployment: "SaaS", estimatedMVS: 0, scopingModel: "monitoredCosts", annualCloudSpend: 10_000_000 });
    expect(r.scopingModel).toBe("monitoredCosts");
    expect(r.totalAnnualList).toBeCloseTo(190800, 0);
  });

  test("PA-T06: Monitored Costs — below minimum ($1.5M) returns cfq", () => {
    // $1.5M = 15 units, below the 16-unit minimum
    const r = computeTurbonomicScope({ deployment: "SaaS", estimatedMVS: 0, scopingModel: "monitoredCosts", annualCloudSpend: 1_500_000 });
    expect(r.scopingModel).toBe("cfq");
    expect(r.totalAnnualList).toBe(0);
  });
});

// ─── Terraform ────────────────────────────────────────────────────────────────

describe("Pricing accuracy — Terraform HCP", () => {
  test("PA-TF01: Standard 1,000 RUM = $5.16 × 1000 = $5,160/yr (no volume discount below 10K)", () => {
    const r = computeTerraformRecommendation({
      deployment: "HCP", estimatedManagedResources: 1000, teamSize: 5,
      needsGovernance: true, needsAuditLog: false,
    });
    expect(r.recommendedEdition).toBe("Standard");
    expect(r.totalAnnualList).toBeCloseTo(5160, 0);
  });

  test("PA-TF02: Premium 1,000 RUM = $10.80 × 1000 = $10,800/yr", () => {
    const r = computeTerraformRecommendation({
      deployment: "HCP", estimatedManagedResources: 1000, teamSize: 5,
      needsGovernance: true, needsAuditLog: true,
    });
    expect(r.recommendedEdition).toBe("Premium");
    expect(r.totalAnnualList).toBeCloseTo(10800, 0);
  });

  test("PA-TF03: Free tier (≤500 RUM, no governance need) = $0", () => {
    const r = computeTerraformRecommendation({
      deployment: "HCP", estimatedManagedResources: 400, teamSize: 2,
      needsGovernance: false, needsAuditLog: false,
    });
    expect(r.recommendedEdition).toBe("Free");
    expect(r.totalAnnualList).toBe(0);
  });

  test("PA-TF04: Premium > Standard at same RUM count", () => {
    const std = computeTerraformRecommendation({ deployment: "HCP", estimatedManagedResources: 5000, teamSize: 10, needsGovernance: true, needsAuditLog: false });
    const pre = computeTerraformRecommendation({ deployment: "HCP", estimatedManagedResources: 5000, teamSize: 10, needsGovernance: true, needsAuditLog: true });
    expect(pre.totalAnnualList).toBeGreaterThan(std.totalAnnualList);
  });
});

// ─── Concert ─────────────────────────────────────────────────────────────────

describe("Pricing accuracy — Concert", () => {
  test("PA-C01: On-prem price-per-RU = $212/RU/yr (D0MK3ZX)", () => {
    // alertFatigue + 100 MVS essentials = ceil(100/7) = 15 RU
    const r = computeConcertRecommendation({ primaryPain: "alertFatigue", deployment: "onprem", estimatedMVS: 100, observeTier: "essentials" });
    expect(r.pricePerRU).toBeCloseTo(212, 0);
    expect(r.totalAnnualList).toBeCloseTo(r.totalRU * 212, 0);
  });

  test("PA-C02: SaaS price-per-RU ≈ $1.06/RU/yr (5900BD6)", () => {
    const r = computeConcertRecommendation({ primaryPain: "alertFatigue", deployment: "saas", estimatedMVS: 100, observeTier: "essentials" });
    expect(r.pricePerRU).toBeLessThan(1.10);
    expect(r.pricePerRU).toBeGreaterThan(1.00);
  });

  test("PA-C03: SaaS significantly cheaper than on-prem at same RU count", () => {
    const base = { primaryPain: "alertFatigue" as const, estimatedMVS: 200, observeTier: "essentials" as const };
    const onprem = computeConcertRecommendation({ ...base, deployment: "onprem" });
    const saas   = computeConcertRecommendation({ ...base, deployment: "saas" });
    expect(onprem.totalAnnualList).toBeGreaterThan(saas.totalAnnualList * 100);
  });

  test("PA-C04: Protect module adds 3 RU per application", () => {
    const base = computeConcertRecommendation({ primaryPain: "riskPosture", deployment: "onprem", estimatedApplications: 10 });
    const more  = computeConcertRecommendation({ primaryPain: "riskPosture", deployment: "onprem", estimatedApplications: 20 });
    // 10 extra apps × 3 RU × $212 = $6,360 more
    expect(more.totalAnnualList - base.totalAnnualList).toBeCloseTo(10 * 3 * 212, -1);
  });
});

// ─── Vault 2.0 ───────────────────────────────────────────────────────────────

describe("Pricing accuracy — Vault 2.0 (Model A)", () => {
  test("PA-V01: 1 cluster install fee = $96,000/yr (D15FQZX)", () => {
    // Zero use-case RUs: only the install fee
    const r = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 0 } });
    expect(r.lines.find(l => l.part === "D15FQZX")?.annualList).toBeCloseTo(96000, 0);
  });

  test("PA-V02: RU rate = $48/RU/month = $576/RU/yr (D15FKZX)", () => {
    const one   = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 1 } });
    const onehK = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: 1001 } });
    // 1000 extra RU × $576/yr = $576,000 delta (before discounts)
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

// ─── MaaS360 ─────────────────────────────────────────────────────────────────

describe("Pricing accuracy — MaaS360", () => {
  test("PA-M01: Essentials 1,000 devices = $4.24 × 1000 × 12 = $50,880/yr", () => {
    const r = computeMaaS360Estimate({ devices: 1000, planKey: "Essentials", addOnKeys: [], includeConcierge: false });
    expect(r.annualList).toBeCloseTo(4.24 * 1000 * 12, 0);
  });

  test("PA-M02: Deluxe 1,000 devices = $5.30 × 1000 × 12 = $63,600/yr", () => {
    const r = computeMaaS360Estimate({ devices: 1000, planKey: "Deluxe", addOnKeys: [], includeConcierge: false });
    expect(r.annualList).toBeCloseTo(5.30 * 1000 * 12, 0);
  });

  test("PA-M03: Premier 1,000 devices = $6.63 × 1000 × 12 = $79,560/yr", () => {
    const r = computeMaaS360Estimate({ devices: 1000, planKey: "Premier", addOnKeys: [], includeConcierge: false });
    expect(r.annualList).toBeCloseTo(6.63 * 1000 * 12, 0);
  });

  test("PA-M04: Enterprise 1,000 devices = $9.54 × 1000 × 12 = $114,480/yr", () => {
    const r = computeMaaS360Estimate({ devices: 1000, planKey: "Enterprise", addOnKeys: [], includeConcierge: false });
    expect(r.annualList).toBeCloseTo(9.54 * 1000 * 12, 0);
  });

  test("PA-M05: Price scales linearly with devices (no volume breaks)", () => {
    const k1  = computeMaaS360Estimate({ devices: 1000,  planKey: "Essentials", addOnKeys: [], includeConcierge: false });
    const k10 = computeMaaS360Estimate({ devices: 10000, planKey: "Essentials", addOnKeys: [], includeConcierge: false });
    expect(k10.annualList / k1.annualList).toBeCloseTo(10, 1);
  });
});

// ─── webMethods ───────────────────────────────────────────────────────────────

describe("Pricing accuracy — webMethods SaaS", () => {
  test("PA-W01: Base subscription only (0 txn) = 720 RU × $11.54/RU/yr", () => {
    // 60 RU/mo × 12 = 720 RU. $11.54/RU/yr. ~$8,309/yr
    const r = computeWebMethodsScope({ needsAppIntegration: false, preferSaaS: true });
    const baseLine = r.lines.find(l => l.capability.includes("Base"));
    expect(baseLine).toBeDefined();
    expect(baseLine!.annualList).toBeGreaterThan(0);
    // RU count should be exactly 720 (60 RU/mo × 12)
    expect(baseLine!.rvuCount).toBe(720);
  });

  test("PA-W02: Integration transactions add cost above base", () => {
    const noTxn   = computeWebMethodsScope({ needsAppIntegration: true, preferSaaS: true, estimatedIntegrations: 0 });
    const withTxn = computeWebMethodsScope({ needsAppIntegration: true, preferSaaS: true, estimatedIntegrations: 100000 });
    expect(withTxn.totalAnnualList).toBeGreaterThan(noTxn.totalAnnualList);
  });

  test("PA-W03: API transactions add cost independently", () => {
    const noApi   = computeWebMethodsScope({ needsAPIManagement: true, preferSaaS: true, estimatedAPITransactions: 0 });
    const withApi = computeWebMethodsScope({ needsAPIManagement: true, preferSaaS: true, estimatedAPITransactions: 500000 });
    expect(withApi.totalAnnualList).toBeGreaterThan(noApi.totalAnnualList);
  });
});

// ─── NS1 ─────────────────────────────────────────────────────────────────────

describe("Pricing accuracy — NS1", () => {
  test("PA-N01: Standard tier (< 1000 MQ) — positive price", () => {
    const r = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 0 });
    expect(r.totalAnnualList).toBeGreaterThan(0);
    expect(r.tier).toBe("Standard");
  });

  test("PA-N02: Premium tier at ≥ 1000 MQ — is correctly flagged as Premium", () => {
    const pre = computeNS1Quote({ queryVolumeMQ: 1000, filterChains: 0, monitors: 0, recordCount: 0 });
    expect(pre.tier).toBe("Premium");
  });

  test("PA-N03: Standard DDoS is $0 (included) — no price change for ddosProtection flag", () => {
    // Spike/DDoS is INCLUDED in NS1 Connect Standard at no extra charge
    const no  = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 0, ddosProtection: false });
    const yes = computeNS1Quote({ queryVolumeMQ: 100, filterChains: 0, monitors: 0, recordCount: 0, ddosProtection: true });
    expect(yes.totalAnnualList).toBe(no.totalAnnualList);
    // Premium DDoS (D0GN5ZX) does add cost though
    const preDdos = computeNS1Quote({ queryVolumeMQ: 2000, filterChains: 0, monitors: 0, recordCount: 0, ddosProtection: true });
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
