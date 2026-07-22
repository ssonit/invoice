"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseConfirmSubscriptionInput } from "@/lib/validation/subscriptions";

export type ConfirmSubscriptionResult = { ok: true } | { ok: false; error: string };

// Upserts the user's yes/no answer for one vendor. Uses the service-role
// client (bypassing RLS) after an explicit auth check, matching the
// createInbox pattern in src/app/dashboard/actions.ts.
export async function confirmSubscription(
  vendorKey: string,
  status: "active" | "cancelled",
): Promise<ConfirmSubscriptionResult> {
  const parsed = parseConfirmSubscriptionInput({ vendorKey, status });
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { error } = await service.from("subscription_confirmations").upsert(
    {
      user_id: user.id,
      vendor_key: parsed.data.vendorKey,
      status: parsed.data.status,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,vendor_key" },
  );

  if (error) {
    console.error("Failed to save subscription confirmation", user.id, error);
    return { ok: false, error: "Could not save your answer. Please try again." };
  }

  revalidatePath("/dashboard/vendors");
  return { ok: true };
}
