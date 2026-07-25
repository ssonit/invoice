# Inbox Server-Side Pagination/Filter/Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `/dashboard/inbox`'s search, status/source filters, and pagination from fully client-side to server-side, matching the pattern already shipped for `/dashboard/invoices`.

**Architecture:** A new pure query-parsing module (`src/lib/invoices/inbox-query.ts`, unit-tested) turns URL search params into a typed query; `page.tsx` uses it to build a filtered + paginated Supabase query; `inbox-view.tsx` switches from local `useState`/`useMemo` filtering to props-driven data + URL navigation for filter/search/page changes, while `selectedId` (which invoice is open in the detail pane) stays local client state.

**Tech Stack:** Next.js 16 App Router, Supabase, Vitest. No new dependencies.

**Design spec:** `docs/superpowers/specs/2026-07-25-inbox-server-side-design.md`

---

## Task 1: Add search constants to `src/constants/inbox.ts`

**Files:**
- Modify: `src/constants/inbox.ts`

- [ ] **Step 1: Add the constants**

Append to `src/constants/inbox.ts`:
```ts
export const INBOX_SEARCH_MAX_LENGTH = 100
export const INBOX_SEARCH_DEBOUNCE_MS = 300
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/constants/inbox.ts
git commit -m "feat: add inbox search constants"
```

---

## Task 2: `src/lib/invoices/inbox-query.ts`

**Files:**
- Create: `src/lib/invoices/inbox-query.ts`
- Test: `src/lib/invoices/inbox-query.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/invoices/inbox-query.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { isDefaultInboxListQuery, parseInboxListQuery } from "./inbox-query";

describe("parseInboxListQuery", () => {
  it("defaults page to 1, q to empty, status/source to 'all'", () => {
    expect(parseInboxListQuery({})).toEqual({
      page: 1,
      q: "",
      status: "all",
      source: "all",
    });
  });

  it("parses valid page/q/status/source", () => {
    expect(
      parseInboxListQuery({ page: "2", q: "acme", status: "review", source: "email" }),
    ).toEqual({ page: 2, q: "acme", status: "review", source: "email" });
  });

  it("trims and length-caps the search query", () => {
    expect(parseInboxListQuery({ q: "  acme  " }).q).toBe("acme");
    expect(parseInboxListQuery({ q: "a".repeat(500) }).q).toHaveLength(100);
  });

  it("falls back to 'all' for an unknown status or source value", () => {
    expect(parseInboxListQuery({ status: "bogus" }).status).toBe("all");
    expect(parseInboxListQuery({ source: "bogus" }).source).toBe("all");
  });

  it("accepts each real status and source value", () => {
    expect(parseInboxListQuery({ status: "extracted" }).status).toBe("extracted");
    expect(parseInboxListQuery({ status: "approved" }).status).toBe("approved");
    expect(parseInboxListQuery({ source: "upload" }).source).toBe("upload");
  });
});

describe("isDefaultInboxListQuery", () => {
  it("is true for the default shape", () => {
    expect(
      isDefaultInboxListQuery({ page: 1, q: "", status: "all", source: "all" }),
    ).toBe(true);
  });

  it("is false when any field differs from the default", () => {
    expect(
      isDefaultInboxListQuery({ page: 2, q: "", status: "all", source: "all" }),
    ).toBe(false);
    expect(
      isDefaultInboxListQuery({ page: 1, q: "acme", status: "all", source: "all" }),
    ).toBe(false);
    expect(
      isDefaultInboxListQuery({ page: 1, q: "", status: "review", source: "all" }),
    ).toBe(false);
    expect(
      isDefaultInboxListQuery({ page: 1, q: "", status: "all", source: "email" }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/invoices/inbox-query.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/invoices/inbox-query.ts`:
```ts
import { parsePageParam } from "@/lib/pagination";
import {
  INBOX_SEARCH_MAX_LENGTH,
  type InboxSourceFilter,
  type InboxStatusFilter,
} from "@/constants/inbox";

export type InboxListQuery = {
  page: number;
  q: string;
  status: InboxStatusFilter;
  source: InboxSourceFilter;
};

const STATUS_VALUES = new Set<string>(["all", "review", "extracted", "approved"]);
const SOURCE_VALUES = new Set<string>(["all", "email", "upload"]);

export function parseInboxListQuery(params: {
  page?: string;
  q?: string;
  status?: string;
  source?: string;
}): InboxListQuery {
  return {
    page: parsePageParam(params.page),
    q: (params.q ?? "").trim().slice(0, INBOX_SEARCH_MAX_LENGTH),
    status: STATUS_VALUES.has(params.status ?? "")
      ? (params.status as InboxStatusFilter)
      : "all",
    source: SOURCE_VALUES.has(params.source ?? "")
      ? (params.source as InboxSourceFilter)
      : "all",
  };
}

export function isDefaultInboxListQuery(query: InboxListQuery): boolean {
  return (
    query.page === 1 &&
    query.q.length === 0 &&
    query.status === "all" &&
    query.source === "all"
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/invoices/inbox-query.test.ts`
Expected: PASS (9/9).

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/inbox-query.ts src/lib/invoices/inbox-query.test.ts
git commit -m "feat: add inbox list query parsing (page/q/status/source)"
```

---

## Task 3: Wire pagination + server-side filtering into the Inbox page

Orchestration — not unit-tested (the pure logic it depends on already is, in Task 2);
verified manually in Task 4.

**Files:**
- Modify: `src/app/dashboard/inbox/page.tsx`

- [ ] **Step 1: Replace `src/app/dashboard/inbox/page.tsx` in full**

```tsx
import { createClient } from "@/lib/supabase/server"
import { InboxView } from "@/components/dashboard/inbox/inbox-view"
import { normalizeInvoice } from "@/lib/invoices"
import { escapeIlike } from "@/lib/vendors/query"
import { parseInboxListQuery } from "@/lib/invoices/inbox-query"
import { INBOX_LIST_PAGE_SIZE } from "@/constants/inbox"
import { pageCount, paginationRange } from "@/lib/pagination"

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; source?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const query = parseInboxListQuery(await searchParams)
  const { from, to } = paginationRange(query.page, INBOX_LIST_PAGE_SIZE)

  let dbQuery = supabase
    .from("invoices")
    .select("*", { count: "exact" })
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  if (query.q) {
    const pattern = `%${escapeIlike(query.q).replace(/"/g, "")}%`
    dbQuery = dbQuery.or(
      `vendor.ilike."${pattern}",invoice_number.ilike."${pattern}",currency.ilike."${pattern}",source.ilike."${pattern}"`,
    )
  }

  if (query.source !== "all") {
    dbQuery = dbQuery.eq("source", query.source)
  }

  if (query.status === "review") {
    dbQuery = dbQuery.eq("needs_review", true)
  } else if (query.status === "approved") {
    dbQuery = dbQuery.eq("needs_review", false).gte("confidence_score", 0.9)
  } else if (query.status === "extracted") {
    dbQuery = dbQuery
      .eq("needs_review", false)
      .or("confidence_score.lt.0.9,confidence_score.is.null")
  }

  const [{ data, count }, { count: grandTotal }] = await Promise.all([
    dbQuery.range(from, to),
    supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
  ])

  const invoices = (data ?? []).map(normalizeInvoice)
  const totalCount = count ?? 0
  const totalPages = pageCount(totalCount, INBOX_LIST_PAGE_SIZE)

  return (
    <InboxView
      invoices={invoices}
      nowIso={new Date().toISOString()}
      query={query}
      totalCount={totalCount}
      grandTotal={grandTotal ?? 0}
      pageCount={totalPages}
    />
  )
}
```

Note: the `.eq("needs_review", false).or(...)` combination for the `extracted` status
relies on Supabase/PostgREST's default AND-combination of separate filter method calls —
each additional `.eq()`/`.or()` call narrows the same query, so this reads as
`needs_review = false AND (confidence_score < 0.9 OR confidence_score IS NULL)`, matching
`getInboxStatus()`'s `extracted` branch exactly (see design spec's translation table).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors expected here — `InboxView` doesn't accept these new props yet. That's
fixed in Task 4. Confirm the *only* errors are about `InboxView`'s prop types before
moving on (no typos elsewhere in this file).

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/inbox/page.tsx
git commit -m "feat: query the Inbox page with server-side pagination and filters"
```

---

## Task 4: Rewrite `inbox-view.tsx` for URL-driven state

The master-detail layout, `InboxDetail`, `DocumentPreview`, `FilterChip`, and
`DetailField` are unchanged — only the top-level `InboxView` function's state management
changes. Copy those unchanged pieces forward from the current file; only the parts shown
below are new/different.

**Files:**
- Modify: `src/components/dashboard/inbox/inbox-view.tsx`

- [ ] **Step 1: Replace the imports and the start of `InboxView` through the `groups` computation**

Change:
```tsx
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Maximize2,
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
} from "lucide-react"

import {
  INBOX_DEFAULT_SOURCE_FILTER,
  INBOX_DEFAULT_STATUS_FILTER,
  INBOX_LIST_PAGE_SIZE,
  INBOX_SOURCE_FILTER,
  INBOX_SOURCE_FILTER_OPTIONS,
  INBOX_STATUS_FILTER,
  INBOX_STATUS_FILTER_OPTIONS,
  type InboxSourceFilter,
  type InboxStatusFilter,
} from "@/constants/inbox"
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  getInboxStatus,
  inboxGroupLabel,
  inboxTimeLabel,
  type InvoiceRow,
} from "@/lib/invoices"
import { cn } from "@/lib/utils"
import { InboxStatusBadge } from "@/components/dashboard/inbox/inbox-status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function sourceSubtitle(invoice: InvoiceRow): string {
  if (invoice.source === INBOX_SOURCE_FILTER.UPLOAD) return "Manual upload"
  const slug = (invoice.vendor ?? "vendor")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18)
  return `invoices@${slug || "mail"}.com`
}

type Group = { label: string; items: InvoiceRow[] }

export function InboxView({
  invoices,
  nowIso,
}: {
  invoices: InvoiceRow[]
  nowIso: string
}) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<InboxStatusFilter>(
    INBOX_DEFAULT_STATUS_FILTER,
  )
  const [sourceFilter, setSourceFilter] = useState<InboxSourceFilter>(
    INBOX_DEFAULT_SOURCE_FILTER,
  )
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(
    invoices[0]?.id ?? null
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return invoices.filter((inv) => {
      if (
        statusFilter !== INBOX_STATUS_FILTER.ALL &&
        getInboxStatus(inv) !== statusFilter
      ) {
        return false
      }
      if (
        sourceFilter !== INBOX_SOURCE_FILTER.ALL &&
        inv.source !== sourceFilter
      ) {
        return false
      }
      if (!q) return true
      const hay = [inv.vendor, inv.invoice_number, inv.currency, inv.source]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [invoices, query, statusFilter, sourceFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / INBOX_LIST_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * INBOX_LIST_PAGE_SIZE
    return filtered.slice(start, start + INBOX_LIST_PAGE_SIZE)
  }, [filtered, safePage])

  const groups = useMemo(() => {
    const map = new Map<string, InvoiceRow[]>()
    for (const inv of pageItems) {
      const label = inboxGroupLabel(inv.created_at, nowIso)
      const list = map.get(label) ?? []
      list.push(inv)
      map.set(label, list)
    }
    return Array.from(map.entries()).map(
      ([label, items]): Group => ({ label, items })
    )
  }, [pageItems, nowIso])

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter, sourceFilter])

  useEffect(() => {
    if (pageItems.length === 0) {
      setSelectedId(null)
      return
    }
    if (!pageItems.some((inv) => inv.id === selectedId)) {
      setSelectedId(pageItems[0].id)
    }
  }, [pageItems, selectedId])

  const selected =
    pageItems.find((inv) => inv.id === selectedId) ?? pageItems[0] ?? null

  const filtersActive =
    statusFilter !== INBOX_STATUS_FILTER.ALL ||
    sourceFilter !== INBOX_SOURCE_FILTER.ALL
  const rangeStart =
    filtered.length === 0 ? 0 : (safePage - 1) * INBOX_LIST_PAGE_SIZE + 1
  const rangeEnd = Math.min(safePage * INBOX_LIST_PAGE_SIZE, filtered.length)
```

to:
```tsx
import { useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Maximize2,
  MoreHorizontal,
  RefreshCw,
  Search,
  X,
} from "lucide-react"

import {
  INBOX_DEFAULT_SOURCE_FILTER,
  INBOX_DEFAULT_STATUS_FILTER,
  INBOX_LIST_PAGE_SIZE,
  INBOX_SEARCH_DEBOUNCE_MS,
  INBOX_SOURCE_FILTER,
  INBOX_SOURCE_FILTER_OPTIONS,
  INBOX_STATUS_FILTER,
  INBOX_STATUS_FILTER_OPTIONS,
} from "@/constants/inbox"
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  getInboxStatus,
  inboxGroupLabel,
  inboxTimeLabel,
  type InvoiceRow,
} from "@/lib/invoices"
import type { InboxListQuery } from "@/lib/invoices/inbox-query"
import { paginationRange } from "@/lib/pagination"
import { cn } from "@/lib/utils"
import { InboxStatusBadge } from "@/components/dashboard/inbox/inbox-status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function sourceSubtitle(invoice: InvoiceRow): string {
  if (invoice.source === INBOX_SOURCE_FILTER.UPLOAD) return "Manual upload"
  const slug = (invoice.vendor ?? "vendor")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18)
  return `invoices@${slug || "mail"}.com`
}

function buildHref(pathname: string, next: InboxListQuery): string {
  const params = new URLSearchParams()
  if (next.q) params.set("q", next.q)
  if (next.status !== "all") params.set("status", next.status)
  if (next.source !== "all") params.set("source", next.source)
  if (next.page !== 1) params.set("page", String(next.page))
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

type Group = { label: string; items: InvoiceRow[] }

export function InboxView({
  invoices,
  nowIso,
  query,
  totalCount,
  grandTotal,
  pageCount,
}: {
  invoices: InvoiceRow[]
  nowIso: string
  query: InboxListQuery
  totalCount: number
  grandTotal: number
  pageCount: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [selectedId, setSelectedId] = useState<string | null>(
    invoices[0]?.id ?? null
  )
  const [searchInput, setSearchInput] = useState(query.q)
  const [prevQueryQ, setPrevQueryQ] = useState(query.q)

  // Sync the search box when the URL's q changes from outside this component
  // (browser back/forward). Adjusted during render, per React's guidance,
  // rather than in an Effect.
  if (query.q !== prevQueryQ) {
    setPrevQueryQ(query.q)
    setSearchInput(query.q)
  }

  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  }, [query])

  function navigate(patch: Partial<InboxListQuery>) {
    const current = queryRef.current
    const next: InboxListQuery = {
      q: patch.q !== undefined ? patch.q.trim() : current.q,
      status: patch.status ?? current.status,
      source: patch.source ?? current.source,
      // Any filter/search change resets to page 1; explicit page changes pass page directly.
      page: patch.page ?? 1,
    }
    router.push(buildHref(pathname, next))
  }

  useEffect(() => {
    if (searchInput === query.q) return
    const handle = window.setTimeout(() => navigate({ q: searchInput }), INBOX_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search
  }, [searchInput, query.q, pathname])

  const groups: Group[] = (() => {
    const map = new Map<string, InvoiceRow[]>()
    for (const inv of invoices) {
      const label = inboxGroupLabel(inv.created_at, nowIso)
      const list = map.get(label) ?? []
      list.push(inv)
      map.set(label, list)
    }
    return Array.from(map.entries()).map(([label, items]): Group => ({ label, items }))
  })()

  useEffect(() => {
    if (invoices.length === 0) {
      setSelectedId(null)
      return
    }
    if (!invoices.some((inv) => inv.id === selectedId)) {
      setSelectedId(invoices[0].id)
    }
  }, [invoices, selectedId])

  const selected =
    invoices.find((inv) => inv.id === selectedId) ?? invoices[0] ?? null

  const filtersActive = query.status !== "all" || query.source !== "all"
  const { from } = paginationRange(query.page, INBOX_LIST_PAGE_SIZE)
  const rangeStart = totalCount === 0 ? 0 : from + 1
  const rangeEnd = Math.min(from + invoices.length, totalCount)
```

(`paginationRange` and `INBOX_LIST_PAGE_SIZE` are imported alongside the rest at the top
of the file per Step 1's import block above — `import { paginationRange } from
"@/lib/pagination"` and add `INBOX_LIST_PAGE_SIZE` back into the existing
`@/constants/inbox` import.)

- [ ] **Step 2: Update the header count display**

Change:
```tsx
        <p className="text-[12px] text-muted-foreground tabular-nums">
          {filtered.length} of {invoices.length}
        </p>
```
to:
```tsx
        <p className="text-[12px] text-muted-foreground tabular-nums">
          {totalCount} of {grandTotal}
        </p>
```

- [ ] **Step 3: Update the search input**

Change:
```tsx
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search invoices..."
                  className="h-8 bg-muted/30 pl-8"
                />
```
to:
```tsx
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search invoices..."
                  className="h-8 bg-muted/30 pl-8"
                />
```

- [ ] **Step 4: Update the status/source filter dropdown items**

Change:
```tsx
                    {INBOX_STATUS_FILTER_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => setStatusFilter(opt.value)}
                      >
                        <span className="flex-1">{opt.label}</span>
                        {statusFilter === opt.value ? (
                          <Check className="size-3.5 text-[#E8FF47]" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
```
to:
```tsx
                    {INBOX_STATUS_FILTER_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => navigate({ status: opt.value })}
                      >
                        <span className="flex-1">{opt.label}</span>
                        {query.status === opt.value ? (
                          <Check className="size-3.5 text-[#E8FF47]" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
```

Change:
```tsx
                    {INBOX_SOURCE_FILTER_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => setSourceFilter(opt.value)}
                      >
                        <span className="flex-1">{opt.label}</span>
                        {sourceFilter === opt.value ? (
                          <Check className="size-3.5 text-[#E8FF47]" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
```
to:
```tsx
                    {INBOX_SOURCE_FILTER_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => navigate({ source: opt.value })}
                      >
                        <span className="flex-1">{opt.label}</span>
                        {query.source === opt.value ? (
                          <Check className="size-3.5 text-[#E8FF47]" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
```

Change the "Clear filters" item:
```tsx
                      <DropdownMenuItem
                        onClick={() => {
                          setStatusFilter(INBOX_DEFAULT_STATUS_FILTER)
                          setSourceFilter(INBOX_DEFAULT_SOURCE_FILTER)
                        }}
                      >
                        Clear filters
                      </DropdownMenuItem>
```
to:
```tsx
                      <DropdownMenuItem
                        onClick={() =>
                          navigate({
                            status: INBOX_DEFAULT_STATUS_FILTER,
                            source: INBOX_DEFAULT_SOURCE_FILTER,
                          })
                        }
                      >
                        Clear filters
                      </DropdownMenuItem>
```

- [ ] **Step 5: Update the active-filter chips**

Change:
```tsx
                {statusFilter !== INBOX_STATUS_FILTER.ALL ? (
                  <FilterChip
                    label={
                      INBOX_STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)
                        ?.label ?? statusFilter
                    }
                    onClear={() => setStatusFilter(INBOX_DEFAULT_STATUS_FILTER)}
                  />
                ) : null}
                {sourceFilter !== INBOX_SOURCE_FILTER.ALL ? (
                  <FilterChip
                    label={
                      INBOX_SOURCE_FILTER_OPTIONS.find((o) => o.value === sourceFilter)
                        ?.label ?? sourceFilter
                    }
                    onClear={() => setSourceFilter(INBOX_DEFAULT_SOURCE_FILTER)}
                  />
                ) : null}
```
to:
```tsx
                {query.status !== INBOX_STATUS_FILTER.ALL ? (
                  <FilterChip
                    label={
                      INBOX_STATUS_FILTER_OPTIONS.find((o) => o.value === query.status)
                        ?.label ?? query.status
                    }
                    onClear={() => navigate({ status: INBOX_DEFAULT_STATUS_FILTER })}
                  />
                ) : null}
                {query.source !== INBOX_SOURCE_FILTER.ALL ? (
                  <FilterChip
                    label={
                      INBOX_SOURCE_FILTER_OPTIONS.find((o) => o.value === query.source)
                        ?.label ?? query.source
                    }
                    onClear={() => navigate({ source: INBOX_DEFAULT_SOURCE_FILTER })}
                  />
                ) : null}
```

- [ ] **Step 6: Update the invoice list to render `invoices` instead of `pageItems`, and the pagination controls**

The `groups` map already iterates the (now page-scoped) `invoices` prop directly per Step
1, so the list-rendering JSX itself (`groups.map(...)`) needs no further change. Update
the pagination footer:

Change:
```tsx
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {rangeStart}–{rangeEnd} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous page"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="text-muted-foreground"
              >
                <ChevronLeft strokeWidth={1.75} />
              </Button>
              <span className="min-w-14 text-center text-[11px] text-muted-foreground tabular-nums">
                {safePage} / {pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next page"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="text-muted-foreground"
              >
                <ChevronRight strokeWidth={1.75} />
              </Button>
            </div>
```
to:
```tsx
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {rangeStart}–{rangeEnd} of {totalCount}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Previous page"
                disabled={query.page <= 1}
                onClick={() => navigate({ page: Math.max(1, query.page - 1) })}
                className="text-muted-foreground"
              >
                <ChevronLeft strokeWidth={1.75} />
              </Button>
              <span className="min-w-14 text-center text-[11px] text-muted-foreground tabular-nums">
                {query.page} / {pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Next page"
                disabled={query.page >= pageCount}
                onClick={() => navigate({ page: Math.min(pageCount, query.page + 1) })}
                className="text-muted-foreground"
              >
                <ChevronRight strokeWidth={1.75} />
              </Button>
            </div>
```

`InboxDetail`, `DocumentPreview`, `FilterChip`, `DetailField`, and the rest of the
render tree below the sidebar footer are unchanged from the current file.

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/components/dashboard/inbox/inbox-view.tsx src/app/dashboard/inbox/page.tsx`
Expected: no errors. In particular, re-run the lint check specifically for
`react-hooks/refs` and `react-hooks/set-state-in-effect` — the two rules that caught the
anti-pattern in `invoices-toolbar.tsx` during the system-hardening work. If either fires
here, the ref write moved outside its own `useEffect`, or a `setState` mirroring a prop
ended up inside an `useEffect` instead of the render-time-adjustment block — fix by
matching the pattern in Step 1 exactly.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/inbox/inbox-view.tsx
git commit -m "feat: switch Inbox to URL-driven pagination, filters, and search"
```

---

## Task 5: Full verification + docs

**Files:**
- Modify: `docs/system-hardening.md` — extends its existing "Invoices page: pagination +
  server-side filtering" section (Inbox now follows the identical pattern; this isn't a
  separate feature worth its own doc file).

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: all suites pass, including the 9 new tests from Task 2.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual smoke test**

Prerequisite: local Supabase running, dev server running.

1. Ensure the seeded admin has more than 8 invoices (insert synthetic rows via `npx
   supabase db query` if needed — mirror the pattern from the Invoices pagination smoke
   test in `docs/superpowers/plans/2026-07-23-system-hardening.md` Task 10 Step 5 — then
   delete them after).
2. Open `/dashboard/inbox` → confirm the page-1/page-N split and "N of M" header count.
3. Click Next → URL becomes `?page=2`, sidebar list changes, detail pane still works for
   a newly-selected invoice on that page.
4. Type into the search box → URL updates to `?q=...` (after the debounce), results
   narrow, page resets to 1.
5. Pick a status filter (e.g. "Review") → URL updates to `?status=review`, results narrow
   to only `needs_review = true` rows — cross-check the count against
   `npx supabase db query "select count(*) from invoices where user_id = '00000000-0000-0000-0000-000000000001' and needs_review = true"`.
6. Pick a source filter (e.g. "Upload") → URL updates to `?source=upload`, results narrow
   accordingly.
7. Combine a search + a filter + a non-1 page in the URL directly (e.g.
   `/dashboard/inbox?q=synthetic&status=all&source=upload&page=1`) → confirm the result
   set and "N of M" count are consistent with what Steps 4–6 individually produced.
8. Clean up any synthetic rows inserted for this test.

- [ ] **Step 4: Record the change**

Extend the existing "Invoices page: pagination + server-side filtering" section of
`docs/system-hardening.md` with a short paragraph recording: Inbox now follows the
identical server-side pagination/filter/search pattern; Vendors was evaluated and
intentionally left out (full invoice fetch is unavoidable there regardless of
vendor-list page size); the `getInboxStatus()` → SQL translation for the three status
values, so a future reader doesn't have to re-derive it from `src/lib/invoices.ts`.

- [ ] **Step 5: Final commit**

```bash
git add docs/system-hardening.md
git commit -m "docs: record Inbox server-side pagination/filter/search"
```

---

## File Structure Summary

**Created:**
- `src/lib/invoices/inbox-query.ts` + `.test.ts`

**Modified:**
- `src/constants/inbox.ts`
- `src/app/dashboard/inbox/page.tsx`
- `src/components/dashboard/inbox/inbox-view.tsx`
- `docs/system-hardening.md` (or new `docs/inbox-server-side.md`)
