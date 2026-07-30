import "server-only";
import type { ExtractionInput, ExtractionResult, InvoiceExtraction } from "./schema";
import { buildExtractionMetrics, type ExtractionMetrics } from "./usage";
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
  // which provider ran, and it keeps the wrappers free of timing code.
  const startedAt = Date.now();
  const result = await providers[provider](input);
  return {
    extraction: result.extraction,
    metrics: buildExtractionMetrics({
      provider,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
    }),
  };
}
