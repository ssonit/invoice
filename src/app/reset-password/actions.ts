"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseResetPasswordForm } from "@/lib/validation/auth";

export async function updatePassword(formData: FormData) {
  const parsed = parseResetPasswordForm(formData);
  if (!parsed.success) {
    redirect(`/reset-password?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}
