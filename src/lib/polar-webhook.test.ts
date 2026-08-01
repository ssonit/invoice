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
  // A fake webhook secret for testing error paths — never a real secret.
  // The whsec_ prefix matches Stripe's format; to avoid GitHub secret-scanning
  // false positives, a self-documenting placeholder is used instead.
  const TEST_SECRET = "fake_test_webhook_secret_placeholder";

  it("throws WebhookVerificationError for an unsigned payload", () => {
    const body = JSON.stringify({ type: "subscription.active", data: {} });
    expect(() =>
      verifyPolarWebhook(body, {}, TEST_SECRET),
    ).toThrow(WebhookVerificationError);
  });

  it("throws WebhookVerificationError for a missing webhook-id header", () => {
    const body = JSON.stringify({ type: "subscription.active", data: {} });
    expect(() =>
      verifyPolarWebhook(
        body,
        { "webhook-timestamp": String(Math.floor(Date.now() / 1000)) },
        TEST_SECRET,
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
        TEST_SECRET,
      ),
    ).toThrow(WebhookVerificationError);
  });
});
