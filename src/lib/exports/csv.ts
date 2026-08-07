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

/** Characters that trigger formula interpretation in Excel / Google Sheets /
 *  LibreOffice Calc when they appear at the start of a cell. */
const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

/** RFC 4180 + OWASP formula-injection mitigation.
 *
 *  - If the value starts with `=`, `+`, `-`, `@`, tab, or CR, prefix with a
 *    single quote so spreadsheet apps treat it as literal text, not a formula.
 *  - If the value contains a comma, double quote, or newline, wrap in double
 *    quotes and double any internal quotes (RFC 4180). */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return "";
  const s = String(value);

  // Guard against formula injection (OWASP).  The single-quote prefix is
  // recognised by Excel / Sheets / Calc as "treat the rest as text".  We
  // apply it *before* quoting so the prefix is inside the quoted field.
  // Skip the formula-injection prefix when the value parses as a finite
  // number (e.g. "-42" or "+42.5") — those are safe and keeping them
  // numeric lets Excel sum the column correctly (OWASP recommendation).
  const safe =
    FORMULA_TRIGGER_RE.test(s) && !Number.isFinite(Number(s)) ? `'${s}` : s;

  if (
    safe.includes(",") ||
    safe.includes('"') ||
    safe.includes("\n") ||
    safe.includes("\r")
  ) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function invoicesToCsv(
  rows: InvoiceRow[],
  opts?: { truncated?: boolean },
): string {
  const header = CSV_COLUMNS.map((c) => escapeCsvCell(c.label)).join(",");
  const dataLines = rows.map((row) =>
    CSV_COLUMNS.map((col) => {
      const value = row[col.key as keyof InvoiceRow];
      return escapeCsvCell(value);
    }).join(","),
  );

  const parts = [header, ...dataLines];
  if (opts?.truncated) {
    const warning =
      "⚠️ Export limited to 5,000 most recent invoices. Older invoices may be missing.";
    parts.push(escapeCsvCell(warning));
  }

  return BOM + parts.join("\n") + "\n";
}
