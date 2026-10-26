"use client"

import { useMemo } from "react"
import { useInView } from "@/hooks/use-in-view"
import { useReportRpc } from "@/hooks/use-report-rpc"
import {
  overviewTrendStart,
  parseOverviewAggregates,
  statsFromOverviewAggregates,
  trendFromOverviewAggregates,
} from "@/lib/overview-aggregates"
import { StatCards } from "@/components/dashboard/stat-cards"
import { InvoicesTrendChart } from "@/components/dashboard/invoices-trend-chart"
import { ChartSkeleton, ReportError, StatCardsSkeleton } from "@/components/dashboard/report-state"

/**
 * Overview stat cards + trend chart, fed by the `overview_aggregates` RPC once
 * this block scrolls into view (IntersectionObserver).
 */
export function OverviewReportView() {
  const { ref, isInView } = useInView<HTMLDivElement>()

  // Computed once per mount so the RPC args stay stable across re-renders.
  const args = useMemo(() => {
    const now = new Date()
    return {
      p_month_start: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      ).toISOString(),
      p_trend_start: overviewTrendStart(now).toISOString(),
    }
  }, [])

  const result = useReportRpc({
    fn: "overview_aggregates",
    args,
    parse: parseOverviewAggregates,
    enabled: isInView,
  })

  const data = result.status === "ready" ? result.data : null
  const stats = useMemo(() => (data ? statsFromOverviewAggregates(data) : null), [data])
  const trend = useMemo(() => (data ? trendFromOverviewAggregates(data) : null), [data])

  return (
    <div ref={ref} className="flex flex-col gap-5">
      {result.status === "loading" ? (
        <>
          <StatCardsSkeleton />
          <ChartSkeleton />
        </>
      ) : null}
      {result.status === "error" ? <ReportError onRetry={result.retry} /> : null}
      {stats && trend ? (
        <>
          <StatCards stats={stats} />
          <InvoicesTrendChart data={trend} />
        </>
      ) : null}
    </div>
  )
}
