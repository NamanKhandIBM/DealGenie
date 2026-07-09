// Exports part numbers for a given product as a downloadable CSV file.
// Called client-side only — uses browser's Blob + anchor download trick.

import type { Product } from "./types";
import { VERIFY_ALL_PARTS } from "./verify-parts";
import { VAULT_ALL_PARTS } from "./vault-parts";
import { NS1_ALL_PARTS } from "./ns1-parts";

function escapeCsv(value: string | number): string {
  const s = String(value ?? "");
  // Wrap in quotes if the value contains a comma, quote, or newline
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
