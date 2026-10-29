// Shared invoice row shape + aggregations for the dashboard overview.
// `amount` is coerced to a number in normalizeInvoice() because Postgres
// numeric columns can arrive as strings from PostgREST.

import { ZERO_DECIMAL_CURRENCIES } from "@/constants/currencies";
import {
  DEFAULT_INTL_LOCALE,
  FALLBACK_TIME_ZONE,
  dayKeyInTimeZone,
  formatCalendarDate,
  formatClockTime,
  formatFullDate,
  formatMonthDay,
  formatShortMonth,
  previousDayKeyInTimeZone,
} from "@/lib/dashboard/format-date";

export type InvoiceLineItem = {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
};

export type InvoiceRow = {
  id: string;
  vendor: string | null;
  invoice_number: string | null;
  amount: number | null;
  currency: string | null;
  issue_date: string | null;
  due_date: string | null;
  tax: number | null;
  line_items: InvoiceLineItem[];
  confidence_score: number | null;
  source: string;
  source_sender?: string | null; // email From address; null for uploads
  needs_review: boolean;
  file_url: string | null;
  created_at: string;
  approved_at?: string | null; // set by an explicit "Mark approved"
};

export type InvoiceInboxStatus = "review" | "extracted" | "approved";

/** Approval is an explicit human decision; model confidence never grants it. */
export function getInboxStatus(row: InvoiceRow): InvoiceInboxStatus {
  if (row.needs_review) return "review";
  if (row.approved_at) return "approved";
  return "extracted";
}

export function formatInvoiceMoney(
  amount: number | null,
  currency: string | null,
): string {
  if (amount == null) return "—";
  const digits = currency != null && ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
  const formatted = formatFixedNumber(amount, digits);
  if (currency === "USD") return formatted.startsWith("-") ? `-$${formatted.slice(1)}` : `$${formatted}`;
  return `${formatted} ${currency ?? ""}`.trim();
}

/** Locale-stable number formatting for SSR/client hydration. */
function formatFixedNumber(n: number, fractionDigits: number): string {
  const fixed = Math.abs(n).toFixed(fractionDigits);
  const [intPart, fracPart] = fixed.split(".");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = n < 0 ? "-" : "";
  return fracPart != null && fractionDigits > 0
    ? `${sign}${withCommas}.${fracPart}`
    : `${sign}${withCommas}`;
}

/** Format YYYY-MM-DD without timezone shifts. */
export function formatInvoiceDate(value: string | null, locale: string = DEFAULT_INTL_LOCALE): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return value;
  return formatCalendarDate({ year, month, day }, locale);
}

export type InboxLabelOptions = { locale?: string; timeZone?: string };

/**
 * Group label relative to a fixed `now` (pass the same ISO from the server).
 * "Today" / "Yesterday" are returned as English sentinels for the caller to
 * translate; other days are formatted in the viewer's locale and time zone.
 */
export function inboxGroupLabel(
  createdAt: string,
  nowIso: string,
  { locale = DEFAULT_INTL_LOCALE, timeZone = FALLBACK_TIME_ZONE }: InboxLabelOptions = {},
): string {
  const date = new Date(createdAt);
  const now = new Date(nowIso);
  const dayKey = dayKeyInTimeZone(date, timeZone);
  if (dayKey === dayKeyInTimeZone(now, timeZone)) return "Today";
  if (dayKey === previousDayKeyInTimeZone(now, timeZone)) return "Yesterday";
  return formatFullDate(date, locale, timeZone);
}

export function inboxTimeLabel(
  createdAt: string,
  nowIso: string,
  { locale = DEFAULT_INTL_LOCALE, timeZone = FALLBACK_TIME_ZONE }: InboxLabelOptions = {},
): string {
  const date = new Date(createdAt);
  const now = new Date(nowIso);
  const dayKey = dayKeyInTimeZone(date, timeZone);
  if (dayKey === dayKeyInTimeZone(now, timeZone)) return formatClockTime(date, locale, timeZone);
  if (dayKey === previousDayKeyInTimeZone(now, timeZone)) return "Yesterday";
  return formatMonthDay(date, locale, timeZone);
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeLineItems(value: unknown): InvoiceLineItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      description: String(row.description ?? ""),
      quantity: asNumber(row.quantity),
      unit_price: asNumber(row.unit_price),
      amount: asNumber(row.amount),
    };
  });
}

export function normalizeInvoice(row: Record<string, unknown>): InvoiceRow {
  return {
    id: String(row.id),
    vendor: (row.vendor as string) ?? null,
    invoice_number: (row.invoice_number as string) ?? null,
    amount: asNumber(row.amount),
    currency: (row.currency as string) ?? null,
    issue_date: (row.issue_date as string) ?? null,
    due_date: (row.due_date as string) ?? null,
    tax: asNumber(row.tax),
    line_items: normalizeLineItems(row.line_items),
    confidence_score: asNumber(row.confidence_score),
    source: String(row.source ?? "email"),
    source_sender: (row.source_sender as string) ?? null,
    needs_review: Boolean(row.needs_review),
    file_url: (row.file_url as string) ?? null,
    created_at: String(row.created_at),
    approved_at: (row.approved_at as string) ?? null,
  };
}

/**
 * Comparator for sorting invoices by amount without mixing currencies:
 * currency code first (no-currency last), then amount; missing amounts last.
 */
export function compareInvoiceAmounts(
  a: Pick<InvoiceRow, "amount" | "currency">,
  b: Pick<InvoiceRow, "amount" | "currency">,
): number {
  if (a.amount == null || b.amount == null) {
    return (a.amount == null ? 1 : 0) - (b.amount == null ? 1 : 0);
  }
  if (a.currency !== b.currency) {
    if (a.currency == null) return 1;
    if (b.currency == null) return -1;
    return a.currency < b.currency ? -1 : 1;
  }
  return a.amount - b.amount;
}

export type CurrencyTotal = {
  currency: string | null;
  total: number;
  count: number; // invoices with an amount in this currency
  average: number;
};

/**
 * Per-currency totals (no FX conversion), largest total first. Invoices without
 * an amount are skipped; a null currency is grouped under `currency: null`.
 */
export function sumByCurrency(rows: InvoiceRow[]): CurrencyTotal[] {
  const groups = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    if (row.amount == null) continue;
    const key = row.currency ?? "—";
    const group = groups.get(key) ?? { total: 0, count: 0 };
    group.total += row.amount;
    group.count++;
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      currency: key === "—" ? null : key,
      total: g.total,
      count: g.count,
      average: g.total / g.count,
    }))
    .sort((a, b) => b.total - a.total);
}

export type InvoiceStats = {
  total: number;
  needsReview: number;
  thisMonth: number;
  totalValue: number; // dominant currency only; see totalsByCurrency for all
  currency: string | null;
  multiCurrency: boolean;
  totalsByCurrency: CurrencyTotal[];
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
  let totalValue = -Infinity;
  for (const [cur, sum] of byCurrency) {
    if (sum > totalValue) {
      totalValue = sum;
      currency = cur === "—" ? null : cur;
    }
  }
  if (totalValue === -Infinity) totalValue = 0;

  return {
    total: rows.length,
    needsReview,
    thisMonth,
    totalValue,
    currency,
    multiCurrency: byCurrency.size > 1,
    totalsByCurrency: sumByCurrency(rows),
  };
}

export type TrendPoint = { month: string; count: number };

// Invoice counts for the last `months` calendar months, oldest first.
export function monthlyTrend(
  rows: InvoiceRow[],
  months = 6,
  locale: string = DEFAULT_INTL_LOCALE,
): TrendPoint[] {
  const buckets: TrendPoint[] = [];
  const index = new Map<string, number>();
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const label = formatShortMonth(d, locale);
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
