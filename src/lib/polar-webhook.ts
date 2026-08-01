import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";

/**
 * Polar signs webhook payloads using the Standard Webhooks spec (base64
 * HMAC-SHA256). The official SDK's `validateEvent()` handles verification
 * and returns a typed event payload.
 *
 * Returns the verified event on success.
 * Throws {@link WebhookVerificationError} on a bad signature or malformed
 * payload — callers must catch it and respond 400.
 */
export function verifyPolarWebhook(
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
) {
  return validateEvent(rawBody, headers, secret);
}

export { WebhookVerificationError };
