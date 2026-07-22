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

// Fixed cycle lengths (not leap-year-adjusted) — intentional, see design spec:
// projections stay predictable rather than tracking the exact prior gap.
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

    const sorted = [...group].sort(
      (a, b) => toUtcDate(a.issue_date!).getTime() - toUtcDate(b.issue_date!).getTime(),
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

export type SubscriptionStatus = "upcoming" | "due" | "confirmed_active" | "cancelled";

export type SubscriptionWithStatus = SubscriptionCandidate & {
  status: SubscriptionStatus;
  needsConfirmation: boolean;
};

export type SubscriptionConfirmation = {
  status: "active" | "cancelled";
  confirmedAt: string; // ISO datetime
};

const REMINDER_WINDOW_BEFORE_DAYS = 3;
const REMINDER_WINDOW_AFTER_DAYS = 21;

export function withConfirmationStatus(
  candidates: SubscriptionCandidate[],
  confirmations: Map<string, SubscriptionConfirmation>,
  today: Date = new Date(),
): SubscriptionWithStatus[] {
  const todayIso = today.toISOString().slice(0, 10);

  return candidates.map((candidate) => {
    const confirmation = confirmations.get(candidate.vendorKey);
    const windowStart = addDays(candidate.nextExpectedDate, -REMINDER_WINDOW_BEFORE_DAYS);
    const windowEnd = addDays(candidate.nextExpectedDate, REMINDER_WINDOW_AFTER_DAYS);
    const inWindow = todayIso >= windowStart && todayIso <= windowEnd;

    if (confirmation?.status === "cancelled") {
      // Honor "cancelled" only if no newer invoice has arrived since the user
      // said so. If a new invoice showed up after the cancellation, they're
      // apparently being charged again — fall through to re-evaluate as
      // due/upcoming instead of staying silently "cancelled" forever.
      const cancelledAfterLastInvoice = confirmation.confirmedAt.slice(0, 10) >= candidate.lastIssueDate;
      if (cancelledAfterLastInvoice) {
        return { ...candidate, status: "cancelled" as const, needsConfirmation: false };
      }
    } else if (confirmation?.status === "active") {
      const cycleStart = addDays(candidate.nextExpectedDate, -CYCLE_DAYS[candidate.cycle]);
      const confirmedAtIso = confirmation.confirmedAt.slice(0, 10);
      if (confirmedAtIso >= cycleStart) {
        return { ...candidate, status: "confirmed_active" as const, needsConfirmation: false };
      }
    }

    if (inWindow) {
      return { ...candidate, status: "due" as const, needsConfirmation: true };
    }

    return { ...candidate, status: "upcoming" as const, needsConfirmation: false };
  });
}
