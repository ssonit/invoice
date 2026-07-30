import { createClient } from "@/lib/supabase/server";
import { hasActiveTeamPlan, isBillingDevUnlockEnabled, type TeamAccess } from "../billing";

/**
 * Checks whether the current user can access Team-gated features.
 *
 * Order:
 *   1. Non-prod dev unlock (BILLING_DEV_UNLOCK) — full access, no DB hit.
 *   2. Load billing_subscriptions row, check via hasActiveTeamPlan().
 *   3. Otherwise denied.
 *
 * Called from gated pages and the exports API route.
 */
export async function getTeamAccess(): Promise<TeamAccess> {
  if (isBillingDevUnlockEnabled()) {
    return { allowed: true, reason: "dev_unlock" };
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("billing_subscriptions")
    .select("plan, status, ends_at")
    .single();

  if (hasActiveTeamPlan(row)) {
    return { allowed: true, reason: "team" };
  }

  return { allowed: false, reason: "denied" };
}
