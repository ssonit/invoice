import { describe, expect, it } from "vitest";
import {
  parseAnalyticsAggregates,
  reportFromAggregates,
  type AnalyticsAggregates,
} from "./aggregates";

const NOW = new Date("2026-07-15T12:00:00Z");

function makeAggregates(overrides: Partial<AnalyticsAggregates> = {}): AnalyticsAggregates {
  return {
    invoiceCount: 3,
    needsReview: 1,
    byCurrency: [{ currency: "USD", total: 300, count: 3 }],
    byMonth: [
      { month: "2026-06", currency: "USD", total: 100 },
      { month: "2026-07", currency: "USD", total: 200 },
    ],
    byVendor: [
      { vendorKey: "acme", label: "ACME", currency: "USD", total: 200, count: 2 },
      { vendorKey: "globex", label: "Globex", currency: "USD", total: 100, count: 1 },
    ],
    ...overrides,
  };
}

describe("parseAnalyticsAggregates", () => {
  const valid = {
    invoice_count: 2,
    needs_review: 0,
    by_currency: [{ currency: "USD", total: "12.5", count: 2 }],
    by_month: [{ month: "2026-07", currency: "USD", total: 12.5 }],
    by_vendor: [
      { vendor_key: "acme", label: " ACME ", currency: "USD", total: 12.5, count: 2 },
    ],
  };

  it("parses a valid payload, coercing numeric strings and trimming labels", () => {
    const parsed = parseAnalyticsAggregates(valid);
    expect(parsed?.byCurrency[0].total).toBe(12.5);
    expect(parsed?.byVendor[0].label).toBe("ACME");
  });

  it("maps a null/empty currency to null", () => {
    const parsed = parseAnalyticsAggregates({
      ...valid,
      by_currency: [{ currency: null, total: 1, count: 1 }],
    });
    expect(parsed?.byCurrency[0].currency).toBeNull();
  });

  it.each([null, undefined, "x", 5, [], {}])("rejects %j", (input) => {
    expect(parseAnalyticsAggregates(input)).toBeNull();
  });

  it("rejects a payload with a malformed row", () => {
    expect(
      parseAnalyticsAggregates({ ...valid, by_month: [{ month: 7, total: 1 }] }),
    ).toBeNull();
    expect(
      parseAnalyticsAggregates({ ...valid, by_currency: [{ total: "abc", count: 1 }] }),
    ).toBeNull();
  });
});

describe("reportFromAggregates", () => {
  it("builds totals, monthly buckets (oldest first) and vendors", () => {
    const report = reportFromAggregates(makeAggregates(), 3, NOW);
    expect(report.currency).toBe("USD");
    expect(report.totalSpend).toBe(300);
    expect(report.invoiceCount).toBe(3);
    expect(report.needsReview).toBe(1);
    expect(report.multiCurrency).toBe(false);
    expect(report.monthlySpend).toEqual([
      { month: "May", amount: 0 },
      { month: "Jun", amount: 100 },
      { month: "Jul", amount: 200 },
    ]);
    expect(report.topVendors.map((v) => v.label)).toEqual(["ACME", "Globex"]);
    expect(report.totalsByCurrency[0].average).toBe(100);
  });

  it("returns an empty report with no buckets when there are no invoices", () => {
    const report = reportFromAggregates(
      makeAggregates({ invoiceCount: 0, needsReview: 0, byCurrency: [], byMonth: [], byVendor: [] }),
      6,
      NOW,
    );
    expect(report.invoiceCount).toBe(0);
    expect(report.monthlySpend).toEqual([]);
    expect(report.topVendors).toEqual([]);
    expect(report.totalSpend).toBe(0);
    expect(report.currency).toBeNull();
  });

  it("picks the largest-sum currency and ignores other currencies in chart/vendors", () => {
    const report = reportFromAggregates(
      makeAggregates({
        byCurrency: [
          { currency: "USD", total: 300, count: 3 },
          { currency: "EUR", total: 900, count: 1 },
        ],
        byMonth: [
          { month: "2026-07", currency: "USD", total: 300 },
          { month: "2026-07", currency: "EUR", total: 900 },
        ],
        byVendor: [
          { vendorKey: "a", label: "A", currency: "USD", total: 300, count: 3 },
          { vendorKey: "b", label: "B", currency: "EUR", total: 900, count: 1 },
        ],
      }),
      1,
      NOW,
    );
    expect(report.currency).toBe("EUR");
    expect(report.multiCurrency).toBe(true);
    expect(report.monthlySpend).toEqual([{ month: "Jul", amount: 900 }]);
    expect(report.topVendors.map((v) => v.label)).toEqual(["B"]);
    expect(report.totalsByCurrency.map((t) => t.currency)).toEqual(["EUR", "USD"]);
  });

  it("honours a requested currency that exists, ignores one that does not", () => {
    const agg = makeAggregates({
      byCurrency: [
        { currency: "USD", total: 300, count: 3 },
        { currency: "EUR", total: 900, count: 1 },
      ],
      byMonth: [],
      byVendor: [],
    });
    expect(reportFromAggregates(agg, 1, NOW, "USD").currency).toBe("USD");
    expect(reportFromAggregates(agg, 1, NOW, "USD").totalSpend).toBe(300);
    expect(reportFromAggregates(agg, 1, NOW, "JPY").currency).toBe("EUR");
  });

  it("treats a null currency as the '—' key", () => {
    const report = reportFromAggregates(
      makeAggregates({
        byCurrency: [{ currency: null, total: 50, count: 1 }],
        byMonth: [{ month: "2026-07", currency: null, total: 50 }],
        byVendor: [],
      }),
      1,
      NOW,
      "—",
    );
    expect(report.currency).toBeNull();
    expect(report.monthlySpend).toEqual([{ month: "Jul", amount: 50 }]);
  });

  it("folds vendors beyond the top 8 into one 'Other' slice", () => {
    const byVendor = Array.from({ length: 10 }, (_, i) => ({
      vendorKey: `v${i}`,
      label: `Vendor ${i}`,
      currency: "USD",
      total: 100 - i,
      count: 1,
    }));
    const report = reportFromAggregates(makeAggregates({ byVendor }), 1, NOW);
    expect(report.topVendors).toHaveLength(9);
    const other = report.topVendors[8];
    expect(other.key).toBe("other");
    expect(other.amount).toBe(92 + 91);
    expect(other.count).toBe(2);
  });

  it("drops currencies whose invoices have no amount", () => {
    const report = reportFromAggregates(
      makeAggregates({ byCurrency: [{ currency: "USD", total: 0, count: 0 }] }),
      1,
      NOW,
    );
    expect(report.totalsByCurrency).toEqual([]);
    expect(report.currency).toBeNull();
  });
});
