import type { InvoiceRow } from "@/lib/invoices";

export const CSV_COLUMNS = [
  { key: "vendor", label: "Vendor" },
  { key: "invoice_number", label: "Invoice Number" },
  { key: "amount", label: "Amount" },
  { key: "currency", label: "Currency" },
  { key: "issue_date", label: "Issue Date" },
  { key: "due_date", label: "Due Date" },
  { key: "tax", label: "Tax" },
  { key: "source", label: "Source" },
  { key: "needs_review", label: "Needs Review" },
  { key: "confidence_score", label: "Confidence Score" },
  { key: "created_at", label: "Created At" },
] as const;

const BOM = "﻿";

/** RFC 4180 — wrap in double quotes and double any internal quotes when the
 *  value contains a comma, double quote, or newline. */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (
    s.includes(",") ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function invoicesToCsv(rows: InvoiceRow[]): string {
  const header = CSV_COLUMNS.map((c) => escapeCsvCell(c.label)).join(",");
  const dataLines = rows.map((row) =>
    CSV_COLUMNS.map((col) => {
      const value = row[col.key as keyof InvoiceRow];
      return escapeCsvCell(value);
    }).join(","),
  );
  return BOM + [header, ...dataLines].join("\n") + "\n";
}
