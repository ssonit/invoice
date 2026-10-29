"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
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
  formatInvoiceMoney,
  getInboxStatus,
  inboxGroupLabel,
  inboxTimeLabel,
  type InvoiceRow,
} from "@/lib/invoices"
import { FALLBACK_TIME_ZONE, INTL_LOCALE } from "@/lib/dashboard/format-date"
import type { InboxListQuery } from "@/lib/invoices/inbox-query"
import { paginationRange } from "@/lib/pagination"
import type { DashboardDictionary } from "@/lib/dashboard/i18n"
import { cn } from "@/lib/utils"
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n"
import { InboxStatusBadge } from "@/components/dashboard/inbox/inbox-status-badge"
import { InvoiceDetail } from "@/components/dashboard/invoice-detail"
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

function sourceSubtitle(invoice: InvoiceRow, t: DashboardDictionary): string {
  if (invoice.source === INBOX_SOURCE_FILTER.UPLOAD) return t.inbox.manualUpload
  // Only show an address we actually received; never infer one from the vendor name.
  return invoice.source_sender ?? t.inbox.forwardedEmail
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

const subscribeToNothing = () => () => {}
const getBrowserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
const getServerTimeZone = () => FALLBACK_TIME_ZONE

// Server render uses UTC; the browser swaps in its own zone after hydration
// without a hydration mismatch.
function useViewerTimeZone(): string {
  return useSyncExternalStore(subscribeToNothing, getBrowserTimeZone, getServerTimeZone)
}

type Group = { label: string; items: InvoiceRow[] }

// inboxGroupLabel / inboxTimeLabel return English "Today" / "Yesterday".
function groupLabel(label: string, t: DashboardDictionary): string {
  if (label === "Today") return t.inbox.today
  if (label === "Yesterday") return t.inbox.yesterday
  return label
}

function timeLabel(label: string, t: DashboardDictionary): string {
  return label === "Yesterday" ? t.inbox.yesterday : label
}

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
  const { t, locale } = useDashboardI18n()
  const timeZone = useViewerTimeZone()
  const labelOptions = { locale: INTL_LOCALE[locale], timeZone }
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
      const label = inboxGroupLabel(inv.created_at, nowIso, labelOptions)
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
          {t.inbox.title}
        </h1>
        <p className="text-[12px] text-muted-foreground tabular-nums">
          {t.inbox.countOf.replace("{count}", String(totalCount)).replace("{total}", String(grandTotal))}
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
                  placeholder={t.inbox.searchPlaceholder}
                  className="h-8 bg-muted/30 pl-8"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t.inbox.filterLabel}
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
                    <DropdownMenuLabel>{t.inbox.statusHeading}</DropdownMenuLabel>
                    {INBOX_STATUS_FILTER_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => navigate({ status: opt.value })}
                      >
                        <span className="flex-1">{t.inbox.statusFilters[opt.value] ?? opt.label}</span>
                        {query.status === opt.value ? (
                          <Check className="size-3.5 text-[#E8FF47]" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{t.inbox.sourceHeading}</DropdownMenuLabel>
                    {INBOX_SOURCE_FILTER_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        onClick={() => navigate({ source: opt.value })}
                      >
                        <span className="flex-1">{t.inbox.sourceFilters[opt.value] ?? opt.label}</span>
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
                        {t.inbox.clearFilters}
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
                    label={t.inbox.statusFilters[query.status] ?? query.status}
                    onClear={() => navigate({ status: INBOX_DEFAULT_STATUS_FILTER })}
                  />
                ) : null}
                {query.source !== INBOX_SOURCE_FILTER.ALL ? (
                  <FilterChip
                    label={t.inbox.sourceFilters[query.source] ?? query.source}
                    onClear={() => navigate({ source: INBOX_DEFAULT_SOURCE_FILTER })}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <ScrollArea className="min-h-0 flex-1">
            {groups.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {t.inbox.noMatches}
              </p>
            ) : (
              <div className="pb-2">
                {groups.map((group) => (
                  <div key={group.label}>
                    <p className="sticky top-0 z-10 bg-background/95 px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground backdrop-blur">
                      {groupLabel(group.label, t)}
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
                                    {invoice.vendor ?? t.detail.unknownVendor}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-muted-foreground">
                                    {timeLabel(inboxTimeLabel(invoice.created_at, nowIso, labelOptions), t)}
                                  </span>
                                </span>
                                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                  {sourceSubtitle(invoice, t)}
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
              {t.inbox.rangeOf
                .replace("{start}", String(rangeStart))
                .replace("{end}", String(rangeEnd))
                .replace("{total}", String(totalCount))}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.inbox.previousPage}
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
                aria-label={t.inbox.nextPage}
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
              {t.inbox.selectPrompt}
            </div>
          ) : (
            <InvoiceDetail
              key={selected.id}
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
