import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lemon Squeezy signs each webhook body with HMAC-SHA256 using the store's
 * webhook signing secret, sent as a hex digest in the `X-Signature` header.
 * Verified with a timing-safe comparison (matches the intent of the `svix`
 * library already used for the AgentMail webhook, hand-rolled here since
 * Lemon Squeezy doesn't use svix).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
  const actual = Buffer.from(signatureHeader, "utf8");

  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
