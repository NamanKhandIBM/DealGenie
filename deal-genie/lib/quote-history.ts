/**
 * Quote history — types + Cloudant REST client.
 *
 * Uses IBM Cloudant's HTTP API directly (no SDK needed).
 * Auth: IBM Cloud IAM bearer token (same flow as watsonx.ts).
 *
 * Cloudant REST docs: https://cloud.ibm.com/apidocs/cloudant
 */

import type { Product } from "./types";
import type { Message } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuoteSummary {
  totalAnnual?: number;
  totalMonthly?: number;
  keyMetrics: string[];   // e.g. ["2,000 MAU", "SSO + MFA", "3yr term"]
  listPrice?: number;
  estNet?: number;
}

export interface SavedQuote {
  _id?: string;           // Cloudant document id (set by server on save)
  _rev?: string;          // Cloudant revision (needed for delete)
  id: string;             // client-generated uuid — stable identifier
  savedAt: number;        // Date.now()
  label: string;          // auto: "Verify · 2,000 MAU · $38,500/yr"
  product: Product;
  answers: Record<string, string | number | boolean | string[]>;
  summary: QuoteSummary;
  chatSnapshot: Message[];
  savedBy?: string;       // future: IBMid of the seller
}

// ─── Cloudant helpers ─────────────────────────────────────────────────────────

const DB_NAME = "dealgenie-quotes";
const IAM_TOKEN_URL = "https://iam.cloud.ibm.com/identity/token";

// Simple IAM token cache (same pattern as watsonx.ts)
interface TokenCache { token: string; expiresAt: number }
let _tokenCache: TokenCache | null = null;

async function getIAMToken(): Promise<string> {
  const now = Date.now();
  if (_tokenCache && now < _tokenCache.expiresAt) return _tokenCache.token;

  const apiKey = process.env.CLOUDANT_API_KEY;
  if (!apiKey) throw new Error("CLOUDANT_API_KEY is not set");

  const res = await fetch(IAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ibm:params:oauth:grant-type:apikey",
      apikey: apiKey,
    }),
  });
  if (!res.ok) throw new Error(`IAM token fetch failed (${res.status}): ${await res.text()}`);

  const json = await res.json();
  const ttlMs = (json.expires_in ?? 3600) * 1000;
  _tokenCache = { token: json.access_token, expiresAt: now + ttlMs * 0.8 };
  return _tokenCache.token;
}

function cloudantBase(): string {
  const url = process.env.CLOUDANT_URL;
  if (!url) throw new Error("CLOUDANT_URL is not set");
  return url.replace(/\/$/, "");
}

async function cloudantFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getIAMToken();
  const url = `${cloudantBase()}/${DB_NAME}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

// ─── Ensure DB exists (idempotent) ───────────────────────────────────────────

export async function ensureDatabase(): Promise<void> {
  const token = await getIAMToken();
  const url = `${cloudantBase()}/${DB_NAME}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  // 201 = created, 412 = already exists — both are fine
  if (res.status !== 201 && res.status !== 412) {
    const body = await res.text();
    throw new Error(`Failed to create Cloudant DB (${res.status}): ${body}`);
  }
}

// ─── Save a quote ─────────────────────────────────────────────────────────────

export async function saveQuote(quote: SavedQuote): Promise<SavedQuote> {
  await ensureDatabase();
  // Use the client-side uuid as the Cloudant doc id for idempotency
  const doc = { ...quote, _id: quote.id };
  const res = await cloudantFetch(`/${quote.id}`, {
    method: "PUT",
    body: JSON.stringify(doc),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudant save failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  return { ...quote, _rev: json.rev };
}

// ─── List all quotes (newest first, max 50) ───────────────────────────────────

export async function listQuotes(): Promise<SavedQuote[]> {
  await ensureDatabase();
  // Use _all_docs with include_docs=true, sorted by savedAt client-side
  const res = await cloudantFetch(
    "/_all_docs?include_docs=true&limit=50"
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudant list failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const docs: SavedQuote[] = (json.rows ?? [])
    .map((r: { doc: SavedQuote }) => r.doc)
    .filter((d: SavedQuote) => d && d.id && d.product);
  // Sort newest first
  return docs.sort((a, b) => b.savedAt - a.savedAt);
}

// ─── Delete a quote ───────────────────────────────────────────────────────────

export async function deleteQuote(id: string, rev: string): Promise<void> {
  const res = await cloudantFetch(`/${id}?rev=${encodeURIComponent(rev)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudant delete failed (${res.status}): ${body}`);
  }
}

// ─── Auto-label generator ─────────────────────────────────────────────────────

export function buildQuoteLabel(
  product: Product,
  summary: QuoteSummary
): string {
  const metrics = summary.keyMetrics.slice(0, 2).join(" · ");
  const price = summary.totalAnnual
    ? ` · $${(summary.totalAnnual / 1000).toFixed(0)}K/yr`
    : "";
  return `${product}${metrics ? ` · ${metrics}` : ""}${price}`;
}

// ─── Extract summary from answers ─────────────────────────────────────────────

export function extractSummary(
  product: Product,
  answers: Record<string, string | number | boolean | string[]>,
  lastAssistantMessage?: string
): QuoteSummary {
  const keyMetrics: string[] = [];
  let totalAnnual: number | undefined;

  if (product === "Verify") {
    const pop = answers.verifyPopulation ?? answers.population;
    const caps = answers.verifyCaps ?? answers.capabilities;
    const term = answers.verifyTerm ?? answers.term;
    if (pop) keyMetrics.push(`${Number(pop).toLocaleString()} users`);
    if (Array.isArray(caps) && caps.length) keyMetrics.push(caps.join("+"));
    else if (typeof caps === "string") keyMetrics.push(caps);
    if (term) keyMetrics.push(String(term));
  } else if (product === "NS1") {
    const zones = answers.ns1Zones ?? answers.zones;
    const queries = answers.ns1Queries ?? answers.queries;
    if (zones) keyMetrics.push(`${zones} zones`);
    if (queries) keyMetrics.push(`${Number(queries).toLocaleString()} q/mo`);
  } else if (product === "Vault") {
    const model = answers.vaultModel ?? answers.model;
    const rus = answers.vaultRUs ?? answers.rus;
    if (model) keyMetrics.push(String(model));
    if (rus) keyMetrics.push(`${Number(rus).toLocaleString()} RU/mo`);
  }

  // Try to parse total from last assistant message (looks for $X,XXX or $X.XM)
  if (lastAssistantMessage) {
    const match = lastAssistantMessage.match(/\$[\d,]+(?:\.\d+)?(?:\s*[KkMm])?(?:\s*\/\s*(?:yr|year|annual))/i);
    if (match) {
      const raw = match[0].replace(/[^0-9.KkMm]/g, "");
      const mult = /[Kk]/.test(raw) ? 1000 : /[Mm]/.test(raw) ? 1_000_000 : 1;
      totalAnnual = parseFloat(raw.replace(/[KkMm]/g, "")) * mult;
    }
  }

  return { keyMetrics, totalAnnual };
}
