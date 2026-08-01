import type { createServiceClient } from "@/lib/supabase/service";
import { getBillingMode, hasActiveTeamPlan, isBillingDevUnlockEnabled } from "../billing";
import { STARTER_MONTHLY_INVOICE_LIMIT_DEFAULT } from "@/constants/billing";

export type ServiceClient = ReturnType<typeof createServiceClient>;

export type QuotaCheckResult =
  | { allowed: true }
  | { allowed: false; used: number; limit: number; resetsAt: string };

/**
 * Start and end of the current UTC calendar month.
 * Pure date math — no I/O.
 */
export function getMonthRangeUtc(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/**
 * Effective Starter monthly limit — env override or the compiled-in default.
 */
export function getStarterMonthlyLimit(): number {
  const raw = process.env.STARTER_MONTHLY_INVOICE_LIMIT;
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return STARTER_MONTHLY_INVOICE_LIMIT_DEFAULT;
}

/**
 * Count invoice rows for `userId` created in the current UTC month.
 * Only counts rows that actually exist — dedupe hits that just bump
 * `duplicate_hit_count` on an existing row are not counted.
 */
export async function countBillableInvoicesThisMonth(
  supabase: ServiceClient,
  userId: string,
): Promise<number> {
  const { start } = getMonthRangeUtc();

  const { count, error } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());

  if (error) {
    console.error("Failed to count invoices for quota check", userId, error);
    // Fail open — don't block legitimate usage because of a counting error.
    return 0;
  }

  return count ?? 0;
}

/**
 * Check whether a user can extract another invoice under the Starter quota.
 *
 * Order of precedence:
 * 1. Billing disabled (BILLING_MODE=none) → allowed (no billing at all).
 * 2. BILLING_DEV_UNLOCK → allowed (dev convenience).
 * 3. Active Team plan       → allowed (no cap).
 * 4. Starter under limit    → allowed.
 * 5. Starter at/over limit  → denied with usage details.
 *
 * Called from the upload API route and the email extraction path. In the
 * upload route the caller already has a ServiceClient; in the trigger-task
 * path processExtraction receives one. This function is self-contained —
 * it inspects billing_subscriptions internally rather than requiring a
 * separate getTeamAccess call first.
 */
export async function checkStarterQuota(
  supabase: ServiceClient,
  userId: string,
): Promise<QuotaCheckResult> {
  // 1. Billing disabled → unlimited.
  if (getBillingMode() === "none") return { allowed: true };

  // 2. Dev unlock → unlimited.
  if (isBillingDevUnlockEnabled()) return { allowed: true };

  // 3. Active Team plan → unlimited.
  const { data: billingRow } = await supabase
    .from("billing_subscriptions")
    .select("plan, status, ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (hasActiveTeamPlan(billingRow)) return { allowed: true };

  // 4. Starter — count invoices created this UTC month.
  const used = await countBillableInvoicesThisMonth(supabase, userId);
  const limit = getStarterMonthlyLimit();

  if (used < limit) return { allowed: true };

  // 5. Over limit.
  const { end } = getMonthRangeUtc();
  return { allowed: false, used, limit, resetsAt: end.toISOString() };
}
