import { describe, expect, it } from "vitest";
import {
  buildVendorsHref,
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
      page: 1,
    });
  });

  it("parses a valid page number", () => {
    expect(parseVendorQuery({ page: "3" }).page).toBe(3);
  });

  it("falls back to page 1 for an invalid page value", () => {
    expect(parseVendorQuery({ page: "0" }).page).toBe(1);
    expect(parseVendorQuery({ page: "abc" }).page).toBe(1);
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
      isDefaultVendorQuery({
        q: "",
        filter: VENDOR_FILTER.ALL,
        sort: VENDOR_SORT.TOTAL_DESC,
        page: 1,
      }),
    ).toBe(true);
  });

  it("is false when q is non-empty", () => {
    expect(
      isDefaultVendorQuery({
        q: "acme",
        filter: VENDOR_FILTER.ALL,
        sort: VENDOR_SORT.TOTAL_DESC,
        page: 1,
      }),
    ).toBe(false);
  });

  it("is false when filter or sort differs from the default", () => {
    expect(
      isDefaultVendorQuery({
        q: "",
        filter: VENDOR_FILTER.CANCELLED,
        sort: VENDOR_SORT.TOTAL_DESC,
        page: 1,
      }),
    ).toBe(false);
  });

  it("is false when page is not 1", () => {
    expect(
      isDefaultVendorQuery({
        q: "",
        filter: VENDOR_FILTER.ALL,
        sort: VENDOR_SORT.TOTAL_DESC,
        page: 2,
      }),
    ).toBe(false);
  });
});

describe("buildVendorsHref", () => {
  const defaultQuery = {
    q: "",
    filter: VENDOR_FILTER.ALL,
    sort: VENDOR_SORT.TOTAL_DESC,
    page: 1,
  };

  it("returns the bare pathname for the default query", () => {
    expect(buildVendorsHref("/dashboard/vendors", defaultQuery)).toBe(
      "/dashboard/vendors",
    );
  });

  it("includes page only when it isn't 1", () => {
    expect(buildVendorsHref("/dashboard/vendors", { ...defaultQuery, page: 2 })).toBe(
      "/dashboard/vendors?page=2",
    );
  });

  it("combines q, filter, sort, and page together", () => {
    const href = buildVendorsHref("/dashboard/vendors", {
      q: "acme",
      filter: VENDOR_FILTER.CANCELLED,
      sort: VENDOR_SORT.NAME_ASC,
      page: 3,
    });
    expect(href).toBe(
      "/dashboard/vendors?q=acme&filter=cancelled&sort=name_asc&page=3",
    );
  });
});

describe("label lookups", () => {
  it("returns the display label for a filter and sort value", () => {
    expect(vendorFilterLabel(VENDOR_FILTER.CANCELLED)).toBe("Cancelled");
    expect(vendorSortLabel(VENDOR_SORT.NAME_ASC)).toBe("Name (A → Z)");
  });
});
