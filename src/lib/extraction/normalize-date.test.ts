import { describe, expect, it } from "vitest";
import { normalizeExtractedDate, normalizeExtractionDates } from "./normalize-date";
import type { InvoiceExtraction } from "./schema";

describe("normalizeExtractedDate", () => {
  it("keeps valid ISO dates", () => {
    expect(normalizeExtractedDate("2026-10-26")).toBe("2026-10-26");
  });

  it("drops a time suffix", () => {
    expect(normalizeExtractedDate("2026-10-26T09:00:00Z")).toBe("2026-10-26");
  });

  it("pads single-digit ISO parts", () => {
    expect(normalizeExtractedDate("2026-7-5")).toBe("2026-07-05");
  });

  it("reads dd/mm/yyyy (the failing production value)", () => {
    expect(normalizeExtractedDate("26/10/2026")).toBe("2026-10-26");
  });

  it("reads dotted and dashed day-first dates", () => {
    expect(normalizeExtractedDate("26.10.2026")).toBe("2026-10-26");
    expect(normalizeExtractedDate("26-10-2026")).toBe("2026-10-26");
  });

  it("treats ambiguous dates as day-first", () => {
    expect(normalizeExtractedDate("05/10/2026")).toBe("2026-10-05");
  });

  it("falls back to month-first when day-first is impossible", () => {
    expect(normalizeExtractedDate("10/26/2026")).toBe("2026-10-26");
  });

  it("reads Vietnamese long dates", () => {
    expect(normalizeExtractedDate("Ngày 26 tháng 10 năm 2026")).toBe("2026-10-26");
    expect(normalizeExtractedDate("ngay 5 thang 1 nam 2026")).toBe("2026-01-05");
  });

  it("rejects impossible calendar dates", () => {
    expect(normalizeExtractedDate("2026-02-30")).toBeNull();
    expect(normalizeExtractedDate("31/02/2026")).toBeNull();
  });

  it("returns null for empty or unparseable input", () => {
    expect(normalizeExtractedDate(null)).toBeNull();
    expect(normalizeExtractedDate(undefined)).toBeNull();
    expect(normalizeExtractedDate("   ")).toBeNull();
    expect(normalizeExtractedDate("last Tuesday")).toBeNull();
  });
});

describe("normalizeExtractionDates", () => {
  it("normalizes both date fields and leaves the rest untouched", () => {
    const extraction: InvoiceExtraction = {
      is_invoice: true,
      vendor: "Điện Lực Cần Thơ",
      invoice_number: "123",
      amount: 500000,
      currency: "VND",
      issue_date: "26/10/2026",
      due_date: "garbage",
      tax: null,
      line_items: [],
      confidence_score: 0.9,
    };
    expect(normalizeExtractionDates(extraction)).toEqual({
      ...extraction,
      issue_date: "2026-10-26",
      due_date: null,
    });
  });
});
