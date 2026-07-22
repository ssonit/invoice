import { Users } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { ContentShell } from "@/components/dashboard/content-shell"
import { SubscriptionConfirmButtons } from "@/components/dashboard/vendors/subscription-confirm-buttons"
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

function CycleBadge({ cycle }: { cycle: "monthly" | "yearly" }) {
  return (
    <Badge variant="outline" className="border-[#E8FF47]/35 bg-[#E8FF47]/10 text-[#E8FF47]">
      {cycle === "monthly" ? "Monthly" : "Yearly"}
    </Badge>
  )
}

export default async function VendorsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: invoiceRows }, { data: confirmationRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("subscription_confirmations")
      .select("vendor_key, status, confirmed_at")
      .eq("user_id", user!.id),
  ])

  const invoices = (invoiceRows ?? []).map(normalizeInvoice)

  const confirmations = new Map<string, SubscriptionConfirmation>(
    (confirmationRows ?? []).map((row) => [
      row.vendor_key,
      { status: row.status as "active" | "cancelled", confirmedAt: row.confirmed_at },
    ]),
  )

  const subscriptions = withConfirmationStatus(detectSubscriptions(invoices), confirmations)
  const due = subscriptions.filter((s) => s.needsConfirmation)

  const vendorTotals = new Map<
    string,
    { label: string; total: number; currency: string | null; count: number; lastDate: string }
  >()
  for (const invoice of invoices) {
    if (!invoice.vendor) continue
    const key = normalizeVendorKey(invoice.vendor)
    const existing = vendorTotals.get(key)
    if (existing) {
      existing.total += invoice.amount ?? 0
      existing.count += 1
      if (invoice.issue_date && invoice.issue_date > existing.lastDate) {
        existing.lastDate = invoice.issue_date
      }
    } else {
      vendorTotals.set(key, {
        label: invoice.vendor,
        total: invoice.amount ?? 0,
        currency: invoice.currency,
        count: 1,
        lastDate: invoice.issue_date ?? "",
      })
    }
  }

  return (
    <ContentShell
      title="Vendors"
      description="Every vendor seen in your invoices, with subscription reminders for recurring charges."
    >
      <div className="flex flex-col gap-5">
        {due.length > 0 ? (
          <section className="rounded-xl border border-[#E8FF47]/25 bg-[#E8FF47]/[0.04]">
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
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold tracking-tight">All vendors</h2>
            <p className="text-xs text-muted-foreground">{vendorTotals.size} vendor(s)</p>
          </div>

          {vendorTotals.size === 0 ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No vendors yet</EmptyTitle>
                <EmptyDescription>
                  Vendors appear here once you have invoices with a vendor name.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {[...vendorTotals.entries()]
                .sort((a, b) => b[1].total - a[1].total)
                .map(([key, vendor]) => {
                  const sub = subscriptions.find((s) => s.vendorKey === key)
                  return (
                    <li
                      key={key}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{vendor.label}</p>
                          {sub ? <CycleBadge cycle={sub.cycle} /> : null}
                          {sub?.status === "cancelled" ? (
                            <Badge variant="secondary">Cancelled</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {vendor.count} invoice(s) · last {vendor.lastDate || "—"}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatInvoiceMoney(vendor.total, vendor.currency)}
                      </p>
                    </li>
                  )
                })}
            </ul>
          )}
        </section>
      </div>
    </ContentShell>
  )
}
