import { describe, expect, it } from "vitest";
import {
  parseLemonSqueezyWebhook,
  parseWebhookJson,
} from "./webhooks";

const validEvent = {
  meta: {
    event_name: "subscription_created",
    custom_data: { user_id: "550e8400-e29b-41d4-a716-446655440000" },
  },
  data: {
    id: "sub_123",
    attributes: {
      status: "active",
      customer_id: 42,
      renews_at: "2026-08-01T00:00:00.000000Z",
      ends_at: null,
      urls: { customer_portal: "https://example.lemonsqueezy.com/billing" },
    },
  },
};

describe("parseWebhookJson", () => {
  it("parses valid JSON", () => {
    const result = parseWebhookJson('{"ok":true}');
    expect(result).toEqual({ success: true, data: { ok: true } });
  });

  it("rejects malformed JSON", () => {
    expect(parseWebhookJson("{not json").success).toBe(false);
  });
});

describe("parseLemonSqueezyWebhook", () => {
  it("accepts a well-formed subscription event", () => {
    const result = parseLemonSqueezyWebhook(validEvent);
    expect(result.success).toBe(true);
  });

  it("rejects a missing event name", () => {
    const result = parseLemonSqueezyWebhook({
      ...validEvent,
      meta: { ...validEvent.meta, event_name: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid subscription status", () => {
    const result = parseLemonSqueezyWebhook({
      ...validEvent,
      data: {
        ...validEvent.data,
        attributes: { ...validEvent.data.attributes, status: "bogus" },
      },
    });
    expect(result.success).toBe(false);
  });
});
