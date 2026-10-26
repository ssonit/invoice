import { createClient } from "@/lib/supabase/server";
import { ContentShell } from "@/components/dashboard/content-shell";
import {
  parseExportQuery,
  rangeStartIso,
} from "@/lib/exports/query";
import { ExportsPanel } from "@/components/dashboard/exports/exports-panel";

const DATE_ONLY_LENGTH = 10;

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; status?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const query = parseExportQuery(await searchParams);

  // Count matching invoices in Postgres (export_invoice_count RPC) instead of
  // fetching every row; same effective-date rule as Analytics.
  const startDate =
    query.range === "all"
      ? null
      : rangeStartIso(new Date(), query.range).slice(0, DATE_ONLY_LENGTH);

  const { data, error } = await supabase.rpc("export_invoice_count", {
    p_start: startDate,
    p_status: query.status,
  });
  if (error) console.error("Failed to count exportable invoices", user!.id, error);

  const count = Number(data ?? 0);

  return (
    <ContentShell
      title="Exports"
      description="Download invoices as CSV for spreadsheets or bookkeeping."
    >
      <ExportsPanel query={query} count={count} />
    </ContentShell>
  );
}
