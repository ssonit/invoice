import { createClient } from "@/lib/supabase/server"
import { ContentShell } from "@/components/dashboard/content-shell"
import { InvoicesTable } from "@/components/dashboard/invoices-table"
import { UploadInvoiceButton } from "../upload-invoice-button"
import { normalizeInvoice } from "@/lib/invoices"
import { buildInvoiceSearchPattern } from "@/lib/invoices/search"
import {
  INVOICE_LIST_PAGE_SIZE,
  parseInvoiceListQuery,
} from "@/lib/invoices/query"
import { pageCount, paginationRange } from "@/lib/pagination"
import { isEmailIntakeConfigured } from "@/lib/email-intake"
import { getDashboardDictionary } from "@/lib/dashboard/locale-server"

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; vendor?: string; status?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const query = parseInvoiceListQuery(await searchParams)
  const { from, to } = paginationRange(query.page, INVOICE_LIST_PAGE_SIZE)

  let dbQuery = supabase
    .from("invoices")
    .select("*", { count: "exact" })
    .eq("user_id", user!.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const searchPattern = buildInvoiceSearchPattern(query.vendor)
  if (searchPattern) {
    dbQuery = dbQuery.ilike("search_text", searchPattern)
  }
  if (query.status === "review") dbQuery = dbQuery.eq("needs_review", true)
  if (query.status === "ok") dbQuery = dbQuery.eq("needs_review", false)

  const { data, count } = await dbQuery.range(from, to)

  const invoices = (data ?? []).map(normalizeInvoice)
  const totalPages = pageCount(count ?? 0, INVOICE_LIST_PAGE_SIZE)
  const isEmailIntakeEnabled = isEmailIntakeConfigured(process.env)
  const { t } = await getDashboardDictionary()

  return (
    <ContentShell
      title={t.invoices.title}
      description={
        isEmailIntakeEnabled
          ? t.invoices.descriptionWithEmail
          : t.invoices.descriptionNoEmail
      }
      actions={<UploadInvoiceButton />}
    >
      <InvoicesTable
        data={invoices}
        query={query}
        totalCount={count ?? 0}
        pageCount={totalPages}
        isEmailIntakeEnabled={isEmailIntakeEnabled}
      />
    </ContentShell>
  )
}
