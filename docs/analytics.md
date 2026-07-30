# Analytics Page

**Shipped:** 2026-07-30
**Status:** Live (`/dashboard/analytics`)

## What it does

Replaces the ComingSoon placeholder with a spend-focused insights dashboard:

- **Range toggle:** 6 or 12 months via `?range=` query param (default 6).
- **Stat cards:** Invoice count, needs-review count, total spend, average per invoice
  — all in the dominant currency.
- **Spend over time:** Monthly bar chart (Recharts via `ChartContainer`), oldest first.
- **Top vendors:** Ranked breakdown (top 8 + Other rollup), horizontal share bars.

## Key decisions

- **Dominant currency only** — no FX conversion. Charts and totals use the currency
  with the largest raw sum in range (same rule as `computeStats`). A "top currency"
  hint appears when multiple currencies exist.
- **Effective date:** `issue_date ?? created_at` (UTC date). Spend attribution follows
  the invoice date, not upload time.
- **URL-driven:** range lives in the query string, not client state — same pattern as
  Invoices and Inbox.
- **No new migrations, no new API routes.** The RSC page fetches from the existing
  `invoices` table; all aggregation is pure lib in `src/lib/analytics/`.

## Architecture

```
src/lib/analytics/
  query.ts          — parseAnalyticsQuery, buildAnalyticsHref, rangeStartIso
  report.ts         — effectiveInvoiceDate, buildAnalyticsReport → AnalyticsReport
  query.test.ts     — unit coverage for parse/href/range math
  report.test.ts    — unit coverage for bucketing, currency dominance, top-8, empty

src/components/dashboard/analytics/
  analytics-toolbar.tsx      — 6m / 12m toggle
  analytics-stat-cards.tsx   — 4 stat tiles
  spend-trend-chart.tsx      — Recharts BarChart
  vendor-breakdown.tsx       — Top-8 vendors + Other

src/app/dashboard/analytics/page.tsx  — RSC page (ContentShell + all sections)
```

## What it deliberately doesn't do

- Exports / CSV download
- Team plan gating
- FX conversion, currency picker
- Custom date pickers, comparison to prior period
- SQL aggregate views / materialized caches
- Drill-down links into filtered Invoices
- Pie/donut charts
