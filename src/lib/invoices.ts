// Shared invoice row shape + aggregations for the dashboard overview.
// `amount` is coerced to a number in normalizeInvoice() because Postgres
// numeric columns can arrive as strings from PostgREST.

export type InvoiceRow = {
  id: string;
  vendor: string | null;
  invoice_number: string | null;
  amount: number | null;
  currency: string | null;
  issue_date: string | null;
  source: string;
  needs_review: boolean;
  created_at: string;
};

export function normalizeInvoice(row: Record<string, unknown>): InvoiceRow {
  const rawAmount = row.amount;
  const amount =
    rawAmount == null || rawAmount === ""
      ? null
      : Number(rawAmount);

  return {
    id: String(row.id),
    vendor: (row.vendor as string) ?? null,
    invoice_number: (row.invoice_number as string) ?? null,
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    currency: (row.currency as string) ?? null,
    issue_date: (row.issue_date as string) ?? null,
    source: String(row.source ?? "email"),
    needs_review: Boolean(row.needs_review),
    created_at: String(row.created_at),
  };
}

export type InvoiceStats = {
  total: number;
  needsReview: number;
  thisMonth: number;
  totalValue: number;
  currency: string | null;
  multiCurrency: boolean;
};

export function computeStats(rows: InvoiceRow[]): InvoiceStats {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();

  let thisMonth = 0;
  let needsReview = 0;
  const byCurrency = new Map<string, number>();

  for (const row of rows) {
    if (row.needs_review) needsReview++;

    const created = new Date(row.created_at);
    if (created.getUTCFullYear() === y && created.getUTCMonth() === m) {
      thisMonth++;
    }

    if (row.amount != null) {
      const cur = row.currency ?? "—";
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + row.amount);
    }
  }

  // Report the total for the currency with the largest summed value.
  let currency: string | null = null;
  let totalValue = 0;
  for (const [cur, sum] of byCurrency) {
    if (sum > totalValue) {
      totalValue = sum;
      currency = cur === "—" ? null : cur;
    }
  }

  return {
    total: rows.length,
    needsReview,
    thisMonth,
    totalValue,
    currency,
    multiCurrency: byCurrency.size > 1,
  };
}

export type TrendPoint = { month: string; count: number };

// Invoice counts for the last `months` calendar months, oldest first.
export function monthlyTrend(rows: InvoiceRow[], months = 6): TrendPoint[] {
  const buckets: TrendPoint[] = [];
  const index = new Map<string, number>();
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const label = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    index.set(key, buckets.length);
    buckets.push({ month: label, count: 0 });
  }

  for (const row of rows) {
    const d = new Date(row.created_at);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const at = index.get(key);
    if (at != null) buckets[at].count++;
  }

  return buckets;
}
