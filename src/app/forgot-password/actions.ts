"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { parseForgotPasswordForm } from "@/lib/validation/auth";

export async function requestPasswordReset(formData: FormData) {
  const parsed = parseForgotPasswordForm(formData);
  if (!parsed.success) {
    redirect(`/forgot-password?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Always show the same success state, whether or not the email is
  // registered — don't let this endpoint reveal which emails have accounts.
  redirect("/forgot-password?sent=1");
}
