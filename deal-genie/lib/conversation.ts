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
import { NS1_BEST_PRACTICES, NS1_ALL_PARTS } from "./ns1-parts";
import { VAULT_BEST_PRACTICES, VAULT_ALL_PARTS } from "./vault-parts";
import { VERIFY_BEST_PRACTICES, VERIFY_ALL_PARTS } from "./verify-parts";

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

    // Handle NS1 action selection
    if (s.product === "NS1" && currentQ?.key === "ns1Action") {
      const action = msg.trim();
      if (action === "guide") {
        s.phase = "best-practices";
        return { state: s, reply: "__BEST_PRACTICES_INIT__", activeQuestion: null };
      }
      if (action === "bestpractices") {
        s.phase = "result";
        return { state: s, reply: formatNS1BestPractices(), activeQuestion: null };
      }
      if (action === "parts") {
        s.phase = "result";
        return { state: s, reply: formatNS1PartNumbers(), activeQuestion: null };
      }
      // If "quote", continue with normal flow
    }

    // Handle Vault action selection
    if (s.product === "Vault" && currentQ?.key === "vaultAction") {
      const action = msg.trim();
      if (action === "guide") {
        s.phase = "best-practices";
        return { state: s, reply: "__BEST_PRACTICES_INIT__", activeQuestion: null };
      }
      if (action === "bestpractices") {
        s.phase = "result";
        return { state: s, reply: formatVaultBestPractices(), activeQuestion: null };
      }
      if (action === "parts") {
        s.phase = "result";
        return { state: s, reply: formatVaultPartNumbers(), activeQuestion: null };
      }
      // If "quote", continue with normal flow
    }

    // Handle Verify action selection
    if (s.product === "Verify" && currentQ?.key === "verifyAction") {
      const action = msg.trim();
      if (action === "guide") {
        s.phase = "best-practices";
        return { state: s, reply: "__BEST_PRACTICES_INIT__", activeQuestion: null };
      }
      if (action === "bestpractices") {
        s.phase = "result";
        return { state: s, reply: formatVerifyBestPractices(), activeQuestion: null };
      }
      if (action === "parts") {
        s.phase = "result";
        return { state: s, reply: formatVerifyPartNumbers(), activeQuestion: null };
      }
      // If "quote", continue with normal flow
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

export function computeResult(state: ConversationState): string {
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
  const avgLogins = Math.max(1, Math.min(12, parseNumber(String(a.avgLogins ?? 12))));
  const managedUsers = parseNumber(String(a.managedUsers ?? 0));
  const regions = 1; // one license = one tenant; not a configurable input
  const term = String(a.term ?? "12-month") as "12-month" | "3-year";

  // listPrice here is the MONTHLY list price from data.ts.
  // The verify engine computes addOnAnnual = listPrice × quantity, so we must
  // convert monthly-rated add-ons to annual before passing them in.
  const ADDON_MAP: Record<string, { description: string; listPrice: number; unit: string }> = {
    D02T6ZX: { description: "SMS and Email MFA Only",        listPrice: 33.70,        unit: "per event per thousand" },
    D01UQZX: { description: "Hosted Application Gateway",   listPrice: 22500  * 12,  unit: "per instance / year" },
    D01URZX: { description: "Vanity Domain",                 listPrice: 562    * 12,  unit: "per instance / year" },
    D22PGLL: { description: "Non-Production with SLA",       listPrice: 2810   * 12,  unit: "per instance / year" },
    D21CWLL: { description: "Non-Production without SLA",    listPrice: 1410   * 12,  unit: "per instance / year" },
  };
  const addOnParts = (a.addOns as string[]) ?? [];
  // nonProd is a single-choice key ("none" | "D22PGLL" | "D21CWLL") — merge into the add-on list
  const nonProdPart = String(a.nonProd ?? "none");
  const allParts = [...addOnParts.filter((p) => p !== "none"), ...(nonProdPart !== "none" ? [nonProdPart] : [])];
  const addOns = allParts.filter((p) => ADDON_MAP[p]).map((p) => ({
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
  ${population.toLocaleString()} users &nbsp;·&nbsp; ${avgLogins}/12 active months &nbsp;·&nbsp; MAU: <strong>${result.mau.toLocaleString()}</strong> &nbsp;·&nbsp; ${caps.join(", ")} &nbsp;·&nbsp; ${term}
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
    ddosProtection: String(a.ddos ?? "no") === "yes",
    expectedGrowthPct: growth,
    term: String(a.term ?? "12-month") === "3-year" ? "3-year" : "12-month",
  });

  // Enhanced display with part numbers, best practices, and tutorial
  const partNumberRows = result.partNumbers.map((part) =>
    `<tr>
      <td><code>${part.partNumber}</code></td>
      <td>${part.description}</td>
      <td class="text-right">${part.quantity.toLocaleString()}</td>
      <td>${part.unit}</td>
      <td class="text-sm">${part.notes}</td>
    </tr>`
  ).join("");

  const flags = result.flags.map((f) => `<li>${f}</li>`).join("");

  const bestPracticesSection = result.bestPractices.slice(0, 3).map((practice, idx) =>
    `<div class="bg-blue-50 border-l-4 border-blue-500 p-3 mb-2">
      <p class="font-semibold text-sm text-gray-900">${idx + 1}. ${practice.category}</p>
      <p class="text-xs text-gray-700 italic mt-1">"${practice.question}"</p>
      <p class="text-xs text-gray-600 mt-1">${practice.tips[0]}</p>
    </div>`
  ).join("");

  return `<div class="result-card">

<div class="result-header">
  <span class="result-product">NS1 Connect</span>
  <span class="result-badge ns1">NS1</span>
</div>

<div class="result-inputs">
  ${result.effectiveMQ.toLocaleString()} MQ/month &nbsp;·&nbsp; DNS: ${a.currentDNS ?? "N/A"} &nbsp;·&nbsp; ${a.term ?? "12-month"}
</div>

<div class="result-section-label">📋 PART NUMBERS FOR CPQ</div>
<table class="result-table">
  <thead><tr><th>Part #</th><th>Description</th><th class="text-right">Qty</th><th>Unit</th><th>Notes</th></tr></thead>
  <tbody>${partNumberRows}</tbody>
</table>

<div class="result-price-row">
  <div class="result-price">~$${result.ballparkMRR.toLocaleString()}<span>/mo</span></div>
  <div class="result-price-note">~$${result.ballparkAnnual.toLocaleString()} /yr &nbsp;·&nbsp; ILLUSTRATIVE — confirm in CPQ</div>
</div>

<ul class="result-flags">${flags}</ul>

<div class="result-section-label mt-4">💡 BEST PRACTICES (Top 3 of ${result.bestPractices.length})</div>
${bestPracticesSection}
<p class="text-xs text-gray-600 mt-2">
  <strong>Full Guide Available:</strong> ${result.bestPractices.length} best practices, ${result.tutorialSteps.length}-step tutorial, and quick reference included in the quote data.
</p>

<div class="result-next">
  ✅ <strong>Part numbers ready for CPQ</strong> (D0XXXZX = placeholder, get actual from Tony Nicolakis/Nick Lammert)<br/>
  📚 <strong>Best practices & tutorial</strong> included to help with discovery<br/>
  📋 Copy part numbers and quantities into SAP CPQ
</div>

</div>`;
}

// ─── NS1 GUIDE & PARTS FORMATTERS ────────────────────────────────────────────

function formatNS1BestPractices(): string {
  const practicesHTML = NS1_BEST_PRACTICES.map((practice, idx) => `
    <div class="bg-white border border-gray-200 rounded-lg p-4 mb-3">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
          ${idx + 1}
        </div>
        <div class="flex-1">
          <h3 class="font-semibold text-gray-900 mb-2">${practice.category}</h3>
          <div class="bg-blue-50 border-l-4 border-blue-400 p-3 mb-2">
            <p class="text-sm font-medium text-blue-900">Key Question:</p>
            <p class="text-sm text-blue-800 italic">"${practice.question}"</p>
          </div>
          <p class="text-sm text-gray-700 mb-2"><strong>Why this matters:</strong> ${practice.why}</p>
          <div class="text-sm text-gray-600">
            <p class="font-medium mb-1">Tips:</p>
            <ul class="list-disc list-inside space-y-1">
              ${practice.tips.map(tip => `<li>${tip}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  return `<div class="result-card">
<div class="result-header">
  <span class="result-product">NS1 Best Practices Guide</span>
  <span class="result-badge ns1">NS1</span>
</div>

<div class="result-inputs">
  Complete guide to gathering NS1 requirements and preparing accurate quotes
</div>

<div class="result-section-label">📚 BEST PRACTICES FOR NS1 QUOTING</div>
${practicesHTML}

</div>`;
}

function formatNS1PartNumbers(): string {
  const categoryStyle = (cat: string) => {
    if (cat === 'Core' || cat === 'Standard') return 'background:rgba(15,98,254,0.2);color:#93b4fd;border:1px solid rgba(15,98,254,0.35)';
    if (cat === 'Add-on') return 'background:rgba(8,189,186,0.15);color:#5eead4;border:1px solid rgba(8,189,186,0.3)';
    if (cat === 'GSLB') return 'background:rgba(139,92,246,0.2);color:#c4b5fd;border:1px solid rgba(139,92,246,0.35)';
    return 'background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3)';
  };

  const partsHTML = NS1_ALL_PARTS.map(part => `
    <tr>
      <td><code>${part.partNumber}</code></td>
      <td>${part.description}</td>
      <td>${part.unit}</td>
      <td><span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;${categoryStyle(part.category)}">${part.category}</span></td>
      <td>${part.notes || '—'}</td>
      <td>${part.minimums?.description ?? '—'}</td>
    </tr>
  `).join('');

  return `<div class="result-card">
<div class="result-header">
  <span class="result-product">NS1 Part Numbers Reference</span>
  <span class="result-badge ns1">NS1</span>
</div>
<div class="result-inputs">Complete catalog of NS1 part numbers — Standard, Premium &amp; Hybrid Cloud DNS</div>
<ul class="result-flags" style="margin-bottom:8px">
  <li>List prices pending — confirm all rates in IBM Software CPQ before quoting</li>
</ul>
<table class="result-table">
  <thead><tr><th>Part #</th><th>Description</th><th>Unit</th><th>Category</th><th>Notes</th><th>Minimums</th></tr></thead>
  <tbody>${partsHTML}</tbody>
</table>
</div>`;
}
// ─── VAULT FORMATTING ────────────────────────────────────────────────────────

function formatVaultBestPractices(): string {
  const practicesHTML = VAULT_BEST_PRACTICES.map((practice, idx) => `
    <div style="margin-bottom:16px;padding:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-left:3px solid #0f62fe;border-radius:10px;">
      <p style="margin:0 0 8px 0;font-weight:700;color:#e8eaed;font-size:13.5px;">${idx + 1}. ${practice.category}</p>
      <p style="margin:0 0 10px 0;font-size:12.5px;color:#93b4fd;">❓ ${practice.question}</p>
      <p style="margin:0 0 10px 0;font-size:12px;color:#cbd5e1;line-height:1.5;"><strong style="color:#e8eaed;">Why it matters:</strong> ${practice.rationale}</p>
      <ul style="margin:0;padding-left:18px;color:#94a3b8;font-size:12px;">
        ${practice.tips.map(tip => `<li style="margin-bottom:5px;">${tip}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  return `<div class="result-card">
<div class="result-header">
  <span class="result-product">IBM HashiCorp Vault — Best Practices</span>
  <span class="result-badge">Vault</span>
</div>
<div class="result-inputs">Essential questions and guidance for accurate Vault quotes</div>
${practicesHTML}
</div>`;
}

function formatVaultPartNumbers(): string {
  const categoryStyle = (cat: string) => {
    if (cat === 'Model A - Platform/RU') return 'background:rgba(15,98,254,0.2);color:#93b4fd;border:1px solid rgba(15,98,254,0.35)';
    if (cat === 'Model B - Clients/RVU') return 'background:rgba(8,189,186,0.15);color:#5eead4;border:1px solid rgba(8,189,186,0.3)';
    return 'background:rgba(139,92,246,0.2);color:#c4b5fd;border:1px solid rgba(139,92,246,0.35)';
  };

  const partsHTML = VAULT_ALL_PARTS.map(part => `
    <tr>
      <td><code>${part.partNumber}</code></td>
      <td>${part.description}</td>
      <td>${part.unit}</td>
      <td><span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;${categoryStyle(part.category)}">${part.category}</span></td>
      <td>${part.notes || '—'}</td>
    </tr>
  `).join('');

  return `<div class="result-card">
<div class="result-header">
  <span class="result-product">IBM HashiCorp Vault Part Numbers</span>
  <span class="result-badge">Vault</span>
</div>
<div class="result-inputs">Complete catalog of Vault SKUs for SAP CPQ</div>
<table class="result-table">
  <thead><tr><th>Part #</th><th>Description</th><th>Unit</th><th>Category</th><th>Notes</th></tr></thead>
  <tbody>${partsHTML}</tbody>
</table>
</div>`;
}

// ─── VERIFY FORMATTING ───────────────────────────────────────────────────────

function formatVerifyBestPractices(): string {
  const practicesHTML = VERIFY_BEST_PRACTICES.map((practice, idx) => `
    <div style="margin-bottom:16px;padding:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-left:3px solid #0f62fe;border-radius:10px;">
      <p style="margin:0 0 8px 0;font-weight:700;color:#e8eaed;font-size:13.5px;">${idx + 1}. ${practice.category}</p>
      <p style="margin:0 0 10px 0;font-size:12.5px;color:#93b4fd;">❓ ${practice.question}</p>
      <p style="margin:0 0 10px 0;font-size:12px;color:#cbd5e1;line-height:1.5;"><strong style="color:#e8eaed;">Why it matters:</strong> ${practice.rationale}</p>
      <ul style="margin:0;padding-left:18px;color:#94a3b8;font-size:12px;">
        ${practice.tips.map(tip => `<li style="margin-bottom:5px;">${tip}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  return `<div class="result-card">
<div class="result-header">
  <span class="result-product">IBM Security Verify — Best Practices</span>
  <span class="result-badge">Verify</span>
</div>
<div class="result-inputs">Essential questions and guidance for accurate Verify quotes</div>
${practicesHTML}
</div>`;
}

function formatVerifyPartNumbers(): string {
  const categoryStyle = (cat: string) =>
    cat === 'Core'
      ? 'background:rgba(15,98,254,0.2);color:#93b4fd;border:1px solid rgba(15,98,254,0.35)'
      : 'background:rgba(139,92,246,0.2);color:#c4b5fd;border:1px solid rgba(139,92,246,0.35)';

  const partsHTML = VERIFY_ALL_PARTS.map(part => `
    <tr>
      <td><code>${part.partNumber}</code></td>
      <td>${part.description}</td>
      <td>${part.unit}</td>
      <td><span style="padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;${categoryStyle(part.category)}">${part.category}</span></td>
      <td>${part.notes || '—'}</td>
    </tr>
  `).join('');

  return `<div class="result-card">
<div class="result-header">
  <span class="result-product">IBM Security Verify Part Numbers</span>
  <span class="result-badge">Verify</span>
</div>
<div class="result-inputs">Complete catalog of Verify SKUs for SAP CPQ</div>
<table class="result-table">
  <thead><tr><th>Part #</th><th>Description</th><th>Unit</th><th>Category</th><th>Notes</th></tr></thead>
  <tbody>${partsHTML}</tbody>
</table>
</div>`;
}


// ─── WELCOME ─────────────────────────────────────────────────────────────────

export const WELCOME_REPLY =
  "Which product would you like to quote?\n\n1. **IBM Security Verify**\n2. **NS1 Connect**\n3. **IBM HashiCorp Vault**\n\nPick one below or type the name.";

export function getInitialActiveQuestion(): ActiveQuestion | null {
  return null; // product selection is handled by quick-pick buttons in the UI
}
