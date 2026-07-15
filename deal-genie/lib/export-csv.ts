// Exports part numbers as a downloadable CSV file.
// Called client-side only — uses browser's Blob + anchor download trick.

import type { Product } from "./types";
import { VERIFY_ALL_PARTS } from "./verify-parts";
import { VAULT_ALL_PARTS } from "./vault-parts";
import { NS1_ALL_PARTS } from "./ns1-parts";
import { computeVerifyQuote } from "./verify-engine";
import type { VerifyCapability } from "./data";
import { computeVaultQuote } from "./vault-engine";
import type { VaultUseCaseInputs } from "./vault-engine";
import { computeNS1Quote } from "./ns1-engine";

function escapeCsv(value: string | number): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function triggerDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildRows(
  rows: Array<{
    partNumber: string;
    description: string;
    unit: string;
    category: string;
    notes?: string;
  }>
): string {
  const header = ["Part Number", "Description", "Unit", "Category", "Notes"].join(",");
  const lines = rows.map((r) =>
    [
      escapeCsv(r.partNumber),
      escapeCsv(r.description),
      escapeCsv(r.unit),
      escapeCsv(r.category),
      escapeCsv(r.notes ?? ""),
    ].join(",")
  );
  return [header, ...lines].join("\n");
}

/** Exports the full catalog of parts for a product (all possible part numbers). */
export function exportPartsCsv(product: Product): void {
  let csv: string;
  let filename: string;

  if (product === "Verify") {
    csv = buildRows(VERIFY_ALL_PARTS);
    filename = "IBM_Verify_Part_Numbers.csv";
  } else if (product === "Vault") {
    csv = buildRows(VAULT_ALL_PARTS);
    filename = "IBM_Vault_Part_Numbers.csv";
  } else {
    csv = buildRows(NS1_ALL_PARTS);
    filename = "IBM_NS1_Connect_Part_Numbers.csv";
  }

  triggerDownload(csv, filename);
}

function parseNum(s: string): number {
  return parseFloat(s.replace(/[^0-9.]/g, "")) || 0;
}

function parseYesNo(s: string): boolean {
  return s === "yes" || s === "true" || s === "1";
}

/**
 * Exports the specific quoted part numbers (with quantities) from a completed quote.
 * Re-runs the same engine logic used to render the result card.
 */
export function exportQuoteCsv(
  product: Product,
  answers: Record<string, string | number | boolean | string[]>
): void {
  const a = answers;

  if (product === "Verify") {
    const ADDON_MAP: Record<string, { description: string; listPrice: number; unit: string }> = {
      D02T6ZX: { description: "SMS and Email MFA Only",      listPrice: 33.70,       unit: "per event per thousand" },
      D01UQZX: { description: "Hosted Application Gateway",  listPrice: 22500 * 12,  unit: "per instance / year" },
      D01URZX: { description: "Vanity Domain",               listPrice: 562   * 12,  unit: "per instance / year" },
      D22PGLL: { description: "Non-Production with SLA",     listPrice: 2810  * 12,  unit: "per instance / year" },
      D21CWLL: { description: "Non-Production without SLA",  listPrice: 1410  * 12,  unit: "per instance / year" },
    };
    const caps = (a.capabilities as string[]) ?? ["SSO"];
    const population = parseNum(String(a.population ?? 500));
    const avgLogins = Math.max(1, Math.min(12, parseNum(String(a.avgLogins ?? 12))));
    const managedUsers = parseNum(String(a.managedUsers ?? 0));
    const regions = Math.max(1, parseNum(String(a.regions ?? "1")));
    const term = String(a.term ?? "12-month") as "12-month" | "3-year";
    const addOnParts = (a.addOns as string[]) ?? [];
    const nonProdPart = String(a.nonProd ?? "none");
    const allParts = [...addOnParts.filter((p) => p !== "none"), ...(nonProdPart !== "none" ? [nonProdPart] : [])];
    const addOns = allParts.filter((p) => ADDON_MAP[p]).map((p) => ({ part: p, quantity: 1, ...ADDON_MAP[p] }));

    const result = computeVerifyQuote({ capabilities: caps as VerifyCapability[], population, avgLoginsPerYear: avgLogins, managedUsers, regions, addOns, term });
    const header = ["Part Number", "Description", "Quantity", "Annual List ($)", "Rationale"].join(",");
    const lines = result.lines.map((l) =>
      [escapeCsv(l.part), escapeCsv(l.description), escapeCsv(l.quantity), escapeCsv(l.annualList.toFixed(0)), escapeCsv(l.rationale)].join(",")
    );
    triggerDownload([header, ...lines].join("\n"), "IBM_Verify_Quote.csv");

  } else if (product === "Vault") {
    const modelCode = String(a.vaultModel ?? "A");
    const installCount = parseNum(String(a.installCount ?? "1")) || 1;

    let result;
    if (modelCode === "A") {
      const useCases = (a.useCases as string[]) ?? [];
      const useCaseInputs: VaultUseCaseInputs = {};
      if (useCases.includes("static"))  useCaseInputs.staticSecretCount   = parseNum(String(a.staticSecretCount ?? "100")) || 100;
      if (useCases.includes("dynamic")) useCaseInputs.dynamicRoles         = parseNum(String(a.dynamicRoles ?? "10")) || 10;
      if (useCases.includes("pki"))   { useCaseInputs.pkiCertsPerMonth     = parseNum(String(a.pkiCertsPerMonth ?? "100")) || 100;
                                        useCaseInputs.pkiCertLifetimeHours = parseNum(String(a.pkiCertLifetime ?? "2160")) || 2160; }
      if (useCases.includes("ssh"))   { useCaseInputs.sshCredsPerMonth     = parseNum(String(a.sshCredsPerMonth ?? "100")) || 100;
                                        useCaseInputs.sshLifetimeHours     = parseNum(String(a.sshLifetime ?? "24")) || 24; }
      if (useCases.includes("transit")) useCaseInputs.transitCallsPerMonth = parseNum(String(a.transitCallsPerMonth ?? "150000")) || 150000;
      if (useCases.includes("kmse"))    useCaseInputs.kmseKeyCount         = parseNum(String(a.kmseKeyCount ?? "100")) || 100;
      result = computeVaultQuote({ model: "A-Platform", installCount, useCaseInputs, includeNonProd: parseYesNo(String(a.includeNonProd ?? "no")), includeKMIP: parseYesNo(String(a.includeKMIP ?? "no")) });
    } else {
      const editionMap: Record<string, "Essentials" | "Standard" | "Premium"> = { "1": "Essentials", "2": "Standard", "3": "Premium" };
      const edition = editionMap[String(a.edition ?? "2")] ?? "Standard";
      const clientCount = parseNum(String(a.clientCount ?? "1")) || 1;
      result = computeVaultQuote({ model: "B-Clients", edition, installCount, clientCount, includeNonProd: parseYesNo(String(a.includeNonProd ?? "no")), pkiCerts: parseNum(String(a.pkiAddon ?? "0")), adpKeyMgmt: parseNum(String(a.adpKeyMgmt ?? "0")), adpTransformClients: parseNum(String(a.adpTransform ?? "0")) || undefined });
    }

    const header = ["Part Number", "Description", "Quantity", "Annual List ($)", "Rationale"].join(",");
    const lines = result.lines.map((l) =>
      [escapeCsv(l.part), escapeCsv(l.description), escapeCsv(l.quantity), escapeCsv(l.annualList.toFixed(0)), escapeCsv(l.rationale)].join(",")
    );
    triggerDownload([header, ...lines].join("\n"), "IBM_Vault_Quote.csv");

  } else {
    // NS1
    const mq = parseNum(String(a.queryMQ ?? "0"));
    const records = parseNum(String(a.recordCount ?? "0"));
    const gslbRaw = String(a.gslb ?? "no");
    const filterChains = parseNum(String(a.filterChainCount ?? "0"));
    const monitorsRaw = parseNum(String(a.monitors ?? "0"));
    const dedicatedRaw = String(a.dedicated ?? "no");
    const dedicatedPoPs = dedicatedRaw !== "no" ? parseNum(dedicatedRaw) || undefined : undefined;
    const chinaRaw = String(a.china ?? "no");
    const chinaMQ = chinaRaw === "yes" ? Math.max(50, parseNum(String(a.chinaMQ ?? "50"))) : undefined;
    const growthMQ = parseNum(String(a.growthMQ ?? "0"));
    const growthPct = parseNum(String(a.growth ?? "0"));
    const ddosNxdRaw = String(a.ddos ?? "no");

    const result = computeNS1Quote({
      queryVolumeMQ: mq, recordCount: records, filterChains,
      rumBased: gslbRaw === "yes-rum" || gslbRaw === "yes-rum-advanced",
      rumAdvanced: gslbRaw === "yes-rum-advanced",
      monitors: monitorsRaw, dedicatedPoPs, chinaMQ,
      dnsInsights: String(a.insights ?? "no") === "yes",
      ddosProtection: ddosNxdRaw === "ddos" || ddosNxdRaw === "both" || ddosNxdRaw === "yes",
      nxdWaiver: ddosNxdRaw === "nxd" || ddosNxdRaw === "both",
      cloudSync: String(a.cloudSync ?? "no") === "yes",
      growthMQ, expectedGrowthPct: growthPct,
      term: String(a.term ?? "12-month") === "3-year" ? "3-year" : "12-month",
    });

    const stripSource = (s: string) =>
      s.replace(/\.\s*Source:[^.]+\./gi, ".").replace(/\s*Source:[^.]+\./gi, "").trim();
    const header = ["Part Number", "Description", "Quantity", "Unit", "List $/mo", "Extended $/mo", "Notes"].join(",");
    const lines = result.partNumbers.map((p) =>
      [escapeCsv(p.partNumber), escapeCsv(p.description), escapeCsv(p.quantity), escapeCsv(p.unit), escapeCsv(p.listPrice > 0 ? p.listPrice.toFixed(2) : "TBD"), escapeCsv(p.extendedPrice > 0 ? p.extendedPrice.toFixed(0) : "TBD"), escapeCsv(stripSource(p.notes))].join(",")
    );
    triggerDownload([header, ...lines].join("\n"), "IBM_NS1_Quote.csv");
  }
}
