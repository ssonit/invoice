import { describe, expect, it } from "vitest";
import { buildExtractionMetrics } from "./usage";

const usage = { model: "claude-haiku-4-5", inputTokens: 1200, outputTokens: 300 };

describe("buildExtractionMetrics", () => {
  it("passes through a well-formed usage payload", () => {
    expect(
      buildExtractionMetrics({ provider: "anthropic", usage, durationMs: 812 }),
    ).toEqual({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      inputTokens: 1200,
      outputTokens: 300,
      durationMs: 812,
    });
  });

  it("keeps a zero token count rather than nulling it", () => {
    const metrics = buildExtractionMetrics({
      provider: "google",
      usage: { ...usage, outputTokens: 0 },
      durationMs: 5,
    });
    expect(metrics.outputTokens).toBe(0);
  });

  it("nulls missing token counts", () => {
    const metrics = buildExtractionMetrics({
      provider: "google",
      usage: { model: "gemini-2.5-flash", inputTokens: null, outputTokens: null },
      durationMs: 5,
    });
    expect(metrics.inputTokens).toBeNull();
    expect(metrics.outputTokens).toBeNull();
  });

  it("nulls NaN and negative counts", () => {
    const metrics = buildExtractionMetrics({
      provider: "deepseek",
      usage: { model: "deepseek-chat", inputTokens: Number.NaN, outputTokens: -4 },
      durationMs: 10,
    });
    expect(metrics.inputTokens).toBeNull();
    expect(metrics.outputTokens).toBeNull();
  });

  it("nulls fractional counts", () => {
    const metrics = buildExtractionMetrics({
      provider: "deepseek",
      usage: { model: "deepseek-chat", inputTokens: 12.5, outputTokens: 1 },
      durationMs: 1,
    });
    expect(metrics.inputTokens).toBeNull();
    expect(metrics.outputTokens).toBe(1);
  });

  it("rounds the duration and never reports a negative one", () => {
    expect(
      buildExtractionMetrics({ provider: "anthropic", usage, durationMs: 12.6 }).durationMs,
    ).toBe(13);
    expect(
      buildExtractionMetrics({ provider: "anthropic", usage, durationMs: -1 }).durationMs,
    ).toBe(0);
  });
});
