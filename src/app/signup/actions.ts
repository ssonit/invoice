"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseSignupForm } from "@/lib/validation/auth";
import { checkSignupRateLimit } from "@/lib/rate-limit";

export async function signup(formData: FormData) {
  const parsed = parseSignupForm(formData);
  if (!parsed.success) {
    redirect(`/signup?error=${encodeURIComponent(parsed.error)}`);
  }

  const rateLimitResult = await checkSignupRateLimit(parsed.data.email);
  if (rateLimitResult.limited) {
    redirect(
      `/signup?error=${encodeURIComponent("Too many attempts — please wait a while and try again.")}`,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.name },
    },
  });

  if (error) {
    // Never surface Supabase auth messages (e.g. "User already registered") —
    // that would enable account enumeration. forgot-password already uses the
    // same generic pattern.
    console.error("Signup failed", parsed.data.email, error);
    redirect(
      `/signup?error=${encodeURIComponent("Could not create your account. Please try again.")}`,
    );
  }

  if (!data.user) {
    console.error("Signup returned no user", parsed.data.email);
    redirect(
      `/signup?error=${encodeURIComponent("Could not create your account. Please try again.")}`,
    );
  }

  // The AgentMail forwarding inbox is provisioned on demand from the
  // dashboard, not at signup — see src/app/dashboard/actions.ts.
  if (data.session) {
    redirect("/dashboard");
  }

  redirect("/signup?check_email=1");
}
