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
import { deleteVendor, getVendorInvoices } from "@/app/dashboard/vendors/actions"
import { SubscriptionConfirmButtons } from "@/components/dashboard/vendors/subscription-confirm-buttons"
import { VendorFormDialog } from "@/components/dashboard/vendors/vendor-form-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { formatInvoiceDate, formatInvoiceMoney } from "@/lib/invoices"
import type { SubscriptionStatus } from "@/lib/subscriptions"
import { cn } from "@/lib/utils"

export type VendorListInvoice = {
  id: string
  invoice_number: string | null
  amount: number | null
  currency: string | null
  issue_date: string | null
  due_date: string | null
}

export type VendorListItem = {
  id: string
  key: string
  label: string
  notes: string | null
  createdAt: string
  total: number
  currency: string | null
  count: number
  lastDate: string
  subscription: {
    cycle: SubscriptionCycleConstant
    status: SubscriptionStatus
    needsConfirmation: boolean
    lastAmount: number | null
    lastIssueDate: string
    nextExpectedDate: string
  } | null
  invoices: VendorListInvoice[]
}

function CycleBadge({ cycle }: { cycle: SubscriptionCycleConstant }) {
  return (
    <Badge variant="outline" className="border-[#E8FF47]/35 bg-[#E8FF47]/10 text-[#E8FF47]">
      {SUBSCRIPTION_CYCLE_LABELS[cycle]}
    </Badge>
  )
}

function statusLabel(status: SubscriptionStatus): string {
  switch (status) {
    case "cancelled":
      return "Cancelled"
    case "confirmed_active":
      return "Active"
    case "due":
      return "Due for confirmation"
    case "upcoming":
      return "Upcoming"
  }
}

export function VendorsList({ vendors }: { vendors: VendorListItem[] }) {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [fullInvoices, setFullInvoices] = useState<VendorListInvoice[] | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()
  const [isLoadingInvoices, startLoadInvoices] = useTransition()

  // Triggered directly from the row click (not an Effect) — this responds to
  // a discrete user action, not something to "synchronize" on every render.
  function selectVendor(key: string) {
    setSelectedKey(key)
    setFullInvoices(null)
    startLoadInvoices(async () => {
      const result = await getVendorInvoices(key)
      if (result.ok) setFullInvoices(result.invoices)
    })
  }

  const pageCount = Math.max(1, Math.ceil(vendors.length / VENDOR_LIST_PAGE_SIZE))
  const pageIndex = Math.min(page, pageCount - 1)
  const pageItems = vendors.slice(
    pageIndex * VENDOR_LIST_PAGE_SIZE,
    pageIndex * VENDOR_LIST_PAGE_SIZE + VENDOR_LIST_PAGE_SIZE,
  )

  const selected = selectedKey
    ? (vendors.find((v) => v.key === selectedKey) ?? null)
    : null

  function confirmDelete() {
    if (!selected) return
    startDelete(async () => {
      const result = await deleteVendor({ id: selected.id })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Vendor deleted.")
      setDeleteOpen(false)
      setSelectedKey(null)
      router.refresh()
    })
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {pageItems.map((vendor) => {
          const sub = vendor.subscription
          return (
            <li key={vendor.id}>
              <button
                type="button"
                onClick={() => selectVendor(vendor.key)}
                className={cn(
                  "flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left text-sm",
                  "transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
                )}
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
                <div className="flex shrink-0 items-center gap-2">
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatInvoiceMoney(vendor.total, vendor.currency)}
                  </p>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </div>
              </button>
            </li>
          )
        })}
      </ul>

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

      <Sheet
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelectedKey(null)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.label}</SheetTitle>
                <SheetDescription>
                  {selected.count} invoice(s) · last {selected.lastDate || "—"}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil data-icon="inline-start" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 data-icon="inline-start" />
                    Delete
                  </Button>
                </div>

                {selected.notes ? (
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Notes</p>
                    <p className="mt-0.5 text-sm whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Total spent</p>
                    <p className="mt-0.5 font-mono text-sm tabular-nums">
                      {formatInvoiceMoney(selected.total, selected.currency)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Invoices</p>
                    <p className="mt-0.5 text-sm font-medium">{selected.count}</p>
                  </div>
                </div>

                {selected.subscription ? (
                  <div className="rounded-lg border border-border px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">Subscription</p>
                      <CycleBadge cycle={selected.subscription.cycle} />
                      <Badge variant="secondary">
                        {statusLabel(selected.subscription.status)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                      <p>
                        Last charge{" "}
                        {formatInvoiceMoney(
                          selected.subscription.lastAmount,
                          selected.currency,
                        )}{" "}
                        on {selected.subscription.lastIssueDate}
                      </p>
                      <p>Next expected {selected.subscription.nextExpectedDate}</p>
                    </div>
                    {selected.subscription.needsConfirmation ? (
                      <div className="mt-3">
                        <SubscriptionConfirmButtons vendorKey={selected.key} />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-sm font-medium">Invoices</p>
                    {isLoadingInvoices ? (
                      <Spinner className="size-3.5 text-muted-foreground" />
                    ) : null}
                  </div>
                  {(fullInvoices ?? selected.invoices).length === 0 ? (
                    <p className="rounded-lg border border-border px-3 py-3 text-xs text-muted-foreground">
                      No invoices linked yet.
                    </p>
                  ) : (
                    <ul className="rounded-lg border border-border">
                      {(fullInvoices ?? selected.invoices).map((invoice, index) => (
                        <li key={invoice.id}>
                          {index > 0 ? <Separator /> : null}
                          <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {invoice.invoice_number || "No invoice #"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatInvoiceDate(invoice.issue_date)}
                                {invoice.due_date
                                  ? ` · due ${formatInvoiceDate(invoice.due_date)}`
                                  : ""}
                              </p>
                            </div>
                            <p className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                              {formatInvoiceMoney(invoice.amount, invoice.currency)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <VendorFormDialog
                key={selected.id}
                open={editOpen}
                onOpenChange={setEditOpen}
                title="Edit vendor"
                description="Renaming updates matching invoice vendor names."
                submitLabel="Save"
                initial={{
                  id: selected.id,
                  name: selected.label,
                  notes: selected.notes ?? "",
                }}
              />

              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selected.label}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the vendor
                      {selected.count > 0
                        ? ` and clears the vendor name on ${selected.count} linked invoice(s)`
                        : ""}
                      . Invoice amounts are kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={(e) => {
                        e.preventDefault()
                        confirmDelete()
                      }}
                    >
                      {isDeleting ? <Spinner data-icon="inline-start" /> : null}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
