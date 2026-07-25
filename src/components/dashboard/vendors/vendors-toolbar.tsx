"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ArrowUpDown, Filter, Search, X } from "lucide-react"

import {
  VENDOR_DEFAULT_FILTER,
  VENDOR_DEFAULT_SORT,
  VENDOR_FILTER_OPTIONS,
  VENDOR_SEARCH_DEBOUNCE_MS,
  VENDOR_SORT_OPTIONS,
  type VendorFilter,
  type VendorSort,
} from "@/constants/vendors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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

export function VendorsToolbar({
  query,
  resultCount,
  className,
}: {
  query: VendorQuery
  resultCount: number
  className?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [q, setQ] = useState(query.q)
  const [prevQueryQ, setPrevQueryQ] = useState(query.q)

  // Sync the search box when the URL's q changes from outside this component
  // (browser back/forward). Adjusted during render, per React's guidance,
  // rather than in an Effect.
  if (query.q !== prevQueryQ) {
    setPrevQueryQ(query.q)
    setQ(query.q)
  }

  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  }, [query])

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

  useEffect(() => {
    if (q === query.q) return
    const handle = window.setTimeout(() => {
      navigate({ q })
    }, VENDOR_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [q, query.q, pathname]) // eslint-disable-line react-hooks/exhaustive-deps -- debounce search

  const hasActive = !isDefaultVendorQuery(query)

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border px-4 py-3",
        isPending && "opacity-70",
        className,
      )}
    >
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or notes…"
            className="ps-8"
            aria-label="Search vendors"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={[...VENDOR_FILTER_OPTIONS]}
            value={query.filter}
            onValueChange={(value) => {
              if (value != null) navigate({ filter: value as VendorFilter })
            }}
          >
            <SelectTrigger
              size="sm"
              className="min-w-44 justify-between"
              aria-label="Filter vendors"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Filter className="size-3.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent align="end">
              {VENDOR_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={[...VENDOR_SORT_OPTIONS]}
            value={query.sort}
            onValueChange={(value) => {
              if (value != null) navigate({ sort: value as VendorSort })
            }}
          >
            <SelectTrigger
              size="sm"
              className="min-w-56 justify-between"
              aria-label="Sort vendors"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent align="end">
              {VENDOR_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("")
                startTransition(() => {
                  router.push(pathname)
                })
              }}
            >
              <X data-icon="inline-start" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {resultCount} vendor{resultCount === 1 ? "" : "s"}
        {query.q ? ` matching “${query.q}”` : ""}
      </p>
    </div>
  )
}
