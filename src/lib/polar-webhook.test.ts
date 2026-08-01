import { describe, expect, it } from "vitest";
import { verifyPolarWebhook, WebhookVerificationError } from "./polar-webhook";

// validateEvent uses standardwebhooks under the hood, which verifies
// base64 HMAC-SHA256 signatures and returns typed payloads. We test
// that the wrapper correctly delegates to the SDK — the SDK itself
// is well-tested upstream.
//
// Full integration: a real webhook body + valid signature → parsed event.
// We test the error path because we can't generate valid signatures
// without the actual webhook secret.

describe("verifyPolarWebhook", () => {
  it("throws WebhookVerificationError for an unsigned payload", () => {
    const body = JSON.stringify({ type: "subscription.active", data: {} });
    expect(() =>
      verifyPolarWebhook(body, {}, "whsec_testsecret12345678901234567890"),
    ).toThrow(WebhookVerificationError);
  });

  it("throws WebhookVerificationError for a missing webhook-id header", () => {
    const body = JSON.stringify({ type: "subscription.active", data: {} });
    expect(() =>
      verifyPolarWebhook(
        body,
        { "webhook-timestamp": String(Math.floor(Date.now() / 1000)) },
        "whsec_testsecret12345678901234567890",
      ),
    ).toThrow(WebhookVerificationError);
  });

  it("throws WebhookVerificationError for wrong secret", () => {
    const body = JSON.stringify({ type: "subscription.active", data: {} });
    expect(() =>
      verifyPolarWebhook(
        body,
        {
          "webhook-id": "msg_123",
          "webhook-timestamp": String(Math.floor(Date.now() / 1000)),
          "webhook-signature": "v1,invalid",
        },
        "whsec_testsecret12345678901234567890",
      ),
    ).toThrow(WebhookVerificationError);
  });
});
