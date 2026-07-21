import { createClient } from "@/lib/supabase/server"
import { ContentShell } from "@/components/dashboard/content-shell"
import { InvoicesTable } from "@/components/dashboard/invoices-table"
import { UploadInvoiceButton } from "../upload-invoice-button"
import { normalizeInvoice } from "@/lib/invoices"

export default async function InvoicesPage() {
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

  return (
    <ContentShell
      title="Invoices"
      description="Every invoice extracted from your forwarded email and manual uploads."
      actions={<UploadInvoiceButton />}
    >
      <InvoicesTable data={invoices} />
    </ContentShell>
  )
}
