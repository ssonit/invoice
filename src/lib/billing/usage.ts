import type { createServiceClient } from "@/lib/supabase/service";
import { getBillingMode, hasActiveTeamPlan, isBillingDevUnlockEnabled } from "../billing";
import { STARTER_MONTHLY_INVOICE_LIMIT_DEFAULT } from "@/constants/billing";

export type ServiceClient = ReturnType<typeof createServiceClient>;

export type QuotaCheckResult =
  | { allowed: true }
  | { allowed: false; used: number; limit: number; resetsAt: string };

export type QuotaStatus =
  | { unlimited: true }
  | { unlimited: false; used: number; limit: number };

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
 * Current Starter-quota usage snapshot for a user, without deciding
 * allow/deny. Shared by checkStarterQuota (the extraction gate) and the
 * /api/invoices/quota route, which lets the upload UI cap a batch to the
 * remaining slots before sending any requests — closing the race where N
 * parallel uploads each see "quota not reached" before any of their writes
 * land.
 */
export async function getQuotaStatus(
  supabase: ServiceClient,
  userId: string,
): Promise<QuotaStatus> {
  // 1. Billing disabled → unlimited.
  if (getBillingMode() === "none") return { unlimited: true };

  // 2. Dev unlock → unlimited.
  if (isBillingDevUnlockEnabled()) return { unlimited: true };

  // 3. Active Team plan → unlimited.
  const { data: billingRow } = await supabase
    .from("billing_subscriptions")
    .select("plan, status, ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (hasActiveTeamPlan(billingRow)) return { unlimited: true };

  // 4. Starter — count invoices created this UTC month.
  const used = await countBillableInvoicesThisMonth(supabase, userId);
  const limit = getStarterMonthlyLimit();
  return { unlimited: false, used, limit };
}

/**
 * Check whether a user can extract another invoice under the Starter quota.
 * Called from the upload API route and the email extraction path.
 */
export async function checkStarterQuota(
  supabase: ServiceClient,
  userId: string,
): Promise<QuotaCheckResult> {
  const status = await getQuotaStatus(supabase, userId);
  if (status.unlimited) return { allowed: true };
  if (status.used < status.limit) return { allowed: true };

  const { end } = getMonthRangeUtc();
  return { allowed: false, used: status.used, limit: status.limit, resetsAt: end.toISOString() };
}
