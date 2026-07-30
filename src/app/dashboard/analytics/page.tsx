import { BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTeamAccess } from "@/lib/billing/access";
import { ContentShell } from "@/components/dashboard/content-shell";
import { TeamGate } from "@/components/dashboard/team-gate";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { normalizeInvoice } from "@/lib/invoices";
import { parseAnalyticsQuery, rangeStartIso } from "@/lib/analytics/query";
import { buildAnalyticsReport, effectiveInvoiceDate } from "@/lib/analytics/report";
import { AnalyticsToolbar } from "@/components/dashboard/analytics/analytics-toolbar";
import { AnalyticsStatCards } from "@/components/dashboard/analytics/analytics-stat-cards";
import { SpendTrendChart } from "@/components/dashboard/analytics/spend-trend-chart";
import { VendorBreakdown } from "@/components/dashboard/analytics/vendor-breakdown";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const access = await getTeamAccess();
  if (!access.allowed) {
    return (
      <TeamGate
        title="Analytics"
        description="Spend trends, vendor breakdowns, and invoice stats for your workspace."
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const query = parseAnalyticsQuery(await searchParams);
  const start = rangeStartIso(new Date(), query.range);

  // Fetch invoices whose issue_date OR created_at falls within the window.
  // Rows with null issue_date still match via the created_at clause.
  const { data } = await supabase
    .from("invoices")
    .select("id, vendor, amount, currency, issue_date, created_at, needs_review")
    .eq("user_id", user!.id)
    .or(`issue_date.gte.${start},created_at.gte.${start}`)
    .order("created_at", { ascending: false });

  const allRows = (data ?? []).map(normalizeInvoice);

  // Filter: keep only rows whose effective date is within the window
  const startDate = new Date(start);
  const inRange = allRows.filter(
    (row) => effectiveInvoiceDate(row) >= startDate,
  );

  const report = buildAnalyticsReport(inRange, query.range);

  const isEmpty = report.invoiceCount === 0;

  return (
    <ContentShell
      title="Analytics"
      description="Spend trends, vendor breakdowns, and invoice stats for your workspace."
    >
      <div className="space-y-5">
        <AnalyticsToolbar query={query} />

        {isEmpty ? (
          <Empty className="rounded-[14px] border border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BarChart3 />
              </EmptyMedia>
              <EmptyTitle>No invoices in this period</EmptyTitle>
              <EmptyDescription>
                Try a longer range or forward your first invoice to get started.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <AnalyticsStatCards report={report} />
            <SpendTrendChart data={report.monthlySpend} />
            <VendorBreakdown
              vendors={report.topVendors}
              total={report.totalSpend}
              currency={report.currency}
            />
          </>
        )}
      </div>
    </ContentShell>
  );
}
