"use client";

import { useMemo } from "react";
import type { SavedQuote } from "@/lib/quote-history";

interface Props {
  quotes: SavedQuote[];
  onClose: () => void;
  onLoad: (quote: SavedQuote) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(n?: number) {
  if (!n) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000).toLocaleString()}K`;
  return `$${n.toLocaleString()}`;
}

function fmtNum(v?: string | number | boolean | string[]) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function priceDiff(a?: number, b?: number) {
  if (!a || !b || a === b) return null;
  const diff = b - a;
  const pct = Math.round((Math.abs(diff) / a) * 100);
  return { diff, pct, cheaper: diff < 0 };
}

const PRODUCT_ACCENT: Record<string, string> = {
  Verify: "#4d8ef8",
  NS1:    "#10b981",
  Vault:  "#a855f7",
};

const PRODUCT_BG: Record<string, string> = {
  Verify: "rgba(77,142,248,0.08)",
  NS1:    "rgba(16,185,129,0.08)",
  Vault:  "rgba(168,85,247,0.08)",
};

const PRODUCT_BORDER: Record<string, string> = {
  Verify: "rgba(77,142,248,0.25)",
  NS1:    "rgba(16,185,129,0.25)",
  Vault:  "rgba(168,85,247,0.25)",
};

// ─── Parse a quote into structured display data ───────────────────────────────

interface QuoteDisplay {
  id: string;
  product: string;
  price?: number;
  priceLabel: string;
  features: { label: string; value: string; isPricingDriver: boolean }[];
  addOns: string[];
  term: string;
  rawLabel: string;
}

function parseQuote(q: SavedQuote): QuoteDisplay {
  const a = q.answers;
  const features: QuoteDisplay["features"] = [];
  const addOns: string[] = [];

  // Extract price from chat snapshot (last assistant message with a $ amount)
  let price = q.summary.totalAnnual ?? q.summary.listPrice;
  if (!price) {
    const msgs = [...(q.chatSnapshot ?? [])].reverse();
    for (const m of msgs) {
      if (m.role !== "assistant") continue;
      const match = m.content.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:[KkMm])?\s*\/?\s*yr/i);
      if (match) {
        const raw = match[1].replace(/,/g, "");
        price = parseFloat(raw);
        if (/[Kk]/.test(match[0])) price *= 1000;
        if (/[Mm]/.test(match[0])) price *= 1_000_000;
        break;
      }
    }
  }

  if (q.product === "Verify") {
    const pop = fmtNum(a.population ?? a.verifyPopulation);
    const logins = fmtNum(a.avgLogins);
    const caps = Array.isArray(a.capabilities) ? a.capabilities : typeof a.capabilities === "string" ? [a.capabilities] : [];
    const managed = fmtNum(a.managedUsers);
    const term = String(a.term ?? "12-month");
    const regions = fmtNum(a.regions) ?? 1;

    if (pop) features.push({ label: "Total users", value: pop.toLocaleString(), isPricingDriver: true });
    if (logins) {
      const mau = Math.ceil((pop ?? 0) * Math.min(logins, 12) / 12);
      features.push({ label: "MAU (billing unit)", value: mau.toLocaleString(), isPricingDriver: true });
    }
    if (caps.length) features.push({ label: "Capabilities", value: caps.join(", "), isPricingDriver: true });
    if (managed) features.push({ label: "Managed users (Lifecycle)", value: managed.toLocaleString(), isPricingDriver: true });
    if (regions > 1) features.push({ label: "Regions", value: String(regions), isPricingDriver: true });

    // Add-ons
    const addOnParts = Array.isArray(a.addOns) ? a.addOns : [];
    const addOnNames: Record<string, string> = {
      D02T6ZX: "SMS/Email MFA",
      D01UQZX: "App Gateway",
      D01URZX: "Vanity Domain",
      D22PGLL: "Non-Prod (SLA)",
      D21CWLL: "Non-Prod (no SLA)",
    };
    addOnParts.filter(p => p !== "none").forEach(p => addOns.push(addOnNames[p] ?? p));

    return {
      id: q.id,
      product: "IBM Security Verify",
      price,
      priceLabel: price ? `${fmtPrice(price)}/yr` : "—",
      features,
      addOns,
      term,
      rawLabel: q.label,
    };
  }

  if (q.product === "Vault") {
    const modelCode = String(a.vaultModel ?? "A");
    const modelLabel = modelCode === "A" ? "Platform RU model" : "Self-Managed model";
    const installs = fmtNum(a.installCount);
    const clients = fmtNum(a.clientCount);
    const edition = ["Essentials", "Standard", "Premium"][parseInt(String(a.edition ?? "2")) - 1] ?? "Standard";
    const rus = fmtNum(a.rusMonthly);
    const term = String(a.term ?? "annual");

    features.push({ label: "Licensing model", value: modelLabel, isPricingDriver: true });
    if (modelCode === "A") {
      if (installs) features.push({ label: "Installs", value: String(installs), isPricingDriver: true });
      if (rus) features.push({ label: "RU / month", value: rus.toLocaleString(), isPricingDriver: true });
    } else {
      features.push({ label: "Edition", value: edition, isPricingDriver: true });
      if (installs) features.push({ label: "Installs", value: String(installs), isPricingDriver: true });
      if (clients) features.push({ label: "Clients (RVU)", value: clients.toLocaleString(), isPricingDriver: true });
    }

    const useCases = Array.isArray(a.useCases) ? a.useCases as string[] : [];
    if (useCases.length) features.push({ label: "Use cases", value: useCases.join(", "), isPricingDriver: false });

    return { id: q.id, product: "IBM HashiCorp Vault", price, priceLabel: price ? `${fmtPrice(price)}/yr` : "—", features, addOns, term, rawLabel: q.label };
  }

  if (q.product === "NS1") {
    const queries = fmtNum(a.queryMQ);
    const records = fmtNum(a.recordCount);
    const filters = fmtNum(a.filterChainCount);
    const monitors = fmtNum(a.monitors);

    if (queries) features.push({ label: "Queries / month", value: `${queries.toLocaleString()}M`, isPricingDriver: true });
    if (records) features.push({ label: "DNS records", value: records.toLocaleString(), isPricingDriver: false });
    if (filters) features.push({ label: "Filter chains", value: String(filters), isPricingDriver: true });
    if (monitors) features.push({ label: "Monitors", value: String(monitors), isPricingDriver: false });

    return { id: q.id, product: "NS1 Connect", price, priceLabel: price ? `${fmtPrice(price)}/mo` : "—", features, addOns, term: "monthly", rawLabel: q.label };
  }

  return { id: q.id, product: q.product, price, priceLabel: fmtPrice(price) ?? "—", features, addOns, term: "—", rawLabel: q.label };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuoteCompare({ quotes, onClose, onLoad }: Props) {
  const parsed = useMemo(() => quotes.map(parseQuote), [quotes]);

  // Find cheapest quote
  const prices = parsed.map(p => p.price).filter(Boolean) as number[];
  const minPrice = prices.length ? Math.min(...prices) : undefined;
  const maxPrice = prices.length ? Math.max(...prices) : undefined;

  // Build the "what drives the price difference" insight
  const insight = useMemo(() => {
    if (parsed.length < 2) return null;
    const [a, b] = parsed;
    if (!a.price || !b.price) return null;
    const diff = priceDiff(a.price, b.price);
    if (!diff) return null;

    const drivers: string[] = [];

    if (a.product === "Verify" && b.product === "Verify") {
      const mauA = a.features.find(f => f.label === "MAU (billing unit)");
      const mauB = b.features.find(f => f.label === "MAU (billing unit)");
      if (mauA && mauB && mauA.value !== mauB.value) {
        drivers.push(`MAU billing units (${mauA.value} vs ${mauB.value})`);
      }
      const capA = a.features.find(f => f.label === "Capabilities");
      const capB = b.features.find(f => f.label === "Capabilities");
      if (capA && capB && capA.value !== capB.value) {
        drivers.push(`capability scope (${capA.value} vs ${capB.value})`);
      }
    }

    if (a.addOns.length !== b.addOns.length) {
      drivers.push(`add-ons (${a.addOns.length} vs ${b.addOns.length})`);
    }

    const cheaper = diff.cheaper ? b : a;
    const pricier = diff.cheaper ? a : b;
    const savingLabel = fmtPrice(Math.abs(diff.diff));

    if (drivers.length) {
      return `${pricier.rawLabel.split("·")[0].trim()} costs ${savingLabel ?? "more"} more/yr than ${cheaper.rawLabel.split("·")[0].trim()} primarily due to ${drivers.join(" and ")}.`;
    }
    return `${pricier.rawLabel.split("·")[0].trim()} costs ${diff.pct}% more (${savingLabel}/yr) than ${cheaper.rawLabel.split("·")[0].trim()}.`;
  }, [parsed]);

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center"
      style={{ zIndex: 60, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-4xl mx-0 sm:mx-4 rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{
          background: "rgba(10,13,26,0.99)",
          border: "1px solid rgba(255,255,255,0.1)",
          maxHeight: "92vh",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "#e8eaed" }}>
              Quote comparison
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(147,180,253,0.45)" }}>
              Which option fits your client&rsquo;s requirements and budget?
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(147,180,253,0.5)" }}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">

          {/* ── Quote cards ── */}
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(parsed.length, 3)}, minmax(0, 1fr))` }}
          >
            {parsed.map((q, i) => {
              const accent = PRODUCT_ACCENT[quotes[i].product] ?? "#4d8ef8";
              const bg     = PRODUCT_BG[quotes[i].product]     ?? "rgba(77,142,248,0.08)";
              const border = PRODUCT_BORDER[quotes[i].product]  ?? "rgba(77,142,248,0.25)";
              const isCheapest = q.price !== undefined && q.price === minPrice && minPrice !== maxPrice;
              const isPriciest = q.price !== undefined && q.price === maxPrice && minPrice !== maxPrice;

              return (
                <div
                  key={q.id}
                  className="rounded-xl flex flex-col"
                  style={{ background: bg, border: `1px solid ${border}` }}
                >
                  {/* Card header */}
                  <div className="px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${border}` }}>
                    {isCheapest && (
                      <div
                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2"
                        style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}
                      >
                        ✓ Best value
                      </div>
                    )}
                    <p className="text-[11px] font-medium mb-0.5" style={{ color: accent }}>
                      {q.product}
                    </p>
                    {/* Big price */}
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-2xl font-bold" style={{ color: "#e8eaed" }}>
                        {q.price ? fmtPrice(q.price) : "—"}
                      </span>
                      <span className="text-xs" style={{ color: "rgba(147,180,253,0.5)" }}>
                        /{q.product === "NS1" ? "mo" : "yr"} list
                      </span>
                    </div>
                    {isPriciest && minPrice && q.price && (
                      <p className="text-[11px] mt-1" style={{ color: "rgba(248,113,113,0.7)" }}>
                        +{fmtPrice(q.price - minPrice)}/yr vs cheapest option
                      </p>
                    )}
                    <p className="text-[10px] mt-2" style={{ color: "rgba(147,180,253,0.4)" }}>
                      Term: {q.term}
                    </p>
                  </div>

                  {/* What drives the price */}
                  <div className="px-4 py-3 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Pricing drivers
                    </p>
                    <div className="space-y-2">
                      {q.features.filter(f => f.isPricingDriver).map((f, fi) => (
                        <div key={fi} className="flex items-start justify-between gap-2">
                          <span className="text-[11px]" style={{ color: "rgba(147,180,253,0.55)" }}>
                            {f.label}
                          </span>
                          <span
                            className="text-[11px] font-semibold text-right"
                            style={{ color: "#e8eaed" }}
                          >
                            {f.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Non-pricing features */}
                    {q.features.filter(f => !f.isPricingDriver).length > 0 && (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wider mt-3 mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>
                          Included features
                        </p>
                        <div className="space-y-1.5">
                          {q.features.filter(f => !f.isPricingDriver).map((f, fi) => (
                            <div key={fi} className="flex items-start justify-between gap-2">
                              <span className="text-[11px]" style={{ color: "rgba(147,180,253,0.4)" }}>{f.label}</span>
                              <span className="text-[11px] text-right" style={{ color: "rgba(255,255,255,0.6)" }}>{f.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Add-ons */}
                    {q.addOns.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.2)" }}>
                          Add-ons
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {q.addOns.map((a, ai) => (
                            <span
                              key={ai}
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(147,180,253,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Load button */}
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => onLoad(quotes[i])}
                      className="w-full py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: isCheapest ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
                        border: isCheapest ? "1px solid rgba(74,222,128,0.25)" : `1px solid ${border}`,
                        color: isCheapest ? "#4ade80" : accent,
                      }}
                    >
                      Load this quote →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Price difference insight banner ── */}
          {insight && (
            <div
              className="rounded-xl px-4 py-3.5 flex gap-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <span className="text-base flex-shrink-0 mt-0.5">💡</span>
              <div>
                <p className="text-xs font-semibold mb-0.5" style={{ color: "#e8eaed" }}>
                  Why the price difference?
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(147,180,253,0.6)" }}>
                  {insight}
                </p>
              </div>
            </div>
          )}

          {/* ── Side-by-side pricing driver diff (2 quotes only) ── */}
          {parsed.length === 2 && (() => {
            const [a, b] = parsed;
            // Find rows where pricing drivers differ
            const allDriverKeys = Array.from(new Set([
              ...a.features.filter(f => f.isPricingDriver).map(f => f.label),
              ...b.features.filter(f => f.isPricingDriver).map(f => f.label),
            ]));
            const diffRows = allDriverKeys.filter(key => {
              const va = a.features.find(f => f.label === key)?.value;
              const vb = b.features.find(f => f.label === key)?.value;
              return va !== vb;
            });

            if (!diffRows.length) return null;

            return (
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div
                  className="px-4 py-2.5"
                  style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <p className="text-xs font-semibold" style={{ color: "#e8eaed" }}>
                    What&rsquo;s different between these quotes
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "rgba(147,180,253,0.4)" }}>
                    These are the inputs that cause the price difference
                  </p>
                </div>
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  {diffRows.map((key) => {
                    const va = a.features.find(f => f.label === key)?.value ?? "—";
                    const vb = b.features.find(f => f.label === key)?.value ?? "—";
                    return (
                      <div key={key} className="grid grid-cols-3 px-4 py-2.5">
                        <span className="text-xs col-span-1" style={{ color: "rgba(255,255,255,0.35)" }}>{key}</span>
                        <span
                          className="text-xs font-medium text-center px-2 py-0.5 rounded"
                          style={{
                            color: PRODUCT_ACCENT[quotes[0].product] ?? "#4d8ef8",
                            background: PRODUCT_BG[quotes[0].product] ?? "rgba(77,142,248,0.08)",
                          }}
                        >
                          {va}
                        </span>
                        <span
                          className="text-xs font-medium text-center px-2 py-0.5 rounded"
                          style={{
                            color: PRODUCT_ACCENT[quotes[1].product] ?? "#4d8ef8",
                            background: PRODUCT_BG[quotes[1].product] ?? "rgba(77,142,248,0.08)",
                          }}
                        >
                          {vb}
                        </span>
                      </div>
                    );
                  })}
                  {/* Price row */}
                  {a.price && b.price && (
                    <div className="grid grid-cols-3 px-4 py-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Total price</span>
                      <span
                        className={`text-sm font-bold text-center ${a.price <= b.price ? "text-green-400" : ""}`}
                        style={{ color: a.price <= b.price ? "#4ade80" : "rgba(248,113,113,0.8)" }}
                      >
                        {fmtPrice(a.price)}/yr
                      </span>
                      <span
                        className="text-sm font-bold text-center"
                        style={{ color: b.price <= a.price ? "#4ade80" : "rgba(248,113,113,0.8)" }}
                      >
                        {fmtPrice(b.price)}/yr
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

        </div>

        {/* ── Footer ── */}
        <div
          className="px-6 py-3 flex-shrink-0 flex items-center justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[11px]" style={{ color: "rgba(147,180,253,0.35)" }}>
            All prices are LIST — confirm exact pricing and discounts in CPQ
          </p>
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(147,180,253,0.6)" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
