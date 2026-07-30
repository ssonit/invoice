# Analytics Page — Spend-Focused Insights Dashboard

**Date:** 2026-07-30
**Status:** In progress
**Source:** `docs/DASHBOARD.md` §PLACEHOLDER PAGES, landing "Trend charts" claim

## Goal

Replace the `/dashboard/analytics` ComingSoon placeholder with a real spend-focused
dashboard: monthly spend trend, top-vendor breakdown, and summary stat cards — driven by
a URL-selected range (`?range=6` or `?range=12`, default 6 months). Pure lib aggregation
in `src/lib/analytics/` (unit-tested), recharts bar chart via existing `ChartContainer`,
no Team gating in this pass.

## Scope decision

The Analytics page is one of two "Insights" nav items (alongside Exports, which remains
"soon"). It's the spend counterpart to Overview's invoice-*count* trend — Overview stays
as-is, Analytics adds the monetary dimension the landing page already claims.

| Area | Status in repo today | Decision |
| --- | --- | --- |
| Analytics page | ComingSoon placeholder (`src/app/dashboard/analytics/page.tsx`) | Replace with real page |
| Overview trend chart | Invoice count bar chart (`InvoicesTrendChart`) | Leave unchanged |
| Exports page | ComingSoon placeholder | Out of scope (separate plan) |
| Team plan gating | Not built for any feature | Defer (same as billing deferral) |
| Custom date pickers | Not built | Out of scope (range toggle only) |
| FX / currency conversion | Not built | Out of scope (dominant-currency rule) |

## Design decisions

**Range via URL, not client state.** `?range=6` | `?range=12`, default `6`. The toolbar is
a pair of links that reset/update the query string — same URL-driven pattern as
Invoices/Inbox. No `useState`, no `useSearchParams` for the range itself.

**Effective date for spend bucketing.** `issue_date` if present, else `created_at` date
(UTC). Spend attribution follows the invoice date, not upload time. A null `issue_date`
row still counts via its `created_at` fallback.

**Multi-currency: no FX, dominant-currency rule.** Charts and totals use the currency with
the largest raw sum in-range — same rule as `computeStats` in `src/lib/invoices.ts`.
Show a small "top currency" hint when multiple currencies exist; other-currency rows are
excluded from the chart series but still counted in `invoiceCount`.

**No new migrations, no new API routes.** Date-bounded Supabase select in the RSC page,
filtered and aggregated by pure functions in `src/lib/analytics/`. This is the same
data-fetch pattern as the Invoices page, but with a bounded date window (not unbounded
like Overview).

**Top-8 vendors + Other rollup.** The vendor breakdown ranks by total spend in the
dominant currency, shows the top 8 individually, and rolls the rest into an "Other"
entry. Horizontal fill bars with `--chart-2`, no pie/donut — stays inside the
design-system hierarchy.

**Empty state.** When no invoices exist in the selected range, show the existing `Empty`
pattern with "No invoices in this period."

## Architecture

```
analytics/page.tsx (RSC)
  ├── parseAnalyticsQuery(searchParams) → { range: 6 | 12 }
  ├── rangeStartIso(now, months) → ISO date string
  ├── Supabase .select() with .or() date filter
  ├── normalizeInvoice() per row (reuse existing)
  └── buildAnalyticsReport(rows, months) → AnalyticsReport
        ├── effectiveInvoiceDate(row) → Date
        ├── Monthly spend buckets (oldest first)
        ├── Dominant currency pick
        └── Top-8 vendors + Other

UI (Client Components)
  ├── AnalyticsToolbar — 6 / 12 month toggle links
  ├── AnalyticsStatCards — 4 stat tiles
  ├── SpendTrendChart — recharts BarChart via ChartContainer
  └── VendorBreakdown — ranked list with share bars
```

## Pure lib (`src/lib/analytics/`)

| Module | Responsibility |
|--------|----------------|
| `query.ts` | `AnalyticsRange`, `parseAnalyticsQuery`, `buildAnalyticsHref`, `rangeStartIso(now, months)` |
| `report.ts` | `effectiveInvoiceDate`, `buildAnalyticsReport` → `AnalyticsReport` (summary + monthly spend series + top vendors) |
| `query.test.ts` | Parse valid/invalid range params, href generation, range start date math |
| `report.test.ts` | Date bucketing edges, null `issue_date` fallback, currency dominance, top-8 rollup, empty input |

## Report shape

```ts
type SpendTrendPoint = { month: string; amount: number }
type VendorSpendSlice = { key: string; label: string; amount: number; count: number }
type AnalyticsReport = {
  currency: string | null
  multiCurrency: boolean
  invoiceCount: number
  needsReview: number
  totalSpend: number          // dominant currency only
  monthlySpend: SpendTrendPoint[]  // `months` buckets, oldest first
  topVendors: VendorSpendSlice[]   // top 8 by amount + optional "Other"
}
```

## UI components

| Component | File | Notes |
|-----------|------|-------|
| Analytics page (RSC) | `src/app/dashboard/analytics/page.tsx` | `ContentShell` + empty state + three sections |
| Analytics toolbar | `src/components/dashboard/analytics/analytics-toolbar.tsx` | 6 / 12 month toggle (URL links) |
| Stat cards | `src/components/dashboard/analytics/analytics-stat-cards.tsx` | Invoices · Needs review · Total spend · Avg / invoice |
| Spend trend chart | `src/components/dashboard/analytics/spend-trend-chart.tsx` | recharts `BarChart` via `ChartContainer`, `var(--chart-1)`, `rounded-[14px] shadow-none` |
| Vendor breakdown | `src/components/dashboard/analytics/vendor-breakdown.tsx` | Ranked list, horizontal fill bars, `--chart-2` |

## Nav update

`src/lib/nav-config.ts`: Analytics `status` from `"beta"` → `"live"`.

## Page layout

1. **Toolbar** — 6m / 12m range toggle
2. **Stat cards** — Invoices · Needs review · Total spend · Avg / invoice (dominant currency)
3. **Spend over time** — bar chart, one bar per month
4. **Top vendors** — ranked breakdown, top 8 + Other

## Out of scope

- Exports / CSV download
- Team plan gating
- FX conversion, currency picker
- Custom date pickers, comparison to prior period
- SQL aggregate views / materialized caches
- Changing Overview charts
- Drill-down links into filtered Invoices (nice follow-up)
- Pie/donut charts (horizontal bars only)

## Verification

- **Unit:** `parseAnalyticsQuery` edge cases, date bucketing with null `issue_date`,
  out-of-range rows, multi-currency dominant pick, top-8 + Other rollup, empty input
- **Manual:** empty workspace, single-currency 6m/12m, multi-currency hint, light/dark,
  narrow viewport
- **Gates:** `npm run test`, `npx tsc --noEmit`, `npm run build`
