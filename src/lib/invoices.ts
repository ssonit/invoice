// Shared invoice row shape + aggregations for the dashboard overview.
// `amount` is coerced to a number in normalizeInvoice() because Postgres
// numeric columns can arrive as strings from PostgREST.

import { ZERO_DECIMAL_CURRENCIES } from "@/constants/currencies";

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
  needs_review: boolean;
  file_url: string | null;
  created_at: string;
};

export type InvoiceInboxStatus = "review" | "extracted" | "approved";

/** Map extraction confidence + needs_review into inbox UI statuses. */
export function getInboxStatus(row: InvoiceRow): InvoiceInboxStatus {
  if (row.needs_review) return "review";
  if (row.confidence_score != null && row.confidence_score >= 0.9) {
    return "approved";
  }
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

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Format YYYY-MM-DD without timezone shifts. */
export function formatInvoiceDate(value: string | null): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return value;
  return `${MONTHS_SHORT[month - 1]} ${day}, ${year}`;
}

function utcDayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Group label relative to a fixed `now` (pass the same ISO from the server). */
export function inboxGroupLabel(createdAt: string, nowIso: string): string {
  const date = new Date(createdAt);
  const now = new Date(nowIso);
  const today = startOfUtcDay(now);
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);
  const day = startOfUtcDay(date);

  if (utcDayKey(day) === utcDayKey(today)) return "Today";
  if (utcDayKey(day) === utcDayKey(yesterday)) return "Yesterday";
  return `${MONTHS_SHORT[day.getUTCMonth()]} ${day.getUTCDate()}, ${day.getUTCFullYear()}`;
}

export function inboxTimeLabel(createdAt: string, nowIso: string): string {
  const date = new Date(createdAt);
  const now = new Date(nowIso);
  const today = startOfUtcDay(now);
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);
  const day = startOfUtcDay(date);

  if (utcDayKey(day) === utcDayKey(today)) {
    let hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${String(minutes).padStart(2, "0")} ${period}`;
  }
  if (utcDayKey(day) === utcDayKey(yesterday)) return "Yesterday";
  return `${MONTHS_SHORT[day.getUTCMonth()]} ${day.getUTCDate()}`;
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
    needs_review: Boolean(row.needs_review),
    file_url: (row.file_url as string) ?? null,
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
