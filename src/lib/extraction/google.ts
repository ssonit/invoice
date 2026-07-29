import { GoogleGenAI, Type, type Schema, type Part } from "@google/genai";
import {
  EXTRACTION_PROMPT,
  InvoiceExtractionSchema,
  type ExtractionInput,
  type ExtractionResult,
} from "./schema";

const DEFAULT_MODEL = "gemini-2.5-flash";

// OpenAPI-subset schema Gemini enforces on the JSON output.
const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    is_invoice: { type: Type.BOOLEAN },
    vendor: { type: Type.STRING, nullable: true },
    invoice_number: { type: Type.STRING, nullable: true },
    amount: { type: Type.NUMBER, nullable: true },
    currency: { type: Type.STRING, nullable: true },
    issue_date: { type: Type.STRING, nullable: true },
    due_date: { type: Type.STRING, nullable: true },
    tax: { type: Type.NUMBER, nullable: true },
    line_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER, nullable: true },
          unit_price: { type: Type.NUMBER, nullable: true },
          amount: { type: Type.NUMBER, nullable: true },
        },
        required: ["description"],
      },
    },
    confidence_score: { type: Type.NUMBER },
  },
  required: ["is_invoice", "confidence_score", "line_items"],
};

let client: GoogleGenAI | null = null;
function getClient() {
  client ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY!,
  });
  return client;
}

export async function extractWithGoogle(
  input: ExtractionInput,
): Promise<ExtractionResult> {
  const parts: Part[] = [];

  if (input.type === "pdf") {
    parts.push({
      inlineData: { mimeType: "application/pdf", data: input.data.toString("base64") },
    });
  } else if (input.type === "image") {
    parts.push({
      inlineData: { mimeType: input.mimeType, data: input.data.toString("base64") },
    });
  } else {
    parts.push({ text: `Email HTML content:\n\n${input.html}` });
  }

  parts.push({ text: EXTRACTION_PROMPT });

  const response = await getClient().models.generateContent({
    model: process.env.GOOGLE_EXTRACTION_MODEL || DEFAULT_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Google extraction returned no text");
  }

  return {
    extraction: InvoiceExtractionSchema.parse(JSON.parse(text)),
    usage: {
      model: process.env.GOOGLE_EXTRACTION_MODEL || DEFAULT_MODEL,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    },
  };
}
