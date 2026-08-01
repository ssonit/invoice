import { describe, expect, it } from "vitest";
import {
  computeStats,
  formatInvoiceDate,
  formatInvoiceMoney,
  getInboxStatus,
  inboxGroupLabel,
  inboxTimeLabel,
  monthlyTrend,
  normalizeInvoice,
  type InvoiceRow,
} from "./invoices";

function row(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "1",
    vendor: "Acme",
    invoice_number: "INV-1",
    amount: 100,
    currency: "USD",
    issue_date: "2026-07-01",
    due_date: null,
    tax: null,
    line_items: [],
    confidence_score: 0.95,
    source: "email",
    needs_review: false,
    file_url: null,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getInboxStatus", () => {
  it("returns 'review' when needs_review is true, regardless of confidence", () => {
    expect(getInboxStatus(row({ needs_review: true, confidence_score: 0.99 }))).toBe(
      "review",
    );
  });

  it("returns 'approved' for high confidence", () => {
    expect(getInboxStatus(row({ confidence_score: 0.9 }))).toBe("approved");
  });

  it("returns 'extracted' for lower confidence that isn't flagged for review", () => {
    expect(getInboxStatus(row({ confidence_score: 0.5 }))).toBe("extracted");
  });

  it("returns 'extracted' when confidence_score is null", () => {
    expect(getInboxStatus(row({ confidence_score: null }))).toBe("extracted");
  });
});

describe("formatInvoiceMoney", () => {
  it("formats USD with 2 decimals and a $ prefix", () => {
    expect(formatInvoiceMoney(1234.5, "USD")).toBe("$1,234.50");
  });

  it("formats zero-decimal currencies (VND, JPY, KRW) as whole numbers", () => {
    expect(formatInvoiceMoney(1234567, "VND")).toBe("1,234,567 VND");
    expect(formatInvoiceMoney(5000, "JPY")).toBe("5,000 JPY");
    expect(formatInvoiceMoney(12345, "KRW")).toBe("12,345 KRW");
  });

  it("formats two-decimal non-USD currencies (EUR, GBP) with 2 decimals", () => {
    expect(formatInvoiceMoney(1234.56, "EUR")).toBe("1,234.56 EUR");
    expect(formatInvoiceMoney(99.9, "GBP")).toBe("99.90 GBP");
    expect(formatInvoiceMoney(1500, "SGD")).toBe("1,500.00 SGD");
  });

  it("returns an em dash for a null amount", () => {
    expect(formatInvoiceMoney(null, "USD")).toBe("—");
  });

  it("handles a null currency with 2 decimals (most-currency default)", () => {
    expect(formatInvoiceMoney(50, null)).toBe("50.00");
  });

  it("formats negative amounts with a leading minus sign", () => {
    expect(formatInvoiceMoney(-42, "USD")).toBe("-$42.00");
  });
});

describe("formatInvoiceDate", () => {
  it("formats an ISO date without a timezone shift", () => {
    expect(formatInvoiceDate("2026-07-01")).toBe("Jul 1, 2026");
  });

  it("returns an em dash for null", () => {
    expect(formatInvoiceDate(null)).toBe("—");
  });

  it("returns the raw value when it doesn't match YYYY-MM-DD", () => {
    expect(formatInvoiceDate("not-a-date")).toBe("not-a-date");
  });
});

describe("normalizeInvoice", () => {
  it("coerces numeric-string fields (as PostgREST returns them) to numbers", () => {
    const result = normalizeInvoice({
      id: "1",
      amount: "123.45",
      tax: "1.5",
      confidence_score: "0.8",
      created_at: "2026-07-01T00:00:00.000Z",
    });
    expect(result.amount).toBe(123.45);
    expect(result.tax).toBe(1.5);
    expect(result.confidence_score).toBe(0.8);
  });

  it("falls back to null for missing/empty/non-numeric amount", () => {
    expect(
      normalizeInvoice({ id: "1", amount: "", created_at: "2026-07-01T00:00:00.000Z" })
        .amount,
    ).toBeNull();
    expect(
      normalizeInvoice({
        id: "1",
        amount: "not-a-number",
        created_at: "2026-07-01T00:00:00.000Z",
      }).amount,
    ).toBeNull();
    expect(
      normalizeInvoice({ id: "1", created_at: "2026-07-01T00:00:00.000Z" }).amount,
    ).toBeNull();
  });

  it("defaults line_items to an empty array when missing or not an array", () => {
    expect(
      normalizeInvoice({ id: "1", created_at: "2026-07-01T00:00:00.000Z" }).line_items,
    ).toEqual([]);
  });

  it("normalizes line item fields, coercing numbers and defaulting description", () => {
    const result = normalizeInvoice({
      id: "1",
      created_at: "2026-07-01T00:00:00.000Z",
      line_items: [{ description: "Widget", quantity: "2", unit_price: "9.5" }],
    });
    expect(result.line_items).toEqual([
      { description: "Widget", quantity: 2, unit_price: 9.5, amount: null },
    ]);
  });

  it("defaults source to 'email' when missing", () => {
    expect(
      normalizeInvoice({ id: "1", created_at: "2026-07-01T00:00:00.000Z" }).source,
    ).toBe("email");
  });
});

describe("computeStats", () => {
  it("sums per currency and reports the currency with the largest raw sum", () => {
    // computeStats does not convert currencies — it picks whichever currency's
    // summed amount is numerically largest, so keep USD's sum above VND's here.
    const now = new Date();
    const created = now.toISOString();
    const stats = computeStats([
      row({ amount: 100, currency: "USD", created_at: created }),
      row({ amount: 50, currency: "USD", created_at: created }),
      row({ amount: 80, currency: "VND", created_at: created }),
    ]);
    expect(stats.currency).toBe("USD");
    expect(stats.totalValue).toBe(150);
    expect(stats.multiCurrency).toBe(true);
  });

  it("counts needs_review and this-month rows correctly", () => {
    const now = new Date();
    const created = now.toISOString();
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)).toISOString();
    const stats = computeStats([
      row({ needs_review: true, created_at: created }),
      row({ needs_review: false, created_at: created }),
      row({ needs_review: false, created_at: lastMonth }),
    ]);
    expect(stats.needsReview).toBe(1);
    expect(stats.thisMonth).toBe(2);
    expect(stats.total).toBe(3);
  });

  it("returns null currency and false multiCurrency for an empty list", () => {
    const stats = computeStats([]);
    expect(stats.currency).toBeNull();
    expect(stats.multiCurrency).toBe(false);
    expect(stats.totalValue).toBe(0);
  });

  it("picks dominant currency when all sums are negative (credit notes)", () => {
    const now = new Date();
    const created = now.toISOString();
    const stats = computeStats([
      row({ amount: -100, currency: "USD", created_at: created }),
      row({ amount: -50, currency: "USD", created_at: created }),
      row({ amount: -80, currency: "VND", created_at: created }),
    ]);
    // VND (-80) > USD (-150) → VND is dominant, not null
    expect(stats.currency).toBe("VND");
    expect(stats.totalValue).toBe(-80);
    expect(stats.multiCurrency).toBe(true);
  });
});

describe("monthlyTrend", () => {
  it("returns `months` buckets ending on the current month, oldest first", () => {
    const trend = monthlyTrend([], 3);
    expect(trend).toHaveLength(3);
    const now = new Date();
    const currentLabel = now.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    expect(trend[trend.length - 1]!.month).toBe(currentLabel);
  });

  it("buckets a row into its creation month", () => {
    const now = new Date();
    const trend = monthlyTrend([row({ created_at: now.toISOString() })], 3);
    expect(trend[trend.length - 1]!.count).toBe(1);
  });

  it("ignores rows older than the requested window", () => {
    const now = new Date();
    const tooOld = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
    ).toISOString();
    const trend = monthlyTrend([row({ created_at: tooOld })], 3);
    expect(trend.reduce((sum, b) => sum + b.count, 0)).toBe(0);
  });
});

describe("inboxGroupLabel / inboxTimeLabel", () => {
  const now = "2026-07-23T15:00:00.000Z";

  it("labels a same-day timestamp as Today", () => {
    expect(inboxGroupLabel("2026-07-23T08:00:00.000Z", now)).toBe("Today");
  });

  it("labels the previous UTC day as Yesterday", () => {
    expect(inboxGroupLabel("2026-07-22T23:00:00.000Z", now)).toBe("Yesterday");
  });

  it("labels older dates with month/day/year", () => {
    expect(inboxGroupLabel("2026-07-01T00:00:00.000Z", now)).toBe("Jul 1, 2026");
  });

  it("formats today's time as h:mm AM/PM", () => {
    expect(inboxTimeLabel("2026-07-23T08:05:00.000Z", now)).toBe("8:05 AM");
  });

  it("shows 'Yesterday' (not a time) for the previous day", () => {
    expect(inboxTimeLabel("2026-07-22T23:00:00.000Z", now)).toBe("Yesterday");
  });
});
