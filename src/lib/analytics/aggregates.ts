// Shapes the `analytics_aggregates` RPC result (see
// supabase/migrations/20261027110000_report_rpc_functions.sql) into an
// AnalyticsReport. Postgres does the summing; this only picks the dominant
// currency, fills month buckets and folds the long vendor tail into "Other".

import { type CurrencyTotal } from "@/lib/invoices";
import {
  TOP_VENDOR_LIMIT,
  type AnalyticsReport,
  type SpendTrendPoint,
  type VendorSpendSlice,
} from "@/lib/analytics/report";

const NO_CURRENCY_KEY = "—";

export type AnalyticsAggregates = {
  invoiceCount: number;
  needsReview: number;
  byCurrency: { currency: string | null; total: number; count: number }[];
  byMonth: { month: string; currency: string | null; total: number }[]; // month = YYYY-MM
  byVendor: {
    vendorKey: string;
    label: string;
    currency: string | null;
    total: number;
    count: number;
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toCurrency(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** Validate the untyped RPC payload; returns null when it is malformed. */
export function parseAnalyticsAggregates(input: unknown): AnalyticsAggregates | null {
  if (!isRecord(input)) return null;
  const invoiceCount = toFiniteNumber(input.invoice_count);
  const needsReview = toFiniteNumber(input.needs_review);
  if (invoiceCount == null || needsReview == null) return null;
  if (
    !Array.isArray(input.by_currency) ||
    !Array.isArray(input.by_month) ||
    !Array.isArray(input.by_vendor)
  ) {
    return null;
  }

  const byCurrency: AnalyticsAggregates["byCurrency"] = [];
  for (const raw of input.by_currency) {
    if (!isRecord(raw)) return null;
    const total = toFiniteNumber(raw.total);
    const count = toFiniteNumber(raw.count);
    if (total == null || count == null) return null;
    byCurrency.push({ currency: toCurrency(raw.currency), total, count });
  }

  const byMonth: AnalyticsAggregates["byMonth"] = [];
  for (const raw of input.by_month) {
    if (!isRecord(raw)) return null;
    const total = toFiniteNumber(raw.total);
    if (total == null || typeof raw.month !== "string") return null;
    byMonth.push({ month: raw.month, currency: toCurrency(raw.currency), total });
  }

  const byVendor: AnalyticsAggregates["byVendor"] = [];
  for (const raw of input.by_vendor) {
    if (!isRecord(raw)) return null;
    const total = toFiniteNumber(raw.total);
    const count = toFiniteNumber(raw.count);
    if (total == null || count == null || typeof raw.vendor_key !== "string") {
      return null;
    }
    byVendor.push({
      vendorKey: raw.vendor_key,
      label: typeof raw.label === "string" ? raw.label.trim() : raw.vendor_key,
      currency: toCurrency(raw.currency),
      total,
      count,
    });
  }

  return { invoiceCount, needsReview, byCurrency, byMonth, byVendor };
}

function currencyKey(currency: string | null): string {
  return currency ?? NO_CURRENCY_KEY;
}

function monthBucketKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

export function reportFromAggregates(
  aggregates: AnalyticsAggregates,
  months: number,
  now: Date = new Date(),
  selectedCurrency?: string,
): AnalyticsReport {
  const totalsByCurrency: CurrencyTotal[] = aggregates.byCurrency
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      currency: entry.currency,
      total: entry.total,
      count: entry.count,
      average: entry.total / entry.count,
    }))
    .sort((a, b) => b.total - a.total);

  // Requested currency if present, otherwise the largest-sum one.
  const selectedEntry =
    selectedCurrency != null
      ? totalsByCurrency.find((t) => currencyKey(t.currency) === selectedCurrency)
      : undefined;
  const chosen = selectedEntry ?? totalsByCurrency[0];
  const currency = chosen?.currency ?? null;
  const dominantKey = currencyKey(currency);

  const monthlySpend: SpendTrendPoint[] = [];
  if (aggregates.invoiceCount > 0) {
    const spendByMonth = new Map<string, number>();
    for (const entry of aggregates.byMonth) {
      if (currencyKey(entry.currency) !== dominantKey) continue;
      spendByMonth.set(entry.month, (spendByMonth.get(entry.month) ?? 0) + entry.total);
    }
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      monthlySpend.push({
        month: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
        amount: spendByMonth.get(monthBucketKey(d)) ?? 0,
      });
    }
  }

  const vendors = aggregates.byVendor
    .filter((entry) => currencyKey(entry.currency) === dominantKey)
    .sort((a, b) => b.total - a.total);

  const topVendors: VendorSpendSlice[] = vendors
    .slice(0, TOP_VENDOR_LIMIT)
    .map((entry, i) => ({
      key: `vendor-${i}`,
      label: entry.label,
      amount: entry.total,
      count: entry.count,
    }));

  if (vendors.length > TOP_VENDOR_LIMIT) {
    const rest = vendors.slice(TOP_VENDOR_LIMIT);
    topVendors.push({
      key: "other",
      label: "Other",
      amount: rest.reduce((sum, v) => sum + v.total, 0),
      count: rest.reduce((sum, v) => sum + v.count, 0),
    });
  }

  return {
    currency,
    multiCurrency: totalsByCurrency.length > 1,
    invoiceCount: aggregates.invoiceCount,
    needsReview: aggregates.needsReview,
    totalSpend: chosen?.total ?? 0,
    totalsByCurrency,
    monthlySpend,
    topVendors,
  };
}
