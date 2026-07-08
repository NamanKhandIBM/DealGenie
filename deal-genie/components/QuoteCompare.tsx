"use client";

import type { SavedQuote } from "@/lib/quote-history";

interface Props {
  quotes: SavedQuote[];
  onClose: () => void;
  onLoad: (quote: SavedQuote) => void;
}

type RowKey =
  | "product"
  | "metrics"
  | "listPrice"
  | "estNet"
  | "savedAt";

const ROW_LABELS: Record<RowKey, string> = {
  product:   "Product",
  metrics:   "Key metrics",
  listPrice: "List price / yr",
  estNet:    "Est. net / yr",
  savedAt:   "Saved",
};

function formatPrice(n?: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString([], {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function delta(a?: number, b?: number): { label: string; positive: boolean } | null {
  if (!a || !b || a === b) return null;
  const diff = b - a;
  const pct = Math.round((diff / a) * 100);
  const sign = diff > 0 ? "+" : "";
  return { label: `${sign}${pct}%`, positive: diff < 0 };
}

const productColor: Record<string, string> = {
  Verify: "rgba(15,98,254,0.8)",
  NS1:    "rgba(8,189,130,0.8)",
  Vault:  "rgba(168,85,247,0.8)",
};

export default function QuoteCompare({ quotes, onClose, onLoad }: Props) {
  const base = quotes[0];

  const getValue = (q: SavedQuote, key: RowKey): string => {
    switch (key) {
      case "product":   return q.product;
      case "metrics":   return q.summary.keyMetrics.join(" · ") || "—";
      case "listPrice": return formatPrice(q.summary.totalAnnual ?? q.summary.listPrice);
      case "estNet":    return formatPrice(q.summary.estNet);
      case "savedAt":   return formatDate(q.savedAt);
    }
  };

  const getNumeric = (q: SavedQuote, key: RowKey): number | undefined => {
    if (key === "listPrice") return q.summary.totalAnnual ?? q.summary.listPrice;
    if (key === "estNet")    return q.summary.estNet;
    return undefined;
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 60, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl mx-4 rounded-xl overflow-hidden"
        style={{
          background: "rgba(12,15,28,0.98)",
          border: "1px solid rgba(255,255,255,0.12)",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "#e8eaed" }}>
              Comparing {quotes.length} quotes
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(147,180,253,0.5)" }}>
              Δ column shows difference vs first quote
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(147,180,253,0.6)" }}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="px-6 py-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {/* Row label column */}
                <th className="text-left pb-3 pr-4" style={{ width: "110px" }}></th>

                {/* Quote columns */}
                {quotes.map((q, i) => (
                  <th key={q.id} className="pb-3 px-3 text-left">
                    <div
                      className="rounded-lg p-3"
                      style={{
                        background: i === 0
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(15,98,254,0.08)",
                        border: i === 0
                          ? "1px solid rgba(255,255,255,0.08)"
                          : "1px solid rgba(15,98,254,0.25)",
                      }}
                    >
                      <span
                        className="text-[10px] font-semibold block mb-1"
                        style={{ color: productColor[q.product] ?? "rgba(147,180,253,0.8)" }}
                      >
                        {q.product}
                      </span>
                      <span className="text-xs block" style={{ color: "#e8eaed" }}>
                        {q.summary.keyMetrics[0] ?? q.label}
                      </span>
                      <button
                        onClick={() => onLoad(q)}
                        className="text-[10px] mt-1.5 underline"
                        style={{ color: "rgba(15,98,254,0.8)" }}
                      >
                        Load this quote →
                      </button>
                    </div>
                  </th>
                ))}

                {/* Delta column — only if 2+ quotes */}
                {quotes.length >= 2 && (
                  <th className="pb-3 px-3 text-left">
                    <div
                      className="rounded-lg p-3"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span className="text-[10px] font-semibold block" style={{ color: "rgba(255,255,255,0.4)" }}>
                        Δ vs Quote 1
                      </span>
                    </div>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {(Object.keys(ROW_LABELS) as RowKey[]).map((key) => (
                <tr key={key} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  {/* Row label */}
                  <td className="py-2.5 pr-4 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {ROW_LABELS[key]}
                  </td>

                  {/* Values */}
                  {quotes.map((q) => (
                    <td key={q.id} className="py-2.5 px-3">
                      <span className="text-xs" style={{ color: "#e8eaed" }}>
                        {getValue(q, key)}
                      </span>
                    </td>
                  ))}

                  {/* Delta column */}
                  {quotes.length >= 2 && (
                    <td className="py-2.5 px-3">
                      {(() => {
                        const d = delta(
                          getNumeric(base, key),
                          getNumeric(quotes[1], key)
                        );
                        if (!d) return <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>—</span>;
                        return (
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded"
                            style={{
                              background: d.positive
                                ? "rgba(74,222,128,0.1)"
                                : "rgba(248,113,113,0.1)",
                              color: d.positive ? "#4ade80" : "#f87171",
                            }}
                          >
                            {d.label}
                          </span>
                        );
                      })()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Insight footer */}
        <div
          className="px-6 py-3 text-xs"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(147,180,253,0.45)",
          }}
        >
          💡 Tip: Click &ldquo;Load this quote&rdquo; to restore any quote into the active chat for editing or PDF export.
        </div>
      </div>
    </div>
  );
}
