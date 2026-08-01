"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeVendorKey } from "@/lib/subscriptions";
import { parseConfirmSubscriptionInput, parseMarkSubscriptionInput } from "@/lib/validation/subscriptions";
import {
  parseCreateVendorInput,
  parseDeleteVendorInput,
  parseUpdateVendorInput,
} from "@/lib/validation/vendors";
import { parseVendorKeyInput } from "@/lib/validation/common";
import type { SubscriptionConfirmationStatus } from "@/constants/subscriptions";
import type { VendorListInvoice } from "@/components/dashboard/vendors/vendors-list";

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

export async function markVendorAsSubscription(
  vendorKey: string,
  cycle: "monthly" | "yearly",
): Promise<ConfirmSubscriptionResult> {
  const parsed = parseMarkSubscriptionInput({ vendorKey, cycle });
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }

  const user = await requireUser();
  const service = createServiceClient();

  const { error } = await service.from("subscription_confirmations").upsert(
    {
      user_id: user.id,
      vendor_key: parsed.data.vendorKey,
      status: "active",
      origin: "manual",
      cycle: parsed.data.cycle,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,vendor_key" },
  );

  if (error) {
    console.error("Failed to mark vendor as subscription", user.id, error);
    return { ok: false, error: "Could not mark as subscription. Please try again." };
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
    .is("deleted_at", null)
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
    // vendor_key is a generated column — updating `vendor` recomputes it
    // automatically, so this single bulk update replaces the old
    // fetch-all-then-filter-then-update-one-by-one pattern.
    const { error: invoicesError } = await service
      .from("invoices")
      .update({ vendor: parsed.data.name })
      .eq("user_id", user.id)
      .eq("vendor_key", oldKey);

    if (invoicesError) {
      console.error("Failed to cascade vendor rename to invoices", user.id, invoicesError);
      return { ok: false, error: "Could not update vendor. Please try again." };
    }

    const { error: confirmationsError } = await service
      .from("subscription_confirmations")
      .update({ vendor_key: newKey })
      .eq("user_id", user.id)
      .eq("vendor_key", oldKey);

    if (confirmationsError) {
      console.error(
        "Failed to cascade vendor rename to subscription_confirmations",
        user.id,
        confirmationsError,
      );
      return { ok: false, error: "Could not update vendor. Please try again." };
    }
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
    .is("deleted_at", null)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, error: "Vendor not found." };
  }

  const nameKey = existing.name_key as string;
  const now = new Date().toISOString();

  // Soft-delete: invoices retain their vendor data — historical extraction
  // results are preserved and the vendor still appears in analytics/breakdowns.
  // Only the user's curated vendor list and subscription confirmations are
  // marked deleted; the vendor row itself is never physically removed.

  await service
    .from("subscription_confirmations")
    .update({ deleted_at: now })
    .eq("user_id", user.id)
    .eq("vendor_key", nameKey);

  const { error } = await service
    .from("vendors")
    .update({ deleted_at: now, updated_at: now })
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

export type GetVendorInvoicesResult =
  | { ok: true; invoices: VendorListInvoice[] }
  | { ok: false; error: string };

// On-demand fetch for the vendor detail Sheet's full invoice history — the
// page-level query only ever loads a bounded, windowed sample per vendor
// (see vendor_recent_invoices), so the full list is fetched only when a
// user actually opens a vendor's detail view.
export async function getVendorInvoices(vendorKey: string): Promise<GetVendorInvoicesResult> {
  const parsed = parseVendorKeyInput(vendorKey);
  if (!parsed.success) return { ok: false, error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, issue_date, due_date")
    .eq("user_id", user.id)
    .eq("vendor_key", parsed.data.vendorKey)
    .order("issue_date", { ascending: false });

  if (error) {
    console.error("Failed to load vendor invoices", user.id, vendorKey, error);
    return { ok: false, error: "Could not load invoices. Please try again." };
  }

  return { ok: true, invoices: data ?? [] };
}
