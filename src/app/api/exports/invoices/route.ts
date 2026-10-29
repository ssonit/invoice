import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseExportQuery, rangeStartIso } from "@/lib/exports/query";
import { invoicesToCsv } from "@/lib/exports/csv";
import { normalizeInvoice, type InvoiceRow } from "@/lib/invoices";

const MAX_EXPORT_ROWS = 5_000;
const EXPORT_PAGE_SIZE = 500;

export async function GET(request: Request) {
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

  const now = new Date();
  const rows: InvoiceRow[] = [];
  while (rows.length <= MAX_EXPORT_ROWS) {
    let dbQuery = supabase
      .from("invoices")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (query.range !== "all") {
      const start = rangeStartIso(now, query.range);
      dbQuery = dbQuery.or(
        `issue_date.gte.${start.slice(0, 10)},and(issue_date.is.null,created_at.gte.${start})`,
      );
    }

    if (query.status === "review") {
      dbQuery = dbQuery.eq("needs_review", true);
    } else if (query.status === "ok") {
      dbQuery = dbQuery.eq("needs_review", false);
    }

    const { data, error } = await dbQuery.range(
      rows.length,
      Math.min(rows.length + EXPORT_PAGE_SIZE - 1, MAX_EXPORT_ROWS),
    );

    if (error) {
      console.error("Failed to fetch export invoices", user.id, error);
      return NextResponse.json(
        { error: "Could not fetch invoices. Please try again." },
        { status: 500 },
      );
    }

    if (!data?.length) break;
    rows.push(...data.map(normalizeInvoice));
  }

  const truncated = rows.length > MAX_EXPORT_ROWS;
  const csv = invoicesToCsv(rows.slice(0, MAX_EXPORT_ROWS), { truncated });

  const dateStr = now.toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="invoices-${dateStr}.csv"`,
      ...(truncated ? { "X-Export-Truncated": "true" } : {}),
    },
  });
}
