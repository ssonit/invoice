import { createClient } from "@/lib/supabase/server"
import { InboxView } from "@/components/dashboard/inbox/inbox-view"
import { normalizeInvoice } from "@/lib/invoices"
import { escapeIlike } from "@/lib/vendors/query"
import { parseInboxListQuery } from "@/lib/invoices/inbox-query"
import { INBOX_LIST_PAGE_SIZE } from "@/constants/inbox"
import { pageCount, paginationRange } from "@/lib/pagination"

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; source?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const query = parseInboxListQuery(await searchParams)
  const { from, to } = paginationRange(query.page, INBOX_LIST_PAGE_SIZE)

  let dbQuery = supabase
    .from("invoices")
    .select("*", { count: "exact" })
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  if (query.q) {
    const pattern = `%${escapeIlike(query.q).replace(/"/g, "")}%`
    dbQuery = dbQuery.or(
      `vendor.ilike."${pattern}",invoice_number.ilike."${pattern}",currency.ilike."${pattern}",source.ilike."${pattern}"`,
    )
  }

  if (query.source !== "all") {
    dbQuery = dbQuery.eq("source", query.source)
  }

  if (query.status === "review") {
    dbQuery = dbQuery.eq("needs_review", true)
  } else if (query.status === "approved") {
    dbQuery = dbQuery.eq("needs_review", false).gte("confidence_score", 0.9)
  } else if (query.status === "extracted") {
    dbQuery = dbQuery
      .eq("needs_review", false)
      .or("confidence_score.lt.0.9,confidence_score.is.null")
  }

  const [{ data, count }, { count: grandTotal }] = await Promise.all([
    dbQuery.range(from, to),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
  ])

  const invoices = (data ?? []).map(normalizeInvoice)
  const totalCount = count ?? 0
  const totalPages = pageCount(totalCount, INBOX_LIST_PAGE_SIZE)

  return (
    <InboxView
      invoices={invoices}
      nowIso={new Date().toISOString()}
      query={query}
      totalCount={totalCount}
      grandTotal={grandTotal ?? 0}
      pageCount={totalPages}
    />
  )
}
