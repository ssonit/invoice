# Vendors: URL-Driven Pagination

**Date:** 2026-07-25
**Status:** Approved for implementation

## Goal

`/dashboard/vendors` already paginates (`VendorsList`, `VENDOR_LIST_PAGE_SIZE = 10`), but
the page number lives in local `useState` inside `VendorsList`, not the URL. This has two
real costs, corrected from the earlier (incomplete) assessment in
`docs/superpowers/specs/2026-07-25-inbox-server-side-design.md`:

1. **UX:** reload, browser back/forward, or sharing a link all lose the current page —
   it silently resets to page 1.
2. **Performance:** `<VendorsList vendors={vendors} />` currently receives the *entire*
   filtered+sorted array (every matching vendor, each with a nested `invoices` array) and
   only slices it client-side for display. The full RSC payload — not just the 10 vendors
   shown — is serialized and shipped to the browser on every load. This is a real,
   measurable cost for users with many vendors/invoices, not just a cosmetic HTML-size
   concern as previously assumed.

## Decision

Move pagination to be URL-driven (`?page=N`), matching the pattern already shipped for
Invoices and Inbox: `page.tsx` slices the computed vendor array to just the current page
*before* passing it to `VendorsList`, so only the visible page's data is ever serialized
to the client.

**Why an array slice, not a second DB query:** unlike Invoices/Inbox, Vendors already
computes the *entire* filtered+sorted vendor list server-side every request regardless of
page (subscription detection needs the full invoice history — see the earlier design
docs for why this can't be pushed further into SQL). Given that full computation already
happens, pagination here is a cheap `Array.slice()` after the fact — no additional query,
no additional DB round-trip. The performance win is entirely in *not serializing the
unshown rows to the client*, not in query cost.

## What doesn't change

- The "Needs your confirmation" section (due subscriptions) is **not** paginated — it
  already renders separately, above `VendorsList`, and shows every due item regardless of
  page. No change here.
- `VendorsToolbar`'s search/filter/sort — already URL-driven, untouched except that
  changing any of them now also resets `page` to 1 (matching Invoices/Inbox behavior).
- The vendor detail `Sheet` (edit/delete), `VendorFormDialog` — unchanged.

## Design details

- `VendorQuery` (`src/lib/vendors/query.ts`) gains a `page: number` field, parsed via the
  existing shared `parsePageParam` from `src/lib/pagination.ts` (same helper Invoices and
  Inbox use — no new pagination-parsing logic invented).
- **Refactor, not duplicate:** `buildHref(pathname, next: VendorQuery)` currently lives
  only inside `vendors-toolbar.tsx`. Since `VendorsList` now also needs to build
  pagination hrefs (Previous/Next), `buildHref` moves to `src/lib/vendors/query.ts` as an
  exported, unit-tested pure function, and both components import it — avoids duplicating
  the same URL-building logic in two places (see `.claude/rules/code-style.md`: "check
  for an existing helper before adding a new one").
- `page.tsx`: after computing the final filtered+sorted `vendors` array (unchanged logic),
  clamp the requested page to the actual `pageCount` (an out-of-range `?page=99` request
  degrades to the last real page rather than showing an empty list), slice via
  `paginationRange`, and pass the page-scoped array plus `query`, `totalCount` (the
  pre-slice length — what `VendorsToolbar`'s "N vendors" count already uses, unchanged),
  and `pageCount` to `VendorsList`.
- `VendorsList` drops its internal `useState` page/`pageIndex`/`pageItems` slicing
  entirely — it receives already-paginated `vendors`, plus `query`, `totalCount`,
  `pageCount` as new props, and its Previous/Next buttons navigate via the shared
  `buildHref` (same `router.push` pattern already used everywhere else).
- The empty-state check in `page.tsx` (`vendors.length === 0 ? <Empty/> : <VendorsList/>`)
  switches to `totalCount === 0` — the pre-slice count — so an out-of-range page number
  never incorrectly shows "no vendors" when matches actually exist on an earlier page.

## Testing

`parseVendorQuery`, `isDefaultVendorQuery`, and the newly-exported `buildHref` get
unit-test coverage extended/added in `src/lib/vendors/query.test.ts`, matching the
existing convention for this file. `page.tsx`/`VendorsList`/`VendorsToolbar` are
orchestration — verified manually per project convention.

## Out of scope

- Changing `VENDOR_LIST_PAGE_SIZE` (stays 10).
- Paginating or otherwise touching the "Needs your confirmation" section.
- Any change to how vendor stats/subscriptions are computed (still requires the full
  invoice fetch — unrelated to this fix).
