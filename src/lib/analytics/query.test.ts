import { describe, expect, it } from "vitest";
import { parseAnalyticsQuery, buildAnalyticsHref, rangeStartIso } from "./query";

describe("parseAnalyticsQuery", () => {
  it("defaults to range 6 when no param is provided", () => {
    expect(parseAnalyticsQuery({})).toEqual({ range: 6 });
  });

  it("parses valid range=12", () => {
    expect(parseAnalyticsQuery({ range: "12" })).toEqual({ range: 12 });
  });

  it("parses valid range=6", () => {
    expect(parseAnalyticsQuery({ range: "6" })).toEqual({ range: 6 });
  });

  it("clamps invalid range values to the nearest valid (6 or 12)", () => {
    expect(parseAnalyticsQuery({ range: "3" })).toEqual({ range: 6 });
    expect(parseAnalyticsQuery({ range: "24" })).toEqual({ range: 12 });
    expect(parseAnalyticsQuery({ range: "abc" })).toEqual({ range: 6 });
  });

  it("defaults to 6 when range is empty string", () => {
    expect(parseAnalyticsQuery({ range: "" })).toEqual({ range: 6 });
  });
});

describe("buildAnalyticsHref", () => {
  it("omits range=6 (default) from href", () => {
    expect(buildAnalyticsHref({ range: 6 })).toBe("/dashboard/analytics");
  });

  it("includes range=12 in href", () => {
    expect(buildAnalyticsHref({ range: 12 })).toBe("/dashboard/analytics?range=12");
  });
});

describe("rangeStartIso", () => {
  it("returns an ISO date string at month start, N months before now", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    const result = rangeStartIso(now, 6);
    expect(result).toBe("2026-01-01T00:00:00.000Z");
  });

  it("handles year boundary", () => {
    const now = new Date("2026-02-15T12:00:00Z");
    const result = rangeStartIso(now, 6);
    expect(result).toBe("2025-08-01T00:00:00.000Z");
  });

  it("handles 12-month range", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    const result = rangeStartIso(now, 12);
    expect(result).toBe("2025-07-01T00:00:00.000Z");
  });
});
