import { describe, expect, it } from "vitest";
import { detectSubscriptions, normalizeVendorKey } from "./subscriptions";
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
});
