"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseSignupForm } from "@/lib/validation/auth";

export async function signup(formData: FormData) {
  const parsed = parseSignupForm(formData);
  if (!parsed.success) {
    redirect(`/signup?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (!data.user) {
    redirect("/signup?error=Signup%20failed");
  }

  // The AgentMail forwarding inbox is provisioned on demand from the
  // dashboard, not at signup — see src/app/dashboard/actions.ts.
  if (data.session) {
    redirect("/dashboard");
  }

  redirect("/signup?check_email=1");
}
