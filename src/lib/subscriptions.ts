import type { InvoiceRow } from "./invoices";

export type SubscriptionCycle = "monthly" | "yearly";

export type SubscriptionCandidate = {
  vendorKey: string;
  vendorLabel: string;
  cycle: SubscriptionCycle;
  invoiceCount: number;
  lastAmount: number | null;
  currency: string | null;
  lastIssueDate: string;
  nextExpectedDate: string;
};

const CYCLE_DAYS: Record<SubscriptionCycle, number> = {
  monthly: 30,
  yearly: 365,
};

const MONTHLY_GAP_RANGE: [number, number] = [25, 35];
const YEARLY_GAP_RANGE: [number, number] = [350, 380];

export function normalizeVendorKey(vendor: string): string {
  return vendor.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseIsoDate(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m - 1, d];
}

function toUtcDate(iso: string): Date {
  const [y, m, d] = parseIsoDate(iso);
  return new Date(Date.UTC(y, m, d));
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((toUtcDate(b).getTime() - toUtcDate(a).getTime()) / msPerDay);
}

export function addDays(iso: string, days: number): string {
  const date = toUtcDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function detectSubscriptions(invoices: InvoiceRow[]): SubscriptionCandidate[] {
  const groups = new Map<string, InvoiceRow[]>();

  for (const invoice of invoices) {
    if (!invoice.vendor || !invoice.issue_date) continue;
    const key = normalizeVendorKey(invoice.vendor);
    const group = groups.get(key) ?? [];
    group.push(invoice);
    groups.set(key, group);
  }

  const candidates: SubscriptionCandidate[] = [];

  for (const [vendorKey, group] of groups) {
    if (group.length < 2) continue;

    const sorted = [...group].sort((a, b) =>
      a.issue_date! < b.issue_date! ? -1 : a.issue_date! > b.issue_date! ? 1 : 0,
    );

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].issue_date!, sorted[i].issue_date!));
    }

    const gapMedian = median(gaps);
    let cycle: SubscriptionCycle | null = null;
    if (gapMedian >= MONTHLY_GAP_RANGE[0] && gapMedian <= MONTHLY_GAP_RANGE[1]) {
      cycle = "monthly";
    } else if (gapMedian >= YEARLY_GAP_RANGE[0] && gapMedian <= YEARLY_GAP_RANGE[1]) {
      cycle = "yearly";
    }
    if (!cycle) continue;

    const last = sorted[sorted.length - 1];

    candidates.push({
      vendorKey,
      vendorLabel: last.vendor!,
      cycle,
      invoiceCount: sorted.length,
      lastAmount: last.amount,
      currency: last.currency,
      lastIssueDate: last.issue_date!,
      nextExpectedDate: addDays(last.issue_date!, CYCLE_DAYS[cycle]),
    });
  }

  return candidates;
}
