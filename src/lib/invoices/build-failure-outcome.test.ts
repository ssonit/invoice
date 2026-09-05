import { describe, expect, it } from "vitest";
import { buildFailureOutcome } from "./build-failure-outcome";

describe("buildFailureOutcome", () => {
  it("returns a processed outcome when at least one invoice was saved", () => {
    const saved = [{ vendor: "Acme", amount: 10, currency: "USD" }];
    expect(buildFailureOutcome(saved)).toEqual({ type: "processed", invoices: saved });
  });

  it("returns an error outcome when nothing was saved", () => {
    expect(buildFailureOutcome([])).toEqual({ type: "error" });
  });

  it("includes every saved invoice, not just the first", () => {
    const saved = [
      { vendor: "Acme", amount: 10, currency: "USD" },
      { vendor: "Globex", amount: 20, currency: "USD" },
    ];
    expect(buildFailureOutcome(saved)).toEqual({ type: "processed", invoices: saved });
  });
});
