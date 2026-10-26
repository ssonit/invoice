import { describe, expect, it } from "vitest";
import { buildInvoiceSearchPattern, normalizeSearchText } from "./search";

describe("normalizeSearchText", () => {
  it("strips Vietnamese diacritics and đ", () => {
    expect(normalizeSearchText("Điện lực Hà Nội")).toBe("dien luc ha noi");
  });

  it("lowercases and trims", () => {
    expect(normalizeSearchText("  DE688 ")).toBe("de688");
  });

  it("handles precomposed and decomposed input the same", () => {
    expect(normalizeSearchText("Điện")).toBe(normalizeSearchText("Điện"));
  });
});

describe("buildInvoiceSearchPattern", () => {
  it("returns null for blank input", () => {
    expect(buildInvoiceSearchPattern("   ")).toBeNull();
  });

  it("wraps the folded term in wildcards", () => {
    expect(buildInvoiceSearchPattern("Điện")).toBe("%dien%");
  });

  it("escapes LIKE wildcards in user input", () => {
    expect(buildInvoiceSearchPattern("50%_off")).toBe("%50\\%\\_off%");
  });
});
