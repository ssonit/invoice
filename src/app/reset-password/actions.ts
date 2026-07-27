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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    console.error("Password reset update failed", user?.id, error);
    redirect(
      `/reset-password?error=${encodeURIComponent("Could not update your password. Please try again.")}`,
    );
  }

  redirect("/dashboard");
}
