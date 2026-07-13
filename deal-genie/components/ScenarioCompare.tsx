"use client";

/**
 * ScenarioCompare.tsx
 *
 * Two-panel layout:
 *   LEFT  — core variable explorer (one variable at a time, breadcrumb locking)
 *   RIGHT — persistent add-on checkbox panel with live running total
 *
 * The running total updates whenever:
 *   • a core variable is locked into the breadcrumb trail
 *   • an add-on checkbox is toggled
 *
 * No AI. Zero extra API calls.
 */

import { useState, useMemo } from "react";
import type { Product } from "@/lib/types";
import {
  getForkVariables,
  buildFanOut,
  computeSliderPrice,
  computeScenarioPrice,
  getAddonDefinitions,
  type AddonDefinition,
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
  onBuildQuote: (mergedAnswers: Record<string, string | number | boolean | string[]>) => void;
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
function fmtDelta(n: number) {
  if (n === 0) return "see CPQ";
  return (n >= 0 ? "+" : "") + "$" + Math.round(Math.abs(n)).toLocaleString() + "/yr";
}
function pct(a: number, base: number) {
  if (base === 0) return "";
  const d = ((a - base) / base) * 100;
  return (d >= 0 ? "+" : "") + Math.round(d) + "%";
}

/**
 * Determine initial add-on state from the original quote answers.
 * A binary add-on is "on" if the answer matches the "yes" value.
 * A numeric add-on (pkiAddon, adpKeyMgmt) is "on" if its value is > 0.
 * For Verify we also check the addOns part-number array.
 */
function initialAddonState(
  addons: AddonDefinition[],
  answers: Record<string, string | number | boolean | string[]>
): Record<string, boolean> {
  const state: Record<string, boolean> = {};
  const rawAddOns = (answers.addOns as string[] | undefined) ?? [];

  for (const a of addons) {
    const val = answers[a.key];
    if (typeof a.yesValue === "number") {
      // numeric — on if current value > 0
      state[a.key] = Number(val ?? 0) > 0;
    } else {
      // binary "yes"/"no" — also check legacy addOns array for Verify
      const legacyOn = rawAddOns.includes(String(a.partNumber));
      state[a.key] = String(val ?? "no") === "yes" || legacyOn;
    }
  }
  return state;
}

// ─── Breadcrumb strip ─────────────────────────────────────────────────────────

function BreadcrumbStrip({ crumbs, onReset }: { crumbs: Crumb[]; onReset: () => void }) {
  if (crumbs.length === 0) return null;
  return (
    <div
      className="mx-0 mt-0 mb-3 rounded-xl px-4 py-2.5 flex items-center gap-2 flex-wrap"
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
        style={{ color: "rgba(147,180,253,0.4)", background: "transparent", border: "none", cursor: "pointer" }}
      >
        Reset
      </button>
    </div>
  );
}

// ─── Add-on checkbox panel ────────────────────────────────────────────────────

function AddonPanel({
  addons,
  checked,
  onToggle,
  onSelectNonProd,
  effectiveAnswers,
  product,
}: {
  addons: AddonDefinition[];
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
  onSelectNonProd: (val: string) => void;
  effectiveAnswers: Record<string, string | number | boolean | string[]>;
  product: Product;
}) {
  if (addons.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.18)" }}
    >
      <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "rgba(167,139,250,0.6)" }}>
        Add-ons
      </p>
      <p className="text-[11px] leading-relaxed" style={{ color: "rgba(147,180,253,0.45)" }}>
        Pre-filled from your quote. Toggle to see how each add-on affects the total.
      </p>

      <div className="flex flex-col gap-2">
        {addons.map((addon) => {
          // ── Three-way selector (nonProd: none / D22PGLL / D21CWLL) ──
          if (addon.key === "nonProd") {
            const currentVal = String(effectiveAnswers[addon.key] ?? "none");
            const opts = [
              { value: "none",    label: "None",          delta: 0 },
              { value: "D22PGLL", label: "With SLA",      delta: computeScenarioPrice(product, effectiveAnswers, { nonProd: "D22PGLL" }) - computeScenarioPrice(product, effectiveAnswers, { nonProd: "none" }) },
              { value: "D21CWLL", label: "Without SLA",   delta: computeScenarioPrice(product, effectiveAnswers, { nonProd: "D21CWLL" }) - computeScenarioPrice(product, effectiveAnswers, { nonProd: "none" }) },
            ];
            return (
              <div key={addon.key} className="rounded-xl px-3 py-3"
                style={{ background: currentVal !== "none" ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.02)", border: currentVal !== "none" ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: currentVal !== "none" ? "#c4b5fd" : "rgba(232,234,237,0.7)" }}>
                  Non-Production environment
                </p>
                <div className="flex flex-col gap-1">
                  {opts.map((opt) => {
                    const active = currentVal === opt.value;
                    return (
                      <button key={opt.value} onClick={() => onSelectNonProd(opt.value)}
                        className="text-left rounded-lg px-3 py-2 flex items-center justify-between transition-all"
                        style={{ background: active ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.03)", border: active ? "1px solid rgba(167,139,250,0.5)" : "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0 flex items-center justify-center"
                            style={{ border: active ? "2px solid #a78bfa" : "2px solid rgba(255,255,255,0.2)" }}>
                            {active && <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#a78bfa" }} />}
                          </div>
                          <span className="text-xs font-semibold" style={{ color: active ? "#c4b5fd" : "rgba(232,234,237,0.65)" }}>{opt.label}</span>
                        </div>
                        {opt.value !== "none" && (
                          <span className="text-[10px] font-semibold" style={{ color: active ? "#c4b5fd" : "rgba(147,180,253,0.4)" }}>
                            {active ? fmtDelta(opt.delta) : `adds ${fmtDelta(opt.delta)}`}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          // ── Binary checkbox (all others) ──
          const isOn = checked[addon.key] ?? false;
          const withOverride: Record<string, string | number | boolean | string[]> = { [addon.key]: addon.yesValue };
          const withoutOverride: Record<string, string | number | boolean | string[]> = { [addon.key]: addon.noValue };
          if (product === "Verify") withoutOverride["addOns"] = [];
          const priceWith    = computeScenarioPrice(product, effectiveAnswers, withOverride);
          const priceWithout = computeScenarioPrice(product, effectiveAnswers, withoutOverride);
          const exactDelta   = priceWith - priceWithout;

          return (
            <button
              key={addon.key}
              onClick={() => onToggle(addon.key)}
              className="text-left rounded-xl px-3 py-3 transition-all w-full"
              style={{
                background: isOn ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.02)",
                border: isOn ? "1px solid rgba(167,139,250,0.4)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                  style={{
                    background: isOn ? "#a78bfa" : "transparent",
                    border: isOn ? "2px solid #a78bfa" : "2px solid rgba(255,255,255,0.25)",
                  }}
                >
                  {isOn && (
                    <svg viewBox="0 0 10 8" className="w-2.5 h-2" fill="none" stroke="#fff" strokeWidth="1.8">
                      <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold leading-snug" style={{ color: isOn ? "#c4b5fd" : "rgba(232,234,237,0.7)" }}>
                      {addon.label}
                    </p>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        background: isOn ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                        color: isOn ? "#c4b5fd" : "rgba(147,180,253,0.4)",
                        border: isOn ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(255,255,255,0.07)",
                      }}
                    >
                      {isOn ? fmtDelta(exactDelta) : `adds ${fmtDelta(exactDelta)}`}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(147,180,253,0.35)" }}>
                    {addon.partNumber} · {addon.deltaNote}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Running total bar ────────────────────────────────────────────────────────

function RunningTotal({
  basePrice,
  addonTotal,
  total,
  crumbCount,
}: {
  basePrice: number;
  addonTotal: number;
  total: number;
  crumbCount: number;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.22)" }}
    >
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: "rgba(96,165,250,0.6)" }}>
        Running total
      </p>

      <div className="flex flex-col gap-1.5 text-xs mb-3">
        <div className="flex justify-between">
          <span style={{ color: "rgba(147,180,253,0.55)" }}>
            Core{crumbCount > 0 ? ` (${crumbCount} adjustment${crumbCount > 1 ? "s" : ""})` : ""}
          </span>
          <span className="font-semibold tabular-nums" style={{ color: "#e8eaed" }}>
            {fmt(basePrice)}
          </span>
        </div>
        {addonTotal > 0 && (
          <div className="flex justify-between">
            <span style={{ color: "rgba(167,139,250,0.65)" }}>Add-ons</span>
            <span className="font-semibold tabular-nums" style={{ color: "#c4b5fd" }}>
              +{fmt(addonTotal)}
            </span>
          </div>
        )}
        <div
          className="flex justify-between pt-2 mt-1"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="font-bold" style={{ color: "#e8eaed" }}>Total / yr (list)</span>
          <span className="font-extrabold tabular-nums text-sm" style={{ color: "#3b82f6" }}>
            {fmt(total)}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: "rgba(147,180,253,0.35)" }}>Monthly (list)</span>
          <span className="tabular-nums" style={{ color: "rgba(147,180,253,0.5)" }}>
            {fmt(total / 12)}/mo
          </span>
        </div>
      </div>

      <p className="text-[10px]" style={{ color: "rgba(147,180,253,0.3)", lineHeight: 1.5 }}>
        Prices are LIST. Confirm discounts in CPQ. No AI was used.
      </p>
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
  const lockedKeys = new Set(crumbs.flatMap((c) => Object.keys(c.overrides)));
  // Core vars only — add-ons are no longer part of the picker
  const available = variables.filter((v) => !lockedKeys.has(v.key) && !v.label.startsWith("Add-on:"));
  const [selected, setSelected] = useState<string>(available[0]?.key ?? "");

  if (available.length === 0) {
    return (
      <div className="py-4">
        <div
          className="rounded-xl px-5 py-4 mb-5"
          style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: "#34d399" }}>
            ✓ All core variables locked in
          </p>
          <p className="text-xs" style={{ color: "rgba(147,180,253,0.55)", lineHeight: 1.6 }}>
            Every core pricing lever is locked. Use the add-ons panel to toggle extras, then build the quote.
          </p>
        </div>

        <div className="rounded-xl overflow-hidden mb-5" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {crumbs.map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-2.5 text-xs"
              style={{
                borderBottom: i < crumbs.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
              }}
            >
              <span style={{ color: "rgba(147,180,253,0.5)" }}>{c.varLabel}</span>
              <span className="font-semibold" style={{ color: "#93b4fd" }}>{c.choiceLabel}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-center" style={{ color: "rgba(147,180,253,0.4)" }}>
          Hit <span style={{ color: "#93b4fd" }}>Build quote</span> in the panel on the right →
        </p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <p className="text-sm font-semibold mb-1" style={{ color: "#e8eaed" }}>
        {crumbs.length === 0 ? "What would you like to explore?" : "What would you like to explore next?"}
      </p>
      <p className="text-xs mb-4" style={{ color: "rgba(147,180,253,0.5)" }}>
        Pick a core lever. DealGenie computes a price for every option — highest to lowest.
        {crumbs.length > 0 && " All locked choices above stay fixed."}
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
                  <p className="text-xs mt-0.5" style={{ color: "rgba(147,180,253,0.45)" }}>{v.impact}</p>
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
  effectiveAnswers,
  product,
  onLock,
}: {
  result: CompareResult;
  baselinePrice: number | null;
  effectiveAnswers: Record<string, string | number | boolean | string[]>;
  product: Product;
  onLock: (scenario: Scenario, varLabel: string) => void;
}) {
  const varLabel = result.forkVars[0]?.label ?? "";
  const forkKey  = result.forkVars[0]?.key ?? "";

  // Recompute each scenario's price against effectiveAnswers (which includes
  // any add-on toggles the user has made in the right panel since opening).
  const scenarios = result.scenarios.map((s) => ({
    ...s,
    annualList:  computeScenarioPrice(product, effectiveAnswers, s.overrides),
    monthlyList: Math.round(computeScenarioPrice(product, effectiveAnswers, s.overrides) / 12),
  }));
  // Re-sort high → low after recompute (add-ons shift absolute prices but not relative order; keep stable)
  scenarios.sort((a, b) => b.annualList - a.annualList);

  const cheapest = scenarios[scenarios.length - 1];
  const cols = scenarios.length <= 2 ? 2 : scenarios.length <= 3 ? 3 : scenarios.length <= 4 ? 2 : 3;

  // Determine which scenario index matches the current quote's value for this variable.
  // Compare stringified values for robustness (arrays, numbers, strings).
  const currentVal = effectiveAnswers[forkKey];
  const currentStr = JSON.stringify(currentVal);
  const currentQuoteIdx = scenarios.findIndex(
    (s) => JSON.stringify(s.overrides[forkKey]) === currentStr
  );

  return (
    <>
      <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: "rgba(147,180,253,0.4)" }}>
        {scenarios.length} scenarios for <span style={{ color: "#93b4fd" }}>{varLabel}</span> · highest → lowest price
      </p>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(cols, scenarios.length)}, 1fr)` }}>
        {scenarios.map((s, i) => {
          const isCheapest    = i === scenarios.length - 1;
          const isMid         = scenarios.length >= 3 && i === result.recommendedIdx;
          const isCurrentQuote = i === currentQuoteIdx;
          const c = COLORS[i % COLORS.length];
          const delta = baselinePrice != null ? s.annualList - baselinePrice : s.annualList - cheapest.annualList;
          const vsLabel = baselinePrice != null ? "vs locked baseline" : "vs lowest";

          return (
            <div
              key={i}
              className="rounded-xl p-4 flex flex-col gap-2"
              style={{
                border: isCurrentQuote
                  ? "2px solid rgba(251,191,36,0.7)"
                  : isMid ? `1.5px solid ${c}` : BORDERS[i % BORDERS.length],
                background: isCurrentQuote
                  ? "rgba(251,191,36,0.07)"
                  : isMid ? BGS[i % BGS.length] : "rgba(255,255,255,0.025)",
              }}
            >
              <div className="flex flex-wrap gap-1 min-h-[18px]">
                {isCurrentQuote && (
                  <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.35)" }}>
                    Your quote
                  </span>
                )}
                {i === 0 && !isCurrentQuote && (
                  <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(147,180,253,0.45)", border: "1px solid rgba(255,255,255,0.09)" }}>
                    Highest
                  </span>
                )}
                {isMid && !isCurrentQuote && (
                  <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                    style={{ background: `${c}22`, color: c, border: `1px solid ${c}44` }}>
                    Mid-range
                  </span>
                )}
                {isCheapest && !isCurrentQuote && (
                  <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                    Lowest
                  </span>
                )}
              </div>

              <p className="font-bold text-xs leading-snug" style={{ color: isCurrentQuote ? "#fbbf24" : c }}>{s.name}</p>

              <div>
                <div className="text-xl font-extrabold tabular-nums" style={{ color: "#e8eaed" }}>
                  {fmt(s.annualList)}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(147,180,253,0.38)" }}>
                  /yr list · {fmt(s.monthlyList)}/mo
                </div>
              </div>

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

export default function ScenarioCompare({ product, answers, onClose, onBuildQuote }: Props) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [result, setResult] = useState<CompareResult | null>(null);

  // Add-on definitions (static for a given product + answers)
  const addonDefs = useMemo(
    () => getAddonDefinitions(product, answers),
    [product, answers]
  );

  // Checkbox state — initialised from original quote answers (binary add-ons only)
  const [addonChecked, setAddonChecked] = useState<Record<string, boolean>>(
    () => initialAddonState(addonDefs, answers)
  );

  // nonProd is a three-way choice stored separately: "none" | "D22PGLL" | "D21CWLL"
  const [nonProdSelection, setNonProdSelection] = useState<string>(
    () => {
      const raw = String(answers.nonProd ?? "none");
      // Also handle legacy: if nonProd not set but addOns array has a non-prod part
      if (raw !== "none") return raw;
      const addOns = (answers.addOns as string[] | undefined) ?? [];
      if (addOns.includes("D22PGLL")) return "D22PGLL";
      if (addOns.includes("D21CWLL")) return "D21CWLL";
      return "none";
    }
  );

  // effectiveAnswers = original answers + locked crumb overrides + checked add-on overrides
  const effectiveAnswers = useMemo(() => {
    const merged = { ...answers };
    // Apply locked crumbs
    for (const c of crumbs) Object.assign(merged, c.overrides);
    // Apply binary add-on checkbox state (skip nonProd — handled separately below)
    for (const a of addonDefs) {
      if (a.key === "nonProd") continue;
      merged[a.key] = addonChecked[a.key] ? a.yesValue : a.noValue;
    }
    // Apply nonProd three-way selection
    merged["nonProd"] = nonProdSelection;
    return merged;
  }, [answers, crumbs, addonDefs, addonChecked, nonProdSelection]);

  // Base price = effective answers with core vars locked, add-ons stripped
  // Used so RunningTotal can split "core" vs "add-on" lines
  const basePriceNoAddons = useMemo(() => {
    const stripped = { ...effectiveAnswers };
    for (const a of addonDefs) stripped[a.key] = a.noValue;
    if (product === "Verify") stripped["addOns"] = [];
    return computeScenarioPrice(product, effectiveAnswers, Object.fromEntries(
      addonDefs.map((a) => [a.key, a.noValue])
    ));
  }, [effectiveAnswers, addonDefs, product]);

  const totalPrice = useMemo(
    () => computeScenarioPrice(product, effectiveAnswers, {}),
    [product, effectiveAnswers]
  );
  const addonTotal = totalPrice - basePriceNoAddons;

  // Baseline for scenario card deltas
  const lockedBaselinePrice = useMemo(() => {
    if (crumbs.length === 0) return null;
    return computeScenarioPrice(product, effectiveAnswers, {});
  }, [crumbs, effectiveAnswers, product]);

  const productLabel =
    product === "NS1" ? "NS1 Connect" :
    product === "Vault" ? "IBM HashiCorp Vault" : "IBM Security Verify";

  const handlePick = (key: string) => {
    setResult(buildFanOut(product, effectiveAnswers, [key]));
  };

  const handleLock = (scenario: Scenario, varLabel: string) => {
    const pickedVar = result?.forkVars[0];
    if (!pickedVar) return;
    const choiceLabel = scenario.drivers[0] ?? scenario.name;
    setCrumbs((prev) => [...prev, { varLabel, choiceLabel, overrides: scenario.overrides }]);
    setResult(null);
  };

  const handleReset = () => { setCrumbs([]); setResult(null); };
  const handleBack  = () => setResult(null);

  // Merge add-on checkbox state into the final answers for "Build quote"
  // effectiveAnswers already has all addon keys applied, so just use it directly
  const buildQuoteAnswers = useMemo(() => ({ ...effectiveAnswers }), [effectiveAnswers]);

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto"
      style={{ zIndex: 60, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)", padding: "24px 16px 48px" }}
    >
      <div
        className="w-full max-w-5xl rounded-2xl"
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
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(147,180,253,0.65)", cursor: "pointer" }}>
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
                    : "Explore one lever at a time · toggle add-ons on the right"}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(147,180,253,0.65)", cursor: "pointer" }}>
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Two-column body ── */}
        <div className="flex gap-0" style={{ minHeight: "400px" }}>

          {/* LEFT — explorer */}
          <div className="flex-1 min-w-0 px-6 py-4 flex flex-col" style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <BreadcrumbStrip crumbs={crumbs} onReset={handleReset} />

            {!result ? (
              <VariablePicker
                product={product}
                answers={effectiveAnswers}
                crumbs={crumbs}
                onPick={handlePick}
              />
            ) : (
              <div>
                <ScenarioCards
                  result={result}
                  baselinePrice={lockedBaselinePrice}
                  effectiveAnswers={effectiveAnswers}
                  product={product}
                  onLock={handleLock}
                />
                <SliderPanel result={result} product={product} answers={effectiveAnswers} />
              </div>
            )}
          </div>

          {/* RIGHT — add-on panel + running total */}
          <div className="w-72 flex-shrink-0 px-4 py-4 flex flex-col gap-4">
            <RunningTotal
              basePrice={basePriceNoAddons}
              addonTotal={addonTotal > 0 ? addonTotal : 0}
              total={totalPrice}
              crumbCount={crumbs.length}
            />

            <AddonPanel
              addons={addonDefs}
              checked={addonChecked}
              onToggle={(key) =>
                setAddonChecked((prev) => ({ ...prev, [key]: !prev[key] }))
              }
              onSelectNonProd={setNonProdSelection}
              effectiveAnswers={effectiveAnswers}
              product={product}
            />

            {/* Build quote button */}
            <button
              onClick={() => onBuildQuote(buildQuoteAnswers)}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-auto"
              style={{ background: "#3b82f6", color: "#fff", border: "none", cursor: "pointer" }}
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Build quote with these settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
