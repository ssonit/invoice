# Analytics Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/dashboard/analytics` as a real spend-focused Insights page: monthly spend trend, top-vendor breakdown, and summary stat cards — replacing the ComingSoon placeholder.

**Architecture:** Server Component reads invoices in a date-bounded window from Supabase, normalizes them, and passes the result to `buildAnalyticsReport()` (pure lib, unit-tested). The RSC page renders presentational client components: toolbar (URL links), stat cards, spend trend chart (recharts via `ChartContainer`), and vendor breakdown (horizontal bars). No new API route, no new table, no migration.

**Tech Stack:** Next.js 16 App Router (React 19 Server Components), Supabase JS, Tailwind v4 + shadcn-style UI, Recharts, Vitest.

**Spec:** [`docs/superpowers/specs/2026-07-30-analytics-page-design.md`](../specs/2026-07-30-analytics-page-design.md)

**Visual references:** Spend chart follows `InvoicesTrendChart` tokens (`rounded-[14px] shadow-none`, `var(--chart-1)`, same axis/grid treatment). Vendor breakdown uses horizontal fill bars inside the design-system hierarchy (Tokens: `rounded-[14px]`, `shadow-none`, 11/12/13px type, no gradients).

---

## File Structure

| File | Created / Modified | Responsibility |
| --- | --- | --- |
| `src/lib/analytics/query.ts` | Create | `AnalyticsRange`, `parseAnalyticsQuery`, `buildAnalyticsHref`, `rangeStartIso` |
| `src/lib/analytics/query.test.ts` | Create | Parse valid/invalid range, href output, range start date math |
| `src/lib/analytics/report.ts` | Create | `effectiveInvoiceDate`, `buildAnalyticsReport` → `AnalyticsReport` |
| `src/lib/analytics/report.test.ts` | Create | Date bucketing, null `issue_date` fallback, currency dominance, top-8 rollup, empty input |
| `src/components/dashboard/analytics/analytics-toolbar.tsx` | Create | 6m / 12m range toggle (URL links) |
| `src/components/dashboard/analytics/analytics-stat-cards.tsx` | Create | 4 stat tiles: Invoices, Needs review, Total spend, Avg/invoice |
| `src/components/dashboard/analytics/spend-trend-chart.tsx` | Create | Recharts BarChart via ChartContainer |
| `src/components/dashboard/analytics/vendor-breakdown.tsx` | Create | Top-8 vendors + Other, horizontal share bars |
| `src/app/dashboard/analytics/page.tsx` | Modify | Replace ComingSoon with real page |
| `src/lib/nav-config.ts` | Modify | Analytics status `"beta"` → `"live"` |

---

## Task 1: Analytics query module (TDD)

**Files:**
- Create: `src/lib/analytics/query.ts`
- Test: `src/lib/analytics/query.test.ts`

- [ ] **Step 1: Write the failing test for `parseAnalyticsQuery`**

`src/lib/analytics/query.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseAnalyticsQuery, buildAnalyticsHref, rangeStartIso } from "./query";

describe("parseAnalyticsQuery", () => {
  it("defaults to range 6 when no param is provided", () => {
    expect(parseAnalyticsQuery({})).toEqual({ range: 6 });
  });

  it("parses valid range=12", () => {
    expect(parseAnalyticsQuery({ range: "12" })).toEqual({ range: 12 });
  });

  it("clamps invalid range values to the nearest valid (6 or 12)", () => {
    expect(parseAnalyticsQuery({ range: "3" })).toEqual({ range: 6 });
    expect(parseAnalyticsQuery({ range: "24" })).toEqual({ range: 12 });
    expect(parseAnalyticsQuery({ range: "abc" })).toEqual({ range: 6 });
  });
});

describe("buildAnalyticsHref", () => {
  it("omits range=6 (default) from href", () => {
    expect(buildAnalyticsHref({ range: 6 })).toBe("/dashboard/analytics");
  });

  it("includes range=12 in href", () => {
    expect(buildAnalyticsHref({ range: 12 })).toBe("/dashboard/analytics?range=12");
  });
});

describe("rangeStartIso", () => {
  it("returns an ISO date string N months before now", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    const result = rangeStartIso(now, 6);
    expect(result).toBe("2026-01-01T00:00:00.000Z");
  });

  it("handles year boundary", () => {
    const now = new Date("2026-02-15T12:00:00Z");
    const result = rangeStartIso(now, 6);
    expect(result).toBe("2025-08-01T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Verify tests fail (RED)** — `npm test src/lib/analytics/query.test.ts`
- [ ] **Step 3: Implement `query.ts`** — types + parse + href + rangeStartIso
- [ ] **Step 4: Verify tests pass (GREEN)** — `npm test src/lib/analytics/query.test.ts`

---

## Task 2: Analytics report module (TDD)

**Files:**
- Create: `src/lib/analytics/report.ts`
- Test: `src/lib/analytics/report.test.ts`

- [ ] **Step 1: Write the failing test for `effectiveInvoiceDate` and `buildAnalyticsReport`**

`src/lib/analytics/report.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { effectiveInvoiceDate, buildAnalyticsReport } from "./report";
import type { InvoiceRow } from "@/lib/invoices";

function makeRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "inv-1",
    vendor: "ACME Corp",
    amount: 100,
    currency: "USD",
    issue_date: "2026-06-15",
    due_date: null,
    tax: 0,
    line_items: [],
    confidence_score: 0.9,
    source: "email",
    needs_review: false,
    file_url: null,
    invoice_number: "INV-001",
    created_at: "2026-06-20T10:00:00Z",
    ...overrides,
  };
}

describe("effectiveInvoiceDate", () => {
  it("uses issue_date when present", () => {
    const row = makeRow({ issue_date: "2026-03-10" });
    expect(effectiveInvoiceDate(row).toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });

  it("falls back to created_at when issue_date is null", () => {
    const row = makeRow({ issue_date: null, created_at: "2026-04-15T08:00:00Z" });
    expect(effectiveInvoiceDate(row).toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });

  it("uses UTC date from created_at (strips time)", () => {
    const row = makeRow({ issue_date: null, created_at: "2026-04-15T23:59:00Z" });
    expect(effectiveInvoiceDate(row).toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });
});

describe("buildAnalyticsReport", () => {
  it("returns empty report for no rows", () => {
    const report = buildAnalyticsReport([], 6);
    expect(report).toEqual({
      currency: null,
      multiCurrency: false,
      invoiceCount: 0,
      needsReview: 0,
      totalSpend: 0,
      monthlySpend: [],
      topVendors: [],
    });
  });

  it("counts invoices and needs_review correctly", () => {
    const rows = [
      makeRow({ id: "1", needs_review: false }),
      makeRow({ id: "2", needs_review: true }),
      makeRow({ id: "3", needs_review: true }),
    ];
    const report = buildAnalyticsReport(rows, 6);
    expect(report.invoiceCount).toBe(3);
    expect(report.needsReview).toBe(2);
  });

  it("picks dominant currency by largest sum", () => {
    const rows = [
      makeRow({ id: "1", currency: "USD", amount: 100 }),
      makeRow({ id: "2", currency: "EUR", amount: 500 }),
      makeRow({ id: "3", currency: "USD", amount: 200 }),
    ];
    const report = buildAnalyticsReport(rows, 6);
    expect(report.currency).toBe("EUR");
    expect(report.totalSpend).toBe(500);
    expect(report.multiCurrency).toBe(true);
  });

  it("excludes non-dominant currencies from spend but counts them", () => {
    const rows = [
      makeRow({ id: "1", currency: "USD", amount: 100 }),
      makeRow({ id: "2", currency: "EUR", amount: 50 }),
    ];
    const report = buildAnalyticsReport(rows, 6);
    expect(report.currency).toBe("USD");
    expect(report.totalSpend).toBe(100);
    expect(report.invoiceCount).toBe(2);
  });

  it("handles null currency as '—' fallback (dominance)", () => {
    const rows = [
      makeRow({ id: "1", currency: null, amount: 200 }),
      makeRow({ id: "2", currency: "USD", amount: 100 }),
    ];
    const report = buildAnalyticsReport(rows, 6);
    expect(report.currency).toBeNull();
    expect(report.totalSpend).toBe(200);
  });

  it("produces monthly spend buckets (oldest first)", () => {
    const rows = [
      makeRow({ id: "1", issue_date: "2026-02-10", currency: "USD", amount: 100 }),
      makeRow({ id: "2", issue_date: "2026-02-20", currency: "USD", amount: 200 }),
      makeRow({ id: "3", issue_date: "2026-04-05", currency: "USD", amount: 50 }),
    ];
    const report = buildAnalyticsReport(rows, 6);
    expect(report.monthlySpend.length).toBe(6);
    // February bucket should have 300
    const feb = report.monthlySpend.find((p) => p.month === "Feb");
    expect(feb?.amount).toBe(300);
    // April bucket should have 50
    const apr = report.monthlySpend.find((p) => p.month === "Apr");
    expect(apr?.amount).toBe(50);
    // Months with no spend should be 0
    const mar = report.monthlySpend.find((p) => p.month === "Mar");
    expect(mar?.amount).toBe(0);
  });

  it("returns top-8 vendors by dominant-currency spend", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRow({
        id: String(i),
        vendor: `Vendor ${i}`,
        currency: "USD",
        amount: 100 - i * 10,
      })
    );
    const report = buildAnalyticsReport(rows, 6);
    expect(report.topVendors).toHaveLength(9); // 8 + Other
    expect(report.topVendors[0].label).toBe("Vendor 0");
    expect(report.topVendors[8].label).toBe("Other");
  });

  it("includes non-dominant currency rows as Other in vendor breakdown", () => {
    const rows = [
      makeRow({ id: "1", vendor: "ACME", currency: "USD", amount: 100 }),
      makeRow({ id: "2", vendor: "EuroCorp", currency: "EUR", amount: 50 }),
    ];
    const report = buildAnalyticsReport(rows, 6);
    // USD dominant, so ACME should be in topVendors, EuroCorp excluded
    const acme = report.topVendors.find((v) => v.label === "ACME");
    expect(acme).toBeDefined();
    const euroCorp = report.topVendors.find((v) => v.label === "EuroCorp");
    expect(euroCorp).toBeUndefined();
  });

  it("uses effective date for monthly bucketing", () => {
    const rows = [
      makeRow({ id: "1", issue_date: null, created_at: "2026-05-10T10:00:00Z", currency: "USD", amount: 100 }),
    ];
    const report = buildAnalyticsReport(rows, 6);
    const may = report.monthlySpend.find((p) => p.month === "May");
    expect(may?.amount).toBe(100);
  });
});
```

- [ ] **Step 2: Verify tests fail (RED)** — `npm test src/lib/analytics/report.test.ts`
- [ ] **Step 3: Implement `report.ts`** — types + effectiveInvoiceDate + buildAnalyticsReport
- [ ] **Step 4: Verify tests pass (GREEN)** — `npm test src/lib/analytics/report.test.ts`
- [ ] **Step 5: Verify all tests still pass** — `npm run test`

---

## Task 3: Analytics UI components

**Files:**
- Create: `src/components/dashboard/analytics/analytics-toolbar.tsx`
- Create: `src/components/dashboard/analytics/analytics-stat-cards.tsx`
- Create: `src/components/dashboard/analytics/spend-trend-chart.tsx`
- Create: `src/components/dashboard/analytics/vendor-breakdown.tsx`
- Modify: `src/app/dashboard/analytics/page.tsx`

- [ ] **Step 1: Build `analytics-toolbar.tsx`** — Client component with two `Link`-based toggles (6m / 12m), follows `invoices-toolbar.tsx` pattern but simpler (no search input, no status filter). Active range has `variant="default"`, inactive has `variant="ghost"`. Uses `buildAnalyticsHref`.
- [ ] **Step 2: Build `analytics-stat-cards.tsx`** — Four stat tiles matching the Overview `stat-cards.tsx` pattern. Labels: "Invoices", "Needs review", "Total spend", "Avg / invoice". Spend amounts use `formatInvoiceMoney` from `@/lib/invoices`. Multi-currency hint shown as a muted caption when `multiCurrency` is true.
- [ ] **Step 3: Build `spend-trend-chart.tsx`** — Recharts `BarChart` via `ChartContainer`. Follows `InvoicesTrendChart` exactly: `rounded-[14px] shadow-none` card, `var(--chart-1)`, same axis/grid/tooltip treatment. Y-axis formatted as currency (use `formatInvoiceMoney` in tooltip formatter). X-axis shows abbreviated month labels.
- [ ] **Step 4: Build `vendor-breakdown.tsx`** — Ranked list of vendors. Each row: vendor label + amount + horizontal share bar (width proportional to share of total, colored `var(--chart-2)`). "Other" row shown last with muted label. Empty state when no vendors.
- [ ] **Step 5: Replace `page.tsx`** — Async RSC. Pattern: create supabase client → get user → parse query → compute `rangeStartIso` → fetch invoices in window → normalize → `buildAnalyticsReport` → render `ContentShell` with all four sections. Empty state when 0 invoices.

---

## Task 4: Finalize

**Files:**
- Modify: `src/lib/nav-config.ts`

- [ ] **Step 1: Flip nav status** — Analytics `status` from `"beta"` → `"live"` in `nav-config.ts`
- [ ] **Step 2: Run verification gates** — `npm run test`, `npx tsc --noEmit`, `npm run build`
- [ ] **Step 3: Smoke test** — Manual check: empty workspace, single-currency 6m/12m, multi-currency hint, light/dark, narrow viewport
- [ ] **Step 4: Graphify update** — `graphify update .`
- [ ] **Step 5: Record** — Write `docs/analytics.md` feature record
