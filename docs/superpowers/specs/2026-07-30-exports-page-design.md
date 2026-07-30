# Exports Page — CSV Invoice Download

**Date:** 2026-07-30
**Status:** In progress
**Source:** `docs/DASHBOARD.md` §PLACEHOLDER PAGES, landing "Xuất CSV/Excel" claim

## Goal

Replace the `/dashboard/exports` ComingSoon placeholder with a real CSV download flow:
filter invoices by range and status, preview the matching count, then download as a
UTF-8 CSV (with BOM) via a Route Handler. No Excel SDK, no accounting connectors —
CSV-only MVP.

## Scope decision

The Exports page is the second "Insights" nav item alongside Analytics. It delivers
the CSV half of the ComingSoon copy ("Xuất CSV/Excel và đồng bộ sổ sách"); accounting
sync stays deferred.

| Area | Status in repo today | Decision |
| --- | --- | --- |
| Exports page | ComingSoon placeholder (`src/app/dashboard/exports/page.tsx`) | Replace with real page |
| CSV format | Not built | UTF-8 BOM, RFC-style escaping |
| Native .xlsx | Not built | Out of scope |
| Accounting connectors | Not built | Out of scope (separate plan) |
| Team plan gating | Not built for any feature | Defer (same as Analytics) |
| Custom column picker | Not built | Out of scope (fixed columns) |
| Line-item expansion | Not built | Out of scope (flat rows only) |

## Design decisions

**CSV only, no xlsx dependency.** UTF-8 with BOM so Excel opens Vietnamese text and VND
currency values cleanly. RFC-style quoting for fields containing commas, double quotes,
or newlines. No `exceljs` / `xlsx` package in `package.json`.

**Delivery via Route Handler, not client Blob.** `GET /api/exports/invoices` —
Supabase session cookie auth, query params for filters, response with
`Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment`.
The page renders a plain `<a href>` pointing at the route — no `fetch` + `URL.createObjectURL`.

**Filters via URL query (both page and API):**
- `range`: `6` | `12` | `all` (default `6`)
- `status`: `all` | `review` | `ok` (default `all`)

**Effective date rule (same as Analytics).** `issue_date` if present, else `created_at`
date (UTC). Range window bounds use the first of the month `range` months ago.
`range=all` skips the date window entirely.

**Fixed CSV columns (MVP):** `vendor`, `invoice_number`, `amount`, `currency`,
`issue_date`, `due_date`, `tax`, `source`, `needs_review`, `confidence_score`,
`created_at`. No line-items expansion, no column customization.

**Safety cap: 5,000 rows.** If more invoices match the filters, only the first 5,000
(ordered by `created_at` desc) are included. The page shows a "capped" note when the
count exceeds the cap.

**No Team gating** in this pass (same as Analytics). Flip nav `soon` → `live`.

## Architecture

```
exports/page.tsx (RSC)
  ├── parseExportQuery(searchParams) → ExportQuery
  ├── Supabase .select("count") for preview
  ├── buildExportHref(query) → /api/exports/invoices?range=6&status=all
  └── ExportsPanel (Client Component)
        ├── Range + status filter controls
        ├── Matching count + cap note
        └── Download CSV <a> / button

api/exports/invoices/route.ts (Route Handler)
  ├── createClient().auth.getUser() → 401 if no session
  ├── parseExportQuery(params) → ExportQuery
  ├── Supabase .select() with date + status filters, .limit(5_000)
  ├── normalizeInvoice() per row (reuse existing)
  └── invoicesToCsv(rows) → new Response(csv, { headers })
```

## Pure lib (`src/lib/exports/`)

| Function | Role |
| --- | --- |
| `parseExportQuery(params)` | Validate + default `range` and `status` from query params |
| `buildExportHref(query)` | Build `/api/exports/invoices?range=…&status=…` URL |
| `rangeStartIso(now, months)` | First-of-month ISO string `months` months ago |
| `escapeCsvCell(value)` | RFC-style quoting for a single CSV cell |
| `invoicesToCsv(rows)` | Map InvoiceRow[] → full CSV string with BOM header |
| `CSV_COLUMNS` | Column metadata array (key, header label) |

## Page layout

1. Short description ("Download invoices as CSV for spreadsheets or bookkeeping")
2. Filters: range toggle (6 / 12 / All) + status toggle (All / Needs Review / OK)
3. Matching count ("N invoices will be included") + cap note when N > 5,000
4. Primary **Download CSV** button → API route link
5. Empty state when N = 0

## Out of scope

- Native `.xlsx` / ExcelJS
- Accounting connectors (QuickBooks, Xero, Slack, Drive)
- Custom column picker / line-item rows
- Scheduled / emailed exports
- Team plan gating
- Analytics page work (separate plan)

## Verification

- Unit: CSV escape edge cases (`"`, commas, newlines), BOM prefix, status/range parse defaults
- Manual: download opens in Excel/Sheets; empty filter; status=review; cap messaging
- Gates: `npm run test`, `npx tsc --noEmit`, `npm run build`
