import type { InvoiceRow } from "@/lib/invoices";

export type SpendTrendPoint = { month: string; amount: number };
export type VendorSpendSlice = {
  key: string;
  label: string;
  amount: number;
  count: number;
};
export type AnalyticsReport = {
  currency: string | null;
  multiCurrency: boolean;
  invoiceCount: number;
  needsReview: number;
  totalSpend: number; // dominant currency only
  monthlySpend: SpendTrendPoint[]; // `months` buckets, oldest first
  topVendors: VendorSpendSlice[]; // top 8 by amount + optional "Other"
};

const TOP_VENDOR_LIMIT = 8;

/** Effective date for spend attribution: issue_date if present, else created_at date (UTC). */
export function effectiveInvoiceDate(row: InvoiceRow): Date {
  if (row.issue_date) {
    return new Date(row.issue_date + "T00:00:00.000Z");
  }
  // Use UTC date from created_at (strip time)
  const d = new Date(row.created_at);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

export function buildAnalyticsReport(
  rows: InvoiceRow[],
  months: number,
  now: Date = new Date(),
): AnalyticsReport {
  // ---- Pass 1: per-currency sums (dominance) + counts ----
  const byCurrency = new Map<string, number>();
  let needsReview = 0;

  for (const row of rows) {
    if (row.needs_review) needsReview++;
    if (row.amount != null) {
      const cur = row.currency ?? "—";
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + row.amount);
    }
  }

  // Determine dominant currency
  let currency: string | null = null;
  let maxSum = -Infinity;
  for (const [cur, sum] of byCurrency) {
    if (sum > maxSum) {
      maxSum = sum;
      currency = cur === "—" ? null : cur;
    }
  }
  if (maxSum === -Infinity) maxSum = 0;

  const dominantKey = currency ?? "—";

  // ---- Pass 2: monthly spend buckets (oldest first) ----
  const buckets: SpendTrendPoint[] = [];
  const bucketIndex = new Map<string, number>();

  if (rows.length > 0) {
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const key = monthKey(d);
      bucketIndex.set(key, buckets.length);
      buckets.push({ month: monthLabel(d), amount: 0 });
    }
  }

  // ---- Pass 3: vendor aggregation (dominant currency only) + monthly spend ----
  const vendorMap = new Map<
    string,
    { label: string; amount: number; count: number }
  >();

  for (const row of rows) {
    const effDate = effectiveInvoiceDate(row);
    const key = monthKey(effDate);
    const bucketAt = bucketIndex.get(key);

    const cur = row.currency ?? "—";
    const isDominant = cur === dominantKey;

    if (isDominant && bucketAt != null && row.amount != null) {
      buckets[bucketAt].amount += row.amount;
    }

    // Vendor breakdown — dominant currency only, vendor must exist
    if (isDominant && row.vendor && row.amount != null) {
      const vkey = row.vendor.toLowerCase().trim();
      const existing = vendorMap.get(vkey);
      if (existing) {
        existing.amount += row.amount;
        existing.count++;
      } else {
        vendorMap.set(vkey, {
          label: row.vendor.trim(),
          amount: row.amount,
          count: 1,
        });
      }
    }
  }

  // ---- Pass 4: top vendors + Other ----
  const sorted = [...vendorMap.values()].sort((a, b) => b.amount - a.amount);
  const topVendors: VendorSpendSlice[] = [];

  for (let i = 0; i < Math.min(sorted.length, TOP_VENDOR_LIMIT); i++) {
    const v = sorted[i];
    topVendors.push({
      key: `vendor-${i}`,
      label: v.label,
      amount: v.amount,
      count: v.count,
    });
  }

  if (sorted.length > TOP_VENDOR_LIMIT) {
    const rest = sorted.slice(TOP_VENDOR_LIMIT);
    topVendors.push({
      key: "other",
      label: "Other",
      amount: rest.reduce((sum, v) => sum + v.amount, 0),
      count: rest.reduce((sum, v) => sum + v.count, 0),
    });
  }

  return {
    currency,
    multiCurrency: byCurrency.size > 1,
    invoiceCount: rows.length,
    needsReview,
    totalSpend: maxSum,
    monthlySpend: buckets,
    topVendors,
  };
}
