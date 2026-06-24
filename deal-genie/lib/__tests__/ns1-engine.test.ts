import { computeNS1Quote } from "../ns1-engine";
import type { NS1Inputs } from "../ns1-engine";

describe("NS1 Quote Engine", () => {
  test("Basic managed DNS quote", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 100,
      recordCount: 5000,
    };

    const result = computeNS1Quote(inputs);

    expect(result.effectiveMQ).toBe(100);
    expect(result.billableRecords).toBe(2000); // 5000 - 3000 free
    expect(result.ballparkMRR).toBeGreaterThan(0);
    expect(result.partNumbers.length).toBeGreaterThan(0);
    expect(result.bestPractices.length).toBeGreaterThan(0);
    expect(result.tutorialSteps.length).toBe(7);
    expect(result.quickReference.length).toBeGreaterThan(0);
  });

  test("Quote with growth headroom", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 100,
      expectedGrowthPct: 30,
    };

    const result = computeNS1Quote(inputs);

    expect(result.effectiveMQ).toBe(130); // 100 * 1.30
    expect(result.flags.some(f => f.includes("30% growth headroom"))).toBe(true);
  });

  test("Quote with GSLB features", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 200,
      filterChains: 5,
      rumBased: true,
      monitors: 10,
    };

    const result = computeNS1Quote(inputs);

    expect(result.filterChains).toBe(5);
    expect(result.monitors).toBe(10);
    expect(result.rumPacks).toBeGreaterThan(0);
    
    // Check that GSLB parts are included
    const hasFilterChains = result.partNumbers.some(p => p.description.includes("Filter Chains"));
    const hasRUMPacks = result.partNumbers.some(p => p.description.includes("RUM"));
    const hasMonitors = result.partNumbers.some(p => p.description.includes("Monitors"));
    
    expect(hasFilterChains).toBe(true);
    expect(hasRUMPacks).toBe(true);
    expect(hasMonitors).toBe(true);
  });

  test("Quote with China DNS (minimum enforcement)", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 100,
      chinaMQ: 30, // Below minimum of 50
    };

    const result = computeNS1Quote(inputs);

    expect(result.chinaMQ).toBe(50); // Should be enforced to minimum
    expect(result.flags.some(f => f.includes("minimum of 50M queries"))).toBe(true);
    
    const hasChinaDNS = result.partNumbers.some(p => p.description.includes("China"));
    expect(hasChinaDNS).toBe(true);
  });

  test("Quote with Dedicated DNS (PoP limits)", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 500,
      dedicatedPoPs: 2, // Below minimum of 3
    };

    const result = computeNS1Quote(inputs);

    expect(result.flags.some(f => f.includes("minimum is 3 PoPs"))).toBe(true);
    
    const hasDedicatedDNS = result.partNumbers.some(p => p.description.includes("Dedicated DNS"));
    expect(hasDedicatedDNS).toBe(true);
  });

  test("Quote with DNS Insights", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 100,
      dnsInsights: true,
    };

    const result = computeNS1Quote(inputs);

    expect(result.dnsInsights).toBe(true);
    expect(result.flags.some(f => f.includes("DNS Insights"))).toBe(true);
    
    const hasInsights = result.partNumbers.some(p => p.description.includes("DNS Insights"));
    expect(hasInsights).toBe(true);
  });

  test("Quote with DDoS protection", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 100,
      ddosProtection: true,
    };

    const result = computeNS1Quote(inputs);

    expect(result.flags.some(f => f.includes("DDoS"))).toBe(true);
    
    const hasDDoS = result.partNumbers.some(p => p.description.includes("DDoS"));
    expect(hasDDoS).toBe(true);
  });

  test("Comprehensive quote with all features", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 500,
      recordCount: 10000,
      filterChains: 8,
      rumBased: true,
      monitors: 20,
      dedicatedPoPs: 5,
      chinaMQ: 100,
      dnsInsights: true,
      ddosProtection: true,
      expectedGrowthPct: 25,
      term: "3-year",
    };

    const result = computeNS1Quote(inputs);

    // Verify all components are present
    expect(result.effectiveMQ).toBe(625); // 500 * 1.25
    expect(result.billableRecords).toBe(7000); // 10000 - 3000
    expect(result.filterChains).toBe(8);
    expect(result.monitors).toBe(20);
    expect(result.rumPacks).toBeGreaterThan(0);
    expect(result.chinaMQ).toBe(100);
    expect(result.dnsInsights).toBe(true);
    
    // Verify part numbers include all components
    expect(result.partNumbers.length).toBeGreaterThan(5);
    
    // Verify educational content is included
    expect(result.bestPractices.length).toBeGreaterThan(0);
    expect(result.tutorialSteps.length).toBe(7);
    expect(result.quickReference.length).toBeGreaterThan(0);
  });

  test("Part numbers have correct structure", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 100,
    };

    const result = computeNS1Quote(inputs);

    result.partNumbers.forEach(part => {
      expect(part).toHaveProperty("partNumber");
      expect(part).toHaveProperty("description");
      expect(part).toHaveProperty("quantity");
      expect(part).toHaveProperty("unit");
      expect(part).toHaveProperty("listPrice");
      expect(part).toHaveProperty("extendedPrice");
      expect(part).toHaveProperty("notes");
      
      expect(typeof part.partNumber).toBe("string");
      expect(typeof part.description).toBe("string");
      expect(typeof part.quantity).toBe("number");
      expect(typeof part.unit).toBe("string");
      expect(typeof part.notes).toBe("string");
    });
  });

  test("Best practices have correct structure", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 100,
    };

    const result = computeNS1Quote(inputs);

    result.bestPractices.forEach(practice => {
      expect(practice).toHaveProperty("category");
      expect(practice).toHaveProperty("question");
      expect(practice).toHaveProperty("why");
      expect(practice).toHaveProperty("tips");
      
      expect(typeof practice.category).toBe("string");
      expect(typeof practice.question).toBe("string");
      expect(typeof practice.why).toBe("string");
      expect(Array.isArray(practice.tips)).toBe(true);
      expect(practice.tips.length).toBeGreaterThan(0);
    });
  });

  test("Tutorial steps have correct structure", () => {
    const inputs: NS1Inputs = {
      queryVolumeMQ: 100,
    };

    const result = computeNS1Quote(inputs);

    expect(result.tutorialSteps.length).toBe(7);
    
    result.tutorialSteps.forEach((step, idx) => {
      expect(step).toHaveProperty("step");
      expect(step).toHaveProperty("title");
      expect(step).toHaveProperty("description");
      expect(step).toHaveProperty("action");
      
      expect(step.step).toBe(idx + 1);
      expect(typeof step.title).toBe("string");
      expect(typeof step.description).toBe("string");
      expect(typeof step.action).toBe("string");
    });
  });
});

// Made with Bob
