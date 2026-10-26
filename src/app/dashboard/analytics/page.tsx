import { ContentShell } from "@/components/dashboard/content-shell";
import { parseAnalyticsQuery } from "@/lib/analytics/query";
import { AnalyticsReportView } from "@/components/dashboard/analytics/analytics-report-view";
import { getDashboardDictionary } from "@/lib/dashboard/locale-server";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; currency?: string }>;
}) {
  const params = await searchParams;
  const query = parseAnalyticsQuery(params);
  const { t } = await getDashboardDictionary();

  // Numbers come from the analytics_aggregates RPC, loaded in the browser when
  // the report scrolls into view (see AnalyticsReportView).
  return (
    <ContentShell
      title={t.analytics.title}
      description={t.analytics.description}
    >
      <AnalyticsReportView query={query} requestedCurrency={params.currency} />
    </ContentShell>
  );
}
