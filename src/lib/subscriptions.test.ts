import { describe, expect, it } from "vitest";
import { detectSubscriptions, normalizeVendorKey, withConfirmationStatus } from "./subscriptions";
import type { InvoiceRow } from "./invoices";

function makeInvoice(
  overrides: Partial<InvoiceRow> & { vendor: string; issue_date: string },
): InvoiceRow {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    vendor: overrides.vendor,
    invoice_number: overrides.invoice_number ?? null,
    amount: overrides.amount ?? 29,
    currency: overrides.currency ?? "USD",
    issue_date: overrides.issue_date,
    due_date: overrides.due_date ?? null,
    tax: overrides.tax ?? null,
    line_items: overrides.line_items ?? [],
    confidence_score: overrides.confidence_score ?? 0.95,
    source: overrides.source ?? "email",
    needs_review: overrides.needs_review ?? false,
    file_url: overrides.file_url ?? null,
    created_at: overrides.created_at ?? `${overrides.issue_date}T00:00:00.000Z`,
  };
}

describe("normalizeVendorKey", () => {
  it("collapses case and whitespace variants to the same key", () => {
    expect(normalizeVendorKey("Acme SaaS")).toBe("acme saas");
    expect(normalizeVendorKey("  acme   saas ")).toBe("acme saas");
    expect(normalizeVendorKey("ACME SAAS")).toBe("acme saas");
  });
});

describe("detectSubscriptions", () => {
  it("detects a monthly subscription from ~30-day gaps", () => {
    const invoices = [
      makeInvoice({ vendor: "Acme SaaS", issue_date: "2026-01-15" }),
      makeInvoice({ vendor: "Acme SaaS", issue_date: "2026-02-14" }),
      makeInvoice({ vendor: "Acme SaaS", issue_date: "2026-03-16" }),
    ];

    const result = detectSubscriptions(invoices);

    expect(result).toEqual([
      expect.objectContaining({
        vendorKey: "acme saas",
        cycle: "monthly",
        invoiceCount: 3,
        lastIssueDate: "2026-03-16",
        nextExpectedDate: "2026-04-15",
      }),
    ]);
  });

  it("detects a yearly subscription from ~365-day gaps", () => {
    const invoices = [
      makeInvoice({ vendor: "Annual Insurance Co", issue_date: "2025-01-10" }),
      makeInvoice({ vendor: "Annual Insurance Co", issue_date: "2026-01-10" }),
    ];

    const result = detectSubscriptions(invoices);

    expect(result).toEqual([
      expect.objectContaining({
        vendorKey: "annual insurance co",
        cycle: "yearly",
        invoiceCount: 2,
        lastIssueDate: "2026-01-10",
        nextExpectedDate: "2027-01-10",
      }),
    ]);
  });

  it("ignores vendors with irregular gaps", () => {
    const invoices = [
      makeInvoice({ vendor: "Random Vendor", issue_date: "2026-01-01" }),
      makeInvoice({ vendor: "Random Vendor", issue_date: "2026-01-11" }), // +10 days
      makeInvoice({ vendor: "Random Vendor", issue_date: "2026-04-11" }), // +90 days
    ];

    expect(detectSubscriptions(invoices)).toEqual([]);
  });

  it("ignores vendors with only one invoice", () => {
    const invoices = [makeInvoice({ vendor: "One-Off Vendor", issue_date: "2026-01-01" })];

    expect(detectSubscriptions(invoices)).toEqual([]);
  });

  it("groups multiple vendors independently", () => {
    const invoices = [
      makeInvoice({ vendor: "Acme SaaS", issue_date: "2026-01-15" }),
      makeInvoice({ vendor: "Acme SaaS", issue_date: "2026-02-14" }),
      makeInvoice({ vendor: "Annual Insurance Co", issue_date: "2025-01-10" }),
      makeInvoice({ vendor: "Annual Insurance Co", issue_date: "2026-01-10" }),
    ];

    const result = detectSubscriptions(invoices);

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.vendorKey === "acme saas")?.cycle).toBe("monthly");
    expect(result.find((r) => r.vendorKey === "annual insurance co")?.cycle).toBe("yearly");
  });

  it("classifies a median gap at the inclusive boundary as monthly (25 days)", () => {
    const invoices = [
      makeInvoice({ vendor: "Boundary Monthly", issue_date: "2026-01-01" }),
      makeInvoice({ vendor: "Boundary Monthly", issue_date: "2026-01-26" }), // +25
    ];
    expect(detectSubscriptions(invoices)[0]?.cycle).toBe("monthly");
  });

  it("does not classify a median gap just outside the monthly range (24 days)", () => {
    const invoices = [
      makeInvoice({ vendor: "Just Under Monthly", issue_date: "2026-01-01" }),
      makeInvoice({ vendor: "Just Under Monthly", issue_date: "2026-01-25" }), // +24
    ];
    expect(detectSubscriptions(invoices)).toEqual([]);
  });

  it("classifies a median gap at the inclusive boundary as yearly (350 days)", () => {
    const invoices = [
      makeInvoice({ vendor: "Boundary Yearly", issue_date: "2026-01-01" }),
      makeInvoice({ vendor: "Boundary Yearly", issue_date: "2026-12-17" }), // +350
    ];
    expect(detectSubscriptions(invoices)[0]?.cycle).toBe("yearly");
  });

  it("does not classify a median gap just outside the yearly range (381 days)", () => {
    const invoices = [
      makeInvoice({ vendor: "Just Over Yearly", issue_date: "2026-01-01" }),
      makeInvoice({ vendor: "Just Over Yearly", issue_date: "2027-01-17" }), // +381
    ];
    expect(detectSubscriptions(invoices)).toEqual([]);
  });
});

describe("withConfirmationStatus", () => {
  const candidate = {
    vendorKey: "acme saas",
    vendorLabel: "Acme SaaS",
    cycle: "monthly" as const,
    invoiceCount: 3,
    lastAmount: 29,
    currency: "USD",
    lastIssueDate: "2026-03-16",
    nextExpectedDate: "2026-04-15",
  };

  it("marks a subscription as due when today is inside the reminder window and unconfirmed", () => {
    const today = new Date("2026-04-14T00:00:00.000Z");
    const [result] = withConfirmationStatus([candidate], new Map(), today);
    expect(result.status).toBe("due");
    expect(result.needsConfirmation).toBe(true);
  });

  it("marks a subscription as upcoming when today is before the reminder window", () => {
    const today = new Date("2026-03-20T00:00:00.000Z");
    const [result] = withConfirmationStatus([candidate], new Map(), today);
    expect(result.status).toBe("upcoming");
    expect(result.needsConfirmation).toBe(false);
  });

  it("marks a subscription as confirmed_active when confirmed within the current cycle", () => {
    const confirmations = new Map([
      ["acme saas", { status: "active" as const, confirmedAt: "2026-03-18T00:00:00.000Z" }],
    ]);
    const today = new Date("2026-04-14T00:00:00.000Z");
    const [result] = withConfirmationStatus([candidate], confirmations, today);
    expect(result.status).toBe("confirmed_active");
    expect(result.needsConfirmation).toBe(false);
  });

  it("marks a subscription as cancelled when the user said so, regardless of window", () => {
    const confirmations = new Map([
      ["acme saas", { status: "cancelled" as const, confirmedAt: "2026-03-18T00:00:00.000Z" }],
    ]);
    const today = new Date("2026-04-14T00:00:00.000Z");
    const [result] = withConfirmationStatus([candidate], confirmations, today);
    expect(result.status).toBe("cancelled");
    expect(result.needsConfirmation).toBe(false);
  });

  it("marks a subscription as due when the active confirmation is from a previous cycle", () => {
    const confirmations = new Map([
      ["acme saas", { status: "active" as const, confirmedAt: "2026-02-01T00:00:00.000Z" }],
    ]);
    const today = new Date("2026-04-14T00:00:00.000Z");
    const [result] = withConfirmationStatus([candidate], confirmations, today);
    expect(result.status).toBe("due");
    expect(result.needsConfirmation).toBe(true);
  });

  it("re-prompts when a new invoice arrived after the vendor was marked cancelled", () => {
    const confirmations = new Map([
      ["acme saas", { status: "cancelled" as const, confirmedAt: "2026-02-01T00:00:00.000Z" }],
    ]);
    // candidate.lastIssueDate is "2026-03-16" — after the 2026-02-01 cancellation,
    // meaning a new invoice arrived despite the user saying they'd cancelled.
    const today = new Date("2026-04-14T00:00:00.000Z");
    const [result] = withConfirmationStatus([candidate], confirmations, today);
    expect(result.status).toBe("due");
    expect(result.needsConfirmation).toBe(true);
  });

  it("keeps honoring cancelled when no newer invoice has arrived", () => {
    const confirmations = new Map([
      ["acme saas", { status: "cancelled" as const, confirmedAt: "2026-04-01T00:00:00.000Z" }],
    ]);
    // Cancellation is after candidate.lastIssueDate ("2026-03-16") — no new invoice since.
    const today = new Date("2026-04-14T00:00:00.000Z");
    const [result] = withConfirmationStatus([candidate], confirmations, today);
    expect(result.status).toBe("cancelled");
    expect(result.needsConfirmation).toBe(false);
  });
});
