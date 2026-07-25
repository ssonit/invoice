import { Users } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { ContentShell } from "@/components/dashboard/content-shell"
import { AddVendorButton } from "@/components/dashboard/vendors/vendor-form-dialog"
import { SubscriptionConfirmButtons } from "@/components/dashboard/vendors/subscription-confirm-buttons"
import {
  VendorsList,
  type VendorListItem,
} from "@/components/dashboard/vendors/vendors-list"
import { VendorsToolbar } from "@/components/dashboard/vendors/vendors-toolbar"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { formatInvoiceMoney, normalizeInvoice } from "@/lib/invoices"
import {
  detectSubscriptions,
  normalizeVendorKey,
  withConfirmationStatus,
  type SubscriptionConfirmation,
} from "@/lib/subscriptions"
import {
  VENDOR_FILTER,
  VENDOR_SORT,
  type VendorFilter,
  type VendorSort,
} from "@/constants/vendors"
import {
  escapeIlike,
  isDefaultVendorQuery,
  parseVendorQuery,
} from "@/lib/vendors/query"
import {
  SUBSCRIPTION_CYCLE_LABELS,
} from "@/constants/subscriptions"

function CycleBadge({ cycle }: { cycle: keyof typeof SUBSCRIPTION_CYCLE_LABELS }) {
  return (
    <Badge variant="outline" className="border-[#E8FF47]/35 bg-[#E8FF47]/10 text-[#E8FF47]">
      {SUBSCRIPTION_CYCLE_LABELS[cycle]}
    </Badge>
  )
}

function matchesFilter(vendor: VendorListItem, filter: VendorFilter): boolean {
  switch (filter) {
    case VENDOR_FILTER.ALL:
      return true
    case VENDOR_FILTER.HAS_INVOICES:
      return vendor.count > 0
    case VENDOR_FILTER.NO_INVOICES:
      return vendor.count === 0
    case VENDOR_FILTER.SUBSCRIPTION:
      return vendor.subscription != null && vendor.subscription.status !== "cancelled"
    case VENDOR_FILTER.NO_SUBSCRIPTION:
      return vendor.subscription == null
    case VENDOR_FILTER.NEEDS_CONFIRMATION:
      return vendor.subscription?.needsConfirmation === true
    case VENDOR_FILTER.CANCELLED:
      return vendor.subscription?.status === "cancelled"
  }
}

function sortVendors(vendors: VendorListItem[], sort: VendorSort): VendorListItem[] {
  const list = [...vendors]
  list.sort((a, b) => {
    switch (sort) {
      case VENDOR_SORT.TOTAL_DESC:
        return b.total - a.total || a.label.localeCompare(b.label)
      case VENDOR_SORT.TOTAL_ASC:
        return a.total - b.total || a.label.localeCompare(b.label)
      case VENDOR_SORT.NAME_ASC:
        return a.label.localeCompare(b.label)
      case VENDOR_SORT.NAME_DESC:
        return b.label.localeCompare(a.label)
      case VENDOR_SORT.COUNT_DESC:
        return b.count - a.count || a.label.localeCompare(b.label)
      case VENDOR_SORT.COUNT_ASC:
        return a.count - b.count || a.label.localeCompare(b.label)
      case VENDOR_SORT.LAST_DESC:
        return (b.lastDate || "").localeCompare(a.lastDate || "") || a.label.localeCompare(b.label)
      case VENDOR_SORT.LAST_ASC:
        return (a.lastDate || "").localeCompare(b.lastDate || "") || a.label.localeCompare(b.label)
      case VENDOR_SORT.CREATED_DESC:
        return b.createdAt.localeCompare(a.createdAt) || a.label.localeCompare(b.label)
      case VENDOR_SORT.CREATED_ASC:
        return a.createdAt.localeCompare(b.createdAt) || a.label.localeCompare(b.label)
    }
  })
  return list
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; sort?: string }>
}) {
  const rawParams = await searchParams
  const query = parseVendorQuery(rawParams)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let vendorsQuery = supabase
    .from("vendors")
    .select("id, name, name_key, notes, created_at")
    .eq("user_id", user!.id)

  if (query.q) {
    const pattern = `%${escapeIlike(query.q).replace(/"/g, "")}%`
    vendorsQuery = vendorsQuery.or(`name.ilike."${pattern}",notes.ilike."${pattern}"`)
  }

  if (query.sort === VENDOR_SORT.NAME_ASC) {
    vendorsQuery = vendorsQuery.order("name", { ascending: true })
  } else if (query.sort === VENDOR_SORT.NAME_DESC) {
    vendorsQuery = vendorsQuery.order("name", { ascending: false })
  } else if (query.sort === VENDOR_SORT.CREATED_ASC) {
    vendorsQuery = vendorsQuery.order("created_at", { ascending: true })
  } else if (query.sort === VENDOR_SORT.CREATED_DESC) {
    vendorsQuery = vendorsQuery.order("created_at", { ascending: false })
  } else {
    vendorsQuery = vendorsQuery.order("name", { ascending: true })
  }

  const [
    { data: vendorRowsInitial },
    { data: statsRows },
    { data: recentRows },
    { data: confirmationRows },
  ] = await Promise.all([
    vendorsQuery,
    supabase.from("vendor_invoice_stats").select("*").eq("user_id", user!.id),
    supabase.from("vendor_recent_invoices").select("*").eq("user_id", user!.id),
    supabase
      .from("subscription_confirmations")
      .select("vendor_key, status, confirmed_at")
      .eq("user_id", user!.id),
  ])

  const stats = statsRows ?? []
  // vendor_recent_invoices selects invoices.* (plus rn), so each row has the
  // same shape/coercion needs as a raw invoices row.
  const recentInvoices = (recentRows ?? []).map(normalizeInvoice)

  // When searching, skip orphan heal (orphans wouldn't match the filtered query anyway
  // until upserted). Still heal when browsing the full list. Sourced from the small
  // aggregate view (one row per distinct vendor) instead of the full invoice history.
  let vendorRows = vendorRowsInitial
  if (!query.q) {
    const existingKeys = new Set((vendorRowsInitial ?? []).map((row) => row.name_key))
    const now = new Date().toISOString()
    const orphanUpserts = stats
      .filter((row) => !existingKeys.has(row.vendor_key))
      .map((row) => ({
        user_id: user!.id,
        name: row.label.trim(),
        name_key: row.vendor_key,
        updated_at: now,
      }))
    if (orphanUpserts.length > 0) {
      await supabase.from("vendors").upsert(orphanUpserts, {
        onConflict: "user_id,name_key",
        ignoreDuplicates: true,
      })
      const refreshed = await supabase
        .from("vendors")
        .select("id, name, name_key, notes, created_at")
        .eq("user_id", user!.id)
        .order("name", { ascending: true })
      vendorRows = refreshed.data
    }
  }

  const confirmations = new Map<string, SubscriptionConfirmation>(
    (confirmationRows ?? []).map((row) => [
      row.vendor_key,
      { status: row.status as "active" | "cancelled", confirmedAt: row.confirmed_at },
    ]),
  )

  const subscriptions = withConfirmationStatus(
    detectSubscriptions(recentInvoices),
    confirmations,
  )
  const due = subscriptions.filter((s) => s.needsConfirmation)

  const statsByKey = new Map(stats.map((row) => [row.vendor_key, row]))

  const recentByKey = new Map<string, VendorListItem["invoices"]>()
  for (const invoice of recentInvoices) {
    if (!invoice.vendor) continue
    const key = normalizeVendorKey(invoice.vendor)
    const list = recentByKey.get(key) ?? []
    list.push({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount,
      currency: invoice.currency,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
    })
    recentByKey.set(key, list)
  }

  const vendorMap = new Map<string, VendorListItem>()

  for (const row of vendorRows ?? []) {
    const stat = statsByKey.get(row.name_key)
    vendorMap.set(row.name_key, {
      id: row.id,
      key: row.name_key,
      label: row.name,
      notes: row.notes,
      createdAt: row.created_at,
      // sum()/count() come back from PostgREST as numeric strings — coerce,
      // same reason normalizeInvoice() coerces amount/tax/confidence_score.
      total: stat ? Number(stat.total) : 0,
      currency: stat?.currency ?? null,
      count: stat ? Number(stat.count) : 0,
      lastDate: stat?.last_date ?? "",
      subscription: null,
      // Windowed (≤6) invoices for immediate display — VendorsList lazy-loads
      // the full per-vendor history when a vendor's detail Sheet is opened.
      invoices: recentByKey.get(row.name_key) ?? [],
    })
  }

  for (const vendor of vendorMap.values()) {
    const sub = subscriptions.find((s) => s.vendorKey === vendor.key)
    if (sub) {
      vendor.subscription = {
        cycle: sub.cycle,
        status: sub.status,
        needsConfirmation: sub.needsConfirmation,
        lastAmount: sub.lastAmount,
        lastIssueDate: sub.lastIssueDate,
        nextExpectedDate: sub.nextExpectedDate,
      }
    }
    vendor.invoices.sort((a, b) => (b.issue_date ?? "").localeCompare(a.issue_date ?? ""))
  }

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
          <section className="rounded-xl border border-[#E8FF47]/25 bg-[#E8FF47]/4">
            <div className="border-b border-[#E8FF47]/20 px-4 py-3">
              <h2 className="text-sm font-semibold tracking-tight">Needs your confirmation</h2>
              <p className="text-xs text-muted-foreground">
                These look like recurring charges. Still using them?
              </p>
            </div>
            <ul className="divide-y divide-border">
              {due.map((sub) => (
                <li
                  key={sub.vendorKey}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{sub.vendorLabel}</p>
                      <CycleBadge cycle={sub.cycle} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Last charge {formatInvoiceMoney(sub.lastAmount, sub.currency)} on{" "}
                      {sub.lastIssueDate}
                    </p>
                  </div>
                  <SubscriptionConfirmButtons vendorKey={sub.vendorKey} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

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
      </div>
    </ContentShell>
  )
}
