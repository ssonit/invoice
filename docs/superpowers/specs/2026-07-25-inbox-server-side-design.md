# Inbox: Server-Side Pagination, Filter, Search

**Date:** 2026-07-25
**Status:** Approved for implementation

## Goal

`/dashboard/inbox` fetches every invoice unbounded and does search/status-filter/
source-filter/pagination entirely client-side in `inbox-view.tsx` (8 rows/page,
`useMemo`-computed). Same problem the Invoices page had before
[`docs/superpowers/specs/2026-07-23-system-hardening-design.md`](2026-07-23-system-hardening-design.md)
fixed it — move it server-side, following the exact same pattern (URL-param-driven query,
`.range()`, `manualPagination`).

## Scope decision

Audited alongside Vendors in the same pass. Vendors is explicitly **out of scope** this
round: it already has server-side search/sort, and adding pagination there only trims
HTML sent to the client — it can't reduce query cost, since the full invoice history must
still be fetched regardless of vendor-list page size (subscription detection needs it).
Inbox has no such constraint — a clean win, same shape as the Invoices fix.

## What's different from the Invoices page

Inbox is a master-detail layout (search/filter/list sidebar + detail pane for the
selected invoice), not a flat table — `selectedId` stays client-only `useState` (never
reflected in the URL; selecting an invoice doesn't need to survive a reload). Status
filter values (`review`/`extracted`/`approved`, from `getInboxStatus()`) aren't a single
DB column — they combine `needs_review` and `confidence_score`:

```ts
// getInboxStatus() (src/lib/invoices.ts), translated to SQL filters:
review:   needs_review = true
approved: needs_review = false AND confidence_score >= 0.9
extracted: needs_review = false AND (confidence_score < 0.9 OR confidence_score IS NULL)
```

Free-text search matches the same fields the current client-side search does (`vendor`,
`invoice_number`, `currency`, `source`), via `.or()` with `ilike` — same pattern as the
Vendors page's `name`/`notes` search.

The header shows "N of M" (filtered count vs. grand total) — replicated by running a
second lightweight `count: "exact", head: true` query (no filters) alongside the main
paginated+filtered query.

## Files

- `src/constants/inbox.ts` — add `INBOX_SEARCH_MAX_LENGTH`, `INBOX_SEARCH_DEBOUNCE_MS`
  (mirrors `VENDOR_SEARCH_*` already there for Vendors).
- `src/lib/invoices/inbox-query.ts` (new, tested) — `parseInboxListQuery`,
  `isDefaultInboxListQuery`; reuses `parsePageParam` from `src/lib/pagination.ts`.
- `src/app/dashboard/inbox/page.tsx` — reads `searchParams`, builds the filtered +
  paginated Supabase query, runs the grand-total count query in parallel, passes
  page-scoped `invoices` + `query` + `totalCount` + `grandTotal` + `pageCount` to
  `InboxView`.
- `src/components/dashboard/inbox/inbox-view.tsx` — state management changes from local
  `useState`/`useMemo` filtering to props-driven + URL navigation (`router.push`,
  debounced search). Uses the corrected render-time state-sync pattern already fixed once
  in `invoices-toolbar.tsx` (write refs in an Effect, adjust mirrored state during render
  — not a synchronous `setState` inside an Effect) — get it right the first time here
  rather than repeating the anti-pattern. Layout/detail-pane markup is unchanged.

## Testing

`src/lib/invoices/inbox-query.ts` unit-tested (parsing/defaults), matching
`src/lib/invoices/query.ts`'s existing test file. `page.tsx`/`inbox-view.tsx` verified
manually in-browser, per established convention.

## Out of scope

- Vendors pagination (see Scope decision above).
- Changing the master-detail layout, detail pane, or any invoice-detail functionality.
- Making `selectedId` part of the URL (e.g. deep-linkable invoice detail) — not requested,
  would add scope beyond "server-side pagination/filter/search".
