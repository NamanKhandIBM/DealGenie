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
  // Model A = usage/consumption-based (aligns with Vault 2.0 direction)
  // Model B = client/seat-based (classic Vault 1.0)
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

    // Inline Q&A: if the message looks like a question (not an option answer) and a product
    // is already selected, try to answer it from static knowledge before storing as an answer.
    // This means sellers can type "what counts as a client?" mid-flow and get a real answer.
    if (s.product && currentQ && isLikelyQuestion(msg)) {
      const staticAnswer = staticInlineAnswer(s.product, msg);
      if (staticAnswer) {
        // Don't advance the step — keep the active question, just reply with the answer
        return {
          state: s,
          reply: staticAnswer,
          activeQuestion: { question: currentQ },
        };
      }
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
  const regions = Math.max(1, parseNumber(String(a.regions ?? "1")));
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
    if (useCases.includes("ssh")) {
      useCaseInputs.sshCredsPerMonth  = parseNumber(String(a.sshCredsPerMonth ?? "100")) || 100;
      useCaseInputs.sshLifetimeHours  = parseNumber(String(a.sshLifetime ?? "24")) || 24;
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

  const adpTransformClients = parseNumber(String(a.adpTransform ?? "0"));

  const result = computeVaultQuote({
    model: "B-Clients",
    edition,
    installCount,
    clientCount,
    includeNonProd: parseYesNo(String(a.includeNonProd ?? "no")),
    pkiCerts: parseNumber(String(a.pkiAddon ?? "0")),
    adpKeyMgmt: parseNumber(String(a.adpKeyMgmt ?? "0")),
    adpTransformClients: adpTransformClients > 0 ? adpTransformClients : undefined,
  });
  return formatVaultResult(result, `B — Clients / RVU (${edition})`);
}

function formatVaultResult(result: ReturnType<typeof computeVaultQuote>, modelLabel: string): string {
  const rows = result.lines.map((l) =>
    `<tr><td><code>${l.part}</code></td><td>${l.description}</td><td>${l.quantity.toLocaleString()}</td><td>$${l.annualList.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td><td>${l.rationale}</td></tr>`
  ).join("");
  const flags = result.flags.map((f) => `<li>${f}</li>`).join("");

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
  const rumBased = gslbRaw === "yes-rum";
  const rumAdvanced = gslbRaw === "yes-rum-advanced";
  const filterChains = parseNumber(String(a.filterChainCount ?? "0"));

  const monitorsRaw = parseNumber(String(a.monitors ?? "0"));

  const dedicatedRaw = String(a.dedicated ?? "no");
  const dedicatedPoPs = dedicatedRaw !== "no" ? parseNumber(dedicatedRaw) || undefined : undefined;

  const chinaRaw = String(a.china ?? "no");
  const chinaMQ = chinaRaw === "yes"
    ? Math.max(50, parseNumber(String(a.chinaMQ ?? "50")))
    : undefined;

  // growthMQ: absolute MQ headroom (new); fall back to legacy % if present
  const growthMQ = parseNumber(String(a.growthMQ ?? "0"));
  const growthPct = parseNumber(String(a.growth ?? "0")); // legacy fallback

  // Combined DDoS+NXD answer: "no" | "ddos" | "nxd" | "both"
  const ddosNxdRaw = String(a.ddos ?? "no");
  const ddosProtection = ddosNxdRaw === "ddos" || ddosNxdRaw === "both" || ddosNxdRaw === "yes";
  const nxdWaiver    = ddosNxdRaw === "nxd"  || ddosNxdRaw === "both";

  const result = computeNS1Quote({
    queryVolumeMQ: mq,
    recordCount: records,
    filterChains,
    rumBased: rumBased || rumAdvanced,
    rumAdvanced,
    monitors: monitorsRaw,
    dedicatedPoPs,
    chinaMQ,
    dnsInsights: String(a.insights ?? "no") === "yes",
    ddosProtection,
    nxdWaiver,
    cloudSync: String(a.cloudSync ?? "no") === "yes",
    growthMQ,
    expectedGrowthPct: growthPct,
    term: String(a.term ?? "12-month") === "3-year" ? "3-year" : "12-month",
  });

  // Enhanced display with part numbers, best practices, and tutorial
  const partNumberRows = result.partNumbers.map((part) =>
    `<tr>
      <td><code>${part.partNumber}</code></td>
      <td>${part.description}</td>
      <td class="text-right">${part.quantity.toLocaleString()}</td>
      <td class="text-right">${part.listPrice > 0 ? `$${part.listPrice.toFixed(3)}` : "—"}</td>
      <td class="text-right">${part.extendedPrice > 0 ? `$${part.extendedPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}</td>
      <td class="text-sm">${part.notes}</td>
    </tr>`
  ).join("");

  const flags = result.flags.map((f) => `<li>${f}</li>`).join("");

  const tierLabel = result.tier === "Hybrid"
    ? "Hybrid Cloud DNS (5900B5C)"
    : result.tier === "Premium"
    ? "NS1 Connect Premium (5900B4J)"
    : result.tier === "Standard"
    ? "NS1 Connect Standard (5900B4J)"
    : "NS1 Connect Essentials (5900B4J)";

  // ── CPQ Input Summary (item 12 from Nick) ─────────────────────────────────
  const cpqSummaryRows = [
    ["Package",       tierLabel],
    ["Queries/month", `${result.effectiveMQ.toLocaleString()}M`],
    ["Records",       `${(records ?? 0).toLocaleString()}`],
    ["Filter Chains", `${filterChains}`],
    ["Monitors",      `${monitorsRaw}`],
    ...(chinaMQ ? [["China DNS (MQ)", `${chinaMQ}M`]] : []),
    ...(result.dnsInsights ? [["DNS Insights", "Yes"]] : []),
    ["Term",          String(a.term ?? "12-month")],
  ].map(([label, val]) =>
    `<tr><td style="color:#94a3b8;padding:3px 12px 3px 0;font-size:12px;">${label}</td><td style="font-size:12px;font-weight:600;">${val}</td></tr>`
  ).join("");

  return `<div class="result-card">

<div class="result-header">
  <span class="result-product">NS1 Connect</span>
  <span class="result-badge ns1">NS1 · ${result.tier}</span>
</div>

<div class="result-inputs">
  ${result.effectiveMQ.toLocaleString()} MQ/month &nbsp;·&nbsp; ${tierLabel} &nbsp;·&nbsp; ${a.term ?? "12-month"}
</div>

<div class="result-section-label">📋 PART NUMBERS FOR CPQ</div>
<table class="result-table">
  <thead><tr><th>Part #</th><th>Description</th><th class="text-right">Qty</th><th class="text-right">List $/mo</th><th class="text-right">Extended $/mo</th><th>Notes</th></tr></thead>
  <tbody>${partNumberRows}</tbody>
</table>

<div class="result-price-row">
  ${result.totalMonthlyList > 0
    ? `<div class="result-price">$${result.totalMonthlyList.toLocaleString(undefined, { maximumFractionDigits: 0 })}<span>/mo list</span></div>
       <div class="result-price-note">$${result.totalAnnualList.toLocaleString(undefined, { maximumFractionDigits: 0 })} /yr list${result.hasPendingPrices ? " · ⚠️ partial — some parts still pending CPQ" : " · confirmed prices"}</div>`
    : `<div class="result-price">~$${result.ballparkMRR.toLocaleString()}<span>/mo est.</span></div>
       <div class="result-price-note">~$${result.ballparkAnnual.toLocaleString()} /yr estimated &nbsp;·&nbsp; confirm final pricing in CPQ</div>`
  }
</div>

<ul class="result-flags">${flags}</ul>

<div class="result-section-label mt-4">📥 CPQ INPUT SUMMARY</div>
<table style="margin-bottom:8px;">${cpqSummaryRows}</table>

<div class="result-next">
  ✅ <strong>Part numbers ready for CPQ</strong><br/>
  📋 Use the CPQ Input Summary above to enter values into IBM Software CPQ<br/>
  ⚠️ All prices are LIST — apply discount in CPQ before sharing with customer
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


// ─── INLINE Q&A HELPERS ──────────────────────────────────────────────────────
// Detects free-text questions typed during the quoting flow and answers them
// without disrupting the current step. Static answers come first; if nothing
// matches, the caller falls through to normal answer storage.

function isLikelyQuestion(msg: string): boolean {
  const m = msg.toLowerCase().trim();
  // Must contain a question indicator AND not be a single-word option value
  return (
    m.includes("?") ||
    /^(what|how|why|when|which|who|does|do|is|are|can|should|where|explain|tell me|help|difference|count|why does|means?)\b/.test(m)
  ) && msg.length > 8;
}

function staticInlineAnswer(product: string, msg: string): string | null {
  // ── VAULT ──────────────────────────────────────────────────────────────────
  if (product === "Vault") {
    if (/what.*(count|is).*(client|rvu)|client.*count|count.*client|what.*client/i.test(msg)) {
      return `**What counts as a Vault client?**

A client = any unique app, service, or user that **authenticates** to Vault during the billing year.

- **1 client = 1 unique identity that logs in** — not an instance count
- 10 containers running the same app with the same AppRole → **1 client** (they share one role ID)
- MicroserviceA and MicroserviceB with different AppRole IDs → **2 clients**
- CI/CD pipelines, monitoring agents, and users all count

**Common pitfall:** Kubernetes clusters. Each pod can authenticate separately unless they share an AppRole role ID. Confirm how the customer configures Kubernetes auth — alias_name_source defaults to the service account UID, which means each unique service account = 1 client.

Does this help clarify the number you should enter?`;
    }

    if (/kubernetes|k8s|pod|container/i.test(msg)) {
      return `**Vault + Kubernetes client counting**

Kubernetes auth in Vault uses **service account UID** as the alias by default, meaning:
- Each unique Kubernetes service account = 1 client
- Multiple pods sharing the **same** service account = 1 client
- If a customer has 50 microservices each with their own service account → 50 clients

**This is the reason IBM is moving to Vault 2.0** (consumption/secret-based pricing) — K8s environments can have hundreds of service accounts, making per-client pricing uneconomical.

For current quoting (Model B), ask: "How many distinct Kubernetes service accounts authenticate to Vault?" — that's your client count, not the pod count.`;
    }

    if (/model a|model b|which model|platform.*ru|clients.*rvu|difference.*model/i.test(msg)) {
      return `**Model A vs Model B — which to use?**

| | Model A (Platform/RU) | Model B (Clients/RVU) |
|---|---|---|
| **Best for** | New/expanding, cloud-native, variable workloads | Stable renewals, known app count |
| **Priced on** | What Vault *does* (secrets, certs, keys, API calls) | Who *connects* (unique apps/services/users) |
| **Predictability** | Variable (scales with usage) | Predictable (flat per client) |

**Decision question:** *"Do you know how many apps/services will connect to Vault, and is that number stable?"*
- Yes, stable number → Model B
- No, or growing fast → Model A

⚠️ Cannot be changed without a new contract — get this right upfront.`;
    }

    if (/namespace|duplication|child namespace/i.test(msg)) {
      return `**Namespaces and client counting**

- A client authenticated in a **parent** namespace and accessing a **child** namespace = **1 client**
- A client authenticated in a **child** namespace accessing the parent, or across different namespaces = **counted separately** (can inflate count)
- Migrating mounts **across** namespaces creates duplication in client count; migrating **within** a namespace does not

Practical advice: if the customer uses namespaces heavily (multi-team setups), ask how clients are authenticated — parent or child namespace? This affects the count.`;
    }

    if (/pki|certif|lifetime|cert/i.test(msg)) {
      return `**PKI certificate RU calculation (Model A)**

Formula: \`CEIL(certs_per_month × (lifetime_hours ÷ 730))\`

730 hours = 1 month. Examples:
- 100 certs/month with 90-day (2,160h) lifetime → \`CEIL(100 × 2160/730)\` = **296 RU/month**
- 100 certs/month with 1-day (24h) lifetime → \`CEIL(100 × 24/730)\` = **4 RU/month**
- 1,000 certs/month with 30-day (720h) lifetime → \`CEIL(1000 × 720/730)\` = **986 RU/month**

**Key insight:** short-lived certs (mTLS, service mesh) have very low RU impact. Long-lived certs (1+ year) have disproportionately high RU impact.

For PKI Add-On (Model B), Vault v1.21+ is required — check the customer's Vault version before quoting.`;
    }

    if (/kmip|key.?manage|adp/i.test(msg)) {
      return `**KMIP / ADP Key Management**

Kris Ditmore confirmed: "In my five, six years of selling Vault, I sold KMIP three or four times" — this is rare.

- **Model A:** KMIP is included in the D155LZX install ($360K/cluster, replaces standard $96K install)
- **Model B:** Separate add-on D1013ZX ($249,600/cluster needing KMIP)

Only needed for legacy apps that use the KMIP protocol for external key management (e.g., database transparent data encryption, storage encryption). Ask: *"Do any databases or storage systems use KMIP-based encryption?"*`;
    }

    if (/dr|disaster|recovery|replication|premium|ha|high.?avail/i.test(msg)) {
      return `**HA vs DR for Vault**

- **HA (High Availability):** 3–5 nodes in one cluster. Counts as **1 Install**. Included in all editions. Ask: *"What are your uptime requirements?"*
- **DR (Disaster Recovery):** Multiple clusters (primary + DR). Requires **Premium edition + ≥2 installs**. Ask: *"Do you need to survive a full datacenter failure?"*
- **Performance Replication:** Premium only. Read-heavy workloads across regions.

**Under Model A (RU):** Production installs automatically include DR secondary clusters (inactive standby). Non-production installs do NOT include free DR — purchase additional non-production installs if needed.

Common mistake: quoting Premium without buying ≥2 installs — the edition is useless without a DR target cluster.`;
    }

    if (/what.*vault.?2|vault.?2.*what|vault 2\.0/i.test(msg)) {
      return `**What is Vault 2.0?**

Vault 2.0 is the **April 2026 release** of Vault Enterprise — it would have been Vault 1.22, but IBM aligned to its software versioning policy.

Key facts:
- Supports **both** Model B (Clients/RVU) and Model A (Resource Units/RU) pricing
- Existing customers can upgrade to 2.0 and **keep their Client-based entitlements** — no forced migration
- Moving to RU requires: (1) upgrade to Vault 2.0, (2) a **contracting event** (change of pricing metrics)
- Mid-term switch to RU model is possible via a **supersede**, provided customer meets requirements

For quoting: Model A = RU model, Model B = Client model. Both have working part numbers in this tool.`;
    }

    if (/census|license.*report|utilization.*report|automated.*report/i.test(msg)) {
      return `**Census / License Utilization Reporting**

Census is Vault's **automated monthly reporting** feature — it sends license utilization data to IBM.

- **Required for Model A (RU)** — there is no exception process
- Must be enabled before or at the time of contracting
- Reports data to IBM no less frequently than monthly
- Customers have access to current-month and previous-month data via the Vault API
- Sigma reporting is available to Sales for tracking

**If a customer refuses to enable Census, they cannot use the RU model.** Stay on Model B (Clients).`;
    }

    if (/mix.*model|model.*mix|same.*contract.*model|combine.*model|both.*model/i.test(msg)) {
      return `**Can Model A and Model B be used together?**

**No.** The Client-based model (B) and the Resource Unit model (A) **cannot be mixed** within the same contract, installation, or region.

A customer must choose one model per contract. If they want to switch:
- Allowed mid-term via a **supersede** (not a new contract)
- Customer must meet requirements: Vault 2.0 upgrade + willingness to enable Census
- Once on RU, the Client entitlements are replaced — they cannot run both simultaneously`;
    }

    if (/non.?prod|non.?production|dev.*env|test.*env|staging/i.test(msg)) {
      return `**Non-production environments under Model A (RU)**

- Both production **and** non-production usage is charged using RUs
- Non-production is billed, but **deduplication of secrets** across primary clusters may reduce the total RU count (especially for larger orgs)
- Production installs automatically include **DR secondary clusters** (inactive standby — not for testing)
- Non-production installs do NOT include free DR — purchase additional non-production installs to serve as DR secondaries
- DR is defined as an **inactive standby** cluster; it is not intended for pre-deployment testing`;
    }

    if (/overage|exceed.*entitle|bill.*model|how.*billed|discount.*ru|ru.*discount/i.test(msg)) {
      return `**How RUs are discounted and billed**

- Discounting is at the **RU level** — cannot be changed by use case or install type
- RUs can be discounted under Sales authority; the discount applies **across all RUs**
- Usage = total sum of RUs, with a **monthly maximum entitlement**
- **No overage charges** — if a customer exceeds entitlement, adjust on a go-forward basis:
  - **FSL** (permanent re-baselining) for a lasting increase
  - **Monthly License** for future monthly peaks
- Sales remains responsible for reviewing customer compliance with license terms`;
    }

    if (/greenfield|new.*customer|brand.*new|start.*fresh|no.*existing.*vault/i.test(msg)) {
      return `**Greenfield Vault sizing guidance**

Start small — limits sizing effort and reduces risk of an entitlement being wildly off.

1. **Identify 1–2 initial pain points** where the customer wants the fastest ROI
2. **Identify the relevant metrics** for those use cases
3. **Ask customer-friendly questions:**
   - *"How many secrets do you have under management?"*
   - *"How many secrets would you like rotated automatically?"*
   - *"Do you issue certificates? How many per month, and how long do they live?"*

Once live with Census, you can right-size at renewal based on actual usage data from the Vault API or Sigma reports.`;
    }

    if (/supersede|mid.?term|switch.*mid|change.*contract/i.test(msg)) {
      return `**Mid-term model switch (supersede)**

A customer can switch from Client model (B) to RU model (A) **mid-term** via a supersede — they do not have to wait for contract end.

Requirements:
1. Customer must be on **Vault 2.0** (April 2026 release or later)
2. Customer must be willing to **enable Census** (automated monthly license reporting)
3. A contracting event is required — this is a change in pricing metrics

The supersede replaces the existing Client entitlements with RU entitlements. The two models cannot run simultaneously.`;
    }
  }

  // ── VERIFY ─────────────────────────────────────────────────────────────────
  if (product === "Verify") {
    if (/mau|monthly active|active user|how.*count.*user/i.test(msg)) {
      return `**How MAU is calculated for Verify**

Formula: \`MAU = ROUNDUP(population × MIN(avg_logins_per_year, 12) ÷ 12)\`

- A user active **once** or **100 times** in a month counts the same — it's binary (active or not)
- avg_logins is **months/year they log in at least once** (1–12), not total login events

Examples:
- 10,000 employees who log in every month → MAU = 10,000
- 50,000 seasonal customers active 6 months/year → MAU = CEIL(50,000 × 6/12) = 25,000
- 100,000 users active 3 months/year → MAU = CEIL(100,000 × 3/12) = 25,000

**Don't use raw headcount as MAU** — ask *"In a typical year, which months does a user actually log in?"*`;
    }

    if (/lifecycle|managed.?user|provision|deprovision/i.test(msg)) {
      return `**Lifecycle Management sizing**

- Lifecycle uses **Managed Users** (not MAU) — the accounts Verify actively provisions/deprovisions
- Managed Users ≤ total population, often much smaller (e.g. only HR-managed employees)
- A company with 50,000 total users might only have 5,000 managed by Verify for joiner-mover-leaver flows

Ask: *"Which users does Verify need to create and remove as they join or leave the company?"* That number is your Managed Users count.`;
    }

    if (/adaptive|risk.?based|context/i.test(msg)) {
      return `**Adaptive Access**

Adaptive Access adds risk-based, contextual authentication on top of MFA:
- Uses device posture, location, behaviour, and network signals to assess risk
- Can step-up to stronger auth (biometric, FIDO2) when risk is elevated
- Sized by MAU, same as SSO/MFA

Sell it when the customer says: *"We want to reduce MFA friction for trusted devices"* or *"We need to block suspicious logins automatically."* Usually bundled with MFA, not sold standalone.`;
    }

    if (/gateway|legacy|app.?gateway|saml|oidc/i.test(msg)) {
      return `**Hosted Application Gateway (D01UQZX)**

Required when a legacy app can't support modern auth protocols (SAML, OIDC).
- Acts as a reverse proxy that injects SSO into legacy apps
- $22,500/instance/month — this is a significant add-on, ask carefully
- Ask: *"Do any of the apps use header-based authentication, or are they too old to support SAML/OIDC?"*

Each gateway instance handles a set of legacy apps. One instance typically covers one environment (prod, or a cluster of legacy apps).`;
    }

    if (/sms|email.*mfa|d02t6|per.?event/i.test(msg)) {
      return `**SMS & Email MFA (D02T6ZX)**

This is a **per-event** part at $33.70 per 1,000 events — priced differently from the RU model.
- Only add this when SMS or email OTP is the specific auth method needed
- TOTP apps (Authenticator), push notifications, FIDO2 are covered by the standard RU
- Ask: *"Do they specifically need SMS or email OTP, or will an authenticator app work?"*
- If adding, estimate events = MAU × average MFA challenges per month`;
    }
  }

  // ── NS1 ────────────────────────────────────────────────────────────────────
  if (product === "NS1") {
    if (/tier|standard.*premium|premium.*standard|which.*tier|what.*tier/i.test(msg)) {
      return `**NS1 Connect tier selection**

| Tier | ARR range | Use when |
|---|---|---|
| **Standard** | $4K–$40K | <1B queries/month, <10K records, straightforward DNS |
| **Premium** | $45K–$200K | >1B queries or needs custom GSLB, a la carte |
| **Hybrid Enterprise** | $250K–$1M+ | >10B queries, whale-scale, bundled pricing |

⚠️ **Never mix Standard (D10A*) and Premium (D0GN*) parts on the same quote.**

Estimate ARR first, then pick the tier — it determines which parts you enter in CPQ.`;
    }

    if (/gslb|traffic.?steer|rum|filter.?chain|pulsar/i.test(msg)) {
      return `**GSLB / Traffic Steering types**

- **Standard filter chains (D0GNKZX):** 1 Resource Unit = 1 filter chain. Simple routing rules — geographic, round-robin, weighted. No RUM data needed.
- **RUM Standard (D0GNQZX/D0GZ0ZX):** Uses NS1's own real-user measurement data. 1 Interaction = 1M queries. Min 1M queries. Good for CDN selection.
- **RUM Advanced (D0GNNZX/D0GYYZX):** Uses the **customer's** RUM data. Min 5M queries, must be multiple of 5. For customers with their own performance data.

RUM queries must always be a **subset** of the total Managed DNS query count. You can't buy more RUM queries than DNS queries.`;
    }

    if (/record.*count|dns.*record|zone|how.*count.*record/i.test(msg)) {
      return `**Counting DNS records correctly**

Common mistake: counting **zones** instead of **resource records**.

- A zone (e.g. example.com) might contain 500 individual A, CNAME, MX, TXT records
- You need to count the individual records, not the zones
- Ask the customer to export from their current provider: Route53 console → Hosted Zones → export, or use dig/dnsdump tools

1 IBM Record = 1,000 DNS records. If they have 25,000 records, that's 25 IBM Records.

For Hybrid bundle selection: <200K records → Enterprise (D0GYUZX); 200K–2M records → Enterprise Plus (D0GYWZX).`;
    }

    if (/china|chinese.*dns|dns.*china/i.test(msg)) {
      return `**DNS for China (D0GN8ZX)**

- Minimum 50M queries/month from China-origin traffic
- Requires Managed DNS to already be on the quote
- **CPQ gotcha:** You must check the China DNS box in CPQ **before** entering the Managed DNS section — if you do it after, you'll need to start over
- Ask: *"Do they have users or infrastructure in mainland China?"*`;
    }

    if (/cpq|order|sequence|mistake|gotcha/i.test(msg)) {
      return `**NS1 CPQ ordering rules (Premium)**

Critical sequence — do these **before** entering Managed DNS:
1. ✅ Check China DNS box (if needed)
2. ✅ Check DNS Insights box (if needed)
3. ✅ Then enter Managed DNS section

Required parts on every Premium order:
- D0GNDZX — SLA (always required)
- D0GNGZX — Records (always required)
- D0GNEZX — Requests/queries (always required)

DDoS Overage Protection (D0GN5ZX), NXD Waiver (D0GNMZX), and DNS Insights (D0GN6ZX) quantities must **equal D0GNEZX**.`;
    }
  }

  return null; // no static match — caller will fall through
}

// ─── WELCOME ─────────────────────────────────────────────────────────────────

export const WELCOME_REPLY =
  "Which product would you like to quote?\n\n1. **IBM Security Verify**\n2. **NS1 Connect**\n3. **IBM HashiCorp Vault**\n\nPick one below or type the name.";

export function getInitialActiveQuestion(): ActiveQuestion | null {
  return null; // product selection is handled by quick-pick buttons in the UI
}
