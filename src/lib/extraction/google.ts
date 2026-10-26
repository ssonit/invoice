import { GoogleGenAI, Type, type Schema, type Part } from "@google/genai";
import {
  EXTRACTION_PROMPT,
  InvoiceExtractionSchema,
  type ExtractionInput,
  type ExtractionResult,
} from "./schema";

const DEFAULT_MODEL = "gemini-2.5-flash";
const GOOGLE_PARSE_ATTEMPTS = 2;

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
  } else if (input.type === "text") {
    parts.push({ text: `Extracted document text:\n\n${input.text}` });
  } else {
    parts.push({ text: `Email HTML content:\n\n${input.html}` });
  }

  parts.push({ text: EXTRACTION_PROMPT });

  const requestedModel = process.env.GOOGLE_EXTRACTION_MODEL || DEFAULT_MODEL;

  // Gemini occasionally returns truncated or off-schema JSON. That is
  // non-deterministic, so one retry recovers most cases before the upload fails.
  let response: Awaited<ReturnType<ReturnType<typeof getClient>["models"]["generateContent"]>>;
  let extraction: ReturnType<typeof InvoiceExtractionSchema.parse>;
  for (let attempt = 1; ; attempt++) {
    response = await getClient().models.generateContent({
      model: requestedModel,
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

    try {
      extraction = InvoiceExtractionSchema.parse(JSON.parse(text));
      break;
    } catch (err) {
      if (attempt >= GOOGLE_PARSE_ATTEMPTS) throw err;
      console.error("Google extraction returned invalid JSON, retrying", err);
    }
  }

  return {
    extraction,
    usage: {
      // modelVersion is the model that actually ran, which can differ from
      // what was requested (e.g. an alias resolving to a pinned version) —
      // recording it, not the request, keeps cost attribution accurate.
      model: response.modelVersion ?? requestedModel,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    },
  };
}
