"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseLoginForm } from "@/lib/validation/auth";
import { checkLoginRateLimit } from "@/lib/rate-limit";

export async function login(formData: FormData) {
  const parsed = parseLoginForm(formData);
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent(parsed.error)}`);
  }

  const rateLimitResult = await checkLoginRateLimit(parsed.data.email);
  if (rateLimitResult.limited) {
    redirect(
      `/login?error=${encodeURIComponent("Too many attempts — please wait a few minutes and try again.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    console.error("Login failed", parsed.data.email, error);
    redirect(
      `/login?error=${encodeURIComponent("Invalid email or password.")}`,
    );
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
    redirect(`/login?error=${encodeURIComponent("This account has been deleted.")}`);
  }

  redirect("/dashboard");
}
