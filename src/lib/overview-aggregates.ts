// Shapes the `overview_aggregates` RPC result (see
// supabase/migrations/20261027110000_report_rpc_functions.sql) into the
// InvoiceStats / TrendPoint structures the Overview cards render.

import type { CurrencyTotal, InvoiceStats, TrendPoint } from "@/lib/invoices";
import { DEFAULT_INTL_LOCALE, formatShortMonth } from "@/lib/dashboard/format-date";

export const OVERVIEW_TREND_MONTHS = 6;

export type OverviewAggregates = {
  total: number;
  needsReview: number;
  thisMonth: number;
  byCurrency: { currency: string | null; total: number; count: number }[];
  byMonth: { month: string; count: number }[]; // month = YYYY-MM (UTC created_at)
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Validate the untyped RPC payload; returns null when it is malformed. */
export function parseOverviewAggregates(input: unknown): OverviewAggregates | null {
  if (!isRecord(input)) return null;
  const total = toFiniteNumber(input.total);
  const needsReview = toFiniteNumber(input.needs_review);
  const thisMonth = toFiniteNumber(input.this_month);
  if (total == null || needsReview == null || thisMonth == null) return null;
  if (!Array.isArray(input.by_currency) || !Array.isArray(input.by_month)) return null;

  const byCurrency: OverviewAggregates["byCurrency"] = [];
  for (const raw of input.by_currency) {
    if (!isRecord(raw)) return null;
    const sum = toFiniteNumber(raw.total);
    const count = toFiniteNumber(raw.count);
    if (sum == null || count == null) return null;
    byCurrency.push({
      currency: typeof raw.currency === "string" && raw.currency !== "" ? raw.currency : null,
      total: sum,
      count,
    });
  }

  const byMonth: OverviewAggregates["byMonth"] = [];
  for (const raw of input.by_month) {
    if (!isRecord(raw)) return null;
    const count = toFiniteNumber(raw.count);
    if (count == null || typeof raw.month !== "string") return null;
    byMonth.push({ month: raw.month, count });
  }

  return { total, needsReview, thisMonth, byCurrency, byMonth };
}

export function statsFromOverviewAggregates(aggregates: OverviewAggregates): InvoiceStats {
  const totalsByCurrency: CurrencyTotal[] = aggregates.byCurrency
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      currency: entry.currency,
      total: entry.total,
      count: entry.count,
      average: entry.total / entry.count,
    }))
    .sort((a, b) => b.total - a.total);

  const dominant = totalsByCurrency[0];
  return {
    total: aggregates.total,
    needsReview: aggregates.needsReview,
    thisMonth: aggregates.thisMonth,
    totalValue: dominant?.total ?? 0,
    currency: dominant?.currency ?? null,
    multiCurrency: totalsByCurrency.length > 1,
    totalsByCurrency,
  };
}

/** First-of-month UTC `months - 1` months before `now` (start of the trend window). */
export function overviewTrendStart(now: Date, months = OVERVIEW_TREND_MONTHS): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
}

/** Invoice counts for the last `months` calendar months, oldest first. */
export function trendFromOverviewAggregates(
  aggregates: OverviewAggregates,
  now: Date = new Date(),
  months = OVERVIEW_TREND_MONTHS,
  locale: string = DEFAULT_INTL_LOCALE,
): TrendPoint[] {
  const countByMonth = new Map(aggregates.byMonth.map((m) => [m.month, m.count]));
  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    points.push({
      month: formatShortMonth(d, locale),
      count: countByMonth.get(key) ?? 0,
    });
  }
  return points;
}
