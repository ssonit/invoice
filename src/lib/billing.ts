export type BillingSubscriptionStatus =
  | "none"
  | "on_trial"
  | "active"
  | "paused"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "expired";

export type BillingSubscriptionRow = {
  plan: "starter" | "team";
  status: BillingSubscriptionStatus;
  polar_customer_id: string | null;
  renews_at: string | null;
  ends_at: string | null;
};

import { type BillingMode, BILLING_MODE } from "@/constants/billing";

/**
 * Returns the current billing mode from BILLING_MODE env var.
 * Defaults to "live" when unset or unrecognized — fail-safe for production.
 */
export function getBillingMode(): BillingMode {
  const mode = process.env.BILLING_MODE;
  if (mode === BILLING_MODE.NONE || mode === BILLING_MODE.TEST) return mode;
  return BILLING_MODE.LIVE;
}

const ACCESS_GRANTING_STATUSES = new Set<BillingSubscriptionStatus>([
  "active",
  "on_trial",
  "past_due",
]);

/** Result returned by feature-gating checks. */
export type TeamAccess =
  | { allowed: true; reason: "team" | "dev_unlock" | "billing_disabled" }
  | { allowed: false; reason: "denied" };

/**
 * True when the dev-unlock env var is set AND the environment is non-prod.
 *
 * Defense in depth: unlock is ignored when VERCEL_ENV is "production" OR
 * NODE_ENV is "production", so a leaked env var can't accidentally unlock
 * features for real users.
 */
export function isBillingDevUnlockEnabled(): boolean {
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return false;
  }
  return process.env.BILLING_DEV_UNLOCK === "true";
}

/**
 * True if the user currently has Team-plan access. A cancelled subscription
 * still grants access until `ends_at` — the user already paid for that
 * period. Not called from any gated route yet (see design spec's "no feature
 * gating in this pass"); used today only by the Settings billing card.
 */
export function hasActiveTeamPlan(
  row: Pick<BillingSubscriptionRow, "status" | "ends_at"> | null,
): boolean {
  if (!row) return false;
  if (ACCESS_GRANTING_STATUSES.has(row.status)) return true;
  if (row.status === "cancelled" && row.ends_at) {
    return new Date(row.ends_at) > new Date();
  }
  return false;
}
