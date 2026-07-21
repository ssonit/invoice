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

  redirect("/dashboard");
}
