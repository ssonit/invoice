import { describe, expect, it } from "vitest";
import {
  overviewTrendStart,
  parseOverviewAggregates,
  statsFromOverviewAggregates,
  trendFromOverviewAggregates,
  type OverviewAggregates,
} from "./overview-aggregates";

const NOW = new Date("2026-07-15T12:00:00Z");

const base: OverviewAggregates = {
  total: 5,
  needsReview: 2,
  thisMonth: 3,
  byCurrency: [
    { currency: "USD", total: 100, count: 2 },
    { currency: "EUR", total: 400, count: 2 },
  ],
  byMonth: [
    { month: "2026-06", count: 2 },
    { month: "2026-07", count: 3 },
  ],
};

describe("parseOverviewAggregates", () => {
  const valid = {
    total: 5,
    needs_review: 2,
    this_month: 3,
    by_currency: [{ currency: "USD", total: "10.5", count: 1 }],
    by_month: [{ month: "2026-07", count: "3" }],
  };

  it("parses a valid payload and coerces numeric strings", () => {
    const parsed = parseOverviewAggregates(valid);
    expect(parsed?.byCurrency[0].total).toBe(10.5);
    expect(parsed?.byMonth[0].count).toBe(3);
  });

  it.each([null, undefined, "x", 1, [], {}])("rejects %j", (input) => {
    expect(parseOverviewAggregates(input)).toBeNull();
  });

  it("rejects malformed rows", () => {
    expect(
      parseOverviewAggregates({ ...valid, by_month: [{ month: 1, count: 1 }] }),
    ).toBeNull();
    expect(
      parseOverviewAggregates({ ...valid, by_currency: [{ total: "x", count: 1 }] }),
    ).toBeNull();
  });
});

describe("statsFromOverviewAggregates", () => {
  it("uses the largest-sum currency as the headline value", () => {
    const stats = statsFromOverviewAggregates(base);
    expect(stats.currency).toBe("EUR");
    expect(stats.totalValue).toBe(400);
    expect(stats.multiCurrency).toBe(true);
    expect(stats.total).toBe(5);
    expect(stats.needsReview).toBe(2);
    expect(stats.thisMonth).toBe(3);
    expect(stats.totalsByCurrency.map((t) => t.currency)).toEqual(["EUR", "USD"]);
  });

  it("returns zero value and a null currency when nothing has an amount", () => {
    const stats = statsFromOverviewAggregates({ ...base, total: 0, byCurrency: [] });
    expect(stats.totalValue).toBe(0);
    expect(stats.currency).toBeNull();
    expect(stats.multiCurrency).toBe(false);
  });
});

describe("trendFromOverviewAggregates", () => {
  it("fills missing months with 0, oldest first", () => {
    const points = trendFromOverviewAggregates(base, NOW, 3);
    expect(points).toEqual([
      { month: "May", count: 0 },
      { month: "Jun", count: 2 },
      { month: "Jul", count: 3 },
    ]);
  });

  it("labels months in the requested locale", () => {
    const points = trendFromOverviewAggregates(base, NOW, 3, "vi-VN");
    expect(points.map((p) => p.month)).not.toEqual(["May", "Jun", "Jul"]);
    expect(points[0].month).toMatch(/5/);
  });

  it("handles a window crossing a year boundary", () => {
    const points = trendFromOverviewAggregates(
      { ...base, byMonth: [{ month: "2025-12", count: 4 }] },
      new Date("2026-02-10T00:00:00Z"),
      3,
    );
    expect(points).toEqual([
      { month: "Dec", count: 4 },
      { month: "Jan", count: 0 },
      { month: "Feb", count: 0 },
    ]);
  });
});

describe("overviewTrendStart", () => {
  it("is the first of the month (months - 1) back, in UTC", () => {
    expect(overviewTrendStart(NOW, 6).toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(overviewTrendStart(NOW, 1).toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });
});
