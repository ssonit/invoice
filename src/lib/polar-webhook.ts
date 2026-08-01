import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";

/**
 * Polar signs webhook payloads using the Standard Webhooks spec (base64
 * HMAC-SHA256). The official SDK's `validateEvent()` handles verification
 * and returns a typed event payload.
 *
 * Returns the verified event on success, null on verification failure.
 * Throws only on unexpected errors (never on a bad signature).
 */
export function verifyPolarWebhook(
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
) {
  return validateEvent(rawBody, headers, secret);
}

export { WebhookVerificationError };
