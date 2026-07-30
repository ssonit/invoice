import { describe, expect, it } from "vitest";
import { effectiveInvoiceDate, buildAnalyticsReport } from "./report";
import type { InvoiceRow } from "@/lib/invoices";

function makeRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "inv-1",
    vendor: "ACME Corp",
    amount: 100,
    currency: "USD",
    issue_date: "2026-06-15",
    due_date: null,
    tax: 0,
    line_items: [],
    confidence_score: 0.9,
    source: "email",
    needs_review: false,
    file_url: null,
    invoice_number: "INV-001",
    created_at: "2026-06-20T10:00:00Z",
    ...overrides,
  };
}

// Fixed "now" for deterministic monthly bucketing tests
const NOW = new Date("2026-07-15T12:00:00Z");

describe("effectiveInvoiceDate", () => {
  it("uses issue_date when present", () => {
    const row = makeRow({ issue_date: "2026-03-10" });
    expect(effectiveInvoiceDate(row).toISOString()).toBe(
      "2026-03-10T00:00:00.000Z",
    );
  });

  it("falls back to created_at when issue_date is null", () => {
    const row = makeRow({
      issue_date: null,
      created_at: "2026-04-15T08:00:00Z",
    });
    expect(effectiveInvoiceDate(row).toISOString()).toBe(
      "2026-04-15T00:00:00.000Z",
    );
  });

  it("uses UTC date from created_at (strips time)", () => {
    const row = makeRow({
      issue_date: null,
      created_at: "2026-04-15T23:59:00Z",
    });
    expect(effectiveInvoiceDate(row).toISOString()).toBe(
      "2026-04-15T00:00:00.000Z",
    );
  });
});

describe("buildAnalyticsReport", () => {
  it("returns empty report for no rows", () => {
    const report = buildAnalyticsReport([], 6, NOW);
    expect(report).toEqual({
      currency: null,
      multiCurrency: false,
      invoiceCount: 0,
      needsReview: 0,
      totalSpend: 0,
      monthlySpend: [],
      topVendors: [],
    });
  });

  it("counts invoices and needs_review correctly", () => {
    const rows = [
      makeRow({ id: "1", needs_review: false }),
      makeRow({ id: "2", needs_review: true }),
      makeRow({ id: "3", needs_review: true }),
    ];
    const report = buildAnalyticsReport(rows, 6, NOW);
    expect(report.invoiceCount).toBe(3);
    expect(report.needsReview).toBe(2);
  });

  it("picks dominant currency by largest sum", () => {
    const rows = [
      makeRow({ id: "1", currency: "USD", amount: 100 }),
      makeRow({ id: "2", currency: "EUR", amount: 500 }),
      makeRow({ id: "3", currency: "USD", amount: 200 }),
    ];
    const report = buildAnalyticsReport(rows, 6, NOW);
    expect(report.currency).toBe("EUR");
    expect(report.totalSpend).toBe(500);
    expect(report.multiCurrency).toBe(true);
  });

  it("excludes non-dominant currencies from spend but counts them", () => {
    const rows = [
      makeRow({ id: "1", currency: "USD", amount: 100 }),
      makeRow({ id: "2", currency: "EUR", amount: 50 }),
    ];
    const report = buildAnalyticsReport(rows, 6, NOW);
    expect(report.currency).toBe("USD");
    expect(report.totalSpend).toBe(100);
    expect(report.invoiceCount).toBe(2);
  });

  it("handles null currency as '—' fallback (dominance)", () => {
    const rows = [
      makeRow({ id: "1", currency: null, amount: 200 }),
      makeRow({ id: "2", currency: "USD", amount: 100 }),
    ];
    const report = buildAnalyticsReport(rows, 6, NOW);
    // null-currency dominant → currency is null, not USD
    expect(report.currency).toBeNull();
    expect(report.totalSpend).toBe(200);
  });

  it("produces monthly spend buckets (oldest first, dominant currency only)", () => {
    const rows = [
      makeRow({
        id: "1",
        issue_date: "2026-02-10",
        currency: "USD",
        amount: 100,
      }),
      makeRow({
        id: "2",
        issue_date: "2026-02-20",
        currency: "USD",
        amount: 200,
      }),
      makeRow({
        id: "3",
        issue_date: "2026-04-05",
        currency: "USD",
        amount: 50,
      }),
      // EUR row — excluded from monthly spend (USD still dominant: 350 > 50)
      makeRow({
        id: "4",
        issue_date: "2026-04-10",
        currency: "EUR",
        amount: 50,
      }),
    ];
    const report = buildAnalyticsReport(rows, 6, NOW);
    expect(report.monthlySpend).toHaveLength(6);

    // February bucket (index 0, month "Feb")
    const feb = report.monthlySpend[0];
    expect(feb.month).toBe("Feb");
    expect(feb.amount).toBe(300);

    // April bucket (index 2, month "Apr")
    const apr = report.monthlySpend[2];
    expect(apr.month).toBe("Apr");
    expect(apr.amount).toBe(50);

    // March should be 0 (no USD spend)
    const mar = report.monthlySpend[1];
    expect(mar.month).toBe("Mar");
    expect(mar.amount).toBe(0);
  });

  it("returns top-8 vendors by dominant-currency spend with Other rollup", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRow({
        id: String(i),
        vendor: `Vendor ${i}`,
        currency: "USD",
        amount: 100 - i * 10,
      }),
    );
    const report = buildAnalyticsReport(rows, 6, NOW);
    expect(report.topVendors).toHaveLength(9); // 8 + Other
    expect(report.topVendors[0].label).toBe("Vendor 0");
    expect(report.topVendors[0].amount).toBe(100);
    expect(report.topVendors[8].label).toBe("Other");
    // Other amount = sum of vendors 8 + 9 = 20 + 10 = 30
    expect(report.topVendors[8].amount).toBe(30);
  });

  it("includes non-dominant currency rows as Other in vendor breakdown", () => {
    const rows = [
      makeRow({
        id: "1",
        vendor: "ACME",
        currency: "USD",
        amount: 100,
      }),
      makeRow({
        id: "2",
        vendor: "EuroCorp",
        currency: "EUR",
        amount: 50,
      }),
    ];
    const report = buildAnalyticsReport(rows, 6, NOW);
    // USD dominant → ACME should appear, EuroCorp excluded from topVendors
    const acme = report.topVendors.find((v) => v.label === "ACME");
    expect(acme).toBeDefined();
    const euroCorp = report.topVendors.find((v) => v.label === "EuroCorp");
    expect(euroCorp).toBeUndefined();
  });

  it("uses effective date for monthly bucketing (issue_date preferred)", () => {
    const rows = [
      makeRow({
        id: "1",
        issue_date: null,
        created_at: "2026-05-10T10:00:00Z",
        currency: "USD",
        amount: 100,
      }),
    ];
    const report = buildAnalyticsReport(rows, 6, NOW);
    // May is the 3rd month back from July (index 3)
    const may = report.monthlySpend[3];
    expect(may.month).toBe("May");
    expect(may.amount).toBe(100);
  });

  it("returns no Other when vendors <= 8", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeRow({
        id: String(i),
        vendor: `Vendor ${i}`,
        currency: "USD",
        amount: 100 - i * 10,
      }),
    );
    const report = buildAnalyticsReport(rows, 6, NOW);
    expect(report.topVendors).toHaveLength(5);
    const other = report.topVendors.find((v) => v.label === "Other");
    expect(other).toBeUndefined();
  });
});
