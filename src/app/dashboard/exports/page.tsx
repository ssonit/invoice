import { createClient } from "@/lib/supabase/server";
import { getTeamAccess } from "@/lib/billing/access";
import { ContentShell } from "@/components/dashboard/content-shell";
import { TeamGate } from "@/components/dashboard/team-gate";
import { normalizeInvoice } from "@/lib/invoices";
import { effectiveInvoiceDate } from "@/lib/analytics/report";
import {
  parseExportQuery,
  rangeStartIso,
  type ExportQuery,
} from "@/lib/exports/query";
import { ExportsPanel } from "@/components/dashboard/exports/exports-panel";

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; status?: string }>;
}) {
  const access = await getTeamAccess();
  if (!access.allowed) {
    return (
      <TeamGate
        title="Exports"
        description="Download invoices as CSV for spreadsheets or bookkeeping."
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const query = parseExportQuery(await searchParams);

  // Count matching invoices using the same filter logic as the API route.
  // Select minimal columns needed for effective-date post-filtering.
  let dbQuery = supabase
    .from("invoices")
    .select("issue_date, created_at, needs_review")
    .eq("user_id", user!.id);

  if (query.range !== "all") {
    const start = rangeStartIso(new Date(), query.range);
    dbQuery = dbQuery.or(`issue_date.gte.${start},created_at.gte.${start}`);
  }

  if (query.status === "review") {
    dbQuery = dbQuery.eq("needs_review", true);
  } else if (query.status === "ok") {
    dbQuery = dbQuery.eq("needs_review", false);
  }

  const { data } = await dbQuery;

  const allRows = (data ?? []).map((r) =>
    normalizeInvoice(r as Record<string, unknown>),
  );

  // Post-filter by effective date when range is set (same as Analytics)
  let matchingRows = allRows;
  if (query.range !== "all") {
    const startDate = new Date(rangeStartIso(new Date(), query.range));
    matchingRows = allRows.filter(
      (row) => effectiveInvoiceDate(row) >= startDate,
    );
  }

  const count = matchingRows.length;

  return (
    <ContentShell
      title="Exports"
      description="Download invoices as CSV for spreadsheets or bookkeeping."
    >
      <ExportsPanel query={query} count={count} />
    </ContentShell>
  );
}
