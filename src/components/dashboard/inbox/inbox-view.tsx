"use client"

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

  // Reset the selected invoice when the (server-provided) invoices list changes
  // — e.g. a new page/filter navigation. Adjusted during render, per React's
  // guidance, rather than in an Effect.
  const [prevInvoices, setPrevInvoices] = useState(invoices)
  if (invoices !== prevInvoices) {
    setPrevInvoices(invoices)
    if (invoices.length === 0) {
      setSelectedId(null)
    } else if (!invoices.some((inv) => inv.id === selectedId)) {
      setSelectedId(invoices[0].id)
    }
  }

  const selected =
    invoices.find((inv) => inv.id === selectedId) ?? invoices[0] ?? null

  const filtersActive = query.status !== "all" || query.source !== "all"
  const { from } = paginationRange(query.page, INBOX_LIST_PAGE_SIZE)
  const rangeStart = totalCount === 0 ? 0 : from + 1
  const rangeEnd = Math.min(from + invoices.length, totalCount)

  return (
    <div className="-m-4 flex h-[calc(100dvh-3rem)] min-h-[32rem] flex-col overflow-hidden border-t border-border/60 md:-m-6">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/80 px-4">
        <h1 className="font-[family-name:var(--font-outfit)] text-[15px] font-semibold tracking-tight">
          Invoice Inbox
        </h1>
        <p className="text-[12px] text-muted-foreground tabular-nums">
          {totalCount} of {grandTotal}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-border/80 lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-2 border-b border-border/60 p-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search invoices..."
                  className="h-8 bg-muted/30 pl-8"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Filter invoices"
                      className={cn(
                        "relative text-muted-foreground",
                        filtersActive && "text-[#E8FF47]"
                      )}
                    />
                  }
                >
                  <Filter strokeWidth={1.75} />
                  {filtersActive ? (
                    <span className="absolute top-1 right-1 size-1.5 rounded-full bg-[#E8FF47]" />
                  ) : null}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Status</DropdownMenuLabel>
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
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Source</DropdownMenuLabel>
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
                  </DropdownMenuGroup>
                  {filtersActive ? (
                    <>
                      <DropdownMenuSeparator />
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
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {filtersActive ? (
              <div className="flex flex-wrap items-center gap-1.5">
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
              </div>
            ) : null}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {groups.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No invoices match your filters.
              </p>
            ) : (
              <div className="pb-2">
                {groups.map((group) => (
                  <div key={group.label}>
                    <p className="sticky top-0 z-10 bg-background/95 px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur">
                      {group.label}
                    </p>
                    <ul>
                      {group.items.map((invoice) => {
                        const status = getInboxStatus(invoice)
                        const active = selected?.id === invoice.id
                        return (
                          <li key={invoice.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(invoice.id)}
                              className={cn(
                                "flex w-full gap-3 border-l-2 px-3 py-3 text-left transition-colors",
                                active
                                  ? "border-l-[#E8FF47] bg-[#E8FF47]/8"
                                  : "border-l-transparent hover:bg-muted/40"
                              )}
                            >
                              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground">
                                <FileText
                                  className="size-3.5"
                                  strokeWidth={1.75}
                                />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-start justify-between gap-2">
                                  <span className="truncate text-[13px] font-medium">
                                    {invoice.vendor ?? "Unknown vendor"}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-muted-foreground">
                                    {inboxTimeLabel(invoice.created_at, nowIso)}
                                  </span>
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                  {sourceSubtitle(invoice)}
                                </span>
                                <span className="mt-2 flex items-center justify-between gap-2">
                                  <span className="font-mono text-[12px] tabular-nums">
                                    {formatInvoiceMoney(
                                      invoice.amount,
                                      invoice.currency
                                    )}
                                  </span>
                                  <InboxStatusBadge status={status} />
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
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
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-background">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Select an invoice to inspect extraction details.
            </div>
          ) : (
            <InboxDetail
              invoice={selected}
              onClose={() => setSelectedId(null)}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function FilterChip({
  label,
  onClear,
}: {
  label: string
  onClear: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex h-6 items-center gap-1 rounded-full border border-[#E8FF47]/25 bg-[#E8FF47]/10 px-2 text-[11px] font-medium text-[#E8FF47]"
    >
      {label}
      <X className="size-3 opacity-80" />
    </button>
  )
}

function InboxDetail({
  invoice,
  onClose,
}: {
  invoice: InvoiceRow
  onClose: () => void
}) {
  const status = getInboxStatus(invoice)
  const title = [invoice.vendor ?? "Unknown vendor", invoice.invoice_number]
    .filter(Boolean)
    .join(" · ")

  return (
    <>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/80 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[15px] font-semibold tracking-tight">
              {title}
            </h2>
            <InboxStatusBadge status={status} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-8 gap-1.5" />
              }
            >
              Actions
              <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem disabled>Mark approved</DropdownMenuItem>
                <DropdownMenuItem disabled>Request review</DropdownMenuItem>
                <DropdownMenuItem disabled>Retry extraction</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close detail"
            onClick={onClose}
            className="text-muted-foreground"
          >
            <X strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="min-h-0 flex-1 gap-0">
        <div className="border-b border-border/80 px-4">
          <TabsList
            variant="line"
            className="h-10 w-auto gap-4 rounded-none bg-transparent p-0"
          >
            <TabsTrigger
              value="overview"
              className="rounded-none px-0 data-active:text-foreground after:bg-[#E8FF47]"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="lines"
              className="rounded-none px-0 data-active:text-foreground after:bg-[#E8FF47]"
            >
              Line Items
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="overview" className="m-0 space-y-5 p-4">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Extracted details
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField
                  label="Vendor"
                  value={invoice.vendor ?? "—"}
                  icon={<RefreshCw className="size-3 text-muted-foreground" />}
                />
                <DetailField
                  label="Invoice number"
                  value={invoice.invoice_number ?? "—"}
                />
                <DetailField
                  label="Invoice date"
                  value={formatInvoiceDate(invoice.issue_date)}
                  icon={<Calendar className="size-3 text-muted-foreground" />}
                />
                <DetailField
                  label="Total amount"
                  value={formatInvoiceMoney(invoice.amount, invoice.currency)}
                  highlight
                />
                <DetailField
                  label="Due date"
                  value={formatInvoiceDate(invoice.due_date)}
                  icon={<Calendar className="size-3 text-muted-foreground" />}
                />
                <DetailField
                  label="Tax"
                  value={
                    invoice.tax != null
                      ? formatInvoiceMoney(invoice.tax, invoice.currency)
                      : "—"
                  }
                />
              </div>
            </div>

            <DocumentPreview invoice={invoice} />
          </TabsContent>

          <TabsContent value="lines" className="m-0 p-4">
            {invoice.line_items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No line items extracted for this invoice.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {invoice.line_items.map((item, i) => (
                      <tr key={`${item.description}-${i}`}>
                        <td className="px-3 py-2.5">{item.description || "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                          {item.quantity ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                          {formatInvoiceMoney(item.amount, invoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </>
  )
}

function DetailField({
  label,
  value,
  icon,
  highlight,
}: {
  label: string
  value: string
  icon?: ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card/40 px-3 py-2.5",
        highlight && "border-[#E8FF47]/25 bg-[#E8FF47]/8"
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <p className="truncate text-[13px] font-medium">{value}</p>
        {icon}
      </div>
    </div>
  )
}

function DocumentPreview({ invoice }: { invoice: InvoiceRow }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          Document
        </h3>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Download"
            className="text-muted-foreground"
            disabled={!invoice.file_url}
          >
            <Download strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Fullscreen"
            className="text-muted-foreground"
            disabled
          >
            <Maximize2 strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="More"
            className="text-muted-foreground"
            disabled
          >
            <MoreHorizontal strokeWidth={1.75} />
          </Button>
        </div>
      </div>

      <div className="bg-zinc-950/40 p-4 md:p-6">
        <div className="mx-auto max-w-md rounded-sm bg-white px-6 py-7 text-zinc-900 shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">
                Invoice
              </p>
              <p className="mt-1 text-base font-semibold">
                {invoice.vendor ?? "Vendor"}
              </p>
            </div>
            <p className="font-mono text-xs text-zinc-500">
              {invoice.invoice_number ?? "—"}
            </p>
          </div>

          <dl className="mt-5 grid gap-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Invoice date</dt>
              <dd>{formatInvoiceDate(invoice.issue_date)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">Due date</dt>
              <dd className="rounded bg-[#E8FF47]/70 px-1.5 font-medium">
                {formatInvoiceDate(invoice.due_date)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-zinc-200 pt-3">
              <dt className="font-medium text-zinc-700">Total due</dt>
              <dd className="rounded bg-[#E8FF47]/70 px-1.5 font-semibold">
                {formatInvoiceMoney(invoice.amount, invoice.currency)}
              </dd>
            </div>
          </dl>

          {invoice.line_items.length > 0 ? (
            <ul className="mt-5 space-y-1.5 border-t border-zinc-200 pt-4 text-xs text-zinc-600">
              {invoice.line_items.slice(0, 3).map((item, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{item.description}</span>
                  <span className="shrink-0 font-mono">
                    {formatInvoiceMoney(item.amount, invoice.currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span>1 / 1</span>
        <span className="text-border">|</span>
        <span>100%</span>
      </div>
    </div>
  )
}
