"use client"

import { useMemo } from "react"
import { BarChart3 } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useInView } from "@/hooks/use-in-view"
import { useReportRpc } from "@/hooks/use-report-rpc"
import { parseAnalyticsAggregates, reportFromAggregates } from "@/lib/analytics/aggregates"
import { rangeStartIso, type AnalyticsQuery } from "@/lib/analytics/query"
import { AnalyticsToolbar } from "@/components/dashboard/analytics/analytics-toolbar"
import { AnalyticsStatCards } from "@/components/dashboard/analytics/analytics-stat-cards"
import { SpendTrendChart } from "@/components/dashboard/analytics/spend-trend-chart"
import { VendorBreakdown } from "@/components/dashboard/analytics/vendor-breakdown"
import { ChartSkeleton, ReportError, StatCardsSkeleton } from "@/components/dashboard/report-state"

const NO_CURRENCY_KEY = "—"
const DATE_ONLY_LENGTH = 10

/**
 * Loads the analytics report via the `analytics_aggregates` RPC once this block
 * scrolls into view (IntersectionObserver). The RPC result does not depend on
 * the selected currency, so switching currency only re-derives the report.
 */
export function AnalyticsReportView({
  query,
  requestedCurrency,
}: {
  query: AnalyticsQuery
  requestedCurrency?: string
}) {
  const { ref, isInView } = useInView<HTMLDivElement>()
  const startDate = rangeStartIso(new Date(), query.range).slice(0, DATE_ONLY_LENGTH)

  const result = useReportRpc({
    fn: "analytics_aggregates",
    args: { p_start: startDate },
    parse: parseAnalyticsAggregates,
    enabled: isInView,
  })

  const data = result.status === "ready" ? result.data : null
  const report = useMemo(
    () =>
      data ? reportFromAggregates(data, query.range, new Date(), requestedCurrency) : null,
    [data, query.range, requestedCurrency],
  )

  const currencyKeys = report
    ? report.totalsByCurrency.map((t) => t.currency ?? NO_CURRENCY_KEY)
    : []
  const activeCurrencyKey = report ? (report.currency ?? NO_CURRENCY_KEY) : NO_CURRENCY_KEY

  return (
    <div ref={ref} className="space-y-5">
      <AnalyticsToolbar query={query} currencies={currencyKeys} currency={activeCurrencyKey} />

      {result.status === "error" ? <ReportError onRetry={result.retry} /> : null}

      {result.status === "loading" ? (
        <>
          <StatCardsSkeleton />
          <ChartSkeleton />
          <ChartSkeleton />
        </>
      ) : null}

      {report && report.invoiceCount === 0 ? (
        <Empty className="rounded-[14px] border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BarChart3 />
            </EmptyMedia>
            <EmptyTitle>No invoices in this period</EmptyTitle>
            <EmptyDescription>
              Try a longer range or upload your first invoice to get started.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {report && report.invoiceCount > 0 ? (
        <>
          <AnalyticsStatCards report={report} />
          <SpendTrendChart data={report.monthlySpend} />
          <VendorBreakdown
            vendors={report.topVendors}
            total={report.totalSpend}
            currency={report.currency}
          />
        </>
      ) : null}
    </div>
  )
}
