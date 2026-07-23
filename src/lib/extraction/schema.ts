import { z } from "zod";

export const InvoiceExtractionSchema = z.object({
  is_invoice: z
    .boolean()
    .describe(
      "True only if this is a real invoice, receipt, tax invoice, or bill of sale — not marketing, contracts, resumes, photos, or unrelated docs",
    ),
  vendor: z.string().nullable(),
  invoice_number: z.string().nullable(),
  amount: z.number().nullable().describe("Total amount due, as a plain number"),
  currency: z.string().nullable().describe("ISO 4217 currency code, e.g. USD, VND"),
  issue_date: z.string().nullable().describe("ISO 8601 date, e.g. 2026-07-20"),
  due_date: z.string().nullable().describe("ISO 8601 date"),
  tax: z.number().nullable(),
  line_items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().nullable(),
      unit_price: z.number().nullable(),
      amount: z.number().nullable(),
    }),
  ),
  confidence_score: z
    .number()
    .min(0)
    .max(1)
    .describe("Your confidence that the extracted fields are accurate"),
});

export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;

export type ExtractionInput =
  | { type: "pdf"; data: Buffer }
  | { type: "image"; data: Buffer; mimeType: string }
  | { type: "html"; html: string };

export const EXTRACTION_PROMPT = `You are looking at an email body or file that may or may not be a financial document.

Accept as is_invoice=true only if it is clearly one of:
- invoice / tax invoice / hoá đơn
- receipt / biên lai / payment receipt
- bill / statement of charges for goods or services

Reject (is_invoice=false) everything else, including: newsletters, marketing, contracts, resumes, ID cards, random photos, spreadsheets that are not bills, shipping labels alone, and personal messages.

If rejected, leave other fields null/empty. If accepted, extract the fields carefully.`;
