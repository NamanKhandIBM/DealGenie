"use client";

/**
 * ScenarioCompare.tsx
 *
 * In-flight dual/triple scenario comparison panel.
 * - Scenarios ordered high→low price (anchoring: Full Platform shown first)
 * - Middle scenario pre-highlighted as "Recommended"
 * - Diff table showing only rows that differ between scenarios
 * - Sensitivity slider: adjust one key variable and watch all prices update live
 * - Zero AI calls — all computation is deterministic via compare-engine.ts
 */

import { useState, useCallback } from "react";
import type { Product } from "@/lib/types";
import {
  buildVerifyScenarios,
  buildVaultScenarios,
  buildNS1Scenarios,
  type CompareResult,
  type Scenario,
} from "@/lib/compare-engine";
import { computeNS1Quote } from "@/lib/ns1-engine";
import { computeVerifyQuote } from "@/lib/verify-engine";
import { computeVaultQuote } from "@/lib/vault-engine";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  product: Product;
  answers: Record<string, string | number | boolean | string[]>;
  onClose: () => void;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString();
}

function pctDiff(a: number, base: number): string {
  if (base === 0) return "";
  const d = ((a - base) / base) * 100;
  return (d >= 0 ? "+" : "") + Math.round(d) + "%";
}

// ─── Build initial CompareResult from live answers ───────────────────────────

function buildResult(
  product: Product,
  answers: Record<string, string | number | boolean | string[]>
): CompareResult {
  if (product === "Verify") {
    const population = Number(answers.population ?? 500);
    const avgLogins = Number(answers.avgLogins ?? 12);
    const term = String(answers.term ?? "12-month") as "12-month" | "3-year";
    return buildVerifyScenarios(population, avgLogins, term);
  }
  if (product === "Vault") {
    const model = String(answers.vaultModel ?? "A") as "A" | "B";
    const installCount = Number(answers.installCount ?? 1);
    const clientCount = Number(answers.clientCount ?? 100);
    const rusMonthly = Number(answers.rusMonthly ?? 100);
    return buildVaultScenarios(model, installCount, clientCount, rusMonthly);
  }
  // NS1
  const queryMQ = Number(answers.queryMQ ?? 50);
  const filterChains = Number(answers.filterChainCount ?? 0);
  return buildNS1Scenarios(queryMQ, filterChains);
}

// ─── Compute single price for sensitivity slider ──────────────────────────────

function sliderPrice(
  product: Product,
  answers: Record<string, string | number | boolean | string[]>,
  sliderKey: string,
  sliderValue: number,
  scenarioInputs: Record<string, string | number | boolean | string[]>
): number {
  if (product === "Verify") {
    const population = sliderKey === "population" ? sliderValue : Number(answers.population ?? 500);
    const avgLogins = Number(answers.avgLogins ?? 12);
    const term = String(answers.term ?? "12-month") as "12-month" | "3-year";
    const caps = (scenarioInputs.Capabilities as string)?.split(", ") ?? ["SSO"];
    const managedUsers = caps.includes("Lifecycle") ? population : 0;
    const result = computeVerifyQuote({
      capabilities: caps as ("SSO" | "MFA" | "Adaptive" | "Lifecycle")[],
      population,
      avgLoginsPerYear: avgLogins,
      managedUsers,
      term,
    });
    return result.totalAnnualList;
  }
  if (product === "NS1") {
    const mq = sliderKey === "queryMQ" ? sliderValue : Number(answers.queryMQ ?? 50);
    const fc = Number(scenarioInputs["Filter Chains"] ?? 0);
    const monitors = Number(scenarioInputs.Monitors ?? 0);
    const result = computeNS1Quote({ queryVolumeMQ: mq, filterChains: fc, monitors });
    return result.ballparkAnnual;
  }
  // Vault
  const model = String(answers.vaultModel ?? "B") as "A" | "B";
  const installCount = Number(answers.installCount ?? 1);
  if (model === "B") {
    const clientCount = sliderKey === "clientCount" ? sliderValue : Number(answers.clientCount ?? 100);
    const edition = String(scenarioInputs.Edition ?? "Standard") as "Essentials" | "Standard" | "Premium";
    const result = computeVaultQuote({ model: "B-Clients", edition, installCount, clientCount });
    return result.totalAnnualList;
  }
  const ru = sliderKey === "rusMonthly" ? sliderValue : Number(answers.rusMonthly ?? 100);
  const result = computeVaultQuote({ model: "A-Platform", installCount, useCaseInputs: { staticSecretCount: ru } });
  return result.totalAnnualList;
}

// ─── Diff table ───────────────────────────────────────────────────────────────

function DiffTable({ scenarios }: { scenarios: Scenario[] }) {
  if (scenarios.length < 2) return null;

  // Collect all input keys
  const allKeys = Array.from(new Set(scenarios.flatMap((s) => Object.keys(s.inputs))));
  // Only show rows that differ
  const differingKeys = allKeys.filter((k) => {
    const vals = scenarios.map((s) => String(s.inputs[k] ?? "—"));
    return !vals.every((v) => v === vals[0]);
  });

  if (differingKeys.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-2" style={{ color: "rgba(147,180,253,0.5)" }}>
        What differs between scenarios
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.04)" }}>
              <th className="text-left px-3 py-2 font-semibold" style={{ color: "rgba(147,180,253,0.6)", width: "30%" }}>Variable</th>
              {scenarios.map((s, i) => (
                <th key={i} className="text-right px-3 py-2 font-semibold" style={{ color: TIER_COLORS[i % TIER_COLORS.length] }}>
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {differingKeys.map((k) => (
              <tr key={k} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="px-3 py-2" style={{ color: "rgba(147,180,253,0.55)" }}>{k}</td>
                {scenarios.map((s, i) => (
                  <td key={i} className="text-right px-3 py-2 font-medium" style={{ color: "#e8eaed" }}>
                    {String(s.inputs[k] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
            {/* Price totals row */}
            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
              <td className="px-3 py-2.5 font-semibold text-xs" style={{ color: "#e8eaed" }}>Annual List Price</td>
              {scenarios.map((s, i) => (
                <td key={i} className="text-right px-3 py-2.5 font-bold text-sm" style={{ color: TIER_COLORS[i % TIER_COLORS.length] }}>
                  {fmt(s.annualList)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Colour palette for scenarios (anchored: most expensive first) ────────────

const TIER_COLORS = ["#a78bfa", "#3b82f6", "#34d399"] as const;
const TIER_BORDER = ["rgba(139,92,246,0.35)", "rgba(59,130,246,0.35)", "rgba(52,211,153,0.35)"] as const;
const TIER_BG     = ["rgba(139,92,246,0.08)", "rgba(59,130,246,0.08)", "rgba(52,211,153,0.08)"] as const;
const TIER_GLOW   = ["rgba(139,92,246,0.25)", "rgba(59,130,246,0.25)", "rgba(52,211,153,0.25)"] as const;

// ─── Sensitivity slider panel ─────────────────────────────────────────────────

interface SliderPanelProps {
  result: CompareResult;
  product: Product;
  answers: Record<string, string | number | boolean | string[]>;
}

function SliderPanel({ result, product, answers }: SliderPanelProps) {
  const [value, setValue] = useState(result.sliderMin + Math.round((result.sliderMax - result.sliderMin) * 0.25));
  const prices = result.scenarios.map((s) =>
    sliderPrice(product, answers, result.sliderKey, value, s.inputs)
  );
  const maxPrice = Math.max(...prices, 1);

  return (
    <div
      className="mt-5 rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: "rgba(147,180,253,0.5)" }}>
        Sensitivity — how does price change with {result.sliderLabel}?
      </p>

      {/* Slider */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs w-20 text-right tabular-nums" style={{ color: "rgba(147,180,253,0.6)" }}>
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
        <span className="text-xs w-24 tabular-nums" style={{ color: "rgba(147,180,253,0.6)" }}>
          {result.sliderMax.toLocaleString()} {result.sliderUnit}
        </span>
      </div>

      {/* Current value label */}
      <p className="text-center text-sm font-bold mb-3" style={{ color: "#e8eaed" }}>
        {value.toLocaleString()} {result.sliderUnit}
      </p>

      {/* Bar chart */}
      <div className="space-y-2">
        {result.scenarios.map((s, i) => {
          const pct = (prices[i] / maxPrice) * 100;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs w-36 truncate" style={{ color: TIER_COLORS[i % TIER_COLORS.length] }}>
                {s.name}
              </span>
              <div className="flex-1 h-6 rounded overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div
                  className="h-full rounded transition-all duration-150"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${TIER_COLORS[i % TIER_COLORS.length]}99, ${TIER_COLORS[i % TIER_COLORS.length]})`,
                  }}
                />
              </div>
              <span className="text-xs w-24 text-right tabular-nums font-semibold" style={{ color: "#e8eaed" }}>
                {fmt(prices[i])}/yr
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-center mt-3 text-[11px]" style={{ color: "rgba(147,180,253,0.4)" }}>
        Drag slider to model different {result.sliderLabel.toLowerCase()} values
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScenarioCompare({ product, answers, onClose }: Props) {
  const [result, setResult] = useState<CompareResult>(() => buildResult(product, answers));

  // Rebuild if answers change (won't happen in practice since this is modal)
  const rebuild = useCallback(() => setResult(buildResult(product, answers)), [product, answers]);

  const baseline = result.scenarios[result.baselineIdx];

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto"
      style={{
        zIndex: 60,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        padding: "24px 16px",
      }}
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
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div>
            <h2 className="font-bold text-base" style={{ color: "#e8eaed" }}>
              Scenario Comparison — {product === "NS1" ? "NS1 Connect" : product === "Vault" ? "IBM HashiCorp Vault" : "IBM Security Verify"}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(147,180,253,0.55)" }}>
              {result.scenarios.length} scenarios · ordered Full Platform → Entry · no AI used
            </p>
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

        <div className="px-6 py-5 space-y-5">

          {/* ── Scenario cards ── */}
          <div className={`grid gap-3 ${result.scenarios.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {result.scenarios.map((s, i) => {
              const isRecommended = i === result.recommendedIdx;
              const isBaseline = i === result.baselineIdx;
              const delta = s.annualList - baseline.annualList;
              const color = TIER_COLORS[i % TIER_COLORS.length];
              const border = isRecommended ? `1px solid ${color}` : TIER_BORDER[i % TIER_BORDER.length];
              const bg = isRecommended ? TIER_BG[i % TIER_BG.length] : "rgba(255,255,255,0.03)";

              return (
                <div
                  key={i}
                  className="rounded-xl p-4 flex flex-col gap-2"
                  style={{
                    border,
                    background: bg,
                    boxShadow: isRecommended ? `0 0 0 1px ${color}40` : undefined,
                    position: "relative",
                  }}
                >
                  {/* Badge row */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isRecommended && (
                      <span
                        className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                        style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}
                      >
                        Recommended
                      </span>
                    )}
                    {isBaseline && !isRecommended && (
                      <span
                        className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(147,180,253,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        Entry
                      </span>
                    )}
                    {i === 0 && (
                      <span
                        className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(147,180,253,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
                      >
                        Full Platform
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <h3 className="font-bold text-sm leading-tight" style={{ color }}>
                    {s.name}
                  </h3>
                  <p className="text-[11px] leading-snug" style={{ color: "rgba(147,180,253,0.55)" }}>
                    {s.tagline}
                  </p>

                  {/* Price */}
                  <div className="mt-1">
                    <div className="text-2xl font-extrabold tabular-nums" style={{ color: "#e8eaed" }}>
                      {fmt(s.annualList)}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: "rgba(147,180,253,0.45)" }}>
                      per year list · ~{fmt(s.monthlyList)}/mo
                    </div>
                  </div>

                  {/* Delta vs baseline */}
                  {!isBaseline && (
                    <div
                      className="text-[11px] font-semibold mt-1 px-2 py-0.5 rounded-md w-fit"
                      style={{
                        background: delta > 0 ? "rgba(251,191,36,0.1)" : "rgba(52,211,153,0.1)",
                        color: delta > 0 ? "#fbbf24" : "#34d399",
                        border: `1px solid ${delta > 0 ? "rgba(251,191,36,0.2)" : "rgba(52,211,153,0.2)"}`,
                      }}
                    >
                      {delta > 0 ? "+" : ""}{fmt(Math.abs(delta))} vs Entry ({pctDiff(s.annualList, baseline.annualList)})
                    </div>
                  )}

                  {/* Key drivers */}
                  <ul className="mt-1 space-y-0.5">
                    {s.drivers.map((d, di) => (
                      <li key={di} className="text-[11px] flex items-center gap-1.5" style={{ color: "rgba(147,180,253,0.5)" }}>
                        <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: color }} />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* ── Insight banner ── */}
          <div
            className="rounded-xl px-4 py-3 text-sm"
            style={{
              background: "rgba(59,130,246,0.07)",
              border: "1px solid rgba(59,130,246,0.2)",
              color: "rgba(147,180,253,0.75)",
              lineHeight: 1.55,
            }}
          >
            <span className="font-semibold" style={{ color: "#93b4fd" }}>💡 Pricing insight: </span>
            {result.insightText}
          </div>

          {/* ── Diff table ── */}
          <DiffTable scenarios={result.scenarios} />

          {/* ── Sensitivity slider ── */}
          <SliderPanel result={result} product={product} answers={answers} />

          {/* ── Footer note ── */}
          <p className="text-center text-[11px] pb-1" style={{ color: "rgba(147,180,253,0.3)" }}>
            All prices are LIST — confirm exact pricing, discounts, and approval in CPQ · No AI was used to generate these scenarios
          </p>
        </div>
      </div>
    </div>
  );
}
