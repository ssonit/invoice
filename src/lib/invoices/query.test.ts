import { describe, expect, it } from "vitest";
import { isDefaultInvoiceListQuery, parseInvoiceListQuery } from "./query";

describe("parseInvoiceListQuery", () => {
  it("defaults page to 1, vendor to empty, status to 'all'", () => {
    expect(parseInvoiceListQuery({})).toEqual({ page: 1, vendor: "", status: "all" });
  });

  it("parses a valid page/vendor/status", () => {
    expect(parseInvoiceListQuery({ page: "2", vendor: "acme", status: "review" })).toEqual(
      { page: 2, vendor: "acme", status: "review" },
    );
  });

  it("trims and length-caps the vendor search", () => {
    expect(parseInvoiceListQuery({ vendor: "  acme  " }).vendor).toBe("acme");
    expect(parseInvoiceListQuery({ vendor: "a".repeat(500) }).vendor).toHaveLength(100);
  });

  it("falls back to 'all' for an unknown status value", () => {
    expect(parseInvoiceListQuery({ status: "bogus" }).status).toBe("all");
  });
});

describe("isDefaultInvoiceListQuery", () => {
  it("is true for the default shape", () => {
    expect(isDefaultInvoiceListQuery({ page: 1, vendor: "", status: "all" })).toBe(true);
  });

  it("is false when any field differs from the default", () => {
    expect(isDefaultInvoiceListQuery({ page: 2, vendor: "", status: "all" })).toBe(false);
    expect(isDefaultInvoiceListQuery({ page: 1, vendor: "acme", status: "all" })).toBe(
      false,
    );
    expect(isDefaultInvoiceListQuery({ page: 1, vendor: "", status: "review" })).toBe(
      false,
    );
  });
});
