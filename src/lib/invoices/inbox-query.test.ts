import { describe, expect, it } from "vitest";
import { isDefaultInboxListQuery, parseInboxListQuery } from "./inbox-query";

describe("parseInboxListQuery", () => {
  it("defaults page to 1, q to empty, status/source to 'all'", () => {
    expect(parseInboxListQuery({})).toEqual({
      page: 1,
      q: "",
      status: "all",
      source: "all",
    });
  });

  it("parses valid page/q/status/source", () => {
    expect(
      parseInboxListQuery({ page: "2", q: "acme", status: "review", source: "email" }),
    ).toEqual({ page: 2, q: "acme", status: "review", source: "email" });
  });

  it("trims and length-caps the search query", () => {
    expect(parseInboxListQuery({ q: "  acme  " }).q).toBe("acme");
    expect(parseInboxListQuery({ q: "a".repeat(500) }).q).toHaveLength(100);
  });

  it("falls back to 'all' for an unknown status or source value", () => {
    expect(parseInboxListQuery({ status: "bogus" }).status).toBe("all");
    expect(parseInboxListQuery({ source: "bogus" }).source).toBe("all");
  });

  it("accepts each real status and source value", () => {
    expect(parseInboxListQuery({ status: "extracted" }).status).toBe("extracted");
    expect(parseInboxListQuery({ status: "approved" }).status).toBe("approved");
    expect(parseInboxListQuery({ source: "upload" }).source).toBe("upload");
  });
});

describe("isDefaultInboxListQuery", () => {
  it("is true for the default shape", () => {
    expect(
      isDefaultInboxListQuery({ page: 1, q: "", status: "all", source: "all" }),
    ).toBe(true);
  });

  it("is false when any field differs from the default", () => {
    expect(
      isDefaultInboxListQuery({ page: 2, q: "", status: "all", source: "all" }),
    ).toBe(false);
    expect(
      isDefaultInboxListQuery({ page: 1, q: "acme", status: "all", source: "all" }),
    ).toBe(false);
    expect(
      isDefaultInboxListQuery({ page: 1, q: "", status: "review", source: "all" }),
    ).toBe(false);
    expect(
      isDefaultInboxListQuery({ page: 1, q: "", status: "all", source: "email" }),
    ).toBe(false);
  });
});
