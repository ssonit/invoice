import { describe, expect, it } from "vitest";
import { pageCount, paginationRange, parsePageParam } from "./pagination";

describe("parsePageParam", () => {
  it("defaults to 1 for undefined", () => {
    expect(parsePageParam(undefined)).toBe(1);
  });

  it("parses a valid positive integer string", () => {
    expect(parsePageParam("3")).toBe(3);
  });

  it("falls back to 1 for zero, negative, non-integer, or non-numeric values", () => {
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-1")).toBe(1);
    expect(parsePageParam("2.5")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
  });
});

describe("paginationRange", () => {
  it("computes the 0-indexed range for page 1", () => {
    expect(paginationRange(1, 20)).toEqual({ from: 0, to: 19 });
  });

  it("computes the range for a later page", () => {
    expect(paginationRange(3, 20)).toEqual({ from: 40, to: 59 });
  });

  it("handles a page size of 1", () => {
    expect(paginationRange(5, 1)).toEqual({ from: 4, to: 4 });
  });
});

describe("pageCount", () => {
  it("returns 1 for zero total rows (never show 0 pages)", () => {
    expect(pageCount(0, 20)).toBe(1);
  });

  it("rounds up for a partial last page", () => {
    expect(pageCount(21, 20)).toBe(2);
  });

  it("returns an exact count when total is a multiple of pageSize", () => {
    expect(pageCount(40, 20)).toBe(2);
  });
});
