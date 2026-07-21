"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createUserInbox } from "@/lib/agentmail";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type CreateInboxResult =
  | { ok: true; email: string; alreadyExisted: boolean }
  | { ok: false; error: string };

// Provisions the AgentMail forwarding inbox on demand. Called from the
// dashboard when the user chooses to set up email forwarding, rather than
// automatically at signup. Exactly one inbox per user (enforced by a DB
// unique constraint as well as the check below).
export async function createInbox(): Promise<CreateInboxResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();

  // Idempotent: if an inbox already exists, report it rather than creating a second.
  const { data: existing } = await service
    .from("inboxes")
    .select("email_address")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    revalidatePath("/dashboard/settings");
    return { ok: true, email: existing.email_address, alreadyExisted: true };
  }

  try {
    const inbox = await createUserInbox(user.id);
    const { error } = await service.from("inboxes").insert({
      user_id: user.id,
      agentmail_inbox_id: inbox.inboxId,
      email_address: inbox.email,
    });
    if (error) {
      // Unique-constraint violation → an inbox was created concurrently.
      if (error.code === "23505") {
        const { data: row } = await service
          .from("inboxes")
          .select("email_address")
          .eq("user_id", user.id)
          .maybeSingle();
        revalidatePath("/dashboard/settings");
        return {
          ok: true,
          email: row?.email_address ?? inbox.email,
          alreadyExisted: true,
        };
      }
      throw new Error(error.message);
    }

    revalidatePath("/dashboard/settings");
    return { ok: true, email: inbox.email, alreadyExisted: false };
  } catch (err) {
    console.error("Failed to create inbox for user", user.id, err);
    const message =
      err instanceof Error && err.message.includes("permission denied")
        ? "Database permission error while saving the inbox. Ask an admin to apply the latest migrations."
        : "Could not create the forwarding address. Please try again.";
    return { ok: false, error: message };
  }
}
