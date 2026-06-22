"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ConversationState, Message } from "@/lib/types";
import { initialState } from "@/lib/types";
import type { ActiveQuestion } from "@/lib/conversation";
import type { Question } from "@/lib/questions";
import QuestionInput from "@/components/QuestionInput";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "👋 Welcome to the **IBM Quoting Assistant**.\n\nI turn client requirements into **part numbers + quantities** ready to paste into CPQ.\n\nWhich product would you like to quote?",
  timestamp: Date.now(),
};

const PRODUCTS = [
  { label: "IBM Security Verify", value: "Verify" },
  { label: "NS1 Connect",          value: "NS1" },
  { label: "IBM HashiCorp Vault",  value: "Vault" },
];

// A "question card" rendered inline in the chat thread
function QuestionCard({
  question,
  onAnswer,
  disabled,
}: {
  question: Question;
  onAnswer: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm shadow-sm px-4 py-4 max-w-[85%] space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900 leading-snug">{question.ask}</p>
        {question.subtext && (
          <p className="text-xs text-gray-500 mt-1">{question.subtext}</p>
        )}
      </div>
      <QuestionInput question={question} onSubmit={onAnswer} disabled={disabled} />
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [state, setState] = useState<ConversationState>(initialState);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [freeText, setFreeText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeQuestion]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      // Add user message to chat
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: formatUserAnswer(text, activeQuestion?.question),
        timestamp: Date.now(),
      };
      setMessages((m) => [...m, userMsg]);
      setFreeText("");
      setActiveQuestion(null);
      setLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, state }),
        });
        const json = await res.json();

        // If there's a reply (opening text or result), add it
        if (json.reply) {
          setMessages((m) => [
            ...m,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: json.reply,
              timestamp: Date.now(),
            },
          ]);
        }

        setState(json.state);
        setActiveQuestion(json.activeQuestion ?? null);
      } catch {
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "⚠️ Something went wrong. Please try again.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, state, activeQuestion]
  );

  const reset = () => {
    setMessages([WELCOME_MESSAGE]);
    setState(initialState);
    setActiveQuestion(null);
    setFreeText("");
  };

  const showProductPicker = state.phase === "welcome" || state.phase === "product-select";
  const showFreeInput = !activeQuestion && state.phase !== "welcome" && state.phase !== "product-select";

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#0f62fe] text-white px-6 py-4 flex items-center gap-3 shadow-md flex-shrink-0">
        <div className="w-8 h-8 bg-white rounded-sm flex items-center justify-center flex-shrink-0">
          <span className="text-[#0f62fe] font-bold text-xs leading-none">IBM</span>
        </div>
        <div>
          <h1 className="font-semibold text-lg leading-tight">Quoting Assistant</h1>
          <p className="text-blue-200 text-xs">Requirements → Part Numbers → CPQ</p>
        </div>
        <button
          onClick={reset}
          className="ml-auto text-xs text-blue-200 hover:text-white border border-blue-300 hover:border-white px-3 py-1 rounded transition-colors"
        >
          New Quote
        </button>
      </header>

      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Product picker — shown at start */}
          {showProductPicker && !loading && (
            <div className="flex flex-col gap-2 ml-9">
              {PRODUCTS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => send(p.value)}
                  disabled={loading}
                  className="w-fit text-sm bg-white border border-gray-200 hover:border-[#0f62fe] hover:text-[#0f62fe] px-4 py-2.5 rounded-xl text-gray-700 font-medium transition-all disabled:opacity-50 text-left shadow-sm"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Active question card — rendered inline in the chat */}
          {activeQuestion && !loading && (
            <div className="flex justify-start ml-9">
              <QuestionCard
                question={activeQuestion.question}
                onAnswer={send}
                disabled={loading}
              />
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center gap-1.5 text-gray-400 text-sm pl-9">
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Free-text input — only shown at result phase or for overrides */}
      {(showFreeInput || state.phase === "result") && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex gap-2 items-end">
            <textarea
              rows={1}
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(freeText);
                }
              }}
              placeholder={
                state.phase === "result"
                  ? "Say 'restart' or type a product name to quote again…"
                  : "Or type your answer here and press Enter…"
              }
              disabled={loading}
              className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f62fe] focus:border-transparent disabled:opacity-50 bg-white"
              style={{ minHeight: "44px", maxHeight: "160px" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${t.scrollHeight}px`;
              }}
            />
            <button
              onClick={() => send(freeText)}
              disabled={loading || !freeText.trim()}
              className="bg-[#0f62fe] hover:bg-[#0353e9] text-white px-5 py-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              Send
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">
            All prices are LIST — confirm exact pricing and discounts in CPQ
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert raw answer value back to a human-readable label for display in the chat bubble */
function formatUserAnswer(value: string, question?: Question | null): string {
  if (!question || !question.options) return value;

  const values = value.split(",").map((v) => v.trim());
  const labels = values
    .map((v) => question.options?.find((o) => o.value === v)?.label ?? v)
    .filter((l) => l !== "none");

  return labels.length > 0 ? labels.join(", ") : value;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#0f62fe] text-white text-xs flex items-center justify-center font-bold flex-shrink-0 mr-2 mt-1">
          Q
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-[#0f62fe] text-white rounded-br-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <div className="prose prose-sm max-w-none prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-[#0f62fe] prose-table:text-xs">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
