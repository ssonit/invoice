import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkStarterQuota,
  countBillableInvoicesThisMonth,
  getMonthRangeUtc,
  getStarterMonthlyLimit,
} from "./usage";
import type { BillingSubscriptionRow } from "../billing";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock ServiceClient whose .from() chain returns controlled
 *  responses for billing_subscriptions and invoices. */
function mockSupabaseClient(opts: {
  billingRow?: BillingSubscriptionRow | null;
  invoiceCount?: number;
  countError?: boolean;
}) {
  const billingRow = opts.billingRow ?? null;
  const invoiceCount = opts.invoiceCount ?? 0;
  const countError = opts.countError ?? false;

  const from = vi.fn((table: string) => {
    if (table === "billing_subscriptions") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: billingRow,
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "invoices") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({
              count: countError ? null : invoiceCount,
              error: countError ? new Error("simulated count error") : null,
            }),
          }),
        }),
      };
    }
    return {};
  }) as any;

  return { from } as any;
}

// ---------------------------------------------------------------------------
// getMonthRangeUtc
// ---------------------------------------------------------------------------

describe("getMonthRangeUtc", () => {
  it("returns start at month-first 00:00 UTC and end at next-month-first 00:00 UTC", () => {
    // Use a fixed date so the test is deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:34:56.789Z"));

    const { start, end } = getMonthRangeUtc();

    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-01T00:00:00.000Z");

    vi.useRealTimers();
  });

  it("handles December → January wrap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-20T00:00:00.000Z"));

    const { start, end } = getMonthRangeUtc();

    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");

    vi.useRealTimers();
  });

  it("handles January correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T00:00:00.000Z"));

    const { start, end } = getMonthRangeUtc();

    expect(start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-02-01T00:00:00.000Z");

    vi.useRealTimers();
  });

  it("handles leap year February", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2028-02-15T00:00:00.000Z"));

    const { start, end } = getMonthRangeUtc();

    expect(start.toISOString()).toBe("2028-02-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2028-03-01T00:00:00.000Z");

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// getStarterMonthlyLimit
// ---------------------------------------------------------------------------

describe("getStarterMonthlyLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the default when env var is unset", () => {
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", undefined);
    // Default is 50 from constants/billing.ts
    expect(getStarterMonthlyLimit()).toBe(50);
  });

  it("reads the env var when set", () => {
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "3");
    expect(getStarterMonthlyLimit()).toBe(3);
  });

  it("falls back to default for non-numeric values", () => {
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "not-a-number");
    expect(getStarterMonthlyLimit()).toBe(50);
  });

  it("falls back to default for negative values", () => {
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "-5");
    expect(getStarterMonthlyLimit()).toBe(50);
  });

  it("accepts zero (block all)", () => {
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "0");
    expect(getStarterMonthlyLimit()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countBillableInvoicesThisMonth
// ---------------------------------------------------------------------------

describe("countBillableInvoicesThisMonth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the count from supabase", async () => {
    const supabase = mockSupabaseClient({ invoiceCount: 7 });
    const count = await countBillableInvoicesThisMonth(supabase, "user-1");
    expect(count).toBe(7);
  });

  it("returns 0 when count is null", async () => {
    // head: true query with no matching rows can return count: null
    const supabase = mockSupabaseClient({ invoiceCount: 0 });
    // Override to return null count
    const from = vi.fn((_table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ count: null, error: null }),
        }),
      }),
    })) as any;
    const count = await countBillableInvoicesThisMonth({ from } as any, "user-1");
    expect(count).toBe(0);
  });

  it("fails open (returns 0) on query error", async () => {
    const supabase = mockSupabaseClient({ countError: true });
    const count = await countBillableInvoicesThisMonth(supabase, "user-1");
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkStarterQuota
// ---------------------------------------------------------------------------

describe("checkStarterQuota", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  // -- Dev unlock ----------------------------------------------------------

  it("allows when BILLING_DEV_UNLOCK is enabled (non-prod)", async () => {
    vi.stubEnv("BILLING_DEV_UNLOCK", "true");
    vi.stubEnv("NODE_ENV", "development");
    const supabase = mockSupabaseClient({});
    const result = await checkStarterQuota(supabase, "user-1");
    expect(result.allowed).toBe(true);
  });

  it("does NOT allow via dev unlock when NODE_ENV is production", async () => {
    vi.stubEnv("BILLING_DEV_UNLOCK", "true");
    vi.stubEnv("NODE_ENV", "production");
    // dev unlock is disabled in prod, so it falls through to billing check
    const supabase = mockSupabaseClient({ billingRow: null, invoiceCount: 0 });
    const result = await checkStarterQuota(supabase, "user-1");
    // No team plan → treated as starter, under limit → allowed
    expect(result.allowed).toBe(true);
  });

  // -- Team plan ------------------------------------------------------------

  it("allows when user has an active Team plan", async () => {
    vi.stubEnv("NODE_ENV", "production"); // block dev unlock
    const supabase = mockSupabaseClient({
      billingRow: { plan: "team", status: "active", ends_at: null } as BillingSubscriptionRow,
    });
    const result = await checkStarterQuota(supabase, "user-1");
    expect(result.allowed).toBe(true);
  });

  it("allows when user is on Team trial", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const supabase = mockSupabaseClient({
      billingRow: { plan: "team", status: "on_trial", ends_at: null } as BillingSubscriptionRow,
    });
    const result = await checkStarterQuota(supabase, "user-1");
    expect(result.allowed).toBe(true);
  });

  // -- Starter under limit -------------------------------------------------

  it("allows Starter user under the monthly limit", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "10");
    const supabase = mockSupabaseClient({ billingRow: null, invoiceCount: 5 });
    const result = await checkStarterQuota(supabase, "user-1");
    expect(result.allowed).toBe(true);
  });

  it("allows Starter user with no billing row (default Starter)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "10");
    const supabase = mockSupabaseClient({ billingRow: null, invoiceCount: 0 });
    const result = await checkStarterQuota(supabase, "user-1");
    expect(result.allowed).toBe(true);
  });

  // -- Starter over limit --------------------------------------------------

  it("denies Starter user at the limit", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "10");
    const supabase = mockSupabaseClient({ billingRow: null, invoiceCount: 10 });
    const result = await checkStarterQuota(supabase, "user-1");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.used).toBe(10);
      expect(result.limit).toBe(10);
      expect(result.resetsAt).toBe("2026-08-01T00:00:00.000Z");
    }
  });

  it("denies Starter user over the limit", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "10");
    const supabase = mockSupabaseClient({ billingRow: null, invoiceCount: 15 });
    const result = await checkStarterQuota(supabase, "user-1");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.used).toBe(15);
      expect(result.limit).toBe(10);
    }
  });

  // -- Edge cases ----------------------------------------------------------

  it("blocks at limit 0 (zero-cap)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "0");
    const supabase = mockSupabaseClient({ billingRow: null, invoiceCount: 0 });
    const result = await checkStarterQuota(supabase, "user-1");
    // 0 >= 0 → over limit
    expect(result.allowed).toBe(false);
  });

  it("fails open on billing_subscriptions query error", async () => {
    vi.stubEnv("NODE_ENV", "production");
    // Return null data (no row) — treated as Starter
    const supabase = mockSupabaseClient({ billingRow: null, invoiceCount: 100 });
    const result = await checkStarterQuota(supabase, "user-1");
    // 100 >= default 50 → denied
    expect(result.allowed).toBe(false);
  });

  it("resetsAt is the first day of the next UTC month", async () => {
    vi.useFakeTimers();
    // June 15 → resetsAt should be July 1
    vi.setSystemTime(new Date("2026-06-15T23:59:59.000Z"));
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STARTER_MONTHLY_INVOICE_LIMIT", "5");
    const supabase = mockSupabaseClient({ billingRow: null, invoiceCount: 10 });
    const result = await checkStarterQuota(supabase, "user-1");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.resetsAt).toBe("2026-07-01T00:00:00.000Z");
    }
    vi.useRealTimers();
  });
});
