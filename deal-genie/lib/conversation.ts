// Conversation orchestrator — structured question-driven discovery flow.
// All internal metrics (RU, MAU, etc.) are hidden from the seller.

import type { ConversationState, Product } from "./types";
import type { ExtractedEntities } from "./extractor";
import type { Question } from "./questions";
import {
  VERIFY_QUESTIONS,
  NS1_QUESTIONS,
  VAULT_QUESTIONS_COMMON,
  VAULT_QUESTIONS_MODEL_A,
  VAULT_QUESTIONS_MODEL_B,
} from "./questions";
import { computeVerifyQuote } from "./verify-engine";
import { computeVaultQuote, type VaultEdition, type VaultUseCaseInputs } from "./vault-engine";
import { computeNS1Quote } from "./ns1-engine";
import type { VerifyCapability } from "./data";

// ─── The active question to render in the UI ─────────────────────────────────
// When non-null, the UI should show option buttons instead of a plain textarea.
export interface ActiveQuestion {
  question: Question;
  // Current multi-select accumulation (for "multi" type)
  selected?: string[];
}

export interface ProcessResult {
  state: ConversationState;
  reply: string;
  activeQuestion: ActiveQuestion | null;
}

// ─── Smart free-text parser ──────────────────────────────────────────────────

function parseNumber(s: string): number {
  // Handle natural language like "around 5000", "~5k", "5,000"
  const cleaned = s.toLowerCase()
    .replace(/,/g, "")
    .replace(/~|about|around|approximately|roughly/g, "")
    .trim();
  const kMatch = cleaned.match(/^(\d+\.?\d*)\s*k$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const mMatch = cleaned.match(/^(\d+\.?\d*)\s*m(?:illion)?$/);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1_000_000);
  const n = parseFloat(cleaned.match(/[\d.]+/)?.[0] ?? "0");
  return isNaN(n) ? 0 : n;
}

function parseYesNo(s: string): boolean {
  return /^(yes|y|true|1)/i.test(s.trim());
}

function detectProduct(msg: string): Product | null {
  if (/verify|ibm security verify/i.test(msg) || msg.trim() === "1") return "Verify";
  if (/ns1|ns 1|connect/i.test(msg) || msg.trim() === "2") return "NS1";
  if (/vault|hashicorp/i.test(msg) || msg.trim() === "3") return "Vault";
  return null;
}

function getProductOpening(product: Product): string {
  switch (product) {
    case "Verify":
      return "**IBM Security Verify** — I'll ask you a few questions about the client's needs and calculate everything automatically.\n\nLet's start:";
    case "NS1":
      return "⚠️ **NS1 Connect** — I can size the deal and give a ballpark estimate, but NS1 CPQ part numbers must come from CPQ or Tony Nicolakis / Nick Lammert. Prices shown are illustrative only.\n\nLet's go through the sizing questions:";
    case "Vault":
      return "**IBM HashiCorp Vault** — Self-managed (PID 5900BJF), 12-month minimum. There are two pricing models — let me ask the first question to determine which applies:";
  }
}

// ─── Question list helpers ───────────────────────────────────────────────────

function getVaultQuestions(state: ConversationState): Question[] {
  const model = String(state.answers.vaultModel ?? "");
  const specific = model === "A" ? VAULT_QUESTIONS_MODEL_A : VAULT_QUESTIONS_MODEL_B;
  return [...VAULT_QUESTIONS_COMMON, ...specific];
}

function getQuestions(state: ConversationState): Question[] {
  switch (state.product) {
    case "Verify": return VERIFY_QUESTIONS;
    case "NS1":    return NS1_QUESTIONS;
    case "Vault":  return getVaultQuestions(state);
    default:       return [];
  }
}

function nextApplicableStep(
  questions: Question[],
  fromStep: number,
  answers: ConversationState["answers"]
): number {
  let step = fromStep;
  while (step < questions.length) {
    const q = questions[step];
    if (q.conditional && !q.conditional(answers)) {
      step++;
    } else {
      break;
    }
  }
  return step;
}

// ─── Answer storage ──────────────────────────────────────────────────────────

function storeAnswer(
  state: ConversationState,
  question: Question,
  rawValue: string
): void {
  const { key, type } = question;

  if (type === "multi") {
    // rawValue is comma-separated option values (or "none")
    if (rawValue === "none" || rawValue === "") {
      state.answers[key] = [];
    } else {
      state.answers[key] = rawValue.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return;
  }

  if (type === "single") {
    state.answers[key] = rawValue;
    return;
  }

  // number / free — store raw, parse on compute
  state.answers[key] = rawValue;
}

// ─── Entity pre-fill ─────────────────────────────────────────────────────────
// Maps extracted LLM entities onto the ConversationState answers object,
// but only for keys that are not already set (never overwrites a user's answer).

function applyEntities(s: ConversationState, e: ExtractedEntities): void {
  const set = (key: string, value: unknown) => {
    if (value !== undefined && !(key in s.answers)) {
      s.answers[key] = value as ConversationState["answers"][string];
    }
  };

  // Verify
  if (e.capabilities?.length) set("capabilities", e.capabilities);
  if (e.population)    set("population",    e.population);
  if (e.avgLogins)     set("avgLogins",     e.avgLogins);
  if (e.managedUsers)  set("managedUsers",  e.managedUsers);
  if (e.regions)       set("regions",       String(e.regions));
  if (e.term)          set("term",          e.term);
  if (e.includeNonProd !== undefined) set("includeNonProd", e.includeNonProd ? "yes" : "no");

  // Vault
  if (e.vaultModel)    set("vaultModel",    e.vaultModel);
  if (e.installCount)  set("installCount",  e.installCount);
  if (e.edition) {
    const editionMap: Record<string, string> = { Essentials: "1", Standard: "2", Premium: "3" };
    set("edition", editionMap[e.edition] ?? "2");
  }
  if (e.clientCount)   set("clientCount",   e.clientCount);
  if (e.useCases?.length) set("useCases",   e.useCases);

  // NS1
  if (e.queryMQ)          set("queryMQ",          e.queryMQ);
  if (e.recordCount)      set("recordCount",       e.recordCount);
  if (e.filterChainCount) set("filterChainCount",  e.filterChainCount);
  if (e.monitors)         set("monitors",          e.monitors);
}

// ─── MAIN PROCESSOR ──────────────────────────────────────────────────────────

export function processUserMessage(
  state: ConversationState,
  userMessage: string,
  entities: ExtractedEntities = {}
): ProcessResult {
  const s: ConversationState = JSON.parse(JSON.stringify(state));
  const msg = userMessage.trim();

  // Global restart
  if (/^(restart|reset|start over|new quote)/i.test(msg)) {
    return {
      state: { ...s, phase: "product-select", product: null, answers: {}, discoveryStep: 0 },
      reply: WELCOME_REPLY,
      activeQuestion: null,
    };
  }

  // Product selection phase
  if (s.phase === "welcome" || s.phase === "product-select") {
    const product = entities.product ?? detectProduct(msg);
    if (!product) {
      return {
        state: s,
        reply: "I can help with **IBM Security Verify**, **NS1 Connect**, or **IBM HashiCorp Vault**. Which one would you like to quote?",
        activeQuestion: null,
      };
    }
    s.product = product;
    s.phase = "discovery";
    s.discoveryStep = 0;
    s.answers = {};

    // Pre-fill any entities the LLM already extracted from the opening message
    applyEntities(s, entities);

    // Advance past questions that are already answered
    const questions = getQuestions(s);
    s.discoveryStep = nextApplicableStep(questions, 0, s.answers);

    // If all questions are already answered, go straight to result
    if (s.discoveryStep >= questions.length) {
      s.phase = "computing";
      const result = computeResult(s);
      s.phase = "result";
      return { state: s, reply: getProductOpening(product) + "\n\n" + result, activeQuestion: null };
    }

    const firstQ = questions[s.discoveryStep];
    return {
      state: s,
      reply: getProductOpening(product),
      activeQuestion: firstQ ? { question: firstQ } : null,
    };
  }

  // Discovery phase — store answer and advance
  if (s.phase === "discovery" || s.phase === "computing") {
    const questions = getQuestions(s);
    const currentQ = questions[s.discoveryStep];

    if (currentQ) {
      storeAnswer(s, currentQ, msg);
    }

    // Also apply any additional entities the LLM extracted from this message
    applyEntities(s, entities);

    // After model selection for Vault, rebuild question list
    if (s.product === "Vault" && currentQ?.key === "vaultModel") {
      // Re-derive questions with the now-known model
    }

    s.discoveryStep = nextApplicableStep(
      getQuestions(s),
      s.discoveryStep + 1,
      s.answers
    );

    const updatedQuestions = getQuestions(s);

    if (s.discoveryStep >= updatedQuestions.length) {
      s.phase = "computing";
      const result = computeResult(s);
      s.phase = "result";
      return { state: s, reply: result, activeQuestion: null };
    }

    const nextQ = updatedQuestions[s.discoveryStep];
    return {
      state: s,
      reply: "",   // UI renders the question from activeQuestion, not from reply text
      activeQuestion: nextQ ? { question: nextQ } : null,
    };
  }

  // Result phase — detect next product or restart
  if (s.phase === "result") {
    const product = detectProduct(msg);
    if (product) {
      s.product = product;
      s.phase = "discovery";
      s.discoveryStep = 0;
      s.answers = {};
      const firstQ = getQuestions(s)[0];
      return {
        state: s,
        reply: getProductOpening(product),
        activeQuestion: firstQ ? { question: firstQ } : null,
      };
    }
    return {
      state: s,
      reply: "Say **'restart'** to start a new quote, or tell me which product to quote next.",
      activeQuestion: null,
    };
  }

  return { state: s, reply: "Say 'restart' to start over.", activeQuestion: null };
}

// ─── RESULT COMPUTATION ───────────────────────────────────────────────────────

function computeResult(state: ConversationState): string {
  switch (state.product) {
    case "Verify": return computeVerifyResult(state);
    case "Vault":  return computeVaultResult(state);
    case "NS1":    return computeNS1Result(state);
    default: return "Unknown product.";
  }
}

// ─── VERIFY ──────────────────────────────────────────────────────────────────

function computeVerifyResult(state: ConversationState): string {
  const a = state.answers;
  const caps = (a.capabilities as string[]) ?? ["SSO"];
  const population = parseNumber(String(a.population ?? 500));
  const avgLogins = parseNumber(String(a.avgLogins ?? 12));
  const managedUsers = parseNumber(String(a.managedUsers ?? 0));
  const regions = parseNumber(String(a.regions ?? "1")) || 1;
  const term = String(a.term ?? "12-month") as "12-month" | "3-year";

  const ADDON_MAP: Record<string, { description: string; listPrice: number; unit: string }> = {
    D02T6ZX: { description: "SMS and Email MFA Only", listPrice: 33.70, unit: "per event per thousand" },
    D01UQZX: { description: "Hosted Application Gateway", listPrice: 22500, unit: "per instance / month" },
    D01URZX: { description: "Vanity Domain", listPrice: 562, unit: "per instance / month" },
    D22PGLL: { description: "Non-Production with SLA", listPrice: 2810, unit: "per instance / month" },
    D21CWLL: { description: "Non-Production without SLA", listPrice: 1410, unit: "per instance / month" },
  };
  const addOnParts = (a.addOns as string[]) ?? [];
  const addOns = addOnParts.filter((p) => p !== "none" && ADDON_MAP[p]).map((p) => ({
    part: p, quantity: 1, ...ADDON_MAP[p],
  }));

  const result = computeVerifyQuote({
    capabilities: caps as VerifyCapability[],
    population,
    avgLoginsPerYear: avgLogins,
    managedUsers,
    regions,
    addOns,
    term,
  });

  const rows = result.lines.map((l) =>
    `<tr><td><code>${l.part}</code></td><td>${l.description}</td><td>${l.quantity.toLocaleString()}</td><td>$${l.annualList.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td><td>${l.rationale}</td></tr>`
  ).join("");
  const flags = result.flags.map((f) => `<li>${f}</li>`).join("");

  return `<div class="result-card">

<div class="result-header">
  <span class="result-product">IBM Security Verify</span>
  <span class="result-badge">Verify</span>
</div>

<div class="result-inputs">
  ${population.toLocaleString()} users &nbsp;·&nbsp; ${avgLogins} avg logins/yr &nbsp;·&nbsp; MAU: <strong>${result.mau.toLocaleString()}</strong> &nbsp;·&nbsp; ${caps.join(", ")} &nbsp;·&nbsp; ${term}
</div>

<div class="result-section-label">PARTS TO QUOTE IN CPQ</div>
<table class="result-table">
  <thead><tr><th>Part #</th><th>Description</th><th>Qty</th><th>Annual List</th><th>How calculated</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="result-price-row">
  <div class="result-price">~$${result.totalAnnualList.toLocaleString(undefined, { maximumFractionDigits: 0 })}<span>/yr list</span></div>
  <div class="result-price-note">LIST — confirm exact pricing, discount &amp; approval in CPQ</div>
</div>

<ul class="result-flags">${flags}</ul>

<div class="result-next">📋 Paste these parts into CPQ for exact pricing, discounting, and approval.</div>

</div>`;
}

// ─── VAULT ───────────────────────────────────────────────────────────────────

function computeVaultResult(state: ConversationState): string {
  const a = state.answers;
  const modelCode = String(a.vaultModel ?? "A");
  const installCount = parseNumber(String(a.installCount ?? "1")) || 1;

  if (modelCode === "A") {
    const useCases = (a.useCases as string[]) ?? [];
    const useCaseInputs: VaultUseCaseInputs = {};
    if (useCases.includes("static"))  useCaseInputs.staticSecretCount  = parseNumber(String(a.staticSecretCount ?? "100")) || 100;
    if (useCases.includes("dynamic")) useCaseInputs.dynamicRoles        = parseNumber(String(a.dynamicRoles ?? "10")) || 10;
    if (useCases.includes("pki")) {
      useCaseInputs.pkiCertsPerMonth    = parseNumber(String(a.pkiCertsPerMonth ?? "100")) || 100;
      useCaseInputs.pkiCertLifetimeHours = parseNumber(String(a.pkiCertLifetime ?? "2160")) || 2160;
    }
    if (useCases.includes("transit")) useCaseInputs.transitCallsPerMonth = parseNumber(String(a.transitCallsPerMonth ?? "150000")) || 150000;
    if (useCases.includes("kmse"))    useCaseInputs.kmseKeyCount         = parseNumber(String(a.kmseKeyCount ?? "100")) || 100;

    const result = computeVaultQuote({
      model: "A-Platform",
      installCount,
      useCaseInputs,
      includeNonProd: parseYesNo(String(a.includeNonProd ?? "no")),
      includeKMIP: parseYesNo(String(a.includeKMIP ?? "no")),
    });
    return formatVaultResult(result, "A — Platform / Usage-based");
  }

  const editionMap: Record<string, VaultEdition> = { "1": "Essentials", "2": "Standard", "3": "Premium" };
  const edition = editionMap[String(a.edition ?? "2")] ?? "Standard";
  const clientCount = parseNumber(String(a.clientCount ?? "1")) || 1;

  const result = computeVaultQuote({
    model: "B-Clients",
    edition,
    installCount,
    clientCount,
    includeNonProd: parseYesNo(String(a.includeNonProd ?? "no")),
    pkiCerts: parseNumber(String(a.pkiAddon ?? "0")),
    adpKeyMgmt: parseNumber(String(a.adpKeyMgmt ?? "0")),
  });
  return formatVaultResult(result, `B — Clients / RVU (${edition})`);
}

function formatVaultResult(result: ReturnType<typeof computeVaultQuote>, modelLabel: string): string {
  const rows = result.lines.map((l) =>
    `<tr><td><code>${l.part}</code></td><td>${l.description}</td><td>${l.quantity.toLocaleString()}</td><td>$${l.annualList.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td><td>${l.rationale}</td></tr>`
  ).join("");
  const flags = result.flags.map((f) => `<li>${f}</li>`).join("");
  const netLine = result.ballparkNet
    ? `<div class="result-net">Approx. net after discount: ~$${result.ballparkNet.toLocaleString()} / yr</div>`
    : "";

  return `<div class="result-card">

<div class="result-header">
  <span class="result-product">IBM HashiCorp Vault</span>
  <span class="result-badge">Vault</span>
</div>

<div class="result-inputs">Model ${modelLabel}</div>

<div class="result-section-label">PARTS TO QUOTE IN CPQ</div>
<table class="result-table">
  <thead><tr><th>Part #</th><th>Description</th><th>Qty</th><th>Annual List</th><th>How calculated</th></tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="result-price-row">
  <div class="result-price">~$${result.totalAnnualList.toLocaleString(undefined, { maximumFractionDigits: 0 })}<span>/yr list</span></div>
  <div class="result-price-note">LIST — confirm exact pricing, discount &amp; approval in CPQ</div>
</div>
${netLine}

<ul class="result-flags">${flags}</ul>

<div class="result-next">📋 Paste these parts into CPQ for exact pricing, discounting, and approval.</div>

</div>`;
}

// ─── NS1 ─────────────────────────────────────────────────────────────────────

function computeNS1Result(state: ConversationState): string {
  const a = state.answers;

  const mq = parseNumber(String(a.queryMQ ?? "0"));
  const records = parseNumber(String(a.recordCount ?? "0"));

  const gslbRaw = String(a.gslb ?? "no");
  const hasGSLB = gslbRaw !== "no";
  const rumBased = gslbRaw === "yes-rum";
  const filterChains = hasGSLB ? parseNumber(String(a.filterChainCount ?? "0")) : 0;

  const monitorsRaw = parseNumber(String(a.monitors ?? "0"));

  const dedicatedRaw = String(a.dedicated ?? "no");
  const dedicatedPoPs = dedicatedRaw !== "no" ? parseNumber(dedicatedRaw) || undefined : undefined;

  const chinaRaw = String(a.china ?? "no");
  const chinaMQ = chinaRaw === "yes" ? 50 : undefined;

  const growth = parseNumber(String(a.growth ?? "0"));

  const result = computeNS1Quote({
    queryVolumeMQ: mq,
    recordCount: records,
    filterChains,
    rumBased,
    monitors: monitorsRaw,
    dedicatedPoPs,
    chinaMQ,
    dnsInsights: String(a.insights ?? "no") === "yes",
    expectedGrowthPct: growth,
    term: String(a.term ?? "12-month") === "3-year" ? "3-year" : "12-month",
  });

  const sizingRows = [
    `<tr><td>Managed DNS</td><td>${result.effectiveMQ.toLocaleString()} MQ/month</td><td class="pending">PENDING</td><td>${result.rationale}</td></tr>`,
    result.billableRecords > 0 ? `<tr><td>Billable Records</td><td>${result.billableRecords.toLocaleString()}</td><td class="pending">PENDING</td><td>Total minus 3,000 free</td></tr>` : null,
    result.filterChains > 0   ? `<tr><td>Filter Chains</td><td>${result.filterChains.toLocaleString()}</td><td class="pending">PENDING</td><td>1 per steered record</td></tr>` : null,
    result.monitors > 0       ? `<tr><td>Monitors</td><td>${result.monitors.toLocaleString()}</td><td class="pending">PENDING</td><td>1 per hostname/IP</td></tr>` : null,
    result.rumPacks            ? `<tr><td>GSLB RUM Packs</td><td>${result.rumPacks} × 5M-query packs</td><td class="pending">PENDING</td><td>RUM-based steering</td></tr>` : null,
    result.chinaMQ             ? `<tr><td>DNS for China</td><td>${result.chinaMQ} MQ/month (China-origin)</td><td class="pending">PENDING</td><td>Min 50M MQ required</td></tr>` : null,
    result.dnsInsights         ? `<tr><td>DNS Insights</td><td>~20% of query volume</td><td class="pending">PENDING</td><td>Observability add-on</td></tr>` : null,
  ].filter(Boolean).join("");

  const flags = result.flags.map((f) => `<li>${f}</li>`).join("");

  return `<div class="result-card">

<div class="result-header">
  <span class="result-product">NS1 Connect</span>
  <span class="result-badge ns1">NS1</span>
</div>

<div class="result-inputs">
  ${result.effectiveMQ.toLocaleString()} MQ/month &nbsp;·&nbsp; DNS: ${a.currentDNS ?? "N/A"} &nbsp;·&nbsp; ${a.term ?? "12-month"}
</div>

<div class="result-section-label">SIZING — ENTER THESE UNIT COUNTS IN CPQ</div>
<table class="result-table">
  <thead><tr><th>Element</th><th>Quantity</th><th>Part #</th><th>How calculated</th></tr></thead>
  <tbody>${sizingRows}</tbody>
</table>

<div class="result-price-row">
  <div class="result-price">~$${result.ballparkMRR.toLocaleString()}<span>/mo</span></div>
  <div class="result-price-note">~$${result.ballparkAnnual.toLocaleString()} /yr &nbsp;·&nbsp; ILLUSTRATIVE — confirm in CPQ</div>
</div>

<ul class="result-flags">${flags}</ul>

<div class="result-next">📋 Share unit counts with Tony Nicolakis / Nick Lammert or enter in CPQ for real part numbers.</div>

</div>`;
}

// ─── WELCOME ─────────────────────────────────────────────────────────────────

export const WELCOME_REPLY =
  "Which product would you like to quote?\n\n1. **IBM Security Verify**\n2. **NS1 Connect**\n3. **IBM HashiCorp Vault**\n\nPick one below or type the name.";

export function getInitialActiveQuestion(): ActiveQuestion | null {
  return null; // product selection is handled by quick-pick buttons in the UI
}
