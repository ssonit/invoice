import { describe, expect, it } from "vitest";
import { parseEnvInput } from "./env";

const validBase = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "anon-key",
  SUPABASE_SECRET_KEY: "service-role-key",
  AGENTMAIL_API_KEY: "agentmail-key",
  AGENTMAIL_WEBHOOK_SECRET: "webhook-secret",
  BILLING_MODE: "none",
};

function withoutKey<K extends keyof typeof validBase>(key: K) {
  const copy: Partial<typeof validBase> = { ...validBase };
  delete copy[key];
  return copy;
}

describe("parseEnvInput", () => {
  it("accepts a fully-configured environment (default anthropic provider)", () => {
    const result = parseEnvInput({ ...validBase, ANTHROPIC_API_KEY: "sk-ant-x" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing NEXT_PUBLIC_SUPABASE_URL", () => {
    const result = parseEnvInput({
      ...withoutKey("NEXT_PUBLIC_SUPABASE_URL"),
      ANTHROPIC_API_KEY: "sk-ant-x",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("rejects a missing SUPABASE_SECRET_KEY", () => {
    const result = parseEnvInput({
      ...withoutKey("SUPABASE_SECRET_KEY"),
      ANTHROPIC_API_KEY: "sk-ant-x",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/SUPABASE_SECRET_KEY/);
  });

  it("rejects a missing AGENTMAIL_WEBHOOK_SECRET", () => {
    const result = parseEnvInput({
      ...withoutKey("AGENTMAIL_WEBHOOK_SECRET"),
      ANTHROPIC_API_KEY: "sk-ant-x",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/AGENTMAIL_WEBHOOK_SECRET/);
  });

  it("defaults EXTRACTION_PROVIDER to anthropic and requires ANTHROPIC_API_KEY", () => {
    const result = parseEnvInput({ ...validBase });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("accepts EXTRACTION_PROVIDER=google with GEMINI_API_KEY set", () => {
    const result = parseEnvInput({
      ...validBase,
      EXTRACTION_PROVIDER: "google",
      GEMINI_API_KEY: "gemini-key",
    });
    expect(result.success).toBe(true);
  });

  it("accepts EXTRACTION_PROVIDER=google with the legacy GOOGLE_API_KEY alias", () => {
    const result = parseEnvInput({
      ...validBase,
      EXTRACTION_PROVIDER: "google",
      GOOGLE_API_KEY: "google-key",
    });
    expect(result.success).toBe(true);
  });

  it("rejects EXTRACTION_PROVIDER=deepseek without DEEPSEEK_API_KEY", () => {
    const result = parseEnvInput({ ...validBase, EXTRACTION_PROVIDER: "deepseek" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/DEEPSEEK_API_KEY/);
  });

  it("is case-insensitive on EXTRACTION_PROVIDER", () => {
    const result = parseEnvInput({
      ...validBase,
      EXTRACTION_PROVIDER: "Anthropic",
      ANTHROPIC_API_KEY: "sk-ant-x",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown EXTRACTION_PROVIDER", () => {
    const result = parseEnvInput({ ...validBase, EXTRACTION_PROVIDER: "openai" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Unknown EXTRACTION_PROVIDER/);
  });
});

describe("parseEnvInput — Polar billing validation", () => {
  const validWithExtraction = { ...validBase, ANTHROPIC_API_KEY: "sk-ant-x" };

  it("accepts BILLING_MODE=none without any Polar vars", () => {
    const result = parseEnvInput({
      ...validWithExtraction,
      BILLING_MODE: "none",
    });
    expect(result.success).toBe(true);
  });

  it("rejects BILLING_MODE=test without POLAR_ACCESS_TOKEN", () => {
    const result = parseEnvInput({
      ...validWithExtraction,
      BILLING_MODE: "test",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/POLAR_ACCESS_TOKEN/);
  });

  it("rejects BILLING_MODE=live without POLAR_TEAM_PRODUCT_ID", () => {
    const result = parseEnvInput({
      ...validWithExtraction,
      BILLING_MODE: "live",
      POLAR_ACCESS_TOKEN: "polar-token",
      // Missing POLAR_TEAM_PRODUCT_ID
      POLAR_WEBHOOK_SECRET: "whsec_test",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/POLAR_TEAM_PRODUCT_ID/);
  });

  it("rejects BILLING_MODE=test without POLAR_WEBHOOK_SECRET", () => {
    const result = parseEnvInput({
      ...validWithExtraction,
      BILLING_MODE: "test",
      POLAR_ACCESS_TOKEN: "polar-token",
      POLAR_TEAM_PRODUCT_ID: "prod_abc",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/POLAR_WEBHOOK_SECRET/);
  });

  it("defaults BILLING_MODE to live and requires Polar vars", () => {
    const result = parseEnvInput({
      ...validWithExtraction,
      BILLING_MODE: undefined, // override the validBase default → falls back to "live"
      POLAR_ACCESS_TOKEN: "polar-token",
      POLAR_TEAM_PRODUCT_ID: "prod_abc",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/POLAR_WEBHOOK_SECRET/);
  });

  it("accepts BILLING_MODE=test with all Polar vars present", () => {
    const result = parseEnvInput({
      ...validWithExtraction,
      BILLING_MODE: "test",
      POLAR_ACCESS_TOKEN: "polar-token",
      POLAR_TEAM_PRODUCT_ID: "prod_abc",
      POLAR_WEBHOOK_SECRET: "whsec_test",
    });
    expect(result.success).toBe(true);
  });

  it("accepts BILLING_MODE=live with all Polar vars present", () => {
    const result = parseEnvInput({
      ...validWithExtraction,
      BILLING_MODE: "live",
      POLAR_ACCESS_TOKEN: "polar-token",
      POLAR_TEAM_PRODUCT_ID: "prod_abc",
      POLAR_WEBHOOK_SECRET: "whsec_test",
    });
    expect(result.success).toBe(true);
  });
});
