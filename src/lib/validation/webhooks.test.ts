import { describe, expect, it } from "vitest";
import { parseWebhookJson } from "./webhooks";

describe("parseWebhookJson", () => {
  it("parses valid JSON", () => {
    const result = parseWebhookJson('{"ok":true}');
    expect(result).toEqual({ success: true, data: { ok: true } });
  });

  it("rejects malformed JSON", () => {
    expect(parseWebhookJson("{not json").success).toBe(false);
  });
});
