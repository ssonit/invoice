import "server-only";
import type { ExtractionInput, ExtractionResult, InvoiceExtraction } from "./schema";
import { buildExtractionMetrics, type ExtractionMetrics } from "./usage";
import { isRateLimitError } from "./provider-errors";
import { extractWithAnthropic } from "./anthropic";
import { extractWithGoogle } from "./google";
import { extractWithDeepseek } from "./deepseek";
import { classifyPdf } from "./pdf-classify";
import { normalizeExtractionDates } from "./normalize-date";
import { EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD } from "@/constants/extraction";

export type { ExtractionInput, InvoiceExtraction } from "./schema";
export type { ExtractionMetrics } from "./usage";

/** What one extraction produced, plus what it cost to produce it. */
export type ExtractionOutcome = {
  extraction: InvoiceExtraction;
  metrics: ExtractionMetrics;
};

// Which model reads invoices. Override per deployment via EXTRACTION_PROVIDER.
//   anthropic → Claude Haiku 4.5  (PDF / image / HTML / text)
//   google    → Gemini 2.5 Flash  (PDF / image / HTML / text)
//   deepseek  → DeepSeek Chat      (HTML / text only)
type Provider = "anthropic" | "google" | "deepseek";

const providers: Record<Provider, (input: ExtractionInput) => Promise<ExtractionResult>> = {
  anthropic: extractWithAnthropic,
  google: extractWithGoogle,
  deepseek: extractWithDeepseek,
};

function resolveProvider(): Provider {
  const configured = (process.env.EXTRACTION_PROVIDER || "anthropic").toLowerCase();
  if (configured in providers) return configured as Provider;
  throw new Error(
    `Unknown EXTRACTION_PROVIDER "${configured}" — use anthropic, google, or deepseek.`,
  );
}

async function callProvider(
  provider: Provider,
  input: ExtractionInput,
  method: ExtractionMetrics["method"],
): Promise<ExtractionOutcome> {
  // Timed here rather than in each wrapper: this is the one layer that knows
  // which provider ran, and it keeps the wrappers free of timing code. It's
  // also the one place every extraction call passes through regardless of
  // provider, so it's where rate-limit/failure and usage logging live too —
  // the email path (process-extraction.ts) has no try/catch of its own
  // around this call, so without logging here a provider failure there was
  // otherwise invisible outside the Trigger.dev dashboard.
  const startedAt = Date.now();
  let result: ExtractionResult;
  try {
    result = await providers[provider](input);
  } catch (error) {
    if (isRateLimitError(error)) {
      console.error("Extraction provider rate-limited", provider, error);
    } else {
      console.error("Extraction provider call failed", provider, error);
    }
    throw error;
  }

  const metrics = buildExtractionMetrics({
    provider,
    method,
    usage: result.usage,
    durationMs: Date.now() - startedAt,
  });
  console.log("Extraction usage", provider, {
    model: metrics.model,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    durationMs: metrics.durationMs,
    method: metrics.method,
  });

  return { extraction: normalizeExtractionDates(result.extraction), metrics };
}

export async function extractInvoice(input: ExtractionInput): Promise<ExtractionOutcome> {
  const provider = resolveProvider();

  // Only PDFs can carry a local text layer worth extracting — image and
  // HTML-body inputs are unchanged from today's behavior.
  if (input.type !== "pdf") {
    return callProvider(provider, input, null);
  }

  let classification;
  try {
    classification = await classifyPdf(input.data);
  } catch (err) {
    console.error("PDF classification failed, falling back to vision extraction", err);
    return callProvider(provider, input, "vision");
  }
  if (!classification.markdown) {
    return callProvider(provider, input, "vision");
  }

  let localOutcome: ExtractionOutcome;
  try {
    localOutcome = await callProvider(
      provider,
      { type: "text", text: classification.markdown },
      "local_text",
    );
  } catch (err) {
    console.error("Local text extraction failed, falling back to vision extraction", err);
    return callProvider(provider, input, "vision_fallback");
  }

  if (localOutcome.extraction.confidence_score >= EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD) {
    return localOutcome;
  }

  // Local extraction wasn't confident enough to trust — pay for the full
  // vision call instead of returning a low-quality result. The discarded
  // local call's cost is logged, not persisted: the invoice row records
  // whichever call actually produced its data, same convention as a
  // rejected (is_invoice=false) document costing a call with nothing to
  // show for it in the metrics columns.
  console.log("Local text extraction below confidence threshold, escalating to vision", {
    confidenceScore: localOutcome.extraction.confidence_score,
    threshold: EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD,
    discardedInputTokens: localOutcome.metrics.inputTokens,
    discardedOutputTokens: localOutcome.metrics.outputTokens,
  });

  return callProvider(provider, input, "vision_fallback");
}
