import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const InvoiceExtractionSchema = z.object({
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

type ExtractionInput =
  | { type: "pdf"; data: Buffer }
  | { type: "image"; data: Buffer; mimeType: string }
  | { type: "html"; html: string };

const EXTRACTION_PROMPT = `You are looking at an email or attachment that may or may not be an invoice/receipt. Determine if it is actually an invoice, and if so extract its fields. If it is not an invoice (e.g. a newsletter, a personal email, spam), set is_invoice to false and leave other fields null/empty.`;

export async function extractInvoice(input: ExtractionInput): Promise<InvoiceExtraction> {
  const content: Anthropic.Messages.ContentBlockParam[] = [];

  if (input.type === "pdf") {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: input.data.toString("base64"),
      },
    });
  } else if (input.type === "image") {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: input.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: input.data.toString("base64"),
      },
    });
  } else {
    content.push({ type: "text", text: `Email HTML content:\n\n${input.html}` });
  }

  content.push({ type: "text", text: EXTRACTION_PROMPT });

  const response = await anthropic.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    // Haiku 4.5 doesn't support output_config.effort — only format.
    output_config: {
      format: zodOutputFormat(InvoiceExtractionSchema),
    },
    messages: [{ role: "user", content }],
  });

  if (!response.parsed_output) {
    throw new Error(`Invoice extraction failed to parse: stop_reason=${response.stop_reason}`);
  }

  return response.parsed_output;
}
