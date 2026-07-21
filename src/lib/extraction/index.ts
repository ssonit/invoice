import "server-only";
import type { ExtractionInput, InvoiceExtraction } from "./schema";
import { extractWithAnthropic } from "./anthropic";
import { extractWithGoogle } from "./google";
import { extractWithDeepseek } from "./deepseek";

export type { ExtractionInput, InvoiceExtraction } from "./schema";

// Which model reads invoices. Override per deployment via EXTRACTION_PROVIDER.
//   anthropic → Claude Haiku 4.5  (PDF / image / HTML)
//   google    → Gemini 2.5 Flash  (PDF / image / HTML)
//   deepseek  → DeepSeek Chat      (HTML / text only)
type Provider = "anthropic" | "google" | "deepseek";

const providers: Record<Provider, (input: ExtractionInput) => Promise<InvoiceExtraction>> = {
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

export async function extractInvoice(input: ExtractionInput): Promise<InvoiceExtraction> {
  return providers[resolveProvider()](input);
}
