"use client";

import { useState } from "react";
import type { Question } from "@/lib/questions";

interface Props {
  question: Question;
  onSubmit: (value: string) => void;
  disabled?: boolean;
}

export default function QuestionInput({ question, onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [showOther, setShowOther] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  const handleSingle = (value: string) => {
    if (disabled) return;
    onSubmit(value);
  };

  const toggleMulti = (value: string) => {
    if (disabled) return;
    if (value === "none") {
      setSelected(["none"]);
      return;
    }
    setSelected((prev) => {
      const without = prev.filter((v) => v !== "none");
      return without.includes(value)
        ? without.filter((v) => v !== value)
        : [...without, value];
    });
  };

  const submitMulti = () => {
    if (disabled || selected.length === 0) return;
    onSubmit(selected.join(","));
  };

  const submitOther = () => {
    if (disabled || !otherValue.trim()) return;
    onSubmit(otherValue.trim());
    setOtherValue("");
    setShowOther(false);
  };

  if (question.type === "single") {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {question.options?.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSingle(opt.value)}
              disabled={disabled}
              className="option-btn flex flex-col items-start text-left px-4 py-2.5 min-w-[110px]"
            >
              <span className="text-sm font-medium leading-snug">{opt.label}</span>
              {opt.hint && <span className="text-xs opacity-50 mt-0.5">{opt.hint}</span>}
            </button>
          ))}
          {question.allowOther && (
            <button
              onClick={() => setShowOther((v) => !v)}
              disabled={disabled}
              className="option-btn px-4 py-2.5 text-sm border-dashed"
              style={{ borderStyle: "dashed" }}
            >
              Other / enter exact
            </button>
          )}
        </div>
        {showOther && (
          <div className="flex gap-2 mt-1">
            <input
              autoFocus
              type="text"
              value={otherValue}
              onChange={(e) => setOtherValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitOther()}
              placeholder={question.placeholder ?? "Type your answer…"}
              className="input-glass flex-1 px-3 py-2 text-sm"
            />
            {question.unit && (
              <span className="flex items-center text-xs text-slate-400 px-1">{question.unit}</span>
            )}
            <button onClick={submitOther} disabled={!otherValue.trim()} className="btn-primary px-4 py-2 text-sm">
              Confirm
            </button>
          </div>
        )}
      </div>
    );
  }

  if (question.type === "multi") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {question.options?.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleMulti(opt.value)}
                disabled={disabled}
                className={`option-btn flex flex-col items-start text-left px-4 py-2.5 min-w-[130px] ${isSelected ? "selected" : ""}`}
              >
                <div className="flex items-center gap-2">
                  {/* Checkbox indicator */}
                  <div
                    className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all"
                    style={{
                      border: isSelected ? "2px solid #0f62fe" : "2px solid rgba(255,255,255,0.25)",
                      background: isSelected ? "#0f62fe" : "transparent",
                    }}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-medium leading-snug">{opt.label}</span>
                </div>
                {opt.hint && (
                  <span className="text-xs opacity-50 mt-0.5 ml-6">{opt.hint}</span>
                )}
              </button>
            );
          })}
        </div>

        {selected.length > 0 && !selected.includes("none") && (
          <p className="text-xs" style={{ color: "rgba(147,180,253,0.8)" }}>
            Selected: {question.options?.filter((o) => selected.includes(o.value)).map((o) => o.label).join(", ")}
          </p>
        )}

        <button
          onClick={submitMulti}
          disabled={disabled || selected.length === 0}
          className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2"
        >
          {selected.includes("none") ? "Skip (none needed)" : "Confirm selection"}
          {!selected.includes("none") && selected.length > 0 && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  /* number / free — plain text input */
  return (
    <div className="flex gap-2">
      <input
        autoFocus
        type={question.type === "number" ? "number" : "text"}
        value={otherValue}
        onChange={(e) => setOtherValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submitOther()}
        placeholder={question.placeholder ?? "Type your answer…"}
        className="input-glass flex-1 px-3 py-2.5 text-sm"
      />
      {question.unit && (
        <span className="flex items-center text-xs px-2" style={{ color: "rgba(203,213,225,0.5)" }}>
          {question.unit}
        </span>
      )}
      <button
        onClick={submitOther}
        disabled={!otherValue.trim() || disabled}
        className="btn-primary px-4 py-2 text-sm"
      >
        Confirm
      </button>
    </div>
  );
}
