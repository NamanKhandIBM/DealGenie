"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { ConversationState, Message } from "@/lib/types";
import { initialState } from "@/lib/types";
import type { ActiveQuestion } from "@/lib/conversation";
import type { Question } from "@/lib/questions";
import type { BestPracticesMessage } from "@/lib/best-practices-ai";
import QuestionInput from "@/components/QuestionInput";
import QuoteHistoryDrawer from "@/components/QuoteHistoryDrawer";
import QuoteCompare from "@/components/QuoteCompare";
import ScenarioCompare from "@/components/ScenarioCompare";
import { normaliseAnswersForQuote } from "@/lib/compare-engine";
import type { SavedQuote } from "@/lib/quote-history";
import { exportPartsCsv } from "@/lib/export-csv";

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

  // ── Quote history ──────────────────────────────────────────────────────────
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [compareQuotes, setCompareQuotes] = useState<SavedQuote[] | null>(null);
  const [savingQuote, setSavingQuote] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [scenarioCompareOpen, setScenarioCompareOpen] = useState(false);

  const fetchQuotes = useCallback(async () => {
    setQuotesLoading(true);
    try {
      const res = await fetch("/api/quotes");
      if (res.ok) {
        const json = await res.json();
        setSavedQuotes(json.quotes ?? []);
      }
    } finally {
      setQuotesLoading(false);
    }
  }, []);

  const openHistoryDrawer = () => {
    setHistoryDrawerOpen(true);
    fetchQuotes();
  };

  const saveCurrentQuote = async (name: string): Promise<string | null> => {
    if (!state.product || savingQuote) return null;
    setSavingQuote(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          product: state.product,
          answers: state.answers,
          chatSnapshot: messages,
          name,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setSavedQuotes((prev) => [json.quote, ...prev]);
        return null; // success — no error
      }
      return json.error ?? "Failed to save quote";
    } finally {
      setSavingQuote(false);
    }
  };

  const deleteQuote = async (id: string, rev: string) => {
    await fetch(`/api/quotes?id=${id}&rev=${encodeURIComponent(rev)}`, { method: "DELETE" });
    setSavedQuotes((prev) => prev.filter((q) => q.id !== id));
  };

  const loadQuote = (quote: SavedQuote) => {
    setMessages(quote.chatSnapshot.length > 0 ? quote.chatSnapshot : [WELCOME_MESSAGE]);
    setState({
      ...initialState,
      phase: "result",
      product: quote.product,
      answers: quote.answers,
    });
    setActiveQuestion(null);
    setResultSource("quote");
    setHistoryDrawerOpen(false);
    setCompareQuotes(null);
  };

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
        if (json.state?.phase === "result") setResultSource(json.resultType ?? "quote");
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
  const sendProductAction = async (action: "quote" | "parts" | "guide" | "bestpractices") => {
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

  const startQuoting       = () => sendProductAction("quote");
  const startPartNumbers   = () => sendProductAction("parts");
  const startBestPractices = () => sendProductAction("bestpractices");

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
          {/* Deal Genie logo */}
          <img
            src="/dealgenie-icon.png"
            alt="Deal Genie"
            className="w-9 h-9 rounded-md flex-shrink-0"
            style={{ objectFit: "cover" }}
          />

          <div className="flex flex-col">
            <h1 className="font-semibold text-base leading-tight" style={{ color: "#e8eaed" }}>
              Deal Genie
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

          {/* History button */}
          <button
            onClick={openHistoryDrawer}
            className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all relative"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(203,213,225,0.8)",
            }}
          >
            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1zM5 6h6M5 9h4" strokeLinecap="round"/>
            </svg>
            Quotes
            {savedQuotes.length > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full"
                style={{ background: "#0f62fe", color: "white" }}
              >
                {savedQuotes.length}
              </span>
            )}
          </button>

          <button
            onClick={reset}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
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

                {/* After viewing PART NUMBERS → Export CSV + Best Practices + Start Quoting */}
                {state.phase === "result" && resultSource === "parts" && (
                  <>
                    <button
                      onClick={() => state.product && exportPartsCsv(state.product)}
                      disabled={loading || !state.product}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: "rgba(74,222,128,0.08)",
                        border: "1px solid rgba(74,222,128,0.25)",
                        color: "#4ade80",
                      }}
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M8 2v8M5 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M3 12h10" strokeLinecap="round"/>
                      </svg>
                      Export CSV
                    </button>
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
                      Best Practices
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

                {/* After a QUOTE RESULT → Save + Compare Scenarios + Best Practices + Start Quoting */}
                {state.phase === "result" && resultSource === "quote" && (
                  <>
                    {/* Save Quote */}
                    <button
                      onClick={() => setSaveModalOpen(true)}
                      disabled={loading || savingQuote}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: savingQuote ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
                        border: savingQuote ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.1)",
                        color: savingQuote ? "#4ade80" : "rgba(147,180,253,0.7)",
                      }}
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 2h8l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" strokeLinecap="round"/>
                        <path d="M5 2v4h6V2M5 10h6" strokeLinecap="round"/>
                      </svg>
                      {savingQuote ? "Saved ✓" : "Save Quote"}
                    </button>
                    {/* Compare Scenarios — deterministic, zero AI */}
                    <button
                      onClick={() => setScenarioCompareOpen(true)}
                      disabled={loading}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
                      style={{
                        background: "rgba(139,92,246,0.12)",
                        border: "1px solid rgba(139,92,246,0.35)",
                        color: "#a78bfa",
                      }}
                    >
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="1" y="3" width="6" height="10" rx="1"/>
                        <rect x="9" y="3" width="6" height="10" rx="1"/>
                        <path d="M7 8h2" strokeLinecap="round"/>
                      </svg>
                      Compare Scenarios
                    </button>
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
                      Best Practices
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

      {/* ── Quote History Drawer ─────────────────────────────────────────────── */}
      <QuoteHistoryDrawer
        open={historyDrawerOpen}
        onClose={() => setHistoryDrawerOpen(false)}
        quotes={savedQuotes}
        loading={quotesLoading}
        onDelete={deleteQuote}
        onCompare={(selected) => { setCompareQuotes(selected); setHistoryDrawerOpen(false); }}
        onLoad={loadQuote}
      />

      {/* ── Quote Compare Overlay ────────────────────────────────────────────── */}
      {compareQuotes && (
        <QuoteCompare
          quotes={compareQuotes}
          onClose={() => setCompareQuotes(null)}
          onLoad={loadQuote}
        />
      )}

      {/* ── Scenario Compare Overlay ─────────────────────────────────────────── */}
      {scenarioCompareOpen && state.product && (
        <ScenarioCompare
          product={state.product}
          answers={state.answers}
          onClose={() => setScenarioCompareOpen(false)}
          onBuildQuote={async (mergedAnswers) => {
            if (!state.product || loading) return;
            setScenarioCompareOpen(false);
            setHistory((h) => [...h, { messages, state, activeQuestion }]);
            setLoading(true);
            try {
              // Call /api/compute-quote directly — skips the question flow entirely
              // since all answers are already known from the locked scenario selections.
              // normaliseAnswersForQuote translates Verify addon_* keys back into
              // the addOns part-number array that computeVerifyResult reads.
              const normalisedAnswers = normaliseAnswersForQuote(
                state.product,
                { ...state.answers, ...mergedAnswers }
              );
              const res = await fetch("/api/compute-quote", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  state: {
                    ...state,
                    phase: "result",
                    answers: normalisedAnswers,
                  },
                }),
              });
              const json = await res.json();
              if (json.reply) {
                // The reply starts with <div class="result-card" — MessageBubble
                // detects that prefix and renders it with dangerouslySetInnerHTML.
                // Do NOT prepend any text or the HTML renderer won't trigger.
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
              setActiveQuestion(null);
              setResultSource("quote");
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : "Something went wrong.";
              setMessages((m) => [
                ...m,
                { id: crypto.randomUUID(), role: "assistant", content: `⚠️ ${errMsg}`, timestamp: Date.now() },
              ]);
            } finally {
              setLoading(false);
            }
          }}
        />
      )}

      {/* ── Save Quote Modal ──────────────────────────────────────────────────── */}
      {saveModalOpen && (
        <SaveQuoteModal
          existingNames={savedQuotes.map((q) => q.name ?? "")}
          saving={savingQuote}
          onSave={async (name) => {
            const err = await saveCurrentQuote(name);
            if (!err) setSaveModalOpen(false);
            return err;
          }}
          onCancel={() => setSaveModalOpen(false)}
        />
      )}
    </>
  );
}

// ─── Save Quote Modal ─────────────────────────────────────────────────────────

function SaveQuoteModal({
  existingNames,
  saving,
  onSave,
  onCancel,
}: {
  existingNames: string[];
  saving: boolean;
  onSave: (name: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lowerNames = existingNames.map((n) => n.toLowerCase());
  const isDupe = name.trim() && lowerNames.includes(name.trim().toLowerCase());

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Please enter a name for this quote."); return; }
    if (isDupe) { setError("That name is already taken. Choose a different one."); return; }
    setError(null);
    const serverError = await onSave(trimmed);
    if (serverError) setError(serverError);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 70, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "rgba(10,15,30,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
      >
        {/* Header */}
        <div>
          <h3 className="font-bold text-base" style={{ color: "#e8eaed" }}>Name this quote</h3>
          <p className="text-xs mt-1" style={{ color: "rgba(147,180,253,0.5)" }}>
            Give it a memorable name so you can find it later. Names must be unique.
          </p>
        </div>

        {/* Input */}
        <div className="flex flex-col gap-1.5">
          <input
            autoFocus
            type="text"
            placeholder="e.g. Acme Corp — 10k users SSO+MFA"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); if (e.key === "Escape") onCancel(); }}
            maxLength={80}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: error ? "1px solid rgba(248,113,113,0.6)" : isDupe ? "1px solid rgba(251,191,36,0.5)" : "1px solid rgba(255,255,255,0.12)",
              color: "#e8eaed",
            }}
          />
          {/* Inline feedback */}
          {isDupe && !error && (
            <p className="text-[11px]" style={{ color: "#fbbf24" }}>⚠ That name is already taken.</p>
          )}
          {error && (
            <p className="text-[11px]" style={{ color: "#f87171" }}>{error}</p>
          )}
          <p className="text-[10px] text-right" style={{ color: "rgba(147,180,253,0.3)" }}>{name.length}/80</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(147,180,253,0.6)", cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || !!isDupe}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            style={{
              background: saving || !name.trim() || isDupe ? "rgba(59,130,246,0.3)" : "#3b82f6",
              color: saving || !name.trim() || isDupe ? "rgba(255,255,255,0.4)" : "#fff",
              border: "none",
              cursor: saving || !name.trim() || isDupe ? "not-allowed" : "pointer",
            }}
          >
            {saving ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
                </svg>
                Saving…
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 2h8l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" strokeLinecap="round"/>
                  <path d="M5 2v4h6V2M5 10h6" strokeLinecap="round"/>
                </svg>
                Save quote
              </>
            )}
          </button>
        </div>
      </div>
    </div>
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
        <div className="w-7 h-7 flex-shrink-0 mb-0.5 rounded-full overflow-hidden" style={{ minWidth: "28px" }}>
          <img src="/dealgenie-icon.png" alt="Deal Genie" className="w-full h-full" style={{ objectFit: "cover" }} />
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
