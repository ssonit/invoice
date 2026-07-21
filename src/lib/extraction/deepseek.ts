import {
  EXTRACTION_PROMPT,
  InvoiceExtractionSchema,
  type ExtractionInput,
  type InvoiceExtraction,
} from "./schema";

const DEFAULT_MODEL = "deepseek-chat";
const API_URL = "https://api.deepseek.com/chat/completions";

// DeepSeek's chat models are text-only, so the required JSON shape is described
// in the prompt and validated with Zod afterwards (json_object mode guarantees
// valid JSON, not a matching schema).
const SCHEMA_HINT = `Return a JSON object with exactly these keys:
{
  "is_invoice": boolean,
  "vendor": string | null,
  "invoice_number": string | null,
  "amount": number | null,
  "currency": string | null (ISO 4217, e.g. "USD", "VND"),
  "issue_date": string | null (ISO 8601, e.g. "2026-07-20"),
  "due_date": string | null (ISO 8601),
  "tax": number | null,
  "line_items": [{ "description": string, "quantity": number | null, "unit_price": number | null, "amount": number | null }],
  "confidence_score": number (0 to 1)
}`;

export async function extractWithDeepseek(
  input: ExtractionInput,
): Promise<InvoiceExtraction> {
  if (input.type !== "html") {
    throw new Error(
      "DeepSeek cannot read PDF/image attachments — set EXTRACTION_PROVIDER=anthropic or google for file input.",
    );
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_EXTRACTION_MODEL || DEFAULT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${EXTRACTION_PROMPT}\n\n${SCHEMA_HINT}` },
        { role: "user", content: `Email HTML content:\n\n${input.html}` },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `DeepSeek extraction failed: ${response.status} ${await response.text()}`,
    );
  }

  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek extraction returned no content");
  }

  return InvoiceExtractionSchema.parse(JSON.parse(content));
}
