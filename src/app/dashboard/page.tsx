import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { ContentShell } from "@/components/dashboard/content-shell"
import { StatCards } from "@/components/dashboard/stat-cards"
import { InvoicesTrendChart } from "@/components/dashboard/invoices-trend-chart"
import { computeStats, monthlyTrend, normalizeInvoice } from "@/lib/invoices"

export default async function DashboardOverviewPage() {
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
  const stats = computeStats(invoices)
  const trend = monthlyTrend(invoices)
  const recent = invoices.slice(0, 5)

  return (
    <ContentShell
      title="Overview"
      description="Snapshot of your invoice inbox — open Invoices for the full list."
      actions={
        <Link
          href="/dashboard/invoices"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#E8FF47] px-4 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-[#E8FF47]/90"
        >
          View all invoices
          <ArrowRight className="size-4" />
        </Link>
      }
    >
      <div className="flex flex-col gap-5">
        <StatCards stats={stats} />
        <InvoicesTrendChart data={trend} />

        <section className="rounded-xl border border-border bg-card/40">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Recent invoices</h2>
              <p className="text-xs text-muted-foreground">
                Latest {recent.length} of {invoices.length} total
              </p>
            </div>
            <Link
              href="/dashboard/invoices"
              className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              See all
            </Link>
          </div>

          {recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No invoices yet. Upload one from the Invoices page.
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
                      {invoice.vendor ?? "Unknown vendor"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {invoice.invoice_number
                        ? `#${invoice.invoice_number}`
                        : "No number"}
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
