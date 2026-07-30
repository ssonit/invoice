import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTeamAccess } from "@/lib/billing/access";
import { parseExportQuery, rangeStartIso } from "@/lib/exports/query";
import { invoicesToCsv } from "@/lib/exports/csv";
import { normalizeInvoice } from "@/lib/invoices";
import { effectiveInvoiceDate } from "@/lib/analytics/report";

const MAX_EXPORT_ROWS = 5_000;

export async function GET(request: Request) {
  const access = await getTeamAccess();
  if (!access.allowed) {
    return NextResponse.json(
      { error: "Team plan required for CSV exports." },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = parseExportQuery({
    range: searchParams.get("range") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  let dbQuery = supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(MAX_EXPORT_ROWS);

  // Apply date window unless range is "all"
  if (query.range !== "all") {
    const start = rangeStartIso(new Date(), query.range);
    dbQuery = dbQuery.or(`issue_date.gte.${start},created_at.gte.${start}`);
  }

  // Apply status filter
  if (query.status === "review") {
    dbQuery = dbQuery.eq("needs_review", true);
  } else if (query.status === "ok") {
    dbQuery = dbQuery.eq("needs_review", false);
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error("Failed to fetch export invoices", user.id, error);
    return NextResponse.json(
      { error: "Could not fetch invoices. Please try again." },
      { status: 500 },
    );
  }

  const allRows = (data ?? []).map(normalizeInvoice);

  // Post-filter by effective date when range is set (same as Analytics)
  let rows = allRows;
  if (query.range !== "all") {
    const startDate = new Date(rangeStartIso(new Date(), query.range));
    rows = allRows.filter((row) => effectiveInvoiceDate(row) >= startDate);
  }

  const csv = invoicesToCsv(rows);

  const dateStr = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${dateStr}.csv"`,
    },
  });
}
