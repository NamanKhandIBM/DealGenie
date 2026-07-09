/**
 * GET /api/search-health
 *
 * Fires a live IBM Search query and returns the result.
 * Use this to verify the IBM_SEARCH_API_KEY is working.
 *
 * Visit: http://localhost:3000/api/search-health
 */
import { NextResponse } from "next/server";
import { getSearchConfig, ibmSearch } from "@/lib/ibm-search";

export async function GET() {
  const config = getSearchConfig();

  if (!config.ready) {
    return NextResponse.json({
      status: "misconfigured",
      config,
      message: "IBM_SEARCH_API_KEY not set in .env.local",
    });
  }

  const results = await ibmSearch("NS1 Connect DNS pricing configuration", "ibmdocs", 3);

  if (!results) {
    return NextResponse.json({
      status: "error",
      config,
      message: "IBM Search returned null — check server logs. Token may still be activating (allow 30 min after issue).",
    });
  }

  return NextResponse.json({
    status: results.length > 0 ? "ok" : "no_results",
    config,
    resultCount: results.length,
    preview: results[0] ? {
      title:       results[0].title,
      url:         results[0].url,
      description: results[0].description,
      bodyPreview: results[0].body.slice(0, 300),
    } : null,
  });
}
