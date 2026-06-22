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
    if (disabled) return;
    if (selected.length === 0) return;
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
              className="group flex flex-col items-start text-left px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-[#0f62fe] hover:bg-blue-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed min-w-[120px]"
            >
              <span className="text-sm font-medium text-gray-800 group-hover:text-[#0f62fe]">
                {opt.label}
              </span>
              {opt.hint && (
                <span className="text-xs text-gray-400 mt-0.5">{opt.hint}</span>
              )}
            </button>
          ))}
          {question.allowOther && (
            <button
              onClick={() => setShowOther((v) => !v)}
              disabled={disabled}
              className="px-4 py-2.5 rounded-xl border border-dashed border-gray-300 bg-white hover:border-[#0f62fe] text-sm text-gray-500 hover:text-[#0f62fe] transition-all disabled:opacity-40"
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
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f62fe] focus:border-transparent"
            />
            {question.unit && (
              <span className="flex items-center text-xs text-gray-400 px-1">{question.unit}</span>
            )}
            <button
              onClick={submitOther}
              disabled={!otherValue.trim()}
              className="bg-[#0f62fe] hover:bg-[#0353e9] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
            >
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
            const isNone = opt.value === "none";
            return (
              <button
                key={opt.value}
                onClick={() => toggleMulti(opt.value)}
                disabled={disabled}
                className={`group flex flex-col items-start text-left px-4 py-2.5 rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed min-w-[140px] ${
                  isSelected
                    ? "border-[#0f62fe] bg-blue-50 ring-2 ring-[#0f62fe]/20"
                    : "border-gray-200 bg-white hover:border-[#0f62fe] hover:bg-blue-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center ${
                      isSelected ? "bg-[#0f62fe] border-[#0f62fe]" : "border-gray-300"
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-sm font-medium ${isSelected ? "text-[#0f62fe]" : "text-gray-800"}`}>
                    {opt.label}
                  </span>
                </div>
                {opt.hint && (
                  <span className="text-xs text-gray-400 mt-0.5 ml-6">{opt.hint}</span>
                )}
              </button>
            );
          })}
        </div>
        {selected.length > 0 && !selected.includes("none") && (
          <p className="text-xs text-gray-500">
            Selected: {question.options?.filter((o) => selected.includes(o.value)).map((o) => o.label).join(", ")}
          </p>
        )}
        <button
          onClick={submitMulti}
          disabled={disabled || selected.length === 0}
          className="bg-[#0f62fe] hover:bg-[#0353e9] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {selected.includes("none") ? "Skip (none needed)" : "Confirm selection →"}
        </button>
      </div>
    );
  }

  // free / fallback — plain text input
  return (
    <div className="flex gap-2">
      <input
        autoFocus
        type="text"
        value={otherValue}
        onChange={(e) => setOtherValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submitOther()}
        placeholder={question.placeholder ?? "Type your answer…"}
        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f62fe] focus:border-transparent"
      />
      {question.unit && (
        <span className="flex items-center text-xs text-gray-400 px-1">{question.unit}</span>
      )}
      <button
        onClick={submitOther}
        disabled={!otherValue.trim() || disabled}
        className="bg-[#0f62fe] hover:bg-[#0353e9] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
      >
        Confirm
      </button>
    </div>
  );
}
