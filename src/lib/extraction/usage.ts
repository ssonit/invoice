import type { ExtractionUsage } from "./schema";

export type ExtractionMetrics = {
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
};

// Token counts are diagnostics that get summed into cost reports and believed,
// so a wrong number is worse than no number. Anything that isn't a
// non-negative integer becomes null.
function normalizeTokenCount(value: number | null | undefined): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

export function buildExtractionMetrics(params: {
  provider: string;
  usage: ExtractionUsage;
  durationMs: number;
}): ExtractionMetrics {
  const { provider, usage, durationMs } = params;
  return {
    provider,
    model: usage.model,
    inputTokens: normalizeTokenCount(usage.inputTokens),
    outputTokens: normalizeTokenCount(usage.outputTokens),
    durationMs: Math.max(0, Math.round(durationMs)),
  };
}
