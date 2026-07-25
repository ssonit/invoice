# Vendors URL-Driven Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Vendors' existing pagination from local client `useState` (loses page on reload/back-forward, ships the full unpaginated dataset to the client every load) to URL-driven, matching the pattern already shipped for Invoices and Inbox.

**Architecture:** `page.tsx` already computes the full filtered+sorted vendor array server-side every request (unavoidable — subscription detection needs the full invoice history). Pagination becomes a server-side `Array.slice()` of that already-computed array, with the page number read from and written to the URL — no additional query. `buildHref` (currently private to `vendors-toolbar.tsx`) is promoted to a shared, exported, unit-tested helper in `src/lib/vendors/query.ts` so `VendorsList`'s new pagination controls can reuse it instead of duplicating URL-building logic.

**Tech Stack:** Next.js 16 App Router, React 19, Vitest. No new dependencies.

**Design spec:** `docs/superpowers/specs/2026-07-25-vendors-pagination-design.md`

---

## Task 1: Extend `VendorQuery` with `page`, promote `buildHref` to a shared export

**Files:**
- Modify: `src/lib/vendors/query.ts`
- Modify: `src/lib/vendors/query.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the `parseVendorQuery` describe block's first test and add new tests to
`src/lib/vendors/query.test.ts`. Change:
```ts
  it("falls back to defaults for missing params", () => {
    expect(parseVendorQuery({})).toEqual({
      q: "",
      filter: VENDOR_FILTER.ALL,
      sort: VENDOR_SORT.TOTAL_DESC,
    });
  });
```
to:
```ts
  it("falls back to defaults for missing params", () => {
    expect(parseVendorQuery({})).toEqual({
      q: "",
      filter: VENDOR_FILTER.ALL,
      sort: VENDOR_SORT.TOTAL_DESC,
      page: 1,
    });
  });

  it("parses a valid page number", () => {
    expect(parseVendorQuery({ page: "3" }).page).toBe(3);
  });

  it("falls back to page 1 for an invalid page value", () => {
    expect(parseVendorQuery({ page: "0" }).page).toBe(1);
    expect(parseVendorQuery({ page: "abc" }).page).toBe(1);
  });
```

Add a `page` case to the existing `isDefaultVendorQuery` describe block:
```ts
  it("is false when page is not 1", () => {
    expect(
      isDefaultVendorQuery({
        q: "",
        filter: VENDOR_FILTER.ALL,
        sort: VENDOR_SORT.TOTAL_DESC,
        page: 2,
      }),
    ).toBe(false);
  });
```

Add a new describe block for the promoted `buildVendorsHref`:
```ts
describe("buildVendorsHref", () => {
  const defaultQuery = {
    q: "",
    filter: VENDOR_FILTER.ALL,
    sort: VENDOR_SORT.TOTAL_DESC,
    page: 1,
  };

  it("returns the bare pathname for the default query", () => {
    expect(buildVendorsHref("/dashboard/vendors", defaultQuery)).toBe(
      "/dashboard/vendors",
    );
  });

  it("includes page only when it isn't 1", () => {
    expect(buildVendorsHref("/dashboard/vendors", { ...defaultQuery, page: 2 })).toBe(
      "/dashboard/vendors?page=2",
    );
  });

  it("combines q, filter, sort, and page together", () => {
    const href = buildVendorsHref("/dashboard/vendors", {
      q: "acme",
      filter: VENDOR_FILTER.CANCELLED,
      sort: VENDOR_SORT.NAME_ASC,
      page: 3,
    });
    expect(href).toBe(
      "/dashboard/vendors?q=acme&filter=cancelled&sort=name_asc&page=3",
    );
  });
});
```
(Import `buildVendorsHref` alongside the existing named imports at the top of the test
file.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/vendors/query.test.ts`
Expected: FAIL — `page` missing from `parseVendorQuery`'s return, `buildVendorsHref` not
exported yet.

- [ ] **Step 3: Update the implementation**

In `src/lib/vendors/query.ts`, add the `parsePageParam` import:
```ts
import { parsePageParam } from "@/lib/pagination"
```

Change:
```ts
export type VendorQuery = {
  q: string
  filter: VendorFilter
  sort: VendorSort
}
```
to:
```ts
export type VendorQuery = {
  q: string
  filter: VendorFilter
  sort: VendorSort
  page: number
}
```

Change:
```ts
export function parseVendorQuery(params: {
  q?: string
  filter?: string
  sort?: string
}): VendorQuery {
  const q = (params.q ?? "").trim().slice(0, VENDOR_SEARCH_MAX_LENGTH)
  const filter = FILTER_SET.has(params.filter ?? "")
    ? (params.filter as VendorFilter)
    : VENDOR_DEFAULT_FILTER
  const sort = SORT_SET.has(params.sort ?? "")
    ? (params.sort as VendorSort)
    : VENDOR_DEFAULT_SORT
  return { q, filter, sort }
}
```
to:
```ts
export function parseVendorQuery(params: {
  q?: string
  filter?: string
  sort?: string
  page?: string
}): VendorQuery {
  const q = (params.q ?? "").trim().slice(0, VENDOR_SEARCH_MAX_LENGTH)
  const filter = FILTER_SET.has(params.filter ?? "")
    ? (params.filter as VendorFilter)
    : VENDOR_DEFAULT_FILTER
  const sort = SORT_SET.has(params.sort ?? "")
    ? (params.sort as VendorSort)
    : VENDOR_DEFAULT_SORT
  const page = parsePageParam(params.page)
  return { q, filter, sort, page }
}
```

Change:
```ts
export function isDefaultVendorQuery(query: VendorQuery): boolean {
  return (
    query.q.length === 0 &&
    query.filter === VENDOR_DEFAULT_FILTER &&
    query.sort === VENDOR_DEFAULT_SORT
  )
}
```
to:
```ts
export function isDefaultVendorQuery(query: VendorQuery): boolean {
  return (
    query.q.length === 0 &&
    query.filter === VENDOR_DEFAULT_FILTER &&
    query.sort === VENDOR_DEFAULT_SORT &&
    query.page === 1
  )
}
```

Add the new exported helper (place it near `isDefaultVendorQuery`):
```ts
/** Builds the URL for a given query state — shared by the toolbar and the pagination controls. */
export function buildVendorsHref(pathname: string, next: VendorQuery): string {
  const params = new URLSearchParams()
  if (next.q) params.set("q", next.q)
  if (next.filter !== VENDOR_DEFAULT_FILTER) params.set("filter", next.filter)
  if (next.sort !== VENDOR_DEFAULT_SORT) params.set("sort", next.sort)
  if (next.page !== 1) params.set("page", String(next.page))
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/vendors/query.test.ts`
Expected: PASS (all tests, existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/vendors/query.ts src/lib/vendors/query.test.ts
git commit -m "feat: add page to VendorQuery, promote buildHref to a shared export"
```

---

## Task 2: Wire `page` reset and the shared `buildVendorsHref` into `VendorsToolbar`

**Files:**
- Modify: `src/components/dashboard/vendors/vendors-toolbar.tsx`

- [ ] **Step 1: Remove the local `buildHref`, import the shared one**

Change:
```tsx
import {
  isDefaultVendorQuery,
  type VendorQuery,
} from "@/lib/vendors/query"
import { cn } from "@/lib/utils"

function buildHref(pathname: string, next: VendorQuery): string {
  const params = new URLSearchParams()
  if (next.q) params.set("q", next.q)
  if (next.filter !== VENDOR_DEFAULT_FILTER) params.set("filter", next.filter)
  if (next.sort !== VENDOR_DEFAULT_SORT) params.set("sort", next.sort)
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}
```
to:
```tsx
import {
  buildVendorsHref,
  isDefaultVendorQuery,
  type VendorQuery,
} from "@/lib/vendors/query"
import { cn } from "@/lib/utils"
```

- [ ] **Step 2: Reset `page` to 1 on any search/filter/sort change**

Change:
```tsx
  function navigate(patch: Partial<VendorQuery>) {
    const current = queryRef.current
    const next: VendorQuery = {
      q: patch.q !== undefined ? patch.q.trim() : current.q,
      filter: patch.filter ?? current.filter,
      sort: patch.sort ?? current.sort,
    }
    startTransition(() => {
      router.push(buildHref(pathname, next))
    })
  }
```
to:
```tsx
  function navigate(patch: Partial<VendorQuery>) {
    const current = queryRef.current
    const next: VendorQuery = {
      q: patch.q !== undefined ? patch.q.trim() : current.q,
      filter: patch.filter ?? current.filter,
      sort: patch.sort ?? current.sort,
      // Any search/filter/sort change resets to page 1; explicit page changes
      // (from VendorsList's Previous/Next) pass page directly.
      page: patch.page ?? 1,
    }
    startTransition(() => {
      router.push(buildVendorsHref(pathname, next))
    })
  }
```

Note: this toolbar never itself passes `page` in a `navigate()` call (only
`VendorsList` does, in Task 4) — this file's `navigate()` calls all implicitly reset to
page 1, which is exactly the desired behavior.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: errors expected here — `VendorsList` doesn't accept the new props yet, and
`vendors/page.tsx` doesn't pass `page` to `parseVendorQuery`'s callers correctly until
Task 3. Confirm no *other* unexpected errors in this file specifically:
`npx tsc --noEmit 2>&1 | grep vendors-toolbar` should show nothing.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/vendors/vendors-toolbar.tsx
git commit -m "feat: reset Vendors page to 1 on search/filter/sort change"
```

---

## Task 3: Slice + clamp the vendor list server-side in `page.tsx`

**Files:**
- Modify: `src/app/dashboard/vendors/page.tsx`

- [ ] **Step 1: Add the new imports**

Add alongside the existing imports at the top of `src/app/dashboard/vendors/page.tsx`:
```tsx
import { pageCount, paginationRange } from "@/lib/pagination"
import { VENDOR_LIST_PAGE_SIZE } from "@/constants/vendors"
import type { VendorQuery } from "@/lib/vendors/query"
```

- [ ] **Step 2: Slice the computed vendor array and pass paging props down**

Change:
```tsx
  const vendors = sortVendors(
    [...vendorMap.values()].filter((v) => matchesFilter(v, query.filter)),
    query.sort,
  )

  const hasQuery = !isDefaultVendorQuery(query)

  return (
    <ContentShell
      title="Vendors"
      description="Manage vendors and review subscription reminders for recurring charges."
      actions={<AddVendorButton />}
    >
      <div className="flex flex-col gap-5">
        {due.length > 0 ? (
```
to:
```tsx
  const vendors = sortVendors(
    [...vendorMap.values()].filter((v) => matchesFilter(v, query.filter)),
    query.sort,
  )

  const hasQuery = !isDefaultVendorQuery(query)
  const totalCount = vendors.length
  const totalPages = pageCount(totalCount, VENDOR_LIST_PAGE_SIZE)
  // An out-of-range ?page= (e.g. after a filter narrows the results) degrades
  // to the last real page instead of rendering an empty list.
  const safePage = Math.min(query.page, totalPages)
  const pageQuery: VendorQuery = { ...query, page: safePage }
  const { from, to } = paginationRange(safePage, VENDOR_LIST_PAGE_SIZE)
  const pageVendors = vendors.slice(from, to + 1)

  return (
    <ContentShell
      title="Vendors"
      description="Manage vendors and review subscription reminders for recurring charges."
      actions={<AddVendorButton />}
    >
      <div className="flex flex-col gap-5">
        {due.length > 0 ? (
```

Change:
```tsx
        <section className="rounded-xl border border-border bg-card/40">
          <VendorsToolbar query={query} resultCount={vendors.length} />

          {vendors.length === 0 ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>{hasQuery ? "No matching vendors" : "No vendors yet"}</EmptyTitle>
                <EmptyDescription>
                  {hasQuery
                    ? "Try a different search, filter, or sort."
                    : "Add a vendor manually, or wait for invoices with a vendor name."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <VendorsList
              key={`${query.q}|${query.filter}|${query.sort}`}
              vendors={vendors}
            />
          )}
        </section>
```
to:
```tsx
        <section className="rounded-xl border border-border bg-card/40">
          <VendorsToolbar query={query} resultCount={totalCount} />

          {totalCount === 0 ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>{hasQuery ? "No matching vendors" : "No vendors yet"}</EmptyTitle>
                <EmptyDescription>
                  {hasQuery
                    ? "Try a different search, filter, or sort."
                    : "Add a vendor manually, or wait for invoices with a vendor name."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <VendorsList
              key={`${query.q}|${query.filter}|${query.sort}|${safePage}`}
              vendors={pageVendors}
              query={pageQuery}
              totalCount={totalCount}
              pageCount={totalPages}
            />
          )}
        </section>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: errors expected in `vendors-list.tsx` only (fixed in Task 4) — confirm no
errors reference `vendors/page.tsx` itself:
`npx tsc --noEmit 2>&1 | grep "app/dashboard/vendors/page.tsx"` should show nothing.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/vendors/page.tsx
git commit -m "feat: slice and clamp the Vendors list server-side before rendering"
```

---

## Task 4: Rewrite `VendorsList`'s pagination to be props-driven

**Files:**
- Modify: `src/components/dashboard/vendors/vendors-list.tsx`

- [ ] **Step 1: Update imports and the component signature**

Change:
```tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, Pencil, Trash2 } from "lucide-react"

import { VENDOR_LIST_PAGE_SIZE } from "@/constants/vendors"
import {
  SUBSCRIPTION_CYCLE_LABELS,
  type SubscriptionCycleConstant,
} from "@/constants/subscriptions"
import { deleteVendor } from "@/app/dashboard/vendors/actions"
import { SubscriptionConfirmButtons } from "@/components/dashboard/vendors/subscription-confirm-buttons"
import { VendorFormDialog } from "@/components/dashboard/vendors/vendor-form-dialog"
```
to:
```tsx
"use client"

import { useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronRight, Pencil, Trash2 } from "lucide-react"

import {
  SUBSCRIPTION_CYCLE_LABELS,
  type SubscriptionCycleConstant,
} from "@/constants/subscriptions"
import { deleteVendor } from "@/app/dashboard/vendors/actions"
import { buildVendorsHref, type VendorQuery } from "@/lib/vendors/query"
import { SubscriptionConfirmButtons } from "@/components/dashboard/vendors/subscription-confirm-buttons"
import { VendorFormDialog } from "@/components/dashboard/vendors/vendor-form-dialog"
```
(`VENDOR_LIST_PAGE_SIZE` is no longer used in this file — slicing now happens in
`page.tsx` — so its import is dropped, not left dangling.)

- [ ] **Step 2: Replace the local page state with props + a navigate function**

Change:
```tsx
export function VendorsList({ vendors }: { vendors: VendorListItem[] }) {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()

  const pageCount = Math.max(1, Math.ceil(vendors.length / VENDOR_LIST_PAGE_SIZE))
  const pageIndex = Math.min(page, pageCount - 1)
  const pageItems = vendors.slice(
    pageIndex * VENDOR_LIST_PAGE_SIZE,
    pageIndex * VENDOR_LIST_PAGE_SIZE + VENDOR_LIST_PAGE_SIZE,
  )

  const selected = selectedKey
    ? (vendors.find((v) => v.key === selectedKey) ?? null)
    : null
```
to:
```tsx
export function VendorsList({
  vendors,
  query,
  totalCount,
  pageCount,
}: {
  vendors: VendorListItem[]
  query: VendorQuery
  totalCount: number
  pageCount: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()
  const [isNavigating, startNavigate] = useTransition()

  function goToPage(page: number) {
    startNavigate(() => {
      router.push(buildVendorsHref(pathname, { ...query, page }))
    })
  }

  const selected = selectedKey
    ? (vendors.find((v) => v.key === selectedKey) ?? null)
    : null
```

`vendors` is now the already page-scoped array passed from `page.tsx` (Task 3) — every
other reference to it in this file (the `<ul>` rendering, `selected` lookup) already
reads correctly with no further change, since `vendors` used to mean "all matching" and
is now "this page's slice", and every existing usage in this file only ever needed "the
items currently on screen" or "look up by key among what's rendered".

- [ ] **Step 3: Update the list rendering to use `vendors` directly (no more `pageItems`) and add the pending-navigation visual state**

Change:
```tsx
  return (
    <>
      <ul className="divide-y divide-border">
        {pageItems.map((vendor) => {
```
to:
```tsx
  return (
    <>
      <ul className={cn("divide-y divide-border", isNavigating && "opacity-70")}>
        {vendors.map((vendor) => {
```
(`cn` is already imported near the bottom of this file's existing import block — no new
import needed for this step.)

- [ ] **Step 4: Update the pagination footer**

Change:
```tsx
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <p className="text-[12px] text-muted-foreground">
          Page {pageIndex + 1} of {pageCount}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={pageIndex <= 0}
          >
            Previous
          </Button>
          <span className="text-[12px] text-muted-foreground">
            Page {pageIndex + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={pageIndex >= pageCount - 1}
          >
            Next
          </Button>
        </div>
      </div>
```
to:
```tsx
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <p className="text-[12px] text-muted-foreground">
          Page {query.page} of {pageCount}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(Math.max(1, query.page - 1))}
            disabled={query.page <= 1}
          >
            Previous
          </Button>
          <span className="text-[12px] text-muted-foreground">
            Page {query.page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(Math.min(pageCount, query.page + 1))}
            disabled={query.page >= pageCount}
          >
            Next
          </Button>
        </div>
      </div>
```
(The duplicated "Page X of Y" text in both the `<p>` and the `<span>` is preserved exactly
as it was — not a typo to fix here, just re-sourced from `query.page`/`pageCount` props
instead of local state. `totalCount` is accepted as a prop for API consistency with
Invoices/Inbox but isn't rendered here, since `VendorsToolbar` already shows the "N
vendors" count elsewhere on the page — don't add a second, redundant count display.)

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/components/dashboard/vendors/vendors-list.tsx src/components/dashboard/vendors/vendors-toolbar.tsx src/app/dashboard/vendors/page.tsx src/lib/vendors/query.ts`
Expected: no errors. In particular, re-check for `react-hooks/refs` and
`react-hooks/set-state-in-effect` — this file doesn't use that ref/effect pattern at all,
so neither should fire, but confirm anyway given this exact rule has already caught real
bugs three times this session.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/vendors/vendors-list.tsx
git commit -m "feat: switch VendorsList pagination to URL-driven navigation"
```

---

## Task 5: Full verification + docs

**Files:**
- Modify: `docs/system-hardening.md` — extend the same "Invoices page: pagination +
  server-side filtering" section again (now covers Invoices, Inbox, and Vendors).

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: all suites pass, including the new tests from Task 1.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual smoke test**

Prerequisite: local Supabase + dev server running, logged in as the seeded admin.

1. Ensure the seeded admin has more than 10 vendors (insert synthetic invoices with
   distinct vendor names via `npx supabase db query` if needed — the vendor
   orphan-heal logic in `page.tsx` will create matching `vendors` rows automatically on
   the next page load — then delete the synthetic invoices/vendors after).
2. Open `/dashboard/vendors` → confirm "Page 1 of N" and 10 vendors shown.
3. Click Next → URL becomes `?page=2`, different vendors load, list briefly dims
   (`opacity-70`) during the transition.
4. Reload the page at `?page=2` directly → still shows page 2 (this is the core UX fix —
   compare against the pre-fix behavior, which reset to page 1 on reload).
5. Use the browser's Back button after a Next click → returns to page 1 correctly.
6. Type a search query → URL updates to `?q=...&page=1` (page resets), even if you were
   previously on page 2.
7. Manually visit an out-of-range page (e.g. `?page=999`) → clamps to the last real page
   instead of showing an empty list.
8. Confirm the "Needs your confirmation" section (if any due subscriptions exist) still
   shows every due item regardless of which page you're on — unaffected by pagination.
9. Clean up any synthetic data inserted for this test.

- [ ] **Step 4: Record the change**

Extend the "Invoices page: pagination + server-side filtering" section of
`docs/system-hardening.md` with a short paragraph: Vendors now also uses URL-driven
pagination; unlike Invoices/Inbox this doesn't add a new query — the full
filtered+sorted vendor array was already computed server-side every request (subscription
detection needs it), so pagination here is a server-side array slice, which also fixed a
real performance issue (the previous client-side-only pagination shipped every matching
vendor's full nested invoice list to the browser regardless of page size).

- [ ] **Step 5: Final commit**

```bash
git add docs/system-hardening.md
git commit -m "docs: record Vendors URL-driven pagination"
```

---

## File Structure Summary

**Modified:**
- `src/lib/vendors/query.ts` + `.test.ts`
- `src/components/dashboard/vendors/vendors-toolbar.tsx`
- `src/app/dashboard/vendors/page.tsx`
- `src/components/dashboard/vendors/vendors-list.tsx`
- `docs/system-hardening.md`
