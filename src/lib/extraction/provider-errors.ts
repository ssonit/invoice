/**
 * Every extraction provider (Anthropic SDK, Google GenAI SDK, DeepSeek's raw
 * fetch wrapper) surfaces a rate-limit differently — an `.status`/`.statusCode`
 * property, or just "429" embedded in a thrown Error's message. Checked here,
 * once, at the single dispatch point in `index.ts` that already logs
 * extraction failures for every provider.
 */
export function isRateLimitError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number" && status === 429) return true;

    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === "number" && statusCode === 429) return true;
  }

  if (error instanceof Error && /\b429\b/.test(error.message)) return true;

  return false;
}

/**
 * True when a provider rejected the *document itself* (HTTP 400 — e.g. a PDF
 * with no readable pages), as opposed to an outage or auth problem. Retrying
 * the same file can never succeed, so callers report it as a bad file (4xx).
 */
export function isUnreadableDocumentError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  return status === 400 || statusCode === 400;
}
