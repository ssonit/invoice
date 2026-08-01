"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserInbox } from "@/lib/agentmail";
import { parseResetPasswordForm } from "@/lib/validation/auth";
import { parseDeleteAccountInput } from "@/lib/validation/account";
import { createPolarCheckout, createPolarCustomerPortal } from "@/lib/polar";
import { getBillingMode } from "@/lib/billing";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type CreateInboxResult =
  | { ok: true; email: string; alreadyExisted: boolean }
  | { ok: false; error: string };

// Provisions the AgentMail forwarding inbox on demand. Called from the
// dashboard when the user chooses to set up email forwarding, rather than
// automatically at signup. Exactly one inbox per user (enforced by a DB
// unique constraint as well as the check below).
export async function createInbox(): Promise<CreateInboxResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  // Idempotent: if an inbox already exists, report it rather than creating a second.
  const { data: existing } = await service
    .from("inboxes")
    .select("email_address")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/automation");
    return { ok: true, email: existing.email_address, alreadyExisted: true };
  }

  try {
    const inbox = await createUserInbox(user.id);
    const { error } = await service.from("inboxes").insert({
      user_id: user.id,
      agentmail_inbox_id: inbox.inboxId,
      email_address: inbox.email,
    });
    if (error) {
      // Unique-constraint violation → an inbox was created concurrently.
      if (error.code === "23505") {
        const { data: row } = await service
          .from("inboxes")
          .select("email_address")
          .eq("user_id", user.id)
          .maybeSingle();
        revalidatePath("/dashboard/settings");
        revalidatePath("/dashboard/automation");
        return {
          ok: true,
          email: row?.email_address ?? inbox.email,
          alreadyExisted: true,
        };
      }
      throw new Error(error.message);
    }

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/automation");
    return { ok: true, email: inbox.email, alreadyExisted: false };
  } catch (err) {
    console.error("Failed to create inbox for user", user.id, err);
    const message =
      err instanceof Error && err.message.includes("permission denied")
        ? "Database permission error while saving the inbox. Ask an admin to apply the latest migrations."
        : "Could not create the forwarding address. Please try again.";
    return { ok: false, error: message };
  }
}

export type ChangePasswordResult = { ok: true } | { ok: false; error: string };

export async function changePassword(formData: FormData): Promise<ChangePasswordResult> {
  const parsed = parseResetPasswordForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error("Failed to change password", user?.id, error);
    return {
      ok: false,
      error: "Could not update your password. Please try again.",
    };
  }

  return { ok: true };
}

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

// Soft delete: flips profiles.deleted_at and signs the user out. No row in
// invoices/vendors/inboxes/auth.users is touched — see the design spec's
// "no data deletion" constraint.
export async function deleteAccount(confirmEmail: string): Promise<DeleteAccountResult> {
  const parsed = parseDeleteAccountInput({ confirmEmail });
  if (!parsed.success) return { ok: false, error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Never trust a client-side enable/disable check alone for a destructive action.
  if (parsed.data.confirmEmail.toLowerCase() !== user.email?.toLowerCase()) {
    return { ok: false, error: "Email confirmation does not match your account." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to soft-delete account", user.id, error);
    return { ok: false, error: "Could not delete your account. Please try again." };
  }

  await supabase.auth.signOut();
  redirect("/");
}

export type CreateCheckoutUrlResult = { ok: true; url: string } | { ok: false; error: string };

// Starts a Polar hosted checkout for the Team plan. Card data never touches
// this server — the user completes payment on Polar's page.
export async function createCheckoutUrl(): Promise<CreateCheckoutUrlResult> {
  if (getBillingMode() === "none") {
    return { ok: false, error: "Billing is not enabled on this instance." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const origin = (await headers()).get("origin");

  try {
    const url = await createPolarCheckout({
      userId: user.id,
      email: user.email!,
      redirectUrl: `${origin}/dashboard/settings?checkout=success`,
    });
    return { ok: true, url };
  } catch (err) {
    console.error("Failed to create checkout", user.id, err);
    return { ok: false, error: "Could not start checkout. Please try again." };
  }
}

export type OpenCustomerPortalResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

// Opens the Polar customer portal where the user can manage their subscription.
export async function openCustomerPortal(
  customerId: string,
): Promise<OpenCustomerPortalResult> {
  try {
    const url = await createPolarCustomerPortal(customerId);
    return { ok: true, url };
  } catch (err) {
    console.error("Failed to open customer portal", customerId, err);
    return { ok: false, error: "Could not open the billing portal. Please try again." };
  }
}
