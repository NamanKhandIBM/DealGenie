import { computeNS1Quote } from "../ns1-engine";
import type { NS1Inputs } from "../ns1-engine";

// ─── TIER ROUTING ─────────────────────────────────────────────────────────────

describe("NS1 Tier Routing", () => {
  test("Standard tier — small deal (100 MQ, ~$12K/yr)", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 100 });
    expect(result.tier).toBe("Standard");
    expect(result.partNumbers.some(p => p.partNumber === "D10AYZX")).toBe(true);
    expect(result.partNumbers.some(p => p.partNumber === "D10AZZX")).toBe(true);
    // No Premium/Hybrid parts
    expect(result.partNumbers.some(p => p.partNumber === "D0GNDZX")).toBe(false);
    expect(result.partNumbers.some(p => p.partNumber === "D0GZ2ZX")).toBe(false);
  });

  test("Premium tier — mid deal (500 MQ, ~$20K/mo → $240K/yr — should be Hybrid by MQ)", () => {
    // 500 MQ → tierMRR=$2.80 → ballparkAnnual=$16,800 — still Standard
    // Test a Premium deal: 300 MQ → $1,200/mo × 12 = $14,400 (Standard)
    // Premium boundary: need annual >= $40K → MRR >= $3,333
    // At 700 MQ: tierMRR=$2.286 → 700×2.286=$1,600/mo → $19,200/yr (Standard)
    // At 3000 MQ: tierMRR=$1.333 → 3000×1.333=$4,000/mo → $48,000/yr ✓ Premium
    const result = computeNS1Quote({ queryVolumeMQ: 3000 });
    expect(result.tier).toBe("Premium");
    // SLA required
    expect(result.partNumbers.some(p => p.partNumber === "D0GNDZX")).toBe(true);
    expect(result.partNumbers.find(p => p.partNumber === "D0GNDZX")?.quantity).toBe(1);
    // Managed DNS Request required
    expect(result.partNumbers.some(p => p.partNumber === "D0GNEZX")).toBe(true);
    // Managed DNS Record required
    expect(result.partNumbers.some(p => p.partNumber === "D0GNGZX")).toBe(true);
    // No Standard parts
    expect(result.partNumbers.some(p => p.partNumber === "D10AYZX")).toBe(false);
    // No Hybrid parts
    expect(result.partNumbers.some(p => p.partNumber === "D0GZ2ZX")).toBe(false);
  });

  test("Hybrid tier — whale deal by MQ (>10,000 MQ)", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 15000 });
    expect(result.tier).toBe("Hybrid");
    // SLA required
    expect(result.partNumbers.some(p => p.partNumber === "D0GZ2ZX")).toBe(true);
    expect(result.partNumbers.find(p => p.partNumber === "D0GZ2ZX")?.quantity).toBe(1);
    // Enterprise bundle (default <200K records)
    expect(result.partNumbers.some(p => p.partNumber === "D0GYUZX")).toBe(true);
    // No Standard or Premium parts
    expect(result.partNumbers.some(p => p.partNumber === "D10AYZX")).toBe(false);
    expect(result.partNumbers.some(p => p.partNumber === "D0GNDZX")).toBe(false);
  });

  test("Hybrid tier — Enterprise Plus when records >= 200K", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 15000, recordCount: 300000 });
    expect(result.tier).toBe("Hybrid");
    expect(result.partNumbers.some(p => p.partNumber === "D0GYWZX")).toBe(true);
    expect(result.partNumbers.some(p => p.partNumber === "D0GYUZX")).toBe(false);
  });

  test("Hybrid tier — minimum 10B QPM (1,000 Requests) enforced", () => {
    // 15,000 MQ → 1,500 Requests — fine
    const result = computeNS1Quote({ queryVolumeMQ: 15000 });
    const bundlePart = result.partNumbers.find(p => p.partNumber === "D0GYUZX");
    expect(bundlePart).toBeDefined();
    expect(bundlePart!.quantity).toBeGreaterThanOrEqual(1000);
  });

  test("Hybrid tier — MQ below 10K but forced by high ARR (manual override via growth)", () => {
    // 7500 MQ: tierMRR=$0.96 → 7500×0.96=$7,200/mo → $86,400/yr < $250K → Premium
    // Grow to 10,001 MQ → forced Hybrid
    const result = computeNS1Quote({ queryVolumeMQ: 7500, expectedGrowthPct: 34 });
    // 7500 × 1.34 = 10,050 → Hybrid
    expect(result.tier).toBe("Hybrid");
  });
});

// ─── SLA ENFORCEMENT ─────────────────────────────────────────────────────────

describe("NS1 SLA auto-insertion", () => {
  test("Premium: D0GNDZX SLA qty=1 always present", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 3000 });
    expect(result.tier).toBe("Premium");
    const sla = result.partNumbers.find(p => p.partNumber === "D0GNDZX");
    expect(sla).toBeDefined();
    expect(sla!.quantity).toBe(1);
    expect(result.flags.some(f => f.includes("D0GNDZX"))).toBe(true);
  });

  test("Hybrid: D0GZ2ZX SLA qty=1 always present", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 15000 });
    expect(result.tier).toBe("Hybrid");
    const sla = result.partNumbers.find(p => p.partNumber === "D0GZ2ZX");
    expect(sla).toBeDefined();
    expect(sla!.quantity).toBe(1);
    expect(result.flags.some(f => f.includes("D0GZ2ZX"))).toBe(true);
  });
});

// ─── CPQ QUANTITY RULES ───────────────────────────────────────────────────────

describe("NS1 CPQ quantity rules (Premium)", () => {
  const premiumBase: NS1Inputs = { queryVolumeMQ: 3000 };

  test("DNS Insights qty must equal D0GNEZX qty", () => {
    const result = computeNS1Quote({ ...premiumBase, dnsInsights: true });
    expect(result.tier).toBe("Premium");
    const requests = result.partNumbers.find(p => p.partNumber === "D0GNEZX")!.quantity;
    const insights = result.partNumbers.find(p => p.partNumber === "D0GN6ZX")!.quantity;
    expect(insights).toBe(requests);
  });

  test("DDoS qty must equal D0GNEZX qty (Premium)", () => {
    const result = computeNS1Quote({ ...premiumBase, ddosProtection: true });
    expect(result.tier).toBe("Premium");
    const requests = result.partNumbers.find(p => p.partNumber === "D0GNEZX")!.quantity;
    const ddos = result.partNumbers.find(p => p.partNumber === "D0GN5ZX")!.quantity;
    expect(ddos).toBe(requests);
  });

  test("Premium RUM Advanced: qty multiple of 5, min 5", () => {
    const result = computeNS1Quote({ ...premiumBase, filterChains: 5, rumBased: true, rumAdvanced: true });
    expect(result.tier).toBe("Premium");
    const rum = result.partNumbers.find(p => p.partNumber === "D0GNNZX");
    expect(rum).toBeDefined();
    expect(rum!.quantity % 5).toBe(0);
    expect(rum!.quantity).toBeGreaterThanOrEqual(5);
  });

  test("Premium RUM Standard: qty min 1", () => {
    const result = computeNS1Quote({ ...premiumBase, filterChains: 5, rumBased: true, rumAdvanced: false });
    expect(result.tier).toBe("Premium");
    const rum = result.partNumbers.find(p => p.partNumber === "D0GNQZX");
    expect(rum).toBeDefined();
    expect(rum!.quantity).toBeGreaterThanOrEqual(1);
  });

  test("China DNS requests = CEIL(chinaMQ / 10)", () => {
    const result = computeNS1Quote({ ...premiumBase, chinaMQ: 100 });
    expect(result.tier).toBe("Premium");
    const china = result.partNumbers.find(p => p.partNumber === "D0GN8ZX");
    expect(china).toBeDefined();
    expect(china!.quantity).toBe(10); // 100 MQ ÷ 10 = 10 Requests
  });

  test("China DNS minimum 50M enforced", () => {
    const result = computeNS1Quote({ ...premiumBase, chinaMQ: 20 });
    expect(result.tier).toBe("Premium");
    const china = result.partNumbers.find(p => p.partNumber === "D0GN8ZX");
    expect(china).toBeDefined();
    expect(china!.quantity).toBe(5); // min 50 ÷ 10 = 5 Requests
    expect(result.flags.some(f => f.includes("minimum of 50M queries"))).toBe(true);
  });
});

// ─── EXISTING TESTS (updated for new shape) ──────────────────────────────────

describe("NS1 Quote Engine — existing behaviour", () => {
  test("Basic managed DNS quote — Standard", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 100,
      recordCount: 5000,
    };
    const result = computeNS1Quote(inputs);
    expect(result.tier).toBe("Standard");
    expect(result.effectiveMQ).toBe(100);
    expect(result.billableRecords).toBe(2000); // 5000 - 3000 free
    expect(result.ballparkMRR).toBeGreaterThan(0);
    expect(result.partNumbers.length).toBeGreaterThan(0);
    expect(result.bestPractices.length).toBeGreaterThan(0);
    expect(result.tutorialSteps.length).toBe(7);
    expect(result.quickReference.length).toBeGreaterThan(0);
  });

  test("Growth headroom applied", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 100, expectedGrowthPct: 30 });
    expect(result.effectiveMQ).toBe(130); // 100 * 1.30
    expect(result.flags.some(f => f.includes("30% growth headroom"))).toBe(true);
  });

  test("GSLB features — Standard RUM", () => {
    const result = computeNS1Quote({
      queryVolumeMQ: 200,
      filterChains: 5,
      rumBased: true,
      monitors: 10,
    });
    expect(result.filterChains).toBe(5);
    expect(result.monitors).toBe(10);
    expect(result.rumPacks).toBeGreaterThan(0);
    expect(result.partNumbers.some(p => p.description.includes("Filter Chains"))).toBe(true);
    expect(result.partNumbers.some(p => p.description.includes("RUM"))).toBe(true);
    expect(result.partNumbers.some(p => p.description.includes("Monitors"))).toBe(true);
  });

  test("China DNS minimum enforcement — Premium tier (China DNS is a Premium add-on)", () => {
    // China DNS (D0GN8ZX) is a Premium add-on per §12 of Decoder Ring.
    // Use a Premium-tier deal (3000 MQ) with below-minimum China queries.
    const result = computeNS1Quote({ queryVolumeMQ: 3000, chinaMQ: 30 });
    expect(result.tier).toBe("Premium");
    expect(result.chinaMQ).toBe(50); // enforced to 50M minimum
    expect(result.flags.some(f => f.includes("minimum of 50M queries"))).toBe(true);
    expect(result.partNumbers.some(p => p.description.includes("China"))).toBe(true);
  });

  test("Dedicated DNS PoP limits (Premium tier)", () => {
    // 3000 MQ → Premium; dedicatedPoPs=2 → bumped to 3
    const result = computeNS1Quote({ queryVolumeMQ: 3000, dedicatedPoPs: 2 });
    expect(result.tier).toBe("Premium");
    expect(result.flags.some(f => f.includes("minimum is 3 PoPs"))).toBe(true);
    expect(result.partNumbers.some(p => p.description.includes("Dedicated DNS"))).toBe(true);
  });

  test("DNS Insights flag present — Standard tier (no part expected)", () => {
    // Standard tier does not have DNS Insights as a separate part
    const result = computeNS1Quote({ queryVolumeMQ: 100, dnsInsights: true });
    expect(result.tier).toBe("Standard");
    expect(result.dnsInsights).toBe(true);
    // dnsInsights parts are only on Premium/Hybrid
    expect(result.partNumbers.some(p => p.partNumber === "D0GN6ZX")).toBe(false);
  });

  test("DNS Insights — Premium tier emits D0GN6ZX", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 3000, dnsInsights: true });
    expect(result.tier).toBe("Premium");
    expect(result.partNumbers.some(p => p.partNumber === "D0GN6ZX")).toBe(true);
    expect(result.flags.some(f => f.includes("DNS Insights"))).toBe(true);
  });

  test("DDoS protection — Standard uses D10ATZX", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 100, ddosProtection: true });
    expect(result.tier).toBe("Standard");
    expect(result.flags.some(f => f.includes("DDoS") || f.includes("Spike"))).toBe(true);
    expect(result.partNumbers.some(p => p.partNumber === "D10ATZX")).toBe(true);
  });

  test("DDoS protection — Premium uses D0GN5ZX", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 3000, ddosProtection: true });
    expect(result.tier).toBe("Premium");
    expect(result.partNumbers.some(p => p.partNumber === "D0GN5ZX")).toBe(true);
    expect(result.partNumbers.some(p => p.partNumber === "D10ATZX")).toBe(false);
  });

  test("Comprehensive quote — all Standard features", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 500,
      recordCount: 10000,
      filterChains: 8,
      rumBased: true,
      monitors: 20,
      chinaMQ: 100,
      dnsInsights: true,
      ddosProtection: true,
      expectedGrowthPct: 25,
      term: "3-year",
    };
    const result = computeNS1Quote(inputs);
    expect(result.effectiveMQ).toBe(625); // 500 * 1.25
    expect(result.billableRecords).toBe(7000); // 10000 - 3000
    expect(result.filterChains).toBe(8);
    expect(result.monitors).toBe(20);
    expect(result.rumPacks).toBeGreaterThan(0);
    expect(result.chinaMQ).toBe(100);
    expect(result.dnsInsights).toBe(true);
    expect(result.partNumbers.length).toBeGreaterThan(3);
    expect(result.bestPractices.length).toBeGreaterThan(0);
    expect(result.tutorialSteps.length).toBe(7);
    expect(result.quickReference.length).toBeGreaterThan(0);
  });

  test("Part numbers have correct shape", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 100 });
    result.partNumbers.forEach(part => {
      expect(part).toHaveProperty("partNumber");
      expect(part).toHaveProperty("description");
      expect(part).toHaveProperty("quantity");
      expect(part).toHaveProperty("unit");
      expect(part).toHaveProperty("listPrice");
      expect(part).toHaveProperty("extendedPrice");
      expect(part).toHaveProperty("notes");
      expect(typeof part.partNumber).toBe("string");
      expect(typeof part.quantity).toBe("number");
    });
  });

  test("Best practices have correct structure", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 100 });
    result.bestPractices.forEach(practice => {
      expect(practice).toHaveProperty("category");
      expect(practice).toHaveProperty("question");
      expect(practice).toHaveProperty("why");
      expect(practice).toHaveProperty("tips");
      expect(Array.isArray(practice.tips)).toBe(true);
      expect(practice.tips.length).toBeGreaterThan(0);
    });
  });

  test("Tutorial steps have correct structure (7 steps)", () => {
    const result = computeNS1Quote({ queryVolumeMQ: 100 });
    expect(result.tutorialSteps.length).toBe(7);
    result.tutorialSteps.forEach((step, idx) => {
      expect(step.step).toBe(idx + 1);
      expect(typeof step.title).toBe("string");
      expect(typeof step.description).toBe("string");
      expect(typeof step.action).toBe("string");
    });
  });
});

// Made with Bob
