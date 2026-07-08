"use client";

import { useState } from "react";
import type { SavedQuote } from "@/lib/quote-history";

interface Props {
  open: boolean;
  onClose: () => void;
  quotes: SavedQuote[];
  loading: boolean;
  onDelete: (id: string, rev: string) => void;
  onCompare: (selected: SavedQuote[]) => void;
  onLoad: (quote: SavedQuote) => void;
}

export default function QuoteHistoryDrawer({
  open,
  onClose,
  quotes,
  loading,
  onDelete,
  onCompare,
  onLoad,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  };

  const selectedQuotes = quotes.filter((q) => selected.has(q.id));

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const formatPrice = (n?: number) => {
    if (!n) return null;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M/yr`;
    if (n >= 1000) return `$${Math.round(n / 1000)}K/yr`;
    return `$${n.toLocaleString()}/yr`;
  };

  const productColor: Record<string, string> = {
    Verify: "rgba(15,98,254,0.8)",
    NS1: "rgba(8,189,130,0.8)",
    Vault: "rgba(168,85,247,0.8)",
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop — clicking outside closes */}
      <div
        className="fixed inset-0"
        style={{ zIndex: 40 }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full flex flex-col"
        style={{
          width: "260px",
          zIndex: 50,
          background: "rgba(12,15,28,0.97)",
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "rgba(147,180,253,0.7)" }}>
              <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zM5 6h6M5 9h4" strokeLinecap="round"/>
            </svg>
            <span className="text-sm font-semibold" style={{ color: "#e8eaed" }}>
              Saved Quotes
            </span>
            {quotes.length > 0 && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(15,98,254,0.3)", color: "rgba(147,180,253,0.9)" }}
              >
                {quotes.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded"
            style={{ color: "rgba(147,180,253,0.5)" }}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Quote list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {loading && (
            <div className="text-center py-8 text-xs" style={{ color: "rgba(147,180,253,0.4)" }}>
              Loading…
            </div>
          )}
          {!loading && quotes.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <div className="text-2xl">📋</div>
              <p className="text-xs" style={{ color: "rgba(147,180,253,0.4)" }}>
                No saved quotes yet.
              </p>
              <p className="text-xs" style={{ color: "rgba(147,180,253,0.3)" }}>
                Complete a quote and hit&nbsp;Save.
              </p>
            </div>
          )}
          {quotes.map((q) => {
            const isSelected = selected.has(q.id);
            const isConfirming = confirmDelete === q.id;
            return (
              <div
                key={q.id}
                className="rounded-lg p-3 transition-all"
                style={{
                  background: isSelected
                    ? "rgba(15,98,254,0.1)"
                    : "rgba(255,255,255,0.04)",
                  border: isSelected
                    ? "1px solid rgba(15,98,254,0.4)"
                    : "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggle(q.id)}
                      className="mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center transition-all"
                      style={{
                        background: isSelected ? "#0f62fe" : "rgba(255,255,255,0.08)",
                        border: isSelected ? "none" : "1px solid rgba(255,255,255,0.2)",
                      }}
                      title={selected.size >= 3 && !isSelected ? "Max 3 quotes for comparison" : undefined}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="white" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>

                    <div className="min-w-0">
                      {/* Product badge */}
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: productColor[q.product] ?? "rgba(147,180,253,0.8)" }}
                      >
                        {q.product}
                      </span>

                      {/* Name (user-supplied) then auto-label */}
                      <p className="text-xs leading-snug mt-0.5 font-semibold truncate" style={{ color: "#e8eaed", maxWidth: "160px" }}>
                        {q.name || q.summary.keyMetrics.join(" · ") || q.label}
                      </p>

                      {/* Price */}
                      {q.summary.totalAnnual && (
                        <p className="text-[11px] mt-0.5" style={{ color: "rgba(147,180,253,0.6)" }}>
                          {formatPrice(q.summary.totalAnnual)}
                        </p>
                      )}

                      {/* Date + Load */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {formatDate(q.savedAt)}
                        </span>
                        <button
                          onClick={() => onLoad(q)}
                          className="text-[10px] underline"
                          style={{ color: "rgba(15,98,254,0.8)" }}
                        >
                          Load
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Delete */}
                  {isConfirming ? (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => { onDelete(q.id, q._rev ?? ""); setConfirmDelete(null); }}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-[10px]"
                        style={{ color: "rgba(255,255,255,0.3)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(q.id)}
                      className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "rgba(255,255,255,0.25)" }}
                    >
                      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 4h10M6 4V2h4v2M5 4l.5 9h5l.5-9" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Compare bar */}
        {selected.size >= 2 && (
          <div
            className="px-3 pb-4 flex-shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "12px" }}
          >
            <button
              onClick={() => onCompare(selectedQuotes)}
              className="w-full py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: "rgba(15,98,254,0.2)",
                border: "1px solid rgba(15,98,254,0.4)",
                color: "rgba(147,180,253,0.95)",
              }}
            >
              Compare {selected.size} selected →
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="w-full mt-1.5 text-[11px] text-center"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>
    </>
  );
}
