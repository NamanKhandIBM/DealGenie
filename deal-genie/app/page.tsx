"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ConversationState, Message } from "@/lib/types";
import { initialState } from "@/lib/types";
import type { ActiveQuestion } from "@/lib/conversation";
import type { Question } from "@/lib/questions";
import type { BestPracticesMessage } from "@/lib/best-practices-ai";
import QuestionInput from "@/components/QuestionInput";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "👋 Welcome to the **IBM Quoting Assistant**.\n\nI turn client requirements into **part numbers + quantities** ready to paste into CPQ.\n\nWhich product would you like to quote today?",
  timestamp: Date.now(),
};

const PRODUCTS = [
  {
    label: "IBM Security Verify",
    value: "Verify",
    desc: "SSO, MFA, Adaptive Access, Lifecycle & Analytics",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "NS1 Connect",
    value: "NS1",
    desc: "Managed DNS, Traffic Steering, GSLB, Insights",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "IBM HashiCorp Vault",
    value: "Vault",
    desc: "Secrets management — Platform RU or Clients model",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round"/>
      </svg>
    ),
  },
];

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
    <div className="question-card px-5 py-4 max-w-[88%] space-y-3">
      <div>
        <p className="text-sm font-semibold leading-snug" style={{ color: "#e8eaed" }}>
          {question.ask}
        </p>
        {question.subtext && (
          <p className="text-xs mt-1.5" style={{ color: "rgba(147,180,253,0.7)" }}>
            {question.subtext}
          </p>
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
  // Best-practices AI chat history (for follow-up context)
  const [bpHistory, setBpHistory] = useState<BestPracticesMessage[]>([]);
  // History stack for the Back button — each entry is a snapshot before a send()
  const [history, setHistory] = useState<Array<{
    messages: Message[];
    state: ConversationState;
    activeQuestion: ActiveQuestion | null;
  }>>([]);
  // Tracks whether the current result screen came from a quote or a parts/guide action
  const [resultSource, setResultSource] = useState<"quote" | "parts" | null>(null);
  // Client mode — AI SME speaks directly to the client instead of the seller
  const [clientMode, setClientMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeQuestion]);

  const goBack = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setMessages(prev.messages);
    setState(prev.state);
    setActiveQuestion(prev.activeQuestion);
    setFreeText("");
  };

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      // Snapshot current state before every action so Back can restore it
      setHistory((h) => [...h, { messages, state, activeQuestion }]);

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

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "44px";
      }

      try {
        // ── Best-practices follow-up Q&A ──────────────────────────────────────
        if (state.phase === "best-practices" && state.product) {
          const newHistory: BestPracticesMessage[] = [
            ...bpHistory,
            { role: "user", content: text },
          ];
          const bpRes = await fetch("/api/best-practices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product: state.product,
              history: bpHistory,
              message: text,
              clientMode,
            }),
          });
          const bpJson = await bpRes.json();
          if (!bpRes.ok) {
            // Surface the real watsonx error in the chat so we can debug
            const errMsg = bpJson.error ?? `API error ${bpRes.status}`;
            throw new Error(errMsg);
          }
          const aiReply = bpJson.reply ?? "No response from AI.";
          const assistantHistory: BestPracticesMessage[] = [
            ...newHistory,
            { role: "assistant", content: aiReply },
          ];
          setBpHistory(assistantHistory);
          setMessages((m) => [
            ...m,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: aiReply,
              timestamp: Date.now(),
            },
          ]);
          // State stays in best-practices phase — don't update from chat API
          return;
        }

        // ── Normal quoting flow ───────────────────────────────────────────────
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, state }),
        });
        const json = await res.json();

        // Detect best-practices init sentinel
        if (json.reply === "__BEST_PRACTICES_INIT__" && json.state?.product) {
          setState(json.state);
          setActiveQuestion(null);
          setBpHistory([]);
          // Fetch the AI intro
          const bpRes = await fetch("/api/best-practices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ product: json.state.product, history: [], clientMode }),
          });
          const bpJson = await bpRes.json();
          if (!bpRes.ok) {
            const errMsg = bpJson.error ?? `API error ${bpRes.status}`;
            throw new Error(errMsg);
          }
          const intro = bpJson.reply ?? "Ask me anything about this product.";
          setBpHistory([{ role: "assistant", content: intro }]);
          setMessages((m) => [
            ...m,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: intro,
              timestamp: Date.now(),
            },
          ]);
          return;
        }

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
        // Track what kind of result was produced so the action bar shows the right buttons
        if (json.state?.phase === "result") setResultSource("quote");
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `⚠️ ${errMsg}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, state, activeQuestion, messages, bpHistory]
  );

  // ── Shared helper: send a top-level action (quote/parts/guide) for the current product ──
  const sendProductAction = async (action: "quote" | "parts" | "guide") => {
    if (!state.product || loading) return;
    setHistory((h) => [...h, { messages, state, activeQuestion }]);
    setLoading(true);
    try {
      // Start at discoveryStep 0 (the action-select question) in discovery phase
      // so the server routes "parts"/"guide"/"quote" through the correct handler.
      const actionKey =
        state.product === "Verify" ? "verifyAction" :
        state.product === "NS1"    ? "ns1Action"    : "vaultAction";
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: action,
          state: {
            ...state,
            phase: "discovery",
            answers: { [actionKey]: action },
            discoveryStep: 0,
          },
        }),
      });
      const json = await res.json();

      // Best-practices init sentinel — fetch the AI intro
      if (json.reply === "__BEST_PRACTICES_INIT__" && json.state?.product) {
        setState(json.state);
        setActiveQuestion(null);
        setBpHistory([]);
        setResultSource(null);
        const bpRes = await fetch("/api/best-practices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product: json.state.product, history: [], clientMode }),
        });
        const bpJson = await bpRes.json();
        const intro = bpJson.reply ?? "Ask me anything about this product.";
        setBpHistory([{ role: "assistant", content: intro }]);
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", content: intro, timestamp: Date.now() },
        ]);
        return;
      }

      if (json.reply) {
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: "assistant", content: json.reply, timestamp: Date.now() },
        ]);
      }
      setState(json.state);
      setActiveQuestion(json.activeQuestion ?? null);
      setBpHistory([]);
      setResultSource(action === "parts" ? "parts" : "quote");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${errMsg}`, timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startQuoting      = () => sendProductAction("quote");
  const startPartNumbers  = () => sendProductAction("parts");
  const startBestPractices = () => sendProductAction("guide");

  const toggleClientMode = async () => {
    if (!state.product || state.phase !== "best-practices") return;
    const next = !clientMode;
    setClientMode(next);
    setLoading(true);
    setBpHistory([]);
    try {
      const bpRes = await fetch("/api/best-practices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: state.product, history: [], clientMode: next }),
      });
      const bpJson = await bpRes.json();
      const intro = bpJson.reply ?? "Ready.";
      setBpHistory([{ role: "assistant", content: intro }]);
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: intro, timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([WELCOME_MESSAGE]);
    setState(initialState);
    setActiveQuestion(null);
    setFreeText("");
    setBpHistory([]);
    setHistory([]);
    setResultSource(null);
    setClientMode(false);
  };

  const showProductPicker = state.phase === "welcome" || state.phase === "product-select";
  // Show the free-text bar during discovery (plain language input) and best-practices (follow-up questions)
  const showFreeInput = !activeQuestion && state.phase !== "welcome" && state.phase !== "product-select" && state.phase !== "result";
  const isBestPracticesMode = state.phase === "best-practices";
  const showActionBar = !loading && !activeQuestion && (state.phase === "result" || state.phase === "best-practices") && state.product !== null;

  return (
    <>
      {/* Background layer */}
      <div className="app-bg" />

      <div className="flex flex-col h-screen relative" style={{ zIndex: 1 }}>
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="header-glass px-6 py-3.5 flex items-center gap-3 flex-shrink-0">
          {/* IBM logo block */}
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #0f62fe 0%, #0043ce 100%)",
              boxShadow: "0 2px 12px rgba(15,98,254,0.45)",
            }}
          >
            <span className="text-white font-bold text-[11px] tracking-tight">IBM</span>
          </div>

          <div className="flex flex-col">
            <h1 className="font-semibold text-base leading-tight" style={{ color: "#e8eaed" }}>
              Quoting Assistant
            </h1>
            <p className="text-[11px] leading-none mt-0.5" style={{ color: "rgba(147,180,253,0.7)" }}>
              Requirements → Part Numbers → CPQ
            </p>
          </div>

          {/* Powered by badge */}
          <div
            className="ml-4 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
            style={{
              background: "rgba(15,98,254,0.12)",
              border: "1px solid rgba(15,98,254,0.25)",
              color: "rgba(147,180,253,0.8)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#0f62fe", boxShadow: "0 0 6px #0f62fe" }}
            />
            watsonx.ai
          </div>

          <button
            onClick={reset}
            className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(203,213,225,0.8)",
            }}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13.5 2.5A7 7 0 1014 9" strokeLinecap="round"/>
              <path d="M14 3V7h-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            New Quote
          </button>
        </header>

        {/* ── Message thread ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Product picker */}
            {showProductPicker && !loading && (
              <div className="flex flex-col gap-2.5 ml-10">
                {PRODUCTS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => send(p.value)}
                    disabled={loading}
                    className="product-card"
                  >
                    <div className="flex items-center gap-3">
                      <span style={{ color: "#0f62fe" }}>{p.icon}</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#e8eaed" }}>{p.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(147,180,253,0.6)" }}>{p.desc}</p>
                      </div>
                      <svg
                        className="w-4 h-4 ml-auto flex-shrink-0"
                        style={{ color: "rgba(147,180,253,0.4)" }}
                        fill="none" viewBox="0 0 16 16"
                      >
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Active question card */}
            {activeQuestion && !loading && (
              <div className="flex justify-start ml-10">
                <div className="space-y-2">
                  {history.length > 0 && (
                    <button
                      onClick={goBack}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(147,180,253,0.7)",
                      }}
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Back
                    </button>
                  )}
                  <QuestionCard
                    question={activeQuestion.question}
                    onAnswer={send}
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            {/* Action bar — shown after parts, best-practices, or quote result */}
            {showActionBar && (
              <div className="flex flex-wrap items-center gap-2 ml-10">
                {/* Back button — always first when history exists */}
                {history.length > 0 && (
                  <button
                    onClick={goBack}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(147,180,253,0.7)",
                    }}
                  >
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Back
                  </button>
                )}

                {/* After viewing PART NUMBERS → offer Best Practices + Start Quoting */}
                {state.phase === "result" && resultSource === "parts" && (
                  <>
                    <button
                      onClick={startBestPractices}
                      disabled={loading}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(147,180,253,0.7)",
                      }}
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 4h12M2 8h9M2 12h6" strokeLinecap="round"/>
                      </svg>
                      AI SME
                    </button>
                    <button
                      onClick={startQuoting}
                      disabled={loading}
                      className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Start Quoting
                    </button>
                  </>
                )}

                {/* After AI SME → toggle client mode + Part Numbers + Start Quoting */}
                {state.phase === "best-practices" && (
                  <>
                    {/* Walk Client Through toggle */}
                    <button
                      onClick={toggleClientMode}
                      disabled={loading}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={clientMode ? {
                        background: "rgba(8,189,186,0.18)",
                        border: "1px solid rgba(8,189,186,0.5)",
                        color: "#5eead4",
                        fontWeight: 600,
                      } : {
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(147,180,253,0.7)",
                      }}
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="8" cy="5" r="2.5"/>
                        <path d="M2.5 13.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round"/>
                      </svg>
                      {clientMode ? "● Client Mode" : "Walk Client Through"}
                    </button>
                    <button
                      onClick={startPartNumbers}
                      disabled={loading}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(147,180,253,0.7)",
                      }}
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zM5 6h6M5 9h4" strokeLinecap="round"/>
                      </svg>
                      Part Numbers
                    </button>
                    <button
                      onClick={startQuoting}
                      disabled={loading}
                      className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Start Quoting
                    </button>
                  </>
                )}

                {/* After a QUOTE RESULT → AI SME + Start Quoting */}
                {state.phase === "result" && resultSource === "quote" && (
                  <>
                    <button
                      onClick={startBestPractices}
                      disabled={loading}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(147,180,253,0.7)",
                      }}
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 4h12M2 8h9M2 12h6" strokeLinecap="round"/>
                      </svg>
                      AI SME
                    </button>
                    <button
                      onClick={startQuoting}
                      disabled={loading}
                      className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Start Quoting
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Loading indicator */}
            {loading && (
              <div className="flex items-center gap-2 pl-10">
                {/* Avatar */}
                <div className="avatar-ring w-7 h-7 flex-shrink-0">
                  <div className="avatar-inner">
                    <span className="text-white font-bold text-[9px]">Q</span>
                  </div>
                </div>
                <div
                  className="dot-pulse flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-sm"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <span /><span /><span />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Free-text input bar ─────────────────────────────────────────────── */}
        {(showFreeInput || state.phase === "result") && (
          <div
            className="px-4 pb-4 pt-3 flex-shrink-0"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(10,15,30,0.6)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={textareaRef}
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
                   isBestPracticesMode
                     ? clientMode
                       ? "Client: type your response or question…"
                       : "Ask the AI SME a follow-up question…"
                     : state.phase === "result"
                     ? "Say 'restart' or type a product to quote again…"
                     : "Or describe the client's needs in plain language…"
                 }
                  disabled={loading}
                  className="input-glass flex-1 resize-none px-4 py-3 text-sm"
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
                  className="btn-primary px-4 py-3 flex items-center justify-center flex-shrink-0"
                  style={{ minWidth: "44px", height: "44px" }}
                >
                  <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 10h14M10 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              <p className="text-center text-xs mt-2" style={{ color: "rgba(148,163,184,0.45)" }}>
                All prices are LIST — confirm exact pricing and discounts in CPQ
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    <div className={`flex items-end gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="avatar-ring w-7 h-7 flex-shrink-0 mb-0.5" style={{ minWidth: "28px" }}>
          <div className="avatar-inner">
            <span className="font-bold text-[9px]" style={{ color: "#93b4fd" }}>Q</span>
          </div>
        </div>
      )}

      <div
        className={`max-w-[82%] px-4 py-3 text-sm leading-relaxed ${
          isUser ? "bubble-user" : "bubble-assistant"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : message.content.trimStart().startsWith('<div class="result-card"') ? (
          <div dangerouslySetInnerHTML={{ __html: message.content }} />
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* User spacer to balance layout */}
      {isUser && <div className="w-7 flex-shrink-0" />}
    </div>
  );
}
