"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  isDefaultInvoiceListQuery,
  type InvoiceListQuery,
  type InvoiceListStatus,
} from "@/lib/invoices/query"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS: { label: string; value: InvoiceListStatus }[] = [
  { label: "All", value: "all" },
  { label: "Needs review", value: "review" },
  { label: "OK", value: "ok" },
]

const SEARCH_DEBOUNCE_MS = 300

function buildHref(pathname: string, next: InvoiceListQuery): string {
  const params = new URLSearchParams()
  if (next.vendor) params.set("vendor", next.vendor)
  if (next.status !== "all") params.set("status", next.status)
  if (next.page !== 1) params.set("page", String(next.page))
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export function InvoicesToolbar({
  query,
  resultCount,
}: {
  query: InvoiceListQuery
  resultCount: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [vendor, setVendor] = useState(query.vendor)
  const [prevQueryVendor, setPrevQueryVendor] = useState(query.vendor)

  // Sync local input state when the URL's vendor value changes from outside
  // this component (browser back/forward). Adjusted during render, per
  // React's guidance, rather than in an Effect.
  if (query.vendor !== prevQueryVendor) {
    setPrevQueryVendor(query.vendor)
    setVendor(query.vendor)
  }

  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  }, [query])

  function navigate(patch: Partial<InvoiceListQuery>) {
    const current = queryRef.current
    const next: InvoiceListQuery = {
      vendor: patch.vendor !== undefined ? patch.vendor.trim() : current.vendor,
      status: patch.status ?? current.status,
      // Any filter change resets to page 1; explicit page changes pass page directly.
      page: patch.page ?? 1,
    }
    startTransition(() => {
      router.push(buildHref(pathname, next))
    })
  }

  useEffect(() => {
    if (vendor === query.vendor) return
    const handle = window.setTimeout(() => navigate({ vendor }), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce search
  }, [vendor, query.vendor, pathname])

  const hasActive = !isDefaultInvoiceListQuery(query)

  return (
    <div className={cn("flex flex-col gap-3", isPending && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 max-w-xs flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="Filter by vendor..."
            className="h-8 ps-8"
            aria-label="Filter by vendor"
          />
        </div>
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={query.status === option.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate({ status: option.value })}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {hasActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setVendor("")
              startTransition(() => router.push(pathname))
            }}
          >
            <X data-icon="inline-start" />
            Clear
          </Button>
        ) : null}
      </div>
      <p className="text-[12px] text-muted-foreground">{resultCount} invoice(s)</p>
    </div>
  )
}
