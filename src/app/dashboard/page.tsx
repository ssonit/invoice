import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { ContentShell } from "@/components/dashboard/content-shell"
import { OverviewReportView } from "@/components/dashboard/overview-report-view"
import { normalizeInvoice } from "@/lib/invoices"
import { getDashboardDictionary } from "@/lib/dashboard/locale-server"
import { GettingStarted } from "@/components/dashboard/getting-started"
import { isEmailIntakeConfigured } from "@/lib/email-intake"

const RECENT_INVOICES_LIMIT = 5

export default async function DashboardOverviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Stats and trend come from the overview_aggregates RPC (client-side, lazy);
  // the server only fetches the few rows the "Recent" list shows.
  const { data, count } = await supabase
    .from("invoices")
    .select("*", { count: "exact" })
    .eq("user_id", user!.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(RECENT_INVOICES_LIMIT)

  const recent = (data ?? []).map(normalizeInvoice)
  const totalCount = count ?? recent.length
  const { t } = await getDashboardDictionary()

  return (
    <ContentShell
      title={t.overview.title}
      description={t.overview.description}
      actions={
        <Link
          href="/dashboard/invoices"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#E8FF47] px-4 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-[#E8FF47]/90"
        >
          {t.overview.viewAll}
          <ArrowRight className="size-4" />
        </Link>
      }
    >
      <div className="flex flex-col gap-5">
        {totalCount === 0 ? <GettingStarted t={t} emailEnabled={isEmailIntakeConfigured(process.env)} /> : null}
        <OverviewReportView />

        <section className="rounded-xl border border-border bg-card/40">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">{t.overview.recentTitle}</h2>
              <p className="text-xs text-muted-foreground">
                {t.overview.latestOf
                  .replace("{shown}", String(recent.length))
                  .replace("{total}", String(totalCount))}
              </p>
            </div>
            <Link
              href="/dashboard/invoices"
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t.overview.seeAll}
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t.overview.empty}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {invoice.vendor ?? t.overview.unknownVendor}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {invoice.invoice_number
                        ? `#${invoice.invoice_number}`
                        : t.overview.noNumber}
                      {invoice.issue_date ? ` · ${invoice.issue_date}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {invoice.amount != null
                      ? `${invoice.currency ?? ""} ${invoice.amount.toLocaleString()}`.trim()
                      : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ContentShell>
  )
}
