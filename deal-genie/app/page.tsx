"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  recommendMaaS360ToVerifyAttach,
  recommendVaultToVerifyAttach,
  recommendVerifyCrossSellAttach,
  recommendVerifyToMaaS360Attach,
  recommendVerifyToVaultAttach,
} from "@/lib/cross-sell";
import type { SavedQuote } from "@/lib/quote-history";
import { exportQuoteCsv } from "@/lib/export-csv";
import { formatMaaS360PlanLabel } from "@/lib/maas360-data";
import { recommendMaaS360Plan } from "@/lib/maas360-engine";

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "👋 Welcome to **Deal Genie**.\n\nI turn client requirements into **part numbers + quantities** ready to paste into CPQ.\n\nWhich product would you like to quote today?",
  timestamp: Date.now(),
};

const PRODUCTS = [
  // ── Security & Identity ──────────────────────────────────────────────────────
  {
    label: "IBM Security Verify",
    value: "Verify",
    desc: "SSO, MFA, Adaptive Access, Lifecycle & Analytics",
    group: "Security & Identity",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "IBM HashiCorp Vault",
    value: "Vault",
    desc: "Secrets management — Platform RU or Clients model",
    group: "Security & Identity",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round"/>
      </svg>
    ),
  },
  // ── Infrastructure & Integration ──────────────────────────────────────────────
  {
    label: "NS1 Connect",
    value: "NS1",
    desc: "Managed DNS, Traffic Steering, GSLB, Insights",
    group: "Infrastructure & Integration",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "IBM MaaS360",
    value: "MaaS360",
    desc: "Unified endpoint management and endpoint security",
    group: "Infrastructure & Integration",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="4" y="3" width="16" height="18" rx="2"/>
        <path d="M9 7h6M9 12h6M9 17h6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "IBM HashiCorp Terraform",
    value: "Terraform",
    desc: "Infrastructure as Code — HCP Terraform or Enterprise",
    group: "Infrastructure & Integration",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5"/>
        <path d="M12 2v20M2 8.5l10 7 10-7" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "IBM webMethods Integration",
    value: "webMethods",
    desc: "Hybrid iPaaS — APIs, B2B/EDI, app & event integration",
    group: "Infrastructure & Integration",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round"/>
        <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/>
        <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/>
        <circle cx="9" cy="18" r="2" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  // ── Observability & AIOps ──────────────────────────────────────────────────────
  {
    label: "IBM Instana Observability",
    value: "Instana",
    desc: "Full-stack APM, distributed tracing, LLM observability",
    group: "Observability & AIOps",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "IBM Turbonomic",
    value: "Turbonomic",
    desc: "Application Resource Management — cloud & data center optimization",
    group: "Observability & AIOps",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20z"/>
        <path d="M8 12l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "IBM Concert",
    value: "Concert",
    desc: "Agentic ITOps — AI-driven cross-domain operational intelligence",
    group: "Observability & AIOps",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" strokeLinecap="round"/>
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
  const crossSellSource = typeof state.answers.crossSellSource === "string" ? state.answers.crossSellSource : null;
  const linkedSaveContext = useMemo(() => {
    if (!state.product || !crossSellSource || state.phase !== "result") return null;

    const baseStateSnapshot = history
      .slice()
      .reverse()
      .find((entry) => entry.state.phase === "result" && entry.state.product === crossSellSource && !entry.state.answers.crossSellSource);

    if (!baseStateSnapshot) return null;

    const crossSellStartIndex = messages.findIndex((message) =>
      message.content.includes("Guided cross-sell mini-flow: IBM MaaS360")
    );

    return {
      baseProduct: crossSellSource,
      crossSellProduct: state.product,
      baseAnswers: baseStateSnapshot.state.answers,
      crossSellAnswers: state.answers,
      baseChatSnapshot:
        crossSellStartIndex === -1 ? messages : messages.slice(0, crossSellStartIndex),
      crossSellChatSnapshot: messages,
    };
  }, [crossSellSource, history, messages, state.answers, state.phase, state.product]);

  const crossSellButton = useMemo(() => {
    if (state.phase !== "result" || resultSource !== "quote" || crossSellSource) return null;

    if (state.product === "Verify") {
      const caps = Array.isArray(state.answers.capabilities) ? state.answers.capabilities : [];
      const adaptiveSelected = caps.includes("Adaptive");
      const maas360Recommendation = recommendMaaS360Plan({
        secureMail: false,
        advancedApps: adaptiveSelected,
        threatDefense: adaptiveSelected,
        remoteSupport: adaptiveSelected,
      });
      const addOnLabels = maas360Recommendation.addOnKeys.map((key) => {
        if (key === "mtdAdvanced") return "Mobile Threat Defense Advanced";
        if (key === "teamViewer") return "TeamViewer Remote Support";
        return key;
      });
      const maas360Attach = recommendVerifyToMaaS360Attach(state.answers);
      const vaultAttach = recommendVerifyToVaultAttach(state.answers);
      const attachDecision = recommendVerifyCrossSellAttach(state.answers);

      if (attachDecision.target === "MaaS360") {
        return {
          label: adaptiveSelected ? "Add device trust with MaaS360" : "Attach MaaS360 Recommendation",
          description: adaptiveSelected
            ? "Launch a guided MaaS360 attach so the seller can extend Verify into device trust and endpoint controls."
            : "Launch a guided MaaS360 attach based on the Verify quote.",
          productName: "IBM MaaS360",
          headline: `${formatMaaS360PlanLabel(maas360Recommendation.planKey)} package recommended`,
          detail: addOnLabels.length > 0
            ? `Likely attach: ${formatMaaS360PlanLabel(maas360Recommendation.planKey)} with ${addOnLabels.join(" + ")}.`
            : `Likely attach: ${formatMaaS360PlanLabel(maas360Recommendation.planKey)} for endpoint management and device trust.`,
          rationale: maas360Attach.rationale,
          evidence: maas360Attach.evidence,
          sellerPrompt: maas360Attach.headline,
        };
      }

      return {
        label: "Attach Vault Recommendation",
        description: "Launch a guided Vault attach so the seller can position secrets, certificates, and machine-identity governance alongside Verify.",
        productName: "IBM HashiCorp Vault",
        headline: "Vault secrets and machine-identity attach recommended",
        detail: "Likely attach: Vault for secrets management, certificate lifecycle, and non-human identity governance.",
        rationale: vaultAttach.rationale,
        evidence: vaultAttach.evidence,
        sellerPrompt: vaultAttach.headline,
      };
    }

    if (state.product === "MaaS360") {
      const threatDefense = String(state.answers.maas360ThreatDefense ?? "no") === "yes";
      const advancedApps = String(state.answers.maas360AdvancedApps ?? "no") === "yes";
      const secureMail = String(state.answers.maas360SecureMail ?? "no") === "yes";
      const verifyAttach = [
        "SSO",
        "MFA",
        ...(threatDefense ? ["Adaptive"] : []),
        ...(advancedApps || secureMail ? ["Lifecycle"] : []),
      ];
      const attachInsight = recommendMaaS360ToVerifyAttach(state.answers);
      return {
        label: threatDefense ? "Add Verify adaptive access" : "Attach Verify Recommendation",
        description: threatDefense
          ? "Use the current MaaS360 requirements to attach identity-aware access and adaptive policy."
          : "Launch a guided Verify attach based on the MaaS360 quote.",
        productName: "IBM Security Verify",
        headline: `${verifyAttach.join(" + ")} recommended`,
        detail: `Likely attach: ${verifyAttach.join(" + ")} to extend endpoint controls into identity and access policy.`,
        rationale: attachInsight.rationale,
        evidence: attachInsight.evidence,
        sellerPrompt: attachInsight.headline,
      };
    }

    if (state.product === "Vault") {
      const attachInsight = recommendVaultToVerifyAttach(state.answers);
      return {
        label: "Attach Verify Recommendation",
        description: "Use the current Vault requirements to attach workforce identity, MFA, and adaptive access guidance.",
        productName: "IBM Security Verify",
        headline: "Verify identity modernization recommended",
        detail: "Likely attach: Verify for workforce SSO, MFA, adaptive access, and governance alongside Vault secrets controls.",
        rationale: attachInsight.rationale,
        evidence: attachInsight.evidence,
        sellerPrompt: attachInsight.headline,
      };
    }

    if (state.product === "Instana") {
      return {
        label: "Explore Turbonomic or Concert attach",
        description: "Instana provides the observability layer. Turbonomic automates resource actions; Concert adds AI-driven operational intelligence.",
        productName: "IBM Turbonomic or IBM Concert",
        headline: "Turbonomic (automation) or Concert (AI ops) recommended",
        detail: "Type 'cross-sell' to launch a guided Turbonomic or Concert attach conversation.",
        rationale: "Instana customers wanting to close the loop from visibility to action are strong Turbonomic candidates. Those struggling with alert fatigue or MTTR are Concert candidates.",
        evidence: ["Instana + Turbonomic: application-aware resource optimization", "Instana + Concert: AI-prioritized operational intelligence"],
        sellerPrompt: "Ask: 'Are you acting on observability data manually, or do you want it automated?'",
      };
    }

    if (state.product === "Turbonomic") {
      return {
        label: "Attach Instana or explore Apptio FinOps",
        description: "Turbonomic's AI actions become application-aware when Instana feeds real-time APM data. Apptio adds financial governance and showback.",
        productName: "IBM Instana · IBM Apptio",
        headline: "Instana (application-aware optimization) or Apptio (FinOps governance) recommended",
        detail: "Primary attach: Instana Standard for application-aware resource decisions. Adjacent motion: Apptio Cloudability for cost allocation, showback, and FinOps accountability.",
        rationale: "Without observability, Turbonomic optimizes at the infrastructure layer only. Without Apptio, optimization actions lack financial visibility to stakeholders.",
        evidence: [
          "Instana: native APM data feed → SLO-aware resource actions",
          "Apptio: showback/chargeback that makes Turbonomic savings visible to finance",
          "Type 'cross-sell' to explore the Instana guided flow",
        ],
        sellerPrompt: "Ask: 'Is Turbonomic using APM data today? And who sees the cost savings in your finance reports?'",
      };
    }

    if (state.product === "Terraform") {
      return {
        label: "Attach Vault (ILM+SLM) or Turbonomic (ILM+ARM)",
        description: "Terraform provisions infrastructure; Vault secures it. Turbonomic right-sizes it continuously after provisioning.",
        productName: "IBM HashiCorp Vault · IBM Turbonomic",
        headline: "Vault (secrets security) and/or Turbonomic (resource optimization) recommended",
        detail: "Primary attach: Vault eliminates static credentials in Terraform state files — IBM's flagship ILM+SLM story. Adjacent attach: Turbonomic keeps the provisioned infrastructure right-sized and cost-optimized continuously.",
        rationale: "Terraform creates the resources and the secrets sprawl. Vault fixes the secrets. Turbonomic fixes the over-provisioning.",
        evidence: [
          "Vault: dynamic secrets from Terraform provisioning runs — no static credentials",
          "Turbonomic: continuous rightsizing of every VM/node Terraform creates",
          "Type 'cross-sell' to explore the Vault guided flow",
        ],
        sellerPrompt: "Ask: 'Where are your Terraform service credentials stored today? And how do you ensure provisioned resources stay right-sized over time?'",
      };
    }

    if (state.product === "Concert") {
      return {
        label: "Attach Instana or explore Apptio FinOps",
        description: "Concert's AI intelligence is amplified by Instana telemetry. Apptio connects Concert's optimization signals to financial governance.",
        productName: "IBM Instana · IBM Apptio",
        headline: "Instana (richer telemetry) or Apptio (FinOps governance) recommended",
        detail: "Primary attach: Instana feeds Concert's cross-domain context engine with high-fidelity real-time signals. Adjacent motion: Apptio Cloudability translates Concert Optimize savings into financial accountability.",
        rationale: "Concert is most powerful with high-quality observability data. And Concert Optimize ROI is only visible to leadership when it connects to financial reporting.",
        evidence: [
          "Instana: high-fidelity telemetry → better AI context and prioritization in Concert",
          "Apptio: cost allocation and showback that makes Concert Optimize actions visible to finance",
          "Type 'cross-sell' to explore the Instana guided flow",
        ],
        sellerPrompt: "Ask: 'What monitoring data feeds Concert today? And how does your team demonstrate FinOps ROI to leadership?'",
      };
    }

    if (state.product === "webMethods") {
      return {
        label: "Attach Verify — secure the API fabric",
        description: "webMethods exposes APIs and integration endpoints; Verify provides identity-based access governance for those endpoints.",
        productName: "IBM Security Verify",
        headline: "Verify identity and API security attach recommended",
        detail: "Governed integration fabric: webMethods for connectivity, Verify for OAuth 2.0/OIDC identity governance and adaptive access.",
        rationale: "API modernization motions almost always leave API access ungoverned. Verify closes that gap.",
        evidence: ["OAuth 2.0/OIDC for every API endpoint", "Adaptive access policy for integration consumers"],
        sellerPrompt: "Ask: 'Who controls access to the APIs your webMethods platform publishes? Is identity governance in place?'",
      };
    }

    return null;
  }, [crossSellSource, resultSource, state.answers, state.phase, state.product]);

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
      if (linkedSaveContext) {
        const groupId = crypto.randomUUID();
        const baseQuoteId = crypto.randomUUID();
        const crossSellQuoteId = crypto.randomUUID();
        const crossSellName = `${name} — ${linkedSaveContext.crossSellProduct} Cross-sell`;
        const res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quotes: [
              {
                id: baseQuoteId,
                product: linkedSaveContext.baseProduct,
                answers: linkedSaveContext.baseAnswers,
                chatSnapshot: linkedSaveContext.baseChatSnapshot,
                name,
                linkedQuoteGroupId: groupId,
                linkedQuoteRole: "base",
                linkedToQuoteId: crossSellQuoteId,
              },
              {
                id: crossSellQuoteId,
                product: linkedSaveContext.crossSellProduct,
                answers: linkedSaveContext.crossSellAnswers,
                chatSnapshot: linkedSaveContext.crossSellChatSnapshot,
                name: crossSellName,
                linkedQuoteGroupId: groupId,
                linkedQuoteRole: "cross-sell",
                linkedToQuoteId: baseQuoteId,
              },
            ],
          }),
        });
        const json = await res.json();
        if (res.ok) {
          setSavedQuotes((prev) => [...(json.quotes ?? []), ...prev]);
          return null;
        }
        return json.error ?? "Failed to save linked quotes";
      }

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
        return null;
      }
      return json.error ?? "Failed to save quote";
    } finally {
      setSavingQuote(false);
    }
  };

  const deleteQuote = async (quote: SavedQuote) => {
    if (quote.linkedQuoteGroupId) {
      await fetch(`/api/quotes?groupId=${encodeURIComponent(quote.linkedQuoteGroupId)}`, { method: "DELETE" });
      setSavedQuotes((prev) => prev.filter((q) => q.linkedQuoteGroupId !== quote.linkedQuoteGroupId));
      return;
    }

    await fetch(`/api/quotes?id=${quote.id}&rev=${encodeURIComponent(quote._rev ?? "")}`, { method: "DELETE" });
    setSavedQuotes((prev) => prev.filter((q) => q.id !== quote.id));
  };

  const launchCrossSell = async () => {
    if (!crossSellButton || loading) return;
    await send("cross-sell");
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
    [activeQuestion, bpHistory, clientMode, loading, messages, state]
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
        state.product === "Verify"      ? "verifyAction"      :
        state.product === "MaaS360"     ? "maas360Action"     :
        state.product === "NS1"         ? "ns1Action"         :
        state.product === "Instana"     ? "instanaAction"     :
        state.product === "Turbonomic"  ? "turbonomicAction"  :
        state.product === "Terraform"   ? "terraformAction"   :
        state.product === "Concert"     ? "concertAction"     :
        state.product === "webMethods"  ? "webMethodsAction"  :
        "vaultAction";
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

  const startQuoting = () => sendProductAction("quote");
  const startBestPractices = () => sendProductAction("bestpractices");

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
        <header className="header-glass px-6 py-3.5 flex items-center gap-3 flex-shrink-0" style={{ height: "56px" }}>
          {/* Deal Genie logo */}
          <Image
            src="/dealgenie-icon.png"
            alt="Deal Genie"
            width={50}
            height={50}
            className="rounded-xl flex-shrink-0"
            style={{ objectFit: "cover", objectPosition: "center" }}
          />

          <div className="flex flex-col">
            <h1 className="font-semibold text-base leading-tight" style={{ color: "#e8eaed" }}>
              Deal Genie
            </h1>
            <p className="text-[11px] leading-none mt-0.5" style={{ color: "rgba(147,180,253,0.7)" }}>
              Requirements → Part Numbers → CPQ
            </p>
          </div>

          {/* Active product pill */}
          {state.product && (
            <div
              className="ml-3 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.14)",
                color: "rgba(203,213,225,0.9)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{
                  background:
                    state.product === "Verify" || state.product === "MaaS360" ? "#a855f7" :
                    state.product === "Terraform" || state.product === "Vault" ? "#3b82f6" :
                    state.product === "Instana" || state.product === "Concert" || state.product === "NS1" ? "#14b8a6" :
                    state.product === "Turbonomic" ? "#22c55e" :
                    state.product === "webMethods" ? "#f97316" : "#0f62fe",
                }}
              />
              {state.product === "Verify" ? "Security Verify" :
               state.product === "MaaS360" ? "MaaS360" :
               state.product === "NS1" ? "NS1 Connect" :
               state.product === "Vault" ? "HashiCorp Vault" :
               state.product === "Terraform" ? "HashiCorp Terraform" :
               state.product === "Instana" ? "Instana" :
               state.product === "Turbonomic" ? "Turbonomic" :
               state.product === "Concert" ? "Concert" :
               state.product === "webMethods" ? "webMethods" : state.product}
            </div>
          )}

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
                    className={`product-card ${p.value.toLowerCase()}`}
                  >
                    <div className="flex items-center gap-3">
                      <span style={{ color: "currentColor", opacity: 0.7 }}>{p.icon}</span>
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
                      onClick={() => state.product && exportQuoteCsv(state.product, state.answers)}
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

                {/* After a QUOTE RESULT → Export CSV + Save + Compare Scenarios + Best Practices + Start Quoting */}
                {state.phase === "result" && resultSource === "quote" && (
                  <>
                    {/* Export CSV */}
                    <button
                      onClick={() => state.product && exportQuoteCsv(state.product, state.answers)}
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
                    {crossSellButton && (
                      <div
                        className="w-full rounded-xl p-3 mt-1"
                        style={{
                          background: "rgba(245,158,11,0.08)",
                          border: "1px solid rgba(245,158,11,0.22)",
                        }}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "rgba(251,191,36,0.72)" }}>
                              Attach recommendation
                            </p>
                            <p className="text-sm font-semibold mt-1" style={{ color: "#fef3c7" }}>
                              {crossSellButton.productName}: {crossSellButton.headline}
                            </p>
                            <p className="text-xs mt-1" style={{ color: "rgba(254,243,199,0.82)" }}>
                              {crossSellButton.detail}
                            </p>
                            <p className="text-xs mt-1.5" style={{ color: "rgba(254,243,199,0.64)" }}>
                              {crossSellButton.rationale}
                            </p>
                            <p className="text-[11px] mt-2" style={{ color: "rgba(251,191,36,0.78)" }}>
                              Seller angle: {crossSellButton.sellerPrompt}
                            </p>
                            {crossSellButton.evidence.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {crossSellButton.evidence.map((item) => (
                                  <li
                                    key={item}
                                    className="text-[11px] leading-relaxed"
                                    style={{ color: "rgba(254,243,199,0.64)" }}
                                  >
                                    • {item}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <button
                            onClick={launchCrossSell}
                            disabled={loading}
                            className="flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all sm:ml-4"
                            title={crossSellButton.description}
                            style={{
                              background: "rgba(245,158,11,0.12)",
                              border: "1px solid rgba(245,158,11,0.3)",
                              color: "#fbbf24",
                            }}
                          >
                            <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            {crossSellButton.label}
                          </button>
                        </div>
                      </div>
                    )}
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
          linkedProductName={linkedSaveContext?.crossSellProduct ?? null}
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
  linkedProductName,
}: {
  existingNames: string[];
  saving: boolean;
  onSave: (name: string) => Promise<string | null>;
  onCancel: () => void;
  linkedProductName: string | null;
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
            {linkedProductName ? ` Saving will also create a linked ${linkedProductName} cross-sell record.` : ""}
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
        <div className="w-10 h-10 flex-shrink-0 mb-0.5 rounded-full overflow-hidden" style={{ minWidth: "40px" }}>
          <Image src="/dealgenie-icon.png" alt="Deal Genie" width={40} height={40} className="w-full h-full" style={{ objectFit: "cover" }} />
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
