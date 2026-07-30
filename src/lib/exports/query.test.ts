import { describe, expect, it } from "vitest";
import { parseExportQuery, buildExportHref, rangeStartIso } from "./query";

describe("parseExportQuery", () => {
  it("defaults to range=6, status=all when no params", () => {
    expect(parseExportQuery({})).toEqual({ range: 6, status: "all" });
  });

  it("parses valid range=12", () => {
    expect(parseExportQuery({ range: "12" })).toEqual({
      range: 12,
      status: "all",
    });
  });

  it("parses range=all", () => {
    expect(parseExportQuery({ range: "all" })).toEqual({
      range: "all",
      status: "all",
    });
  });

  it("parses valid status=review", () => {
    expect(parseExportQuery({ status: "review" })).toEqual({
      range: 6,
      status: "review",
    });
  });

  it("parses valid status=ok", () => {
    expect(parseExportQuery({ status: "ok" })).toEqual({
      range: 6,
      status: "ok",
    });
  });

  it("falls back to defaults for invalid range", () => {
    expect(parseExportQuery({ range: "3" })).toEqual({
      range: 6,
      status: "all",
    });
    expect(parseExportQuery({ range: "abc" })).toEqual({
      range: 6,
      status: "all",
    });
  });

  it("falls back to all for invalid status", () => {
    expect(parseExportQuery({ status: "pending" })).toEqual({
      range: 6,
      status: "all",
    });
  });
});

describe("buildExportHref", () => {
  it("returns bare path for default query", () => {
    expect(buildExportHref({ range: 6, status: "all" })).toBe(
      "/api/exports/invoices",
    );
  });

  it("includes range=12 when non-default", () => {
    expect(buildExportHref({ range: 12, status: "all" })).toBe(
      "/api/exports/invoices?range=12",
    );
  });

  it("includes status=review when non-default", () => {
    expect(buildExportHref({ range: 6, status: "review" })).toBe(
      "/api/exports/invoices?status=review",
    );
  });

  it("includes both range=12 and status=ok", () => {
    expect(buildExportHref({ range: 12, status: "ok" })).toBe(
      "/api/exports/invoices?range=12&status=ok",
    );
  });

  it("includes both range=all and status=review", () => {
    expect(buildExportHref({ range: "all", status: "review" })).toBe(
      "/api/exports/invoices?range=all&status=review",
    );
  });
});

describe("rangeStartIso", () => {
  it("returns first-of-month ISO 6 months ago", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(rangeStartIso(now, 6)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns first-of-month ISO 12 months ago", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(rangeStartIso(now, 12)).toBe("2025-07-01T00:00:00.000Z");
  });

  it("handles January boundary", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    expect(rangeStartIso(now, 6)).toBe("2025-07-01T00:00:00.000Z");
  });
});
