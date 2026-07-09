/**
 * Live smoke test for IBM Search AI.
 *
 * Run from the repo root:
 *   IBM_SEARCH_API_KEY=1HcbUgqZQJt7wIFJGOku npx tsx deal-genie/scripts/test-ibm-search.ts
 */

const API_KEY = process.env.IBM_SEARCH_API_KEY;
if (!API_KEY) {
  console.error("❌ IBM_SEARCH_API_KEY not set. Run with: IBM_SEARCH_API_KEY=<key> npx tsx ...");
  process.exit(1);
}

const BASE   = "https://www-api.ibm.com/search/api/v1/ibmcom/appid/searchai";
const SEARCH = `${BASE}/responseFormat/json`;

const DEFAULT_RMDT = "title,description,body,url,latest_version,dcc,keywords,slc,dcdate,semver_tags,altver_tags,mtm_tags,build_epoch";

async function search(query: string, scope: string, numResults = 3) {
  const scopeTable: Record<string, { endpoint: string; scope: string | null; refinement: string; variant: string; fieldMatchType?: string }> = {
    salesmanuals: { endpoint: SEARCH,                scope: "salesmanuals", refinement: "ibmcom", variant: "pvboost:3" },
    ibmdocs:      { endpoint: SEARCH,                scope: "ibmdocs",      refinement: "ibmcom", variant: "pvboost:3", fieldMatchType: "docs_match" },
    support:      { endpoint: `${BASE}/agg`,         scope: "*",            refinement: "support", variant: "pvboost:1" },
    all:          { endpoint: `${BASE}/agg`,         scope: null,           refinement: "ibmcom", variant: "pvboost:3" },
  };
  const cfg = scopeTable[scope] ?? scopeTable["all"];
  const filter = scope === "ibmdocs"
    ? "((language:en OR language:zz) AND NOT latest_version:false) AND ibmdocstype:public AND (ibmdocsproducttype:product OR ibmdocsproducttype:solution)"
    : "((language:en OR language:zz) AND NOT latest_version:false)";

  const params = new URLSearchParams({
    query, filter,
    rc: scope === "ibmdocs" ? "zz" : "us",
    languageSelector: "en-us",
    rmdt: DEFAULT_RMDT,
    dict: "spelling", ql: "en",
    nr: String(numResults), sm: "true", page: "1", explain: "true",
    refinement: cfg.refinement,
    variant: cfg.variant,
  });
  if (cfg.scope && cfg.scope !== "*") params.set("scope", cfg.scope);
  if (cfg.fieldMatchType) params.set("fieldMatchType", cfg.fieldMatchType);

  const res = await fetch(`${cfg.endpoint}/?${params}`, {
    headers: { "x-search-query-token": API_KEY! },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const txt = await res.text();
    return { ok: false, status: res.status, body: txt.slice(0, 300) };
  }
  const json = await res.json();
  const list = json?.resultset?.searchresults?.searchresultlist ?? [];
  return { ok: true, results: list };
}

async function run() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("   IBM Search AI — Direct REST Smoke Test");
  console.log("═══════════════════════════════════════════════\n");

  const tests = [
    { label: "NS1 Connect pricing (salesmanuals scope)",           q: "NS1 Connect pricing CPQ part numbers",          scope: "salesmanuals" },
    { label: "IBM Security Verify pricing (salesmanuals scope)",   q: "IBM Security Verify pricing resource units RU", scope: "salesmanuals" },
    { label: "IBM HashiCorp Vault pricing (salesmanuals scope)",   q: "IBM HashiCorp Vault pricing CPQ part numbers",  scope: "salesmanuals" },
    { label: "NS1 documentation (ibmdocs scope)",                  q: "NS1 Connect DNS managed",                       scope: "ibmdocs"      },
  ];

  for (const t of tests) {
    console.log(`🔍 ${t.label}`);
    const r = await search(t.q, t.scope);
    if (!r.ok) {
      console.log(`   ❌ HTTP ${r.status}: ${r.body}\n`);
    } else if (!r.results?.length) {
      console.log(`   ⚠️  No results returned\n`);
    } else {
      console.log(`   ✅ ${r.results.length} result(s)`);
      const first = r.results[0];
      console.log(`   Title: ${first.title ?? "(none)"}`);
      console.log(`   URL  : ${first.url ?? "(none)"}`);
      const attrs = first.docattributes ?? [];
      const bodyAttr = attrs.find((a: Record<string, unknown>) => "body" in a);
      const body = typeof bodyAttr?.body === "string" ? bodyAttr.body.slice(0, 150) : "(no body)";
      console.log(`   Body : ${body}\n`);
    }
  }

  console.log("═══════════════════════════════════════════════");
  console.log("   Done. If all ✅, the integration is live.");
  console.log("═══════════════════════════════════════════════\n");
}

run().catch(console.error);
