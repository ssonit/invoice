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

Migrations applied to production (`invoice_reader`) on 2026-10-27:
`20261027100000_invoices_search_and_approval.sql` (`search_text`, trigger, backfill,
`approved_at`), `20261027110000_report_rpc_functions.sql` (analytics/overview/export
RPCs) and `20261027120000_revoke_handle_new_user_execute.sql` (advisor fix).
Still open in the Supabase dashboard: enable leaked-password protection (Auth settings).

- **EN/VI switch:** `src/lib/dashboard/i18n.ts` (dictionaries, cookie `dashboard-locale`).
  Server Components use `getDashboardDictionary()`; Client Components use
  `useDashboardI18n()`. Add strings to `en` and `vi` together; a test checks key and
  `{placeholder}` parity. Server-action error messages and the agent prompt on the
  Automation page stay English on purpose.
- **Display name:** Settings -> Profile, stored in auth `user_metadata.display_name`.
