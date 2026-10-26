import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AutomationView } from "@/components/dashboard/automation/automation-view";
import { AUTOMATION_AGENTS } from "@/lib/automation/agents";
import { INBOX_SOURCE_FILTER } from "@/constants/inbox";
import { isEmailIntakeConfigured } from "@/lib/email-intake";

export default async function AutomationPage() {
  if (!isEmailIntakeConfigured(process.env)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: inbox }, { count, error: countError }] = await Promise.all([
    supabase
      .from("inboxes")
      .select("email_address")
      .eq("user_id", user!.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .is("deleted_at", null)
      .eq("source", INBOX_SOURCE_FILTER.EMAIL),
  ]);

  // A failed count must not break the page — the address and prompts are
  // still useful, so fall back to the "waiting" state.
  if (countError) {
    console.error("Failed to load automation status", user!.id, countError);
  }

  return (
    <AutomationView
      forwardAddress={inbox?.email_address ?? null}
      receivedCount={count ?? 0}
      agents={AUTOMATION_AGENTS}
    />
  );
}
