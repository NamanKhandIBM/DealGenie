"use client";

/**
 * ScenarioCompare.tsx
 *
 * Step 1 — Variable picker: seller chooses 1–2 levers to compare across.
 * Step 2 — Fan-out result: every option for those levers is computed and shown.
 *
 * No AI. All computation is deterministic via compare-engine.ts.
 * Scenarios are ordered high→low price (anchoring).
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  product: Product;
  answers: Record<string, string | number | boolean | string[]>;
  onClose: () => void;
}

// ─── Colour palette (anchored: most expensive = index 0 = purple) ─────────────

const COLORS  = ["#a78bfa", "#3b82f6", "#34d399", "#f59e0b", "#f87171", "#60a5fa"] as const;
const BORDERS = ["rgba(167,139,250,0.35)", "rgba(59,130,246,0.35)", "rgba(52,211,153,0.35)", "rgba(245,158,11,0.35)", "rgba(248,113,113,0.35)", "rgba(96,165,250,0.35)"] as const;
const BGS     = ["rgba(167,139,250,0.07)", "rgba(59,130,246,0.07)", "rgba(52,211,153,0.07)", "rgba(245,158,11,0.07)", "rgba(248,113,113,0.07)", "rgba(96,165,250,0.07)"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString();
}
function pct(a: number, base: number) {
  if (base === 0) return "";
  const d = ((a - base) / base) * 100;
  return (d >= 0 ? "+" : "") + Math.round(d) + "%";
}

// ─── Step 1: Variable Picker ──────────────────────────────────────────────────

function VariablePicker({
  product,
  answers,
  onConfirm,
}: {
  product: Product;
  answers: Record<string, string | number | boolean | string[]>;
  onConfirm: (keys: string[]) => void;
}) {
  const variables = useMemo(() => getForkVariables(product, answers), [product, answers]);
  const [selected, setSelected] = useState<string[]>([variables[0].key]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= 2) return [prev[1], key]; // rolling window of 2
      return [...prev, key];
    });
  };

  return (
    <div className="px-6 py-5">
      <p className="text-sm font-semibold mb-1" style={{ color: "#e8eaed" }}>
        Which variable do you want to explore?
      </p>
      <p className="text-xs mb-5" style={{ color: "rgba(147,180,253,0.55)" }}>
        Pick 1 or 2 levers. DealGenie will compute the price for every option and show them side-by-side, ordered highest to lowest.
      </p>

      <div className="grid grid-cols-1 gap-2.5 mb-6">
        {variables.map((v) => {
          const active = selected.includes(v.key);
          return (
            <button
              key={v.key}
              onClick={() => toggle(v.key)}
              className="text-left rounded-xl px-4 py-3.5 transition-all"
              style={{
                background: active ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                border: active ? "1px solid rgba(59,130,246,0.55)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: active ? "#93b4fd" : "#e8eaed" }}>
                    {v.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(147,180,253,0.5)" }}>
                    {v.impact}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {v.options.map((o) => (
                      <span
                        key={String(o.value)}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(147,180,253,0.5)", border: "1px solid rgba(255,255,255,0.07)" }}
                      >
                        {o.label}
                      </span>
                    ))}
                  </div>
                </div>
                {/* checkbox */}
                <div
                  className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center"
                  style={{
                    background: active ? "#3b82f6" : "rgba(255,255,255,0.06)",
                    border: active ? "1px solid #3b82f6" : "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  {active && (
                    <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none" stroke="white" strokeWidth="2">
                      <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Summary of what will be generated */}
      {selected.length > 0 && (
        <div
          className="rounded-xl px-4 py-3 mb-5 text-xs"
          style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", color: "rgba(147,180,253,0.7)", lineHeight: 1.55 }}
        >
          {(() => {
            const vars = variables.filter((v) => selected.includes(v.key));
            const totalOptions = vars.reduce((acc, v) => acc * v.options.length, 1);
            if (vars.length === 1) {
              return <>Will generate <strong style={{ color: "#93b4fd" }}>{vars[0].options.length} scenarios</strong>, one for each option of <strong style={{ color: "#93b4fd" }}>{vars[0].label}</strong>. All other answers stay fixed from your current quote.</>;
            }
            return <>Will generate <strong style={{ color: "#93b4fd" }}>{totalOptions} scenarios</strong> — every combination of <strong style={{ color: "#93b4fd" }}>{vars[0].label}</strong> ({vars[0].options.length} options) × <strong style={{ color: "#93b4fd" }}>{vars[1].label}</strong> ({vars[1].options.length} options). All other answers stay fixed.</>;
          })()}
        </div>
      )}

      <button
        onClick={() => selected.length > 0 && onConfirm(selected)}
        disabled={selected.length === 0}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: selected.length > 0 ? "#3b82f6" : "rgba(255,255,255,0.05)",
          color: selected.length > 0 ? "#fff" : "rgba(147,180,253,0.3)",
          border: "none",
          cursor: selected.length > 0 ? "pointer" : "not-allowed",
        }}
      >
        Generate Scenarios →
      </button>
    </div>
  );
}

// ─── Step 2: Scenario Result cards ───────────────────────────────────────────

function ResultCards({ result, baseline }: { result: CompareResult; baseline: Scenario }) {
  const scenarios = result.scenarios;
  // Use a 3-column grid for ≤6 scenarios, wrap after that
  const cols = scenarios.length <= 2 ? 2 : scenarios.length <= 3 ? 3 : scenarios.length <= 4 ? 2 : 3;

  return (
    <div
      className={`grid gap-3`}
      style={{ gridTemplateColumns: `repeat(${Math.min(cols, scenarios.length)}, 1fr)` }}
    >
      {scenarios.map((s, i) => {
        const isRecommended = i === result.recommendedIdx;
        const isBaseline    = i === result.baselineIdx;
        const delta = s.annualList - baseline.annualList;
        const c = COLORS[i % COLORS.length];
        const border = isRecommended
          ? `1.5px solid ${c}`
          : BORDERS[i % BORDERS.length];
        const bg = isRecommended ? BGS[i % BGS.length] : "rgba(255,255,255,0.025)";

        return (
          <div
            key={i}
            className="rounded-xl p-4 flex flex-col gap-1.5"
            style={{ border, background: bg }}
          >
            {/* Badges */}
            <div className="flex flex-wrap gap-1 mb-0.5">
              {isRecommended && (
                <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                  style={{ background: `${c}22`, color: c, border: `1px solid ${c}55` }}>
                  Recommended
                </span>
              )}
              {isBaseline && !isRecommended && (
                <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(147,180,253,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  Lowest
                </span>
              )}
              {i === 0 && (
                <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(147,180,253,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  Highest
                </span>
              )}
            </div>

            {/* Name */}
            <p className="font-bold text-xs leading-snug" style={{ color: c }}>
              {s.name}
            </p>

            {/* Price */}
            <div>
              <div className="text-xl font-extrabold tabular-nums leading-tight" style={{ color: "#e8eaed" }}>
                {fmt(s.annualList)}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: "rgba(147,180,253,0.4)" }}>
                /yr list · {fmt(s.monthlyList)}/mo
              </div>
            </div>

            {/* Delta */}
            {!isBaseline && (
              <div className="text-[10px] font-semibold px-1.5 py-0.5 rounded w-fit mt-0.5"
                style={{
                  background: delta > 0 ? "rgba(251,191,36,0.1)" : "rgba(52,211,153,0.1)",
                  color: delta > 0 ? "#fbbf24" : "#34d399",
                  border: `1px solid ${delta > 0 ? "rgba(251,191,36,0.2)" : "rgba(52,211,153,0.2)"}`,
                }}>
                {delta > 0 ? "+" : ""}{fmt(Math.abs(delta))} vs lowest ({pct(s.annualList, baseline.annualList)})
              </div>
            )}

            {/* Drivers */}
            <ul className="mt-1 space-y-0.5">
              {s.drivers.map((d, di) => (
                <li key={di} className="text-[10px] flex items-center gap-1" style={{ color: "rgba(147,180,253,0.45)" }}>
                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: c }} />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ─── Diff table ───────────────────────────────────────────────────────────────

function DiffTable({ result }: { result: CompareResult }) {
  const scenarios = result.scenarios;
  if (scenarios.length < 2 || result.forkVars.length === 0) return null;

  // Show one row per fork variable
  const rows = result.forkVars.map((fv) => ({
    label: fv.label,
    values: scenarios.map((s) => {
      const raw = s.overrides[fv.key];
      if (Array.isArray(raw)) return (raw as string[]).join(", ");
      if (raw === undefined) return "—";
      return String(raw);
    }),
  }));

  // Cap columns to avoid overflowing — show max 6
  const displayScenarios = scenarios.slice(0, 6);

  return (
    <div className="mt-4">
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: "rgba(147,180,253,0.4)" }}>
        Variable differences across scenarios
      </p>
      <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <table className="w-full text-xs" style={{ minWidth: `${displayScenarios.length * 120 + 140}px` }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)" }}>
              <th className="text-left px-3 py-2 font-semibold" style={{ color: "rgba(147,180,253,0.5)", width: "140px" }}>Variable</th>
              {displayScenarios.map((_, i) => (
                <th key={i} className="text-right px-3 py-2 font-semibold" style={{ color: COLORS[i % COLORS.length] }}>
                  Scenario {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="px-3 py-2" style={{ color: "rgba(147,180,253,0.5)" }}>{row.label}</td>
                {displayScenarios.map((_, i) => (
                  <td key={i} className="text-right px-3 py-2 font-medium" style={{ color: "#e8eaed" }}>
                    {row.values[i]}
                  </td>
                ))}
              </tr>
            ))}
            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
              <td className="px-3 py-2.5 font-semibold" style={{ color: "#e8eaed" }}>Annual List Price</td>
              {displayScenarios.map((s, i) => (
                <td key={i} className="text-right px-3 py-2.5 font-bold" style={{ color: COLORS[i % COLORS.length] }}>
                  {fmt(s.annualList)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {scenarios.length > 6 && (
        <p className="text-[10px] mt-1.5" style={{ color: "rgba(147,180,253,0.35)" }}>
          Showing first 6 of {scenarios.length} scenarios in the diff table.
        </p>
      )}
    </div>
  );
}

// ─── Sensitivity Slider ───────────────────────────────────────────────────────

function SliderPanel({
  result,
  product,
  answers,
}: {
  result: CompareResult;
  product: Product;
  answers: Record<string, string | number | boolean | string[]>;
}) {
  const [value, setValue] = useState(result.sliderCurrentValue);
  if (!result.sliderVar) return null;

  const prices = result.scenarios.map((s) =>
    computeSliderPrice(product, answers, s.overrides, result.sliderKey, value)
  );
  const maxPrice = Math.max(...prices, 1);

  return (
    <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: "rgba(147,180,253,0.45)" }}>
        Sensitivity — move {result.sliderVar.label.toLowerCase()} and watch all prices update
      </p>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] w-20 text-right tabular-nums" style={{ color: "rgba(147,180,253,0.5)" }}>
          {result.sliderMin.toLocaleString()} {result.sliderUnit}
        </span>
        <input
          type="range"
          min={result.sliderMin}
          max={result.sliderMax}
          step={result.sliderStep}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="flex-1 accent-blue-500"
          style={{ cursor: "pointer" }}
        />
        <span className="text-[10px] w-24 tabular-nums" style={{ color: "rgba(147,180,253,0.5)" }}>
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
              <span className="text-[10px] w-32 truncate" style={{ color: c }}>{s.name}</span>
              <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div
                  className="h-full rounded transition-all duration-100"
                  style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${c}88, ${c})` }}
                />
              </div>
              <span className="text-[10px] w-22 text-right tabular-nums font-semibold" style={{ color: "#e8eaed" }}>
                {fmt(prices[i])}/yr
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-center mt-2 text-[10px]" style={{ color: "rgba(147,180,253,0.3)" }}>
        Each bar shows that scenario with the slider value applied · other variables fixed
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScenarioCompare({ product, answers, onClose }: Props) {
  const [result, setResult] = useState<CompareResult | null>(null);

  const productLabel =
    product === "NS1" ? "NS1 Connect" :
    product === "Vault" ? "IBM HashiCorp Vault" : "IBM Security Verify";

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
              <button
                onClick={() => setResult(null)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(147,180,253,0.7)" }}
              >
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Change variable
              </button>
            )}
            <div>
              <h2 className="font-bold text-base" style={{ color: "#e8eaed" }}>
                {result ? "Scenario Comparison" : "Compare Scenarios"} — {productLabel}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(147,180,253,0.45)" }}>
                {result
                  ? `${result.scenarios.length} scenarios · ordered highest → lowest price · no AI`
                  : "Choose which variables to explore"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(147,180,253,0.7)" }}
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        {!result ? (
          <VariablePicker
            product={product}
            answers={answers}
            onConfirm={(keys) => setResult(buildFanOut(product, answers, keys))}
          />
        ) : (
          <div className="px-6 py-5 space-y-2">
            <ResultCards result={result} baseline={result.scenarios[result.baselineIdx]} />

            {/* Insight */}
            <div
              className="rounded-xl px-4 py-3 text-xs"
              style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.18)", color: "rgba(147,180,253,0.7)", lineHeight: 1.6, marginTop: "14px" }}
            >
              <span className="font-semibold" style={{ color: "#93b4fd" }}>💡 </span>
              {result.insightText}
            </div>

            <DiffTable result={result} />
            <SliderPanel result={result} product={product} answers={answers} />

            <p className="text-center text-[10px] pt-2" style={{ color: "rgba(147,180,253,0.25)" }}>
              All prices are LIST — confirm exact pricing and discounts in CPQ · No AI was used
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
