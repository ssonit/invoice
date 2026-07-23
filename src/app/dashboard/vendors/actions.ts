"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeVendorKey } from "@/lib/subscriptions";
import { parseConfirmSubscriptionInput } from "@/lib/validation/subscriptions";
import {
  parseCreateVendorInput,
  parseDeleteVendorInput,
  parseUpdateVendorInput,
} from "@/lib/validation/vendors";
import type { SubscriptionConfirmationStatus } from "@/constants/subscriptions";

export type ConfirmSubscriptionResult = { ok: true } | { ok: false; error: string };
export type VendorMutationResult =
  | { ok: true }
  | { ok: false; error: string };

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

// Upserts the user's yes/no answer for one vendor. Uses the service-role
// client (bypassing RLS) after an explicit auth check, matching the
// createInbox pattern in src/app/dashboard/actions.ts.
export async function confirmSubscription(
  vendorKey: string,
  status: SubscriptionConfirmationStatus,
): Promise<ConfirmSubscriptionResult> {
  const parsed = parseConfirmSubscriptionInput({ vendorKey, status });
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }

  const user = await requireUser();
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

export async function createVendor(input: {
  name: string;
  notes?: string;
}): Promise<VendorMutationResult> {
  const parsed = parseCreateVendorInput(input);
  if (!parsed.success) return { ok: false, error: parsed.error };

  const user = await requireUser();
  const nameKey = normalizeVendorKey(parsed.data.name);
  const service = createServiceClient();

  const { error } = await service.from("vendors").insert({
    user_id: user.id,
    name: parsed.data.name,
    name_key: nameKey,
    notes: parsed.data.notes,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A vendor with this name already exists." };
    }
    console.error("Failed to create vendor", user.id, error);
    return { ok: false, error: "Could not create vendor. Please try again." };
  }

  revalidatePath("/dashboard/vendors");
  return { ok: true };
}

export async function updateVendor(input: {
  id: string;
  name: string;
  notes?: string;
}): Promise<VendorMutationResult> {
  const parsed = parseUpdateVendorInput(input);
  if (!parsed.success) return { ok: false, error: parsed.error };

  const user = await requireUser();
  const service = createServiceClient();
  const newKey = normalizeVendorKey(parsed.data.name);

  const { data: existing, error: loadError } = await service
    .from("vendors")
    .select("id, name_key")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, error: "Vendor not found." };
  }

  const oldKey = existing.name_key as string;

  const { error } = await service
    .from("vendors")
    .update({
      name: parsed.data.name,
      name_key: newKey,
      notes: parsed.data.notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A vendor with this name already exists." };
    }
    console.error("Failed to update vendor", user.id, error);
    return { ok: false, error: "Could not update vendor. Please try again." };
  }

  if (oldKey !== newKey) {
    const { data: invoices } = await service
      .from("invoices")
      .select("id, vendor")
      .eq("user_id", user.id)
      .not("vendor", "is", null);

    const toRename = (invoices ?? []).filter(
      (row) => row.vendor && normalizeVendorKey(row.vendor) === oldKey,
    );

    if (toRename.length > 0) {
      await Promise.all(
        toRename.map((row) =>
          service
            .from("invoices")
            .update({ vendor: parsed.data.name })
            .eq("id", row.id)
            .eq("user_id", user.id),
        ),
      );
    }

    await service
      .from("subscription_confirmations")
      .update({ vendor_key: newKey })
      .eq("user_id", user.id)
      .eq("vendor_key", oldKey);
  }

  revalidatePath("/dashboard/vendors");
  revalidatePath("/dashboard/invoices");
  return { ok: true };
}

export async function deleteVendor(input: { id: string }): Promise<VendorMutationResult> {
  const parsed = parseDeleteVendorInput(input);
  if (!parsed.success) return { ok: false, error: parsed.error };

  const user = await requireUser();
  const service = createServiceClient();

  const { data: existing, error: loadError } = await service
    .from("vendors")
    .select("id, name_key")
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, error: "Vendor not found." };
  }

  const nameKey = existing.name_key as string;

  const { data: invoices } = await service
    .from("invoices")
    .select("id, vendor")
    .eq("user_id", user.id)
    .not("vendor", "is", null);

  const linked = (invoices ?? []).filter(
    (row) => row.vendor && normalizeVendorKey(row.vendor) === nameKey,
  );

  if (linked.length > 0) {
    await Promise.all(
      linked.map((row) =>
        service
          .from("invoices")
          .update({ vendor: null })
          .eq("id", row.id)
          .eq("user_id", user.id),
      ),
    );
  }

  await service
    .from("subscription_confirmations")
    .delete()
    .eq("user_id", user.id)
    .eq("vendor_key", nameKey);

  const { error } = await service
    .from("vendors")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Failed to delete vendor", user.id, error);
    return { ok: false, error: "Could not delete vendor. Please try again." };
  }

  revalidatePath("/dashboard/vendors");
  revalidatePath("/dashboard/invoices");
  return { ok: true };
}
