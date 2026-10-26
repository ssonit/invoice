import { describe, expect, it } from "vitest";
import { isRateLimitError, isUnreadableDocumentError } from "./provider-errors";

describe("isRateLimitError", () => {
  it("detects a numeric status property of 429", () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
  });

  it("detects a numeric statusCode property of 429", () => {
    expect(isRateLimitError({ statusCode: 429 })).toBe(true);
  });

  it("detects 429 mentioned in an Error message", () => {
    expect(isRateLimitError(new Error("DeepSeek extraction failed: 429 Too Many Requests"))).toBe(
      true,
    );
  });

  it("does not flag an unrelated status code", () => {
    expect(isRateLimitError({ status: 500 })).toBe(false);
  });

  it("does not flag an unrelated error message", () => {
    expect(isRateLimitError(new Error("Google extraction returned no text"))).toBe(false);
  });

  it("does not flag a message that merely contains a substring of 429", () => {
    expect(isRateLimitError(new Error("request id 4290 failed"))).toBe(false);
  });

  it("returns false for non-object, non-Error values", () => {
    expect(isRateLimitError("boom")).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

describe("isUnreadableDocumentError", () => {
  it("is true for a provider 400", () => {
    expect(isUnreadableDocumentError({ status: 400 })).toBe(true);
    expect(isUnreadableDocumentError({ statusCode: 400 })).toBe(true);
  });

  it("is false for rate limits, outages, and non-objects", () => {
    expect(isUnreadableDocumentError({ status: 429 })).toBe(false);
    expect(isUnreadableDocumentError({ status: 500 })).toBe(false);
    expect(isUnreadableDocumentError(new Error("boom"))).toBe(false);
    expect(isUnreadableDocumentError(null)).toBe(false);
  });
});
