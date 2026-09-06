import "server-only";
import type { ExtractionInput, ExtractionResult, InvoiceExtraction } from "./schema";
import { buildExtractionMetrics, type ExtractionMetrics } from "./usage";
import { isRateLimitError } from "./provider-errors";
import { extractWithAnthropic } from "./anthropic";
import { extractWithGoogle } from "./google";
import { extractWithDeepseek } from "./deepseek";

export type { ExtractionInput, InvoiceExtraction } from "./schema";
export type { ExtractionMetrics } from "./usage";

/** What one extraction produced, plus what it cost to produce it. */
export type ExtractionOutcome = {
  extraction: InvoiceExtraction;
  metrics: ExtractionMetrics;
};

// Which model reads invoices. Override per deployment via EXTRACTION_PROVIDER.
//   anthropic → Claude Haiku 4.5  (PDF / image / HTML)
//   google    → Gemini 2.5 Flash  (PDF / image / HTML)
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

export async function extractInvoice(input: ExtractionInput): Promise<ExtractionOutcome> {
  const provider = resolveProvider();
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
    usage: result.usage,
    durationMs: Date.now() - startedAt,
  });
  console.log("Extraction usage", provider, {
    model: metrics.model,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    durationMs: metrics.durationMs,
  });

  return { extraction: result.extraction, metrics };
}
