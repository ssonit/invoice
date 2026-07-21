import { createClient } from "@/lib/supabase/server"
import { InboxView } from "@/components/dashboard/inbox/inbox-view"
import { normalizeInvoice } from "@/lib/invoices"

export default async function InboxPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  const invoices = (data ?? []).map(normalizeInvoice)

  return <InboxView invoices={invoices} nowIso={new Date().toISOString()} />
}
