import { normalizeVendorKey } from "@/lib/subscriptions";

export type InvoiceIdentity = {
  vendorKey: string;
  invoiceNumber: string;
};

/**
 * What makes two extractions "the same invoice" even when the files differ
 * (e.g. the invoice PDF and the receipt image for one charge): same vendor and
 * same invoice number. Returns null when either is missing — without both
 * there is nothing reliable to match on, so the document is treated as new.
 * vendorKey matches the generated invoices.vendor_key column.
 */
export function getInvoiceIdentity(extracted: {
  vendor: string | null;
  invoice_number: string | null;
}): InvoiceIdentity | null {
  const vendor = extracted.vendor?.trim();
  const invoiceNumber = extracted.invoice_number?.trim();
  if (!vendor || !invoiceNumber) return null;
  return { vendorKey: normalizeVendorKey(vendor), invoiceNumber };
}
