import { describe, expect, it } from "vitest";
import {
  escapeIlike,
  isDefaultVendorQuery,
  parseVendorQuery,
  vendorFilterLabel,
  vendorSortLabel,
} from "./query";
import { VENDOR_FILTER, VENDOR_SORT } from "@/constants/vendors";

describe("parseVendorQuery", () => {
  it("falls back to defaults for missing params", () => {
    expect(parseVendorQuery({})).toEqual({
      q: "",
      filter: VENDOR_FILTER.ALL,
      sort: VENDOR_SORT.TOTAL_DESC,
    });
  });

  it("trims and length-caps the search query", () => {
    const result = parseVendorQuery({ q: "  acme  " });
    expect(result.q).toBe("acme");
  });

  it("truncates an overly long search query to VENDOR_SEARCH_MAX_LENGTH", () => {
    const result = parseVendorQuery({ q: "a".repeat(500) });
    expect(result.q).toHaveLength(100);
  });

  it("accepts a known filter and sort value", () => {
    const result = parseVendorQuery({
      filter: VENDOR_FILTER.SUBSCRIPTION,
      sort: VENDOR_SORT.NAME_ASC,
    });
    expect(result.filter).toBe(VENDOR_FILTER.SUBSCRIPTION);
    expect(result.sort).toBe(VENDOR_SORT.NAME_ASC);
  });

  it("falls back to the default filter/sort for unknown values", () => {
    const result = parseVendorQuery({ filter: "bogus", sort: "bogus" });
    expect(result.filter).toBe(VENDOR_FILTER.ALL);
    expect(result.sort).toBe(VENDOR_SORT.TOTAL_DESC);
  });
});

describe("escapeIlike", () => {
  it("escapes backslash, percent, and underscore", () => {
    expect(escapeIlike("100%_off\\deal")).toBe("100\\%\\_off\\\\deal");
  });

  it("leaves ordinary text unchanged", () => {
    expect(escapeIlike("Acme SaaS")).toBe("Acme SaaS");
  });

  it("escapes the backslash first so it doesn't double-escape later substitutions", () => {
    // A literal backslash followed by a percent should become \\ + \%, not \\%.
    expect(escapeIlike("\\%")).toBe("\\\\\\%");
  });
});

describe("isDefaultVendorQuery", () => {
  it("is true for the default query shape", () => {
    expect(
      isDefaultVendorQuery({ q: "", filter: VENDOR_FILTER.ALL, sort: VENDOR_SORT.TOTAL_DESC }),
    ).toBe(true);
  });

  it("is false when q is non-empty", () => {
    expect(
      isDefaultVendorQuery({
        q: "acme",
        filter: VENDOR_FILTER.ALL,
        sort: VENDOR_SORT.TOTAL_DESC,
      }),
    ).toBe(false);
  });

  it("is false when filter or sort differs from the default", () => {
    expect(
      isDefaultVendorQuery({
        q: "",
        filter: VENDOR_FILTER.CANCELLED,
        sort: VENDOR_SORT.TOTAL_DESC,
      }),
    ).toBe(false);
  });
});

describe("label lookups", () => {
  it("returns the display label for a filter and sort value", () => {
    expect(vendorFilterLabel(VENDOR_FILTER.CANCELLED)).toBe("Cancelled");
    expect(vendorSortLabel(VENDOR_SORT.NAME_ASC)).toBe("Name (A → Z)");
  });
});
