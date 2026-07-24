"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseLoginForm } from "@/lib/validation/auth";

export async function login(formData: FormData) {
  const parsed = parseLoginForm(formData);
  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent(parsed.error)}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
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
