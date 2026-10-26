# Fixes from manual test pass (2026-10-27)

Decisions worth remembering:

- **Multi-currency totals:** no FX conversion. Totals and averages are shown per
  currency (`sumByCurrency` in `src/lib/invoices.ts`), e.g. `2,888,500 VND + $75.00`.
  The Analytics chart and Top vendors show one currency at a time, switched with
  `?currency=`.
- **Search:** one accent-insensitive search over vendor, invoice number, currency
  and source via `invoices.search_text` (trigger-maintained `lower(unaccent(...))`).
  The query is folded the same way in `src/lib/invoices/search.ts`.
- **Amount sort:** groups by currency, then amount (`compareInvoiceAmounts`).
  It sorts the current page only.
- **Invoice editing:** `InvoiceDetail` (inbox panel and the Invoices row sheet).
  Server actions in `src/app/dashboard/invoices/actions.ts`: `updateInvoice`,
  `setInvoiceReviewStatus` (`invoices.approved_at`), `retryInvoiceExtraction`
  (re-reads the stored PDF or image, overwrites extracted fields).
- **Manual "Mark as subscription":** the row was saved but dropped when the vendor's
  invoice had no `issue_date`; `buildManualCandidates` now falls back to `created_at`.

Migration to apply: `supabase/migrations/20261027100000_invoices_search_and_approval.sql`
(adds `search_text`, its trigger and backfill, and `approved_at`).

Not done yet: EN/VI switch in the dashboard, display name in Settings.
