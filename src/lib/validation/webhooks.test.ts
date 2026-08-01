import { describe, expect, it } from "vitest";
import { parseWebhookJson } from "./webhooks";

// Polar webhook verification uses the official SDK's validateEvent()
// (standardwebhooks under the hood). Only parseWebhookJson() remains
// here as a shared JSON-parsing helper (also used by AgentMail webhook).

describe("parseWebhookJson", () => {
  it("parses valid JSON", () => {
    const result = parseWebhookJson('{"ok":true}');
    expect(result).toEqual({ success: true, data: { ok: true } });
  });

  it("rejects malformed JSON", () => {
    expect(parseWebhookJson("{not json").success).toBe(false);
  });
});
