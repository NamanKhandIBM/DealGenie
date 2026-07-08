"use client";

/**
 * ScenarioCompare.tsx
 *
 * Single-variable exploration with breadcrumb locking.
 *
 * The seller explores ONE variable at a time — never more than 6 cards.
 * After seeing the options they click "Set as baseline" on any card,
 * which locks that choice into the breadcrumb trail and opens a fresh
 * variable picker to explore the next question.
 *
 * This mirrors a real sales conversation: one question at a time,
 * each answer building on the last.
 *
 * No AI. Zero extra API calls.
 */

import { useState, useMemo } from "react";
import type { Product } from "@/lib/types";
import {
  getForkVariables,
  buildFanOut,
  computeSliderPrice,
  type ForkVariable,
  type CompareResult,
  type Scenario,
} from "@/lib/compare-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Crumb {
  varLabel: string;
  choiceLabel: string;
  overrides: Record<string, string | number | boolean | string[]>;
}

interface Props {
  product: Product;
  answers: Record<string, string | number | boolean | string[]>;
  onClose: () => void;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const COLORS  = ["#a78bfa", "#3b82f6", "#34d399", "#f59e0b", "#f87171", "#60a5fa"] as const;
const BORDERS = [
  "rgba(167,139,250,0.35)", "rgba(59,130,246,0.35)", "rgba(52,211,153,0.35)",
  "rgba(245,158,11,0.35)",  "rgba(248,113,113,0.35)", "rgba(96,165,250,0.35)",
] as const;
const BGS = [
  "rgba(167,139,250,0.07)", "rgba(59,130,246,0.07)", "rgba(52,211,153,0.07)",
  "rgba(245,158,11,0.07)",  "rgba(248,113,113,0.07)", "rgba(96,165,250,0.07)",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return "$" + Math.round(n).toLocaleString(); }
function pct(a: number, base: number) {
  if (base === 0) return "";
  const d = ((a - base) / base) * 100;
  return (d >= 0 ? "+" : "") + Math.round(d) + "%";
}

// ─── Breadcrumb strip ─────────────────────────────────────────────────────────

function BreadcrumbStrip({ crumbs, onReset }: { crumbs: Crumb[]; onReset: () => void }) {
  if (crumbs.length === 0) return null;
  return (
    <div
      className="mx-6 mt-4 rounded-xl px-4 py-2.5 flex items-center gap-2 flex-wrap"
      style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)" }}
    >
      <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "rgba(147,180,253,0.5)" }}>
        Locked
      </span>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span style={{ color: "rgba(147,180,253,0.25)" }}>·</span>}
          <span className="text-xs" style={{ color: "rgba(147,180,253,0.55)" }}>{c.varLabel}:</span>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(59,130,246,0.15)", color: "#93b4fd", border: "1px solid rgba(59,130,246,0.3)" }}
          >
            {c.choiceLabel}
          </span>
        </span>
      ))}
      <button
        onClick={onReset}
        className="ml-auto text-[10px] px-2 py-0.5 rounded"
        style={{ color: "rgba(147,180,253,0.4)", background: "transparent", border: "none" }}
      >
        Reset
      </button>
    </div>
  );
}

// ─── Variable picker ─────────────────────────────────────────────────────────

function VariablePicker({
  product,
  answers,
  crumbs,
  onPick,
}: {
  product: Product;
  answers: Record<string, string | number | boolean | string[]>;
  crumbs: Crumb[];
  onPick: (key: string) => void;
}) {
  const variables = useMemo(() => getForkVariables(product, answers), [product, answers]);
  // Filter out variables that are already locked
  const lockedKeys = new Set(crumbs.flatMap((c) => Object.keys(c.overrides)));
  const available  = variables.filter((v) => !lockedKeys.has(v.key));
  const [selected, setSelected] = useState<string>(available[0]?.key ?? "");

  if (available.length === 0) {
    return (
      <div className="px-6 py-8 text-center">
        <p className="text-sm" style={{ color: "rgba(147,180,253,0.5)" }}>
          All available variables have been locked in. Hit Reset to start over.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      <p className="text-sm font-semibold mb-1" style={{ color: "#e8eaed" }}>
        {crumbs.length === 0 ? "What would you like to explore?" : "What would you like to explore next?"}
      </p>
      <p className="text-xs mb-4" style={{ color: "rgba(147,180,253,0.5)" }}>
        Pick one variable. DealGenie computes a price for every option, ordered highest to lowest.
        {crumbs.length > 0 && " All locked values above stay fixed."}
      </p>

      <div className="grid grid-cols-1 gap-2 mb-5">
        {available.map((v) => {
          const active = selected === v.key;
          return (
            <button
              key={v.key}
              onClick={() => setSelected(v.key)}
              className="text-left rounded-xl px-4 py-3 transition-all"
              style={{
                background: active ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)",
                border: active ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-center gap-3">
                {/* Radio dot */}
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{
                    border: active ? "2px solid #3b82f6" : "2px solid rgba(255,255,255,0.2)",
                    background: "transparent",
                  }}
                >
                  {active && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#3b82f6" }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: active ? "#93b4fd" : "#e8eaed" }}>
                      {v.label}
                    </p>
                    <span className="text-[10px] flex-shrink-0" style={{ color: "rgba(147,180,253,0.35)" }}>
                      {v.options.length} options
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(147,180,253,0.45)" }}>
                    {v.impact}
                  </p>
                  {active && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {v.options.map((o) => (
                        <span
                          key={String(o.value)}
                          className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(59,130,246,0.1)", color: "#93b4fd", border: "1px solid rgba(59,130,246,0.2)" }}
                        >
                          {o.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => selected && onPick(selected)}
        disabled={!selected}
        className="w-full py-3 rounded-xl text-sm font-semibold"
        style={{
          background: selected ? "#3b82f6" : "rgba(255,255,255,0.05)",
          color: selected ? "#fff" : "rgba(147,180,253,0.3)",
          border: "none",
          cursor: selected ? "pointer" : "not-allowed",
        }}
      >
        Show scenarios →
      </button>
    </div>
  );
}

// ─── Scenario cards ───────────────────────────────────────────────────────────

function ScenarioCards({
  result,
  baselinePrice,
  onLock,
}: {
  result: CompareResult;
  /** Price of the locked baseline (from crumbs), for delta comparison */
  baselinePrice: number | null;
  onLock: (scenario: Scenario, varLabel: string) => void;
}) {
  const scenarios = result.scenarios;
  const cheapest = scenarios[scenarios.length - 1];
  const varLabel = result.forkVars[0]?.label ?? "";

  const cols = scenarios.length <= 2 ? 2 : scenarios.length <= 3 ? 3 : scenarios.length <= 4 ? 2 : 3;

  return (
    <>
      {/* Column count label */}
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: "rgba(147,180,253,0.4)" }}>
        {scenarios.length} scenarios for <span style={{ color: "#93b4fd" }}>{varLabel}</span> · highest → lowest price
      </p>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(cols, scenarios.length)}, 1fr)` }}>
        {scenarios.map((s, i) => {
          const isCheapest = i === scenarios.length - 1;
          const isMid = scenarios.length >= 3 && i === result.recommendedIdx;
          const c = COLORS[i % COLORS.length];
          const delta = baselinePrice != null ? s.annualList - baselinePrice : s.annualList - cheapest.annualList;
          const vsLabel = baselinePrice != null ? "vs locked baseline" : "vs lowest";

          return (
            <div
              key={i}
              className="rounded-xl p-4 flex flex-col gap-2"
              style={{
                border: isMid ? `1.5px solid ${c}` : BORDERS[i % BORDERS.length],
                background: isMid ? BGS[i % BGS.length] : "rgba(255,255,255,0.025)",
              }}
            >
              {/* Badges */}
              <div className="flex flex-wrap gap-1 min-h-[18px]">
                {i === 0 && (
                  <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(147,180,253,0.45)", border: "1px solid rgba(255,255,255,0.09)" }}>
                    Highest
                  </span>
                )}
                {isMid && (
                  <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                    style={{ background: `${c}22`, color: c, border: `1px solid ${c}44` }}>
                    Mid-range
                  </span>
                )}
                {isCheapest && (
                  <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                    Lowest
                  </span>
                )}
              </div>

              {/* Scenario label */}
              <p className="font-bold text-xs leading-snug" style={{ color: c }}>
                {s.name}
              </p>

              {/* Price */}
              <div>
                <div className="text-xl font-extrabold tabular-nums" style={{ color: "#e8eaed" }}>
                  {fmt(s.annualList)}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(147,180,253,0.38)" }}>
                  /yr list · {fmt(s.monthlyList)}/mo
                </div>
              </div>

              {/* Delta */}
              {delta !== 0 && (
                <div
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit"
                  style={{
                    background: delta > 0 ? "rgba(251,191,36,0.1)" : "rgba(52,211,153,0.1)",
                    color: delta > 0 ? "#fbbf24" : "#34d399",
                    border: `1px solid ${delta > 0 ? "rgba(251,191,36,0.18)" : "rgba(52,211,153,0.18)"}`,
                  }}
                >
                  {delta > 0 ? "+" : ""}{fmt(Math.abs(delta))} {vsLabel} ({pct(s.annualList, baselinePrice ?? cheapest.annualList)})
                </div>
              )}

              {/* Lock button */}
              <button
                onClick={() => onLock(s, varLabel)}
                className="mt-auto w-full text-[11px] font-semibold py-1.5 rounded-lg transition-all"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(147,180,253,0.65)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${c}18`;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = `${c}44`;
                  (e.currentTarget as HTMLButtonElement).style.color = c;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
                  (e.currentTarget as HTMLButtonElement).style.color = "rgba(147,180,253,0.65)";
                }}
              >
                📌 Lock this in &amp; explore further
              </button>
            </div>
          );
        })}
      </div>

      {/* Insight */}
      <div
        className="rounded-xl px-4 py-3 mt-3 text-xs"
        style={{ background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.15)", color: "rgba(147,180,253,0.65)", lineHeight: 1.6 }}
      >
        <span className="font-semibold" style={{ color: "#93b4fd" }}>💡 </span>
        {result.insightText}
      </div>
    </>
  );
}

// ─── Sensitivity slider ───────────────────────────────────────────────────────

function SliderPanel({ result, product, answers }: { result: CompareResult; product: Product; answers: Record<string, string | number | boolean | string[]> }) {
  const [value, setValue] = useState(result.sliderCurrentValue);
  if (!result.sliderVar) return null;

  const prices = result.scenarios.map((s) =>
    computeSliderPrice(product, answers, s.overrides, result.sliderKey, value)
  );
  const maxPrice = Math.max(...prices, 1);

  return (
    <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: "rgba(147,180,253,0.4)" }}>
        Sensitivity — drag to see how {result.sliderVar.label.toLowerCase()} moves all prices
      </p>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] w-20 text-right tabular-nums shrink-0" style={{ color: "rgba(147,180,253,0.45)" }}>
          {result.sliderMin.toLocaleString()} {result.sliderUnit}
        </span>
        <input type="range" min={result.sliderMin} max={result.sliderMax} step={result.sliderStep}
          value={value} onChange={(e) => setValue(Number(e.target.value))}
          className="flex-1 accent-blue-500" style={{ cursor: "pointer" }}
        />
        <span className="text-[10px] w-24 tabular-nums shrink-0" style={{ color: "rgba(147,180,253,0.45)" }}>
          {result.sliderMax.toLocaleString()} {result.sliderUnit}
        </span>
      </div>
      <p className="text-center text-sm font-bold mb-3" style={{ color: "#e8eaed" }}>
        {value.toLocaleString()} {result.sliderUnit}
      </p>
      <div className="space-y-1.5">
        {result.scenarios.slice(0, 6).map((s, i) => {
          const barPct = (prices[i] / maxPrice) * 100;
          const c = COLORS[i % COLORS.length];
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] w-28 truncate shrink-0" style={{ color: c }}>{s.name}</span>
              <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded transition-all duration-100"
                  style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${c}77, ${c})` }} />
              </div>
              <span className="text-[10px] w-24 text-right tabular-nums font-semibold shrink-0" style={{ color: "#e8eaed" }}>
                {fmt(prices[i])}/yr
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScenarioCompare({ product, answers, onClose }: Props) {
  // Accumulated locked choices from each exploration round
  const [crumbs, setCrumbs]     = useState<Crumb[]>([]);
  // Current fan-out result (null = show picker)
  const [result, setResult]     = useState<CompareResult | null>(null);
  // The effective answers = original + all locked overrides
  const effectiveAnswers = useMemo(() => {
    const merged = { ...answers };
    for (const c of crumbs) Object.assign(merged, c.overrides);
    return merged;
  }, [answers, crumbs]);

  // Baseline price = price computed from the locked answers (without current fork var)
  const lockedBaselinePrice = useMemo(() => {
    if (crumbs.length === 0) return null;
    // Import computeScenarioPrice lazily to avoid circular issues — inline the logic
    // We just need the price for effectiveAnswers with no overrides
    if (product === "Verify") {
      const { computeVerifyQuote } = require("@/lib/verify-engine");
      const caps = (effectiveAnswers.capabilities as string[]) ?? ["SSO"];
      const pop = Number(effectiveAnswers.population ?? 500);
      const logins = Number(effectiveAnswers.avgLogins ?? 12);
      const managed = caps.includes("Lifecycle") ? Number(effectiveAnswers.managedUsers ?? pop) : 0;
      const term = String(effectiveAnswers.term ?? "12-month") as "12-month" | "3-year";
      return computeVerifyQuote({ capabilities: caps, population: pop, avgLoginsPerYear: logins, managedUsers: managed, term }).totalAnnualList;
    }
    if (product === "Vault") {
      const { computeVaultQuote } = require("@/lib/vault-engine");
      const model = String(effectiveAnswers.vaultModel ?? "B");
      const installs = Number(effectiveAnswers.installCount ?? 1);
      if (model === "B") {
        const ed = String(effectiveAnswers.edition ?? "Standard") as "Essentials" | "Standard" | "Premium";
        const clients = Number(effectiveAnswers.clientCount ?? 100);
        return computeVaultQuote({ model: "B-Clients", edition: ed, installCount: installs, clientCount: clients }).totalAnnualList;
      }
      const ru = Number(effectiveAnswers.rusMonthly ?? 100);
      return computeVaultQuote({ model: "A-Platform", installCount: installs, useCaseInputs: { staticSecretCount: ru } }).totalAnnualList;
    }
    // NS1
    const { computeNS1Quote } = require("@/lib/ns1-engine");
    return computeNS1Quote({ queryVolumeMQ: Number(effectiveAnswers.queryMQ ?? 50), filterChains: Number(effectiveAnswers.filterChainCount ?? 0), monitors: Number(effectiveAnswers.monitors ?? 0) }).ballparkAnnual;
  }, [crumbs, effectiveAnswers, product]);

  const productLabel =
    product === "NS1" ? "NS1 Connect" :
    product === "Vault" ? "IBM HashiCorp Vault" : "IBM Security Verify";

  const handlePick = (key: string) => {
    const r = buildFanOut(product, effectiveAnswers, [key]);
    setResult(r);
  };

  const handleLock = (scenario: Scenario, varLabel: string) => {
    const pickedVar = result?.forkVars[0];
    if (!pickedVar) return;
    const choiceLabel = scenario.drivers[0] ?? scenario.name;
    setCrumbs((prev) => [...prev, { varLabel, choiceLabel, overrides: scenario.overrides }]);
    setResult(null); // back to picker
  };

  const handleReset = () => {
    setCrumbs([]);
    setResult(null);
  };

  const handleBack = () => setResult(null);

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto"
      style={{ zIndex: 60, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)", padding: "24px 16px 48px" }}
    >
      <div
        className="w-full max-w-4xl rounded-2xl"
        style={{
          background: "rgba(10,15,30,0.97)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-3">
            {result && (
              <button onClick={handleBack}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(147,180,253,0.65)" }}>
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back
              </button>
            )}
            <div>
              <h2 className="font-bold text-base" style={{ color: "#e8eaed" }}>
                {result ? "Scenario Explorer" : "Compare Scenarios"} — {productLabel}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(147,180,253,0.4)" }}>
                {result
                  ? `Exploring: ${result.forkVars[0]?.label ?? ""} · ${result.scenarios.length} scenarios · no AI`
                  : crumbs.length > 0
                    ? `${crumbs.length} variable${crumbs.length > 1 ? "s" : ""} locked · choose the next to explore`
                    : "One variable at a time — lock a choice to keep exploring"}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(147,180,253,0.65)" }}>
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Breadcrumbs (shown when any variable is locked) ── */}
        <BreadcrumbStrip crumbs={crumbs} onReset={handleReset} />

        {/* ── Body ── */}
        <div className="px-6 py-4">
          {!result ? (
            <VariablePicker
              product={product}
              answers={effectiveAnswers}
              crumbs={crumbs}
              onPick={handlePick}
            />
          ) : (
            <div className="space-y-0">
              <ScenarioCards
                result={result}
                baselinePrice={lockedBaselinePrice}
                onLock={handleLock}
              />
              <SliderPanel result={result} product={product} answers={effectiveAnswers} />
              <p className="text-center text-[10px] pt-4 pb-1" style={{ color: "rgba(147,180,253,0.22)" }}>
                All prices are LIST — confirm exact pricing and discounts in CPQ · No AI was used
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
