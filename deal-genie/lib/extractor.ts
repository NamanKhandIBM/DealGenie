/**
 * Entity extractor — uses watsonx.ai (Granite) to parse a seller's free-text
 * message into a structured object that the conversation engine can consume.
 *
 * IMPORTANT: The LLM is ONLY used for understanding natural language input.
 * It never computes RUs, outputs part numbers, or makes pricing decisions.
 * All of that stays in the deterministic engines (verify/vault/ns1-engine.ts).
 */

import { watsonxGenerate } from "./watsonx";
import type { Product } from "./types";

// ─── Extracted entity shape ───────────────────────────────────────────────────

export interface ExtractedEntities {
  /** Which product the seller is asking about, if detectable */
  product?: Product;

  // ── Verify fields ──
  /** Total user population */
  population?: number;
  /** Active months per year (1–12): number of distinct months the user logs in at least once */
  avgLogins?: number;
  /** Capabilities: any of SSO | MFA | AdaptiveAccess | LifecycleGov */
  capabilities?: string[];
  /** Number of managed users (for Lifecycle) */
  managedUsers?: number;
  /** Number of regions */
  regions?: number;

  // ── Vault fields ──
  /** "A" = new/expand (Platform RU), "B" = stable renewal (Clients) */
  vaultModel?: "A" | "B";
  /** Number of Vault clusters / installs */
  installCount?: number;
  /** Edition for Model B: Essentials | Standard | Premium */
  edition?: "Essentials" | "Standard" | "Premium";
  /** Number of clients (RVU) for Model B */
  clientCount?: number;
  /** Use cases for Model A: static | dynamic | pki | ssh | transit | kmse */
  useCases?: string[];

  // ── NS1 fields ──
  /** Monthly query volume in millions */
  queryMQ?: number;
  /** Total record count */
  recordCount?: number;
  /** Number of filter chains needed */
  filterChainCount?: number;
  /** Number of monitors needed */
  monitors?: number;

  // ── Shared ──
  /** Term: "12-month" or "3-year" */
  term?: "12-month" | "3-year";
  /** Whether a non-prod environment is needed */
  includeNonProd?: boolean;
}

// ─── System prompt (locked — never asks the LLM to produce part numbers) ──────

const SYSTEM_PROMPT = `You are a data-extraction assistant for IBM software quoting.
Your ONLY job is to extract structured fields from a seller's message.
You NEVER calculate prices, generate part numbers, or give recommendations.
You output ONLY a valid JSON object — no explanation, no markdown, no preamble.

Extract any of these fields that are clearly stated or strongly implied:

product: "Verify" | "NS1" | "Vault"  (IBM Security Verify = Verify, NS1 Connect = NS1, HashiCorp Vault = Vault)
population: number  (total user count, e.g. "500 users" → 500)
avgLogins: number  (active months per year, 1–12; how many distinct months per year a user logs in at least once — "every day / every week / every month" → 12, "most months" → 9, "half the year" → 6, "a few months" → 3, "once or twice a year" → 1)
capabilities: array of "SSO" | "MFA" | "Adaptive" | "Lifecycle"
managedUsers: number
vaultModel: "A" | "B"  (A = new customer / expanding, B = renewal / stable)
installCount: number  (Vault clusters or servers)
edition: "Essentials" | "Standard" | "Premium"
clientCount: number  (Vault unique apps/services/users)
useCases: array of "static" | "dynamic" | "pki" | "ssh" | "transit" | "kmse"
queryMQ: number  (NS1 monthly queries in millions — "150 million queries" → 150)
recordCount: number
filterChainCount: number
monitors: number
term: "12-month" | "3-year"
includeNonProd: true | false

Rules:
- Only include fields you are confident about from the message.
- If a field is not mentioned, omit it entirely (do not set it to null or 0).
- Never invent a part number or price.
- Output only the JSON object, nothing else.

Examples:
Input: "500 users, SSO and MFA, they log in about once a month"
Output: {"product":"Verify","population":500,"capabilities":["SSO","MFA"],"avgLogins":12}

Input: "500 users need adaptive access and lifecycle governance, they're active all year"
Output: {"product":"Verify","population":500,"capabilities":["Adaptive","Lifecycle"],"avgLogins":12}

Input: "new vault customer, 3 clusters, using PKI and static secrets, around 2000 certs a month with 90 day lifetime"
Output: {"product":"Vault","vaultModel":"A","installCount":3,"useCases":["pki","static"],"pkiCertsPerMonth":2000,"pkiCertLifetimeHours":2160}

Input: "ns1, about 200 million queries a month, 5000 records, need traffic steering on 20 records"
Output: {"product":"NS1","queryMQ":200,"recordCount":5000,"filterChainCount":20}`;

// ─── Main extractor function ──────────────────────────────────────────────────

/**
 * Calls watsonx.ai to extract structured entities from a free-text seller message.
 * Returns an empty object (not null) on any failure — the conversation engine
 * falls back gracefully to asking questions one by one.
 */
export async function extractEntities(userMessage: string): Promise<ExtractedEntities> {
  // Skip extraction for very short inputs (product name picks, "yes", "no", numbers)
  // — the conversation engine already handles these natively.
  if (userMessage.trim().split(/\s+/).length <= 3) {
    return {};
  }

  try {
    const { text } = await watsonxGenerate({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      maxNewTokens: 256,
    });

    // Strip any accidental markdown fences the model might add
    const cleaned = text.replace(/```[a-z]*\n?/gi, "").trim();

    // Find the JSON object in the output (robust against leading/trailing text)
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return sanitise(parsed);
  } catch {
    // Never crash the app — fall back to structured question flow
    return {};
  }
}

// ─── Sanitiser — ensures the parsed object only contains valid values ─────────

function sanitise(raw: Record<string, unknown>): ExtractedEntities {
  const out: ExtractedEntities = {};

  const VALID_PRODUCTS = new Set(["Verify", "NS1", "Vault"]);
  const VALID_CAPS = new Set(["SSO", "MFA", "Adaptive", "Lifecycle"]);
  const VALID_USE_CASES = new Set(["static", "dynamic", "pki", "ssh", "transit", "kmse"]);

  if (typeof raw.product === "string" && VALID_PRODUCTS.has(raw.product))
    out.product = raw.product as Product;

  if (typeof raw.population === "number" && raw.population > 0)
    out.population = raw.population;

  if (typeof raw.avgLogins === "number" && raw.avgLogins > 0)
    out.avgLogins = raw.avgLogins;

  if (Array.isArray(raw.capabilities))
    out.capabilities = (raw.capabilities as string[]).filter((c) => VALID_CAPS.has(c));

  if (typeof raw.managedUsers === "number" && raw.managedUsers > 0)
    out.managedUsers = raw.managedUsers;

  if (typeof raw.regions === "number" && raw.regions > 0)
    out.regions = raw.regions;

  if (raw.vaultModel === "A" || raw.vaultModel === "B")
    out.vaultModel = raw.vaultModel;

  if (typeof raw.installCount === "number" && raw.installCount > 0)
    out.installCount = raw.installCount;

  if (raw.edition === "Essentials" || raw.edition === "Standard" || raw.edition === "Premium")
    out.edition = raw.edition;

  if (typeof raw.clientCount === "number" && raw.clientCount > 0)
    out.clientCount = raw.clientCount;

  if (Array.isArray(raw.useCases))
    out.useCases = (raw.useCases as string[]).filter((u) => VALID_USE_CASES.has(u));

  if (typeof raw.queryMQ === "number" && raw.queryMQ > 0)
    out.queryMQ = raw.queryMQ;

  if (typeof raw.recordCount === "number" && raw.recordCount > 0)
    out.recordCount = raw.recordCount;

  if (typeof raw.filterChainCount === "number" && raw.filterChainCount > 0)
    out.filterChainCount = raw.filterChainCount;

  if (typeof raw.monitors === "number" && raw.monitors > 0)
    out.monitors = raw.monitors;

  if (raw.term === "12-month" || raw.term === "3-year")
    out.term = raw.term;

  if (typeof raw.includeNonProd === "boolean")
    out.includeNonProd = raw.includeNonProd;

  return out;
}
