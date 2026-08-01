/** Default monthly invoice extraction cap for Starter-plan users.
 *  Override with STARTER_MONTHLY_INVOICE_LIMIT env var. */
export const STARTER_MONTHLY_INVOICE_LIMIT_DEFAULT = 50;

export const BILLING_MODE = {
  NONE: "none",
  TEST: "test",
  LIVE: "live",
} as const;

export type BillingMode = (typeof BILLING_MODE)[keyof typeof BILLING_MODE];
