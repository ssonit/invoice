import { describe, expect, it } from "vitest";
import { parseEnvInput } from "./env";

const validBase = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  AGENTMAIL_API_KEY: "agentmail-key",
  AGENTMAIL_WEBHOOK_SECRET: "webhook-secret",
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

  it("rejects a missing SUPABASE_SERVICE_ROLE_KEY", () => {
    const result = parseEnvInput({
      ...withoutKey("SUPABASE_SERVICE_ROLE_KEY"),
      ANTHROPIC_API_KEY: "sk-ant-x",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
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
