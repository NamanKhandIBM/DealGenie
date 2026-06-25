import { computeVerifyQuote, deriveMAU } from "../verify-engine";
import { VERIFY_RU_TIERS } from "../data";

// ─── MAU derivation ──────────────────────────────────────────────────────────

describe("deriveMAU", () => {
  test("active every month (12/12) → full population counts", () => {
    expect(deriveMAU(10000, 12)).toBe(10000);
  });

  test("active 6 months/year → half population counts", () => {
    expect(deriveMAU(10000, 6)).toBe(5000);
  });

  test("active 3 months/year → 25% of population counts", () => {
    expect(deriveMAU(10000, 3)).toBe(2500);
  });

  test("active 1 month/year → ~8% of population counts", () => {
    expect(deriveMAU(10000, 1)).toBe(Math.ceil(10000 * 1 / 12)); // 834
  });

  test("active months capped at 12 — values above 12 still give full population", () => {
    // Should never happen with new UI, but engine must be safe
    expect(deriveMAU(10000, 13)).toBe(10000);
    expect(deriveMAU(10000, 365)).toBe(10000);
  });

  test("login frequency within a month is irrelevant — same result for all frequencies", () => {
    // Whether a user logs in once or 100× in a month, they are counted once per active month.
    // Both produce the same activeMonths value when the question is answered correctly.
    // For 10,000 users active every month, MAU = 10,000 regardless of per-month login count.
    expect(deriveMAU(10000, 12)).toBe(10000);
  });

  test("exact population inputs produce deterministic MAU", () => {
    expect(deriveMAU(7500, 12)).toBe(7500);
    expect(deriveMAU(1, 12)).toBe(1);
    expect(deriveMAU(999999, 12)).toBe(999999);
  });
});

// ─── SSO / MFA / Adaptive multipliers are identical ─────────────────────────

describe("SSO, MFA, Adaptive — equal multipliers at every tier", () => {
  const population = 50000;
  const avgLogins = 12; // MAU = population

  test("SSO and MFA produce identical RU for same population", () => {
    const sso = computeVerifyQuote({ capabilities: ["SSO"], population, avgLoginsPerYear: avgLogins });
    const mfa = computeVerifyQuote({ capabilities: ["MFA"], population, avgLoginsPerYear: avgLogins });
    expect(sso.totalRU).toBe(mfa.totalRU);
  });

  test("SSO and Adaptive produce identical RU for same population", () => {
    const sso      = computeVerifyQuote({ capabilities: ["SSO"],      population, avgLoginsPerYear: avgLogins });
    const adaptive = computeVerifyQuote({ capabilities: ["Adaptive"], population, avgLoginsPerYear: avgLogins });
    expect(sso.totalRU).toBe(adaptive.totalRU);
  });

  test("All three selected together = exactly 3× single-capability RU", () => {
    const single  = computeVerifyQuote({ capabilities: ["SSO"],                    population, avgLoginsPerYear: avgLogins });
    const allThree = computeVerifyQuote({ capabilities: ["SSO", "MFA", "Adaptive"], population, avgLoginsPerYear: avgLogins });
    expect(allThree.totalRU).toBe(single.totalRU * 3);
  });
});

// ─── Lifecycle (Governance) multiplier is DISTINCT ──────────────────────────

describe("Lifecycle (Governance) — distinct multiplier from SSO/MFA/Adaptive", () => {
  const managedUsers = 10000;

  test("Lifecycle RU is higher than SSO RU for the same user count at low volumes", () => {
    // Tier-1 rate: Lifecycle = 0.29, SSO = 0.10 → Lifecycle must produce more RU at small counts
    const lifecycle = computeVerifyQuote({
      capabilities: ["Lifecycle"],
      population: managedUsers,
      avgLoginsPerYear: 12,
      managedUsers,
    });
    const sso = computeVerifyQuote({
      capabilities: ["SSO"],
      population: managedUsers,
      avgLoginsPerYear: 12,
    });
    expect(lifecycle.totalRU).toBeGreaterThan(sso.totalRU);
  });

  test("Lifecycle rate tier-1 = 0.29 (not 0.10 like SSO/MFA/Adaptive)", () => {
    const tier1 = VERIFY_RU_TIERS[0];
    expect(tier1.Lifecycle).toBe(0.29);
    expect(tier1.SSO).toBe(0.10);
    expect(tier1.MFA).toBe(0.10);
    expect(tier1.Adaptive).toBe(0.10);
    // Confirm Lifecycle !== SSO at tier 1
    expect(tier1.Lifecycle).not.toBe(tier1.SSO);
  });

  test("SSO + Lifecycle combination: total RU = SSO RU + Lifecycle RU", () => {
    const mau = 10000;
    const ssoOnly = computeVerifyQuote({ capabilities: ["SSO"], population: mau, avgLoginsPerYear: 12 });
    const lcOnly  = computeVerifyQuote({ capabilities: ["Lifecycle"], population: mau, avgLoginsPerYear: 12, managedUsers: mau });
    const combined = computeVerifyQuote({ capabilities: ["SSO", "Lifecycle"], population: mau, avgLoginsPerYear: 12, managedUsers: mau });
    expect(combined.totalRU).toBe(ssoOnly.totalRU + lcOnly.totalRU);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe("RU edge cases", () => {
  test("Single user produces non-zero RU", () => {
    const result = computeVerifyQuote({ capabilities: ["SSO"], population: 1, avgLoginsPerYear: 12 });
    expect(result.totalRU).toBeGreaterThan(0);
    expect(result.mau).toBe(1);
  });

  test("Lifecycle with no managed users emits a warning flag", () => {
    const result = computeVerifyQuote({
      capabilities: ["Lifecycle"],
      population: 5000,
      avgLoginsPerYear: 12,
      managedUsers: 0,
    });
    expect(result.flags.some((f) => f.includes("No managed users"))).toBe(true);
  });

  test("Lifecycle with 0 managed users produces 0 RU for lifecycle portion", () => {
    const result = computeVerifyQuote({
      capabilities: ["Lifecycle"],
      population: 5000,
      avgLoginsPerYear: 12,
      managedUsers: 0,
    });
    // 0 × any_rate = 0
    expect(result.totalRU).toBe(0);
  });

  test("All five capabilities selected: RU is additive", () => {
    const population = 20000;
    const managedUsers = 20000;
    const avgLoginsPerYear = 12;

    const individual = ["SSO", "MFA", "Adaptive", "Lifecycle"].map((cap) =>
      computeVerifyQuote({
        capabilities: [cap as never],
        population,
        avgLoginsPerYear,
        managedUsers,
      }).totalRU
    );
    const all = computeVerifyQuote({
      capabilities: ["SSO", "MFA", "Adaptive", "Lifecycle"],
      population,
      avgLoginsPerYear,
      managedUsers,
    });
    // Sum of individual should equal combined (RU is purely additive)
    const sumIndividual = individual.reduce((a, b) => a + b, 0);
    expect(all.totalRU).toBe(Math.ceil(sumIndividual));
  });

  test("Large population (1M users) stays within tier bounds and produces finite RU", () => {
    const result = computeVerifyQuote({
      capabilities: ["SSO", "MFA"],
      population: 1_000_000,
      avgLoginsPerYear: 12,
    });
    expect(result.totalRU).toBeGreaterThan(0);
    expect(isFinite(result.totalRU)).toBe(true);
    expect(result.mau).toBe(1_000_000);
  });

  test("3-year term flag is present when term = 3-year", () => {
    const result = computeVerifyQuote({
      capabilities: ["SSO"],
      population: 1000,
      avgLoginsPerYear: 12,
      term: "3-year",
    });
    expect(result.flags.some((f) => f.includes("3-year"))).toBe(true);
  });

  test("12-month term has no 3-year flag", () => {
    const result = computeVerifyQuote({
      capabilities: ["SSO"],
      population: 1000,
      avgLoginsPerYear: 12,
      term: "12-month",
    });
    expect(result.flags.some((f) => f.includes("3-year"))).toBe(false);
  });

  test("toggling between SSO-only and SSO+MFA+Adaptive gives correct 3× ratio", () => {
    const base = computeVerifyQuote({ capabilities: ["SSO"], population: 5000, avgLoginsPerYear: 12 });
    const all  = computeVerifyQuote({ capabilities: ["SSO", "MFA", "Adaptive"], population: 5000, avgLoginsPerYear: 12 });
    expect(all.totalRU).toBe(base.totalRU * 3);
  });
});
