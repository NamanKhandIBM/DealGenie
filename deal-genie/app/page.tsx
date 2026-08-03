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
import { recommendMaaS360Plan, computeMaaS360Estimate } from "@/lib/maas360-engine";
import { computeInstanaQuote } from "@/lib/instana-engine";
import { computeTurbonomicScope } from "@/lib/turbonomic-engine";
import { computeTerraformRecommendation } from "@/lib/terraform-engine";
import { computeConcertRecommendation } from "@/lib/concert-engine";
import { computeVaultQuote } from "@/lib/vault-engine";
import { computeVerifyQuote } from "@/lib/verify-engine";
import type { VerifyCapability } from "@/lib/data";

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

  // ── Compute an instant quote preview for a cross-sell target ────────────────
  // Returns { monthly, annual, keyLine } for display in the attach card.
  // Uses sensible defaults derived from the current answers so the estimate is
  // as contextual as possible without running the full guided flow.
  const computeInstantPreview = useCallback((
    target: string,
    answers: Record<string, string | number | boolean | string[]>
  ): { monthly: number; annual: number; keyLine: string } | null => {
    try {
      if (target === "Turbonomic") {
        // Seed MVS from Instana (if coming from Instana) or use 250 as a sensible default
        const mvs = Math.max(1, Number(answers.instanaMVS ?? answers.turbonomicMVS ?? 250));
        const r = computeTurbonomicScope({ deployment: "SaaS", estimatedMVS: mvs, scopingModel: "mvs", includesPublicCloud: true });
        return { monthly: r.totalMonthlyList, annual: r.totalAnnualList, keyLine: `${mvs} VMs × $18.80/mo (D09ECZX)` };
      }
      if (target === "Instana") {
        // Seed MVS from Turbonomic if available
        const mvs = Math.max(1, Number(answers.turbonomicMVS ?? answers.instanaMVS ?? 250));
        const r = computeInstanaQuote({ model: "SaaS", tier: "Standard", mvsCount: mvs });
        return { monthly: r.totalMonthlyList, annual: r.totalAnnualList, keyLine: `${mvs} MVS × $79.50/mo Standard (D0N79ZX)` };
      }
      if (target === "Vault") {
        // Sensible default: 100 secrets, 1 cluster
        const secrets = Math.max(1, Number(answers.staticSecretCount ?? 100));
        const r = computeVaultQuote({ model: "A-Platform", installCount: 1, useCaseInputs: { staticSecretCount: secrets } });
        return { monthly: Math.round(r.totalAnnualList / 12), annual: r.totalAnnualList, keyLine: `$96K install + ${secrets} secrets @ $48/RU/mo (D15FKZX)` };
      }
      if (target === "Verify") {
        const pop = Math.max(100, Number(answers.population ?? answers.verifyPopulation ?? 5000));
        const caps = (Array.isArray(answers.capabilities) ? answers.capabilities : ["SSO", "MFA"]) as VerifyCapability[];
        const r = computeVerifyQuote({ capabilities: caps, population: pop, avgLoginsPerYear: 12, term: "12-month", regions: 1 });
        return { monthly: Math.round(r.totalAnnualList / 12), annual: r.totalAnnualList, keyLine: `${caps.join("+")} · ${pop.toLocaleString()} users` };
      }
      if (target === "MaaS360") {
        const devices = Math.max(1, Number(answers.maas360Devices ?? 1000));
        const rec = recommendMaaS360Plan({
          secureMail: false, advancedApps: false, threatDefense: false, remoteSupport: false,
        });
        const r = computeMaaS360Estimate({ devices, planKey: rec.planKey, addOnKeys: [], includeConcierge: false });
        return { monthly: Math.round(r.monthlyList), annual: r.annualList, keyLine: `${devices.toLocaleString()} devices × $4.24/mo (${rec.planKey})` };
      }
      if (target === "Concert") {
        const mvs = Math.max(1, Number(answers.instanaMVS ?? answers.turbonomicMVS ?? answers.concertMVS ?? 100));
        const r = computeConcertRecommendation({ primaryPain: "alertFatigue", deployment: "onprem", estimatedMVS: mvs, observeTier: "essentials" });
        return { monthly: Math.round(r.totalAnnualList / 12), annual: r.totalAnnualList, keyLine: `${r.totalRU} RU × $212/RU/yr (D0MK3ZX)` };
      }
      if (target === "Terraform") {
        const rum = Math.max(1, Number(answers.terraformResources ?? 1000));
        const r = computeTerraformRecommendation({ deployment: "HCP", estimatedManagedResources: rum, teamSize: 5, needsGovernance: true });
        return { monthly: Math.round(r.totalAnnualList / 12), annual: r.totalAnnualList, keyLine: `${rum.toLocaleString()} RUM · ${r.recommendedEdition} (${r.lines[0]?.part ?? "D100DZX"})` };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // ── Cross-sell attach cards (one per target product) ──────────────────────
  const crossSellButtons = useMemo(() => {
    if (state.phase !== "result" || resultSource !== "quote" || crossSellSource) return [];

    type AttachCard = {
      label: string;
      description: string;
      productName: string;
      headline: string;
      detail: string;
      rationale: string;
      evidence: string[];
      sellerPrompt: string;
      crossSellCommand: string; // the text to send() — e.g. "cross-sell Vault"
      instantQuote: { monthly: number; annual: number; keyLine: string } | null;
      primary: boolean;
    };

    const cards: AttachCard[] = [];

    if (state.product === "Verify") {
      const caps = Array.isArray(state.answers.capabilities) ? state.answers.capabilities : [];
      const adaptiveSelected = caps.includes("Adaptive");
      const maas360Recommendation = recommendMaaS360Plan({
        secureMail: false, advancedApps: adaptiveSelected, threatDefense: adaptiveSelected, remoteSupport: adaptiveSelected,
      });
      const addOnLabels = maas360Recommendation.addOnKeys.map((k) =>
        k === "mtdAdvanced" ? "Mobile Threat Defense Advanced" : k === "teamViewer" ? "TeamViewer Remote Support" : k
      );
      const maas360Attach = recommendVerifyToMaaS360Attach(state.answers);
      const vaultAttach = recommendVerifyToVaultAttach(state.answers);
      const attachDecision = recommendVerifyCrossSellAttach(state.answers);

      if (attachDecision.target === "MaaS360") {
        cards.push({
          label: adaptiveSelected ? "Add device trust with MaaS360" : "Attach MaaS360",
          description: "Launch a guided MaaS360 attach so the seller can extend Verify into device trust and endpoint controls.",
          productName: "IBM MaaS360",
          headline: `${formatMaaS360PlanLabel(maas360Recommendation.planKey)} package recommended`,
          detail: addOnLabels.length > 0
            ? `Likely attach: ${formatMaaS360PlanLabel(maas360Recommendation.planKey)} with ${addOnLabels.join(" + ")}.`
            : `${formatMaaS360PlanLabel(maas360Recommendation.planKey)} for endpoint management and device trust.`,
          rationale: maas360Attach.rationale,
          evidence: maas360Attach.evidence,
          sellerPrompt: maas360Attach.headline,
          crossSellCommand: "cross-sell",
          instantQuote: computeInstantPreview("MaaS360", state.answers),
          primary: true,
        });
      } else {
        cards.push({
          label: "Attach Vault",
          description: "Launch a guided Vault attach — secrets, certificates, and machine-identity governance alongside Verify.",
          productName: "IBM HashiCorp Vault",
          headline: "Vault secrets and machine-identity attach recommended",
          detail: "Vault for secrets management, certificate lifecycle, and non-human identity governance.",
          rationale: vaultAttach.rationale,
          evidence: vaultAttach.evidence,
          sellerPrompt: vaultAttach.headline,
          crossSellCommand: "cross-sell",
          instantQuote: computeInstantPreview("Vault", state.answers),
          primary: true,
        });
      }
      return cards;
    }

    if (state.product === "MaaS360") {
      const threatDefense = String(state.answers.maas360ThreatDefense ?? "no") === "yes";
      const advancedApps = String(state.answers.maas360AdvancedApps ?? "no") === "yes";
      const secureMail = String(state.answers.maas360SecureMail ?? "no") === "yes";
      const verifyAttach = ["SSO", "MFA", ...(threatDefense ? ["Adaptive"] : []), ...(advancedApps || secureMail ? ["Lifecycle"] : [])];
      const attachInsight = recommendMaaS360ToVerifyAttach(state.answers);
      cards.push({
        label: threatDefense ? "Add Verify adaptive access" : "Attach Verify",
        description: "Launch a guided Verify attach based on the MaaS360 quote.",
        productName: "IBM Security Verify",
        headline: `${verifyAttach.join(" + ")} recommended`,
        detail: `${verifyAttach.join(" + ")} to extend endpoint controls into identity and access policy.`,
        rationale: attachInsight.rationale,
        evidence: attachInsight.evidence,
        sellerPrompt: attachInsight.headline,
        crossSellCommand: "cross-sell",
        instantQuote: computeInstantPreview("Verify", state.answers),
        primary: true,
      });
      return cards;
    }

    if (state.product === "Vault") {
      const attachInsight = recommendVaultToVerifyAttach(state.answers);
      cards.push({
        label: "Attach Verify",
        description: "Workforce identity, MFA, and adaptive access alongside Vault secrets controls.",
        productName: "IBM Security Verify",
        headline: "Verify identity modernization recommended",
        detail: "Verify for workforce SSO, MFA, adaptive access, and governance alongside Vault secrets controls.",
        rationale: attachInsight.rationale,
        evidence: attachInsight.evidence,
        sellerPrompt: attachInsight.headline,
        crossSellCommand: "cross-sell",
        instantQuote: computeInstantPreview("Verify", state.answers),
        primary: true,
      });
      return cards;
    }

    if (state.product === "Instana") {
      const mvs = Number(state.answers.instanaMVS ?? 250);
      cards.push({
        label: "Attach Turbonomic",
        description: "Close the loop from observability to automated resource optimization.",
        productName: "IBM Turbonomic",
        headline: "Turbonomic (resource automation) — primary attach",
        detail: `Turbonomic ingests Instana APM data and automates resource decisions. At ${mvs} MVS, Turbonomic requires minimum 200 MVS Standard SaaS — ✅ satisfied.`,
        rationale: "Instana sees the problem; Turbonomic fixes it automatically — no manual dashboard-to-ticket loop.",
        evidence: ["Application-aware rightsizing → SLO-safe resource actions", "One-click setup from Instana 'Optimizations' tab when both are under the same IBM account"],
        sellerPrompt: "Ask: 'When Instana fires an alert, what does your team do next? How long before the resource is actually adjusted?'",
        crossSellCommand: "cross-sell Turbonomic",
        instantQuote: computeInstantPreview("Turbonomic", state.answers),
        primary: true,
      });
      cards.push({
        label: "Attach Concert",
        description: "Concert Observe requires Instana agents as its telemetry source — architectural dependency.",
        productName: "IBM Concert",
        headline: "Concert (AI ops) — Instana is the required data feed",
        detail: "Concert Observe ingests Instana telemetry for AI-prioritized cross-domain incident intelligence. Not optional — it is the observability source.",
        rationale: "For customers struggling with alert fatigue or slow MTTR across multiple domains (not just resource optimization), Concert is the stronger motion.",
        evidence: ["Concert Observe requires Instana agents — this is an architecture dependency", "AI-prioritized incidents replace manual triage across cloud, K8s, and on-prem"],
        sellerPrompt: "Ask: 'Are your operations teams overwhelmed by alert volume across multiple monitoring tools? How long does it take to correlate an incident?'",
        crossSellCommand: "cross-sell Concert",
        instantQuote: computeInstantPreview("Concert", state.answers),
        primary: false,
      });
      return cards;
    }

    if (state.product === "Turbonomic") {
      const mvs = Number(state.answers.turbonomicMVS ?? 250);
      cards.push({
        label: "Attach Instana",
        description: "Make Turbonomic application-aware — Instana APM data feeds the optimization engine.",
        productName: "IBM Instana",
        headline: "Instana (full-stack observability) — primary attach",
        detail: `Without Instana, Turbonomic optimizes at infrastructure layer only. With Instana, resource actions are SLO-aware. At ${mvs} MVS, Standard SaaS is recommended.`,
        rationale: "Application-aware optimization requires APM data. Instana is the native feed for Turbonomic's AI engine.",
        evidence: ["SLO-aware rightsizing — Turbonomic won't squeeze resources if Instana shows latency degradation", "Sidekick integration: bidirectional metrics and action visibility in both tools"],
        sellerPrompt: "Ask: 'Is Turbonomic using APM data today, or is it optimizing blind at the infrastructure layer?'",
        crossSellCommand: "cross-sell Instana",
        instantQuote: computeInstantPreview("Instana", state.answers),
        primary: true,
      });
      cards.push({
        label: "Attach Concert",
        description: "Concert Optimize is powered by Turbonomic — same engine, surfaced through AI ops.",
        productName: "IBM Concert",
        headline: "Concert (AI ops) — Turbonomic powers the Optimize module",
        detail: "Concert Optimize is architecturally dependent on Turbonomic. Selling Concert means selling Turbonomic targets — they are part of the same platform.",
        rationale: "For customers who want AI-driven operational intelligence beyond pure resource optimization, Concert extends Turbonomic into cross-domain AIOps.",
        evidence: ["Concert Optimize requires Turbonomic targets configured — not optional", "Same optimization engine with AI-driven cross-domain context added on top"],
        sellerPrompt: "Ask: 'Beyond rightsizing, is the operations team dealing with incident correlation across multiple domains? Concert adds the AIOps layer on top.'",
        crossSellCommand: "cross-sell Concert",
        instantQuote: computeInstantPreview("Concert", state.answers),
        primary: false,
      });
      return cards;
    }

    if (state.product === "Terraform") {
      cards.push({
        label: "Attach Vault (ILM+SLM)",
        description: "Eliminate static credentials in Terraform state files — IBM's flagship ILM+SLM story.",
        productName: "IBM HashiCorp Vault",
        headline: "Vault (secrets security) — primary attach",
        detail: "Terraform creates the secrets sprawl; Vault fixes it. Dynamic credentials from Vault mean no static keys in state files or CI/CD pipelines.",
        rationale: "IBM ILM+SLM: Infrastructure Lifecycle Management (Terraform) and Security Lifecycle Management (Vault) delivered together.",
        evidence: ["Dynamic secrets from every Terraform provisioning run — credentials are ephemeral and auto-rotated", "Eliminates the #1 Terraform security risk: static credentials in state files"],
        sellerPrompt: "Ask: 'Where are the credentials your Terraform state files reference stored today? Who has access to them?'",
        crossSellCommand: "cross-sell Vault",
        instantQuote: computeInstantPreview("Vault", state.answers),
        primary: true,
      });
      cards.push({
        label: "Attach Turbonomic (ILM+ARM)",
        description: "Right-size every VM and node Terraform provisions — continuous optimization after provisioning.",
        productName: "IBM Turbonomic",
        headline: "Turbonomic (resource optimization) — adjacent attach",
        detail: "Turbonomic continuously right-sizes every resource Terraform provisions. No more over-provisioned infrastructure burning cloud budget silently.",
        rationale: "Terraform provisions at a point in time. Turbonomic optimizes continuously after provisioning — closing the ILM loop.",
        evidence: ["Continuous rightsizing of every VM/node Terraform creates", "ILM+ARM: Infrastructure Lifecycle Management + Application Resource Management"],
        sellerPrompt: "Ask: 'After Terraform provisions a VM, who ensures it stays right-sized as workloads change over time?'",
        crossSellCommand: "cross-sell Turbonomic",
        instantQuote: computeInstantPreview("Turbonomic", state.answers),
        primary: false,
      });
      return cards;
    }

    if (state.product === "Concert") {
      cards.push({
        label: "Attach Instana",
        description: "Concert Observe requires Instana agents — not optional, architectural dependency.",
        productName: "IBM Instana",
        headline: "Instana (observability) — required data feed for Concert",
        detail: "Concert Observe ingests Instana telemetry. Without Instana agents, Concert's AI context engine has no high-fidelity real-time data to work with.",
        rationale: "Concert is most powerful with high-quality observability data. Instana is the native and required data source.",
        evidence: ["Concert Observe requires Instana agents as its telemetry feed", "High-fidelity APM data → better AI prioritization and fewer false-positive incidents"],
        sellerPrompt: "Ask: 'What monitoring tool feeds Concert today? Is Instana deployed, or are we relying on lower-fidelity data sources?'",
        crossSellCommand: "cross-sell Instana",
        instantQuote: computeInstantPreview("Instana", state.answers),
        primary: true,
      });
      return cards;
    }

    if (state.product === "webMethods") {
      cards.push({
        label: "Attach Verify — secure the API fabric",
        description: "webMethods exposes APIs; Verify governs who can call them with OAuth 2.0/OIDC.",
        productName: "IBM Security Verify",
        headline: "Verify identity and API security attach recommended",
        detail: "Governed integration fabric: webMethods for connectivity, Verify for identity governance and adaptive access on every API endpoint.",
        rationale: "API modernization motions almost always leave API access ungoverned. Verify closes that gap with identity-aware API security.",
        evidence: ["OAuth 2.0/OIDC for every API endpoint webMethods publishes", "Adaptive access policy for integration consumers — block or step-up based on context"],
        sellerPrompt: "Ask: 'Who controls access to the APIs your webMethods platform publishes? Is OAuth in place, or are you still using static API keys?'",
        crossSellCommand: "cross-sell",
        instantQuote: computeInstantPreview("Verify", state.answers),
        primary: true,
      });
      return cards;
    }

    return cards;
  }, [computeInstantPreview, crossSellSource, resultSource, state.answers, state.phase, state.product]);

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

  const launchCrossSell = async (command: string) => {
    if (loading) return;
    await send(command);
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
            width={38}
            height={38}
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
                    {crossSellButtons.length > 0 && (
                      <div className="flex flex-col gap-2 mt-1">
                        {crossSellButtons.map((card) => (
                          <div
                            key={card.productName}
                            className="w-full rounded-xl p-3"
                            style={{
                              background: card.primary ? "rgba(245,158,11,0.08)" : "rgba(99,102,241,0.06)",
                              border: `1px solid ${card.primary ? "rgba(245,158,11,0.22)" : "rgba(99,102,241,0.2)"}`,
                            }}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-[11px] uppercase tracking-[0.14em]" style={{ color: card.primary ? "rgba(251,191,36,0.72)" : "rgba(167,139,250,0.7)" }}>
                                  {card.primary ? "Attach recommendation" : "Adjacent motion"}
                                </p>
                                <p className="text-sm font-semibold mt-1" style={{ color: card.primary ? "#fef3c7" : "#ede9fe" }}>
                                  {card.productName}: {card.headline}
                                </p>
                                {card.instantQuote && (
                                  <div
                                    className="mt-2 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-3"
                                    style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.08)" }}
                                  >
                                    <span className="text-base font-bold" style={{ color: "#fff" }}>
                                      ${Math.round(card.instantQuote.monthly).toLocaleString()}<span className="text-xs font-normal opacity-60">/mo</span>
                                    </span>
                                    <span className="text-xs opacity-50">·</span>
                                    <span className="text-sm font-semibold opacity-80" style={{ color: "#fff" }}>
                                      ${Math.round(card.instantQuote.annual).toLocaleString()}<span className="text-xs font-normal opacity-60">/yr list</span>
                                    </span>
                                    <span className="text-[10px] ml-1 opacity-50">{card.instantQuote.keyLine}</span>
                                  </div>
                                )}
                                <p className="text-xs mt-1.5" style={{ color: card.primary ? "rgba(254,243,199,0.82)" : "rgba(237,233,254,0.75)" }}>
                                  {card.detail}
                                </p>
                                <p className="text-xs mt-1" style={{ color: card.primary ? "rgba(254,243,199,0.64)" : "rgba(237,233,254,0.55)" }}>
                                  {card.rationale}
                                </p>
                                <p className="text-[11px] mt-2" style={{ color: card.primary ? "rgba(251,191,36,0.78)" : "rgba(167,139,250,0.78)" }}>
                                  Seller angle: {card.sellerPrompt}
                                </p>
                                {card.evidence.length > 0 && (
                                  <ul className="mt-2 space-y-1">
                                    {card.evidence.map((item) => (
                                      <li key={item} className="text-[11px] leading-relaxed" style={{ color: card.primary ? "rgba(254,243,199,0.64)" : "rgba(237,233,254,0.5)" }}>
                                        • {item}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <button
                                onClick={() => launchCrossSell(card.crossSellCommand)}
                                disabled={loading}
                                className="flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all sm:ml-4 flex-shrink-0"
                                title={card.description}
                                style={{
                                  background: card.primary ? "rgba(245,158,11,0.12)" : "rgba(99,102,241,0.1)",
                                  border: `1px solid ${card.primary ? "rgba(245,158,11,0.3)" : "rgba(99,102,241,0.25)"}`,
                                  color: card.primary ? "#fbbf24" : "#a78bfa",
                                }}
                              >
                                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                                {card.label}
                              </button>
                            </div>
                          </div>
                        ))}
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
