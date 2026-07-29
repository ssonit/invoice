import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  EXTRACTION_PROMPT,
  InvoiceExtractionSchema,
  type ExtractionInput,
  type ExtractionResult,
} from "./schema";

const DEFAULT_MODEL = "claude-haiku-4-5";

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return client;
}

export async function extractWithAnthropic(
  input: ExtractionInput,
): Promise<ExtractionResult> {
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

  const response = await getClient().messages.parse({
    model: process.env.ANTHROPIC_EXTRACTION_MODEL || DEFAULT_MODEL,
    max_tokens: 4096,
    output_config: {
      format: zodOutputFormat(InvoiceExtractionSchema),
    },
    messages: [{ role: "user", content }],
  });

  if (!response.parsed_output) {
    throw new Error(
      `Anthropic extraction failed to parse: stop_reason=${response.stop_reason}`,
    );
  }

  return {
    extraction: response.parsed_output,
    usage: {
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
    },
  };
}
