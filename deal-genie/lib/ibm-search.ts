/**
 * IBM Search AI — native REST client for Next.js / Node.js
 *
 * Calls the IBM.com unified search API directly using the exact URL and query
 * parameters extracted from the ibm_search_ai Python package source:
 *   github.ibm.com/digital-marketplace/search-ai (ibm_search_ai.py, line 26)
 *
 * Auth: x-search-query-token header (IBM_SEARCH_API_KEY).
 * No Python, no sidecar, no extra dependencies.
 *
 * Fallback: every function returns null on any error — callers fall back to
 * static data in lib/data.ts. Quote generation is never blocked.
 *
 * Useful scopes for DealGenie (from SEARCH_SCOPE_TABLE in ibm_search_ai.py):
 *   ibmdocs      — IBM product documentation (most reliable for product content)
 *   salesmanuals — IBM Documentation: Sales manuals  ← best for pricing/seller guides
 *   support      — IBM Support articles
 *   all          — Broad IBM.com search
 */

// ─── Endpoints (from ibm_search_ai.py lines 26-29) ───────────────────────────

const BASE    = "https://www-api.ibm.com/search/api/v1/ibmcom/appid/searchai";
const SEARCH  = `${BASE}/responseFormat/json`;       // GET — keyword search
const AGG     = `${BASE}/agg`;                       // GET — aggregated search (all/support scopes)

// ─── Scope config table (subset relevant to DealGenie) ───────────────────────
// Derived from IBMSearchScopes.SEARCH_SCOPE_TABLE in ibm_search_ai.py

const DEFAULT_RMDT =
  "title,description,body,url,latest_version,dcc,keywords,slc,dcdate,semver_tags,altver_tags,mtm_tags,build_epoch";

const SCOPE_TABLE: Record<string, {
  endpoint: string;
  scope: string | null;
  rmdt: string;
  refinement: string;
  variant?: string;
  aggregate?: string;
  fieldMatchType?: string;
}> = {
  ibmdocs: {
    endpoint: SEARCH,
    scope: "ibmdocs",
    rmdt: DEFAULT_RMDT,
    refinement: "ibmcom",
    fieldMatchType: "docs_match",
  },
  salesmanuals: {
    endpoint: SEARCH,
    scope: "salesmanuals",
    rmdt: DEFAULT_RMDT,
    refinement: "ibmcom",
    variant: "pvboost:3",
  },
  support: {
    endpoint: AGG,
    scope: "*",          // * = remove from params
    rmdt: "entitled,effectivedate,title,description,body,url,latest_version,dcc,tsdoctypedrill,tscategory,ibm_tssoftware_version_original,topics,keywords,slc,dcdate,semver_tags,altver_tags,mtm_tags,build_epoch",
    refinement: "support",
    variant: "pvboost:1",
    aggregate: '["genesis|0|20","sm|0|20","docs|5|3","docsnews|8|1"]',
  },
  all: {
    endpoint: AGG,
    scope: null,         // omit scope param entirely
    rmdt: "entitled,effectivedate,title,description,body,url,latest_version,dcc,tsdoctypedrill,ibm_tssoftware_version_original,topics,keywords,slc,dcdate,semver_tags,altver_tags,mtm_tags,build_epoch",
    refinement: "ibmcom",
    variant: "pvboost:3",
    aggregate: '["genesis|0|20","sm|0|20","docs|5|3","docsnews|8|1"]',
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  title: string;
  url: string;
  body: string;
  description: string;
  score: number;
}

// ─── Per-product queries ──────────────────────────────────────────────────────

export const PRODUCT_QUERIES: Record<string, { query: string; scope: string }> = {
  // ibmdocs = IBM product documentation — returns actual ibm.com/docs content for each product
  NS1:    { query: "NS1 Connect DNS query pricing configuration",        scope: "ibmdocs" },
  Verify: { query: "IBM Security Verify identity access management SSO", scope: "ibmdocs" },
  Vault:  { query: "IBM HashiCorp Vault secrets management deployment",  scope: "ibmdocs" },
};

// ─── Core search ─────────────────────────────────────────────────────────────

/**
 * Fire a GET request to IBM Search exactly as the Python package does.
 * Returns null on any error (network, auth, unexpected shape).
 */
export async function ibmSearch(
  query: string,
  scope = "salesmanuals",
  numResults = 5
): Promise<SearchResult[] | null> {
  const apiKey = process.env.IBM_SEARCH_API_KEY;
  if (!apiKey) {
    console.warn("[ibm-search] IBM_SEARCH_API_KEY not set");
    return null;
  }

  const cfg = SCOPE_TABLE[scope] ?? SCOPE_TABLE["all"];

  // Build filter: language + latest_version (from ibm_search_ai.py line 1668)
  let filter = "((language:en OR language:zz) AND NOT latest_version:false)";
  if (scope === "ibmdocs") {
    filter += " AND ibmdocstype:public AND (ibmdocsproducttype:product OR ibmdocsproducttype:solution)";
  }

  const params = new URLSearchParams({
    query,
    rc: scope === "ibmdocs" ? "zz" : "us",
    filter,
    languageSelector: "en-us",
    rmdt: cfg.rmdt,
    dict: "spelling",
    ql: "en",
    nr: String(numResults),
    sm: "true",
    page: "1",
    explain: "true",
  });

  // scope: omit if null or "*"
  if (cfg.scope && cfg.scope !== "*") params.set("scope", cfg.scope);
  if (cfg.variant)      params.set("variant", cfg.variant);
  if (cfg.aggregate)    params.set("aggregate", cfg.aggregate);
  if (cfg.fieldMatchType) params.set("fieldMatchType", cfg.fieldMatchType);
  // refinement is always set from the table (package ignores caller-supplied value)
  params.set("refinement", cfg.refinement);

  const url = `${cfg.endpoint}/?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-search-query-token": apiKey },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[ibm-search] ${res.status} from IBM Search: ${text.slice(0, 300)}`);
      return null;
    }

    const json = await res.json();
    const list: unknown[] = json?.resultset?.searchresults?.searchresultlist ?? [];
    if (!Array.isArray(list)) return null;

    return list.slice(0, numResults).map((d: unknown) => {
      const doc = d as Record<string, unknown>;
      // body lives inside docattributes[].body
      const attrs = (doc.docattributes ?? []) as Array<Record<string, unknown>>;
      const bodyAttr = attrs.find((a) => "body" in a);
      const body = typeof bodyAttr?.body === "string" ? bodyAttr.body : "";

      return {
        title:       typeof doc.title === "string" ? doc.title : "",
        url:         typeof doc.url   === "string" ? doc.url   : "",
        body:        body.slice(0, 1500),
        description: typeof doc.description === "string" ? doc.description : "",
        score:       typeof doc.score       === "number" ? doc.score       : -1,
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ibm-search] fetch failed: ${msg}`);
    return null;
  }
}

// ─── Product-level helper ─────────────────────────────────────────────────────

export async function fetchProductContext(
  product: "NS1" | "Verify" | "Vault"
): Promise<SearchResult[] | null> {
  const cfg = PRODUCT_QUERIES[product];
  if (!cfg) return null;
  const results = await ibmSearch(cfg.query, cfg.scope, 5);
  return results && results.length > 0 ? results : null;
}

/**
 * Build a concise snippet from search results for injection into a system prompt.
 */
export function buildContextSnippet(results: SearchResult[], maxChars = 1500): string {
  const snippets = results
    .filter((r) => (r.body || r.description).length > 20)
    .slice(0, 4)
    .map((r) => {
      const title   = r.title ? `[${r.title}]` : "";
      const content = (r.body || r.description).slice(0, 400).replace(/\s+/g, " ").trim();
      return `${title} ${content}`.trim();
    })
    .join("\n\n");

  return snippets.length > maxChars ? snippets.slice(0, maxChars) + "…" : snippets;
}

// ─── Config check ─────────────────────────────────────────────────────────────

export interface SearchConfig {
  hasApiKey: boolean;
  endpoint: string;
  ready: boolean;
}

export function getSearchConfig(): SearchConfig {
  return {
    hasApiKey: !!process.env.IBM_SEARCH_API_KEY,
    endpoint:  SEARCH,
    ready:     !!process.env.IBM_SEARCH_API_KEY,
  };
}
