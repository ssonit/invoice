import { describe, expect, it } from "vitest";
import { getInvoiceIdentity } from "./identity";

describe("getInvoiceIdentity", () => {
  it("normalizes the vendor and trims the invoice number", () => {
    expect(
      getInvoiceIdentity({ vendor: "  Vercel   Inc. ", invoice_number: " DZYSJKRM-0008 " }),
    ).toEqual({ vendorKey: "vercel inc.", invoiceNumber: "DZYSJKRM-0008" });
  });

  it("matches the same invoice regardless of vendor casing", () => {
    const a = getInvoiceIdentity({ vendor: "Cursor", invoice_number: "X-1" });
    const b = getInvoiceIdentity({ vendor: "CURSOR", invoice_number: "X-1" });
    expect(a).toEqual(b);
  });

  it("returns null when the vendor is missing or blank", () => {
    expect(getInvoiceIdentity({ vendor: null, invoice_number: "X-1" })).toBeNull();
    expect(getInvoiceIdentity({ vendor: "   ", invoice_number: "X-1" })).toBeNull();
  });

  it("returns null when the invoice number is missing or blank", () => {
    expect(getInvoiceIdentity({ vendor: "Cursor", invoice_number: null })).toBeNull();
    expect(getInvoiceIdentity({ vendor: "Cursor", invoice_number: "  " })).toBeNull();
  });
});
