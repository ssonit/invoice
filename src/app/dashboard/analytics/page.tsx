import { ContentShell } from "@/components/dashboard/content-shell";
import { parseAnalyticsQuery } from "@/lib/analytics/query";
import { AnalyticsReportView } from "@/components/dashboard/analytics/analytics-report-view";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; currency?: string }>;
}) {
  const params = await searchParams;
  const query = parseAnalyticsQuery(params);

  // Numbers come from the analytics_aggregates RPC, loaded in the browser when
  // the report scrolls into view (see AnalyticsReportView).
  return (
    <ContentShell
      title="Analytics"
      description="Spend trends, vendor breakdowns, and invoice stats for your workspace."
    >
      <AnalyticsReportView query={query} requestedCurrency={params.currency} />
    </ContentShell>
  );
}
