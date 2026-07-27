import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "./lemonsqueezy-webhook";

const SECRET = "test-webhook-secret";

function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  it("returns true for a correctly signed payload", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    const signature = signBody(body, SECRET);
    expect(verifyWebhookSignature(body, signature, SECRET)).toBe(true);
  });

  it("returns false for a tampered payload", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    const signature = signBody(body, SECRET);
    const tamperedBody = JSON.stringify({ meta: { event_name: "subscription_cancelled" } });
    expect(verifyWebhookSignature(tamperedBody, signature, SECRET)).toBe(false);
  });

  it("returns false for a signature signed with the wrong secret", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    const signature = signBody(body, "wrong-secret");
    expect(verifyWebhookSignature(body, signature, SECRET)).toBe(false);
  });

  it("returns false for a missing signature header", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    expect(verifyWebhookSignature(body, null, SECRET)).toBe(false);
  });

  it("returns false for a malformed (non-hex) signature header", () => {
    const body = JSON.stringify({ meta: { event_name: "subscription_created" } });
    expect(verifyWebhookSignature(body, "not-a-valid-signature", SECRET)).toBe(false);
  });
});
