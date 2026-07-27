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
  customer_portal_url: string | null;
  renews_at: string | null;
  ends_at: string | null;
};

const ACCESS_GRANTING_STATUSES = new Set<BillingSubscriptionStatus>([
  "active",
  "on_trial",
  "past_due",
]);

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
