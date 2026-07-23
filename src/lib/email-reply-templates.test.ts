import { describe, expect, it } from "vitest";
import { buildReplyText } from "./email-reply-templates";

describe("buildReplyText", () => {
  it("summarizes a single processed invoice with vendor and amount", () => {
    const text = buildReplyText({
      type: "processed",
      invoices: [{ vendor: "Acme SaaS", amount: 19, currency: "USD" }],
    });
    expect(text).toContain("Acme SaaS");
    expect(text).toContain("19 USD");
  });

  it("omits the amount when it is null", () => {
    const text = buildReplyText({
      type: "processed",
      invoices: [{ vendor: "Acme SaaS", amount: null, currency: null }],
    });
    expect(text).toContain("Acme SaaS");
    expect(text).not.toContain("null");
  });

  it("falls back gracefully when the vendor is null", () => {
    const text = buildReplyText({
      type: "processed",
      invoices: [{ vendor: null, amount: 5, currency: "USD" }],
    });
    expect(text).not.toContain("null");
    expect(text.length).toBeGreaterThan(0);
  });

  it("reports a count for multiple processed invoices", () => {
    const text = buildReplyText({
      type: "processed",
      invoices: [
        { vendor: "A", amount: 1, currency: "USD" },
        { vendor: "B", amount: 2, currency: "USD" },
      ],
    });
    expect(text).toContain("2");
  });

  it("tells the sender when nothing looked like an invoice", () => {
    const text = buildReplyText({ type: "skipped" });
    expect(text.toLowerCase()).toContain("invoice");
    expect(text.length).toBeGreaterThan(0);
  });

  it("apologizes on error", () => {
    const text = buildReplyText({ type: "error" });
    expect(text.length).toBeGreaterThan(0);
  });
});
