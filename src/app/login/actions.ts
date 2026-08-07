"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseLoginForm } from "@/lib/validation/auth";
import { checkLoginRateLimit } from "@/lib/rate-limit";
import type { LoginFormState } from "./login-form-state";

export async function login(
  _prev: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = parseLoginForm(formData);
  if (!parsed.success) {
    return { error: parsed.error };
  }

  const rateLimitResult = await checkLoginRateLimit(parsed.data.email);
  if (rateLimitResult.limited) {
    return {
      error: "Too many attempts — please wait a few minutes and try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    console.error("Login failed", parsed.data.email, error);
    return { error: "Invalid email or password." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("deleted_at")
    .eq("id", user!.id)
    .maybeSingle();

  if (profile?.deleted_at) {
    await supabase.auth.signOut();
    return { error: "This account has been deleted." };
  }

  redirect("/dashboard");
}
