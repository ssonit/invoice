import { z } from "zod";

export const InvoiceExtractionSchema = z.object({
  is_invoice: z
    .boolean()
    .describe("Whether this document/content is actually an invoice or receipt"),
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

export const EXTRACTION_PROMPT = `You are looking at an email or attachment that may or may not be an invoice/receipt. Determine if it is actually an invoice, and if so extract its fields. If it is not an invoice (e.g. a newsletter, a personal email, spam), set is_invoice to false and leave other fields null/empty.`;
