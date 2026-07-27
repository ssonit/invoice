"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { parseForgotPasswordForm } from "@/lib/validation/auth";
import { checkForgotPasswordRateLimit } from "@/lib/rate-limit";

export async function requestPasswordReset(formData: FormData) {
  const parsed = parseForgotPasswordForm(formData);
  if (!parsed.success) {
    redirect(`/forgot-password?error=${encodeURIComponent(parsed.error)}`);
  }

  const rateLimitResult = await checkForgotPasswordRateLimit(parsed.data.email);
  if (rateLimitResult.limited) {
    // Same generic "sent" state as success — don't let a rate-limit response
    // distinguish "too many requests" from "email doesn't exist" and leak
    // account existence through timing/response differences.
    redirect("/forgot-password?sent=1");
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
