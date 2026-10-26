"use client"

import { useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Calendar,
  ChevronDown,
  Download,
  Maximize2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react"

import {
  retryInvoiceExtraction,
  setInvoiceReviewStatus,
  updateInvoice,
} from "@/app/dashboard/invoices/actions"
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  getInboxStatus,
  type InvoiceRow,
} from "@/lib/invoices"
import { INVOICE_REVIEW_STATUS } from "@/lib/validation/invoices"
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n"
import { cn } from "@/lib/utils"
import { InboxStatusBadge } from "@/components/dashboard/inbox/inbox-status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type EditForm = {
  vendor: string
  invoice_number: string
  issue_date: string
  due_date: string
  amount: string
  currency: string
  tax: string
}

function toEditForm(invoice: InvoiceRow): EditForm {
  return {
    vendor: invoice.vendor ?? "",
    invoice_number: invoice.invoice_number ?? "",
    issue_date: invoice.issue_date ?? "",
    due_date: invoice.due_date ?? "",
    amount: invoice.amount != null ? String(invoice.amount) : "",
    currency: invoice.currency ?? "",
    tax: invoice.tax != null ? String(invoice.tax) : "",
  }
}

export function InvoiceDetail({
  invoice,
  onClose,
}: {
  invoice: InvoiceRow
  onClose?: () => void
}) {
  const { t } = useDashboardI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<EditForm | null>(null)
  const isEditing = form !== null
  const status = getInboxStatus(invoice)
  const title = [invoice.vendor ?? t.detail.unknownVendor, invoice.invoice_number]
    .filter(Boolean)
    .join(" · ")

  function setField(field: keyof EditForm, value: string) {
    setForm((current) => (current ? { ...current, [field]: value } : current))
  }

  function save() {
    if (!form) return
    startTransition(async () => {
      const result = await updateInvoice({ id: invoice.id, ...form })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(t.detail.updated)
      setForm(null)
      router.refresh()
    })
  }

  function setReview(next: "approved" | "review") {
    startTransition(async () => {
      const result = await setInvoiceReviewStatus({ id: invoice.id, status: next })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        next === INVOICE_REVIEW_STATUS.APPROVED
          ? t.detail.approved
          : t.detail.markedReview
      )
      router.refresh()
    })
  }

  function retry() {
    startTransition(async () => {
      const toastId = toast.loading(t.detail.rereading)
      const result = await retryInvoiceExtraction({ id: invoice.id })
      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }
      toast.success(t.detail.extractionUpdated, { id: toastId })
      setForm(null)
      router.refresh()
    })
  }

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
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={isPending}
                />
              }
            >
              {t.detail.actions}
              <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={status === "approved"}
                  onClick={() => setReview(INVOICE_REVIEW_STATUS.APPROVED)}
                >
                  {t.detail.markApproved}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={status === "review"}
                  onClick={() => setReview(INVOICE_REVIEW_STATUS.REVIEW)}
                >
                  {t.detail.requestReview}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!invoice.file_url} onClick={retry}>
                  {t.detail.retryExtraction}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {onClose ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.detail.closeDetail}
              onClick={onClose}
              className="text-muted-foreground"
            >
              <X strokeWidth={1.75} />
            </Button>
          ) : null}
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
              {t.detail.overview}
            </TabsTrigger>
            <TabsTrigger
              value="lines"
              className="rounded-none px-0 data-active:text-foreground after:bg-[#E8FF47]"
            >
              {t.detail.lineItems}
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="overview" className="m-0 space-y-5 p-4">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t.detail.extractedDetails}
                </h3>
                {isEditing ? (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => setForm(null)}
                    >
                      {t.detail.cancel}
                    </Button>
                    <Button size="sm" disabled={isPending} onClick={save}>
                      {isPending ? t.detail.saving : t.detail.save}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setForm(toEditForm(invoice))}
                  >
                    <Pencil className="size-3" />
                    {t.detail.edit}
                  </Button>
                )}
              </div>
              {form ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <EditField label={t.detail.vendor}>
                    <Input
                      value={form.vendor}
                      onChange={(e) => setField("vendor", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.invoiceNumber}>
                    <Input
                      value={form.invoice_number}
                      onChange={(e) => setField("invoice_number", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.invoiceDate}>
                    <Input
                      type="date"
                      value={form.issue_date}
                      onChange={(e) => setField("issue_date", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.dueDate}>
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setField("due_date", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.totalAmount}>
                    <Input
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => setField("amount", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.currency}>
                    <Input
                      value={form.currency}
                      maxLength={3}
                      placeholder="USD"
                      onChange={(e) => setField("currency", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.tax}>
                    <Input
                      inputMode="decimal"
                      value={form.tax}
                      onChange={(e) => setField("tax", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField
                    label={t.detail.vendor}
                    value={invoice.vendor ?? "—"}
                    icon={<RefreshCw className="size-3 text-muted-foreground" />}
                  />
                  <DetailField
                    label={t.detail.invoiceNumber}
                    value={invoice.invoice_number ?? "—"}
                  />
                  <DetailField
                    label={t.detail.invoiceDate}
                    value={formatInvoiceDate(invoice.issue_date)}
                    icon={<Calendar className="size-3 text-muted-foreground" />}
                  />
                  <DetailField
                    label={t.detail.totalAmount}
                    value={formatInvoiceMoney(invoice.amount, invoice.currency)}
                    highlight
                  />
                  <DetailField
                    label={t.detail.dueDate}
                    value={formatInvoiceDate(invoice.due_date)}
                    icon={<Calendar className="size-3 text-muted-foreground" />}
                  />
                  <DetailField
                    label={t.detail.tax}
                    value={
                      invoice.tax != null
                        ? formatInvoiceMoney(invoice.tax, invoice.currency)
                        : "—"
                    }
                  />
                </div>
              )}
            </div>

            <DocumentPreview invoice={invoice} />
          </TabsContent>

          <TabsContent value="lines" className="m-0 p-4">
            {invoice.line_items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t.detail.noLineItems}
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t.detail.description}</th>
                      <th className="px-3 py-2 font-medium">{t.detail.qty}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.detail.amount}</th>
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

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block rounded-xl border border-border/80 bg-card/40 px-3 py-2.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
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
  const { t } = useDashboardI18n()
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t.detail.document}
        </h3>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.detail.download}
            className="text-muted-foreground"
            disabled={!invoice.file_url}
          >
            <Download strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.detail.fullscreen}
            className="text-muted-foreground"
            disabled
          >
            <Maximize2 strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.detail.more}
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
                {t.detail.invoiceHeading}
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
              <dt className="text-zinc-500">{t.detail.invoiceDate}</dt>
              <dd>{formatInvoiceDate(invoice.issue_date)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-zinc-500">{t.detail.dueDate}</dt>
              <dd className="rounded bg-[#E8FF47]/70 px-1.5 font-medium">
                {formatInvoiceDate(invoice.due_date)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-zinc-200 pt-3">
              <dt className="font-medium text-zinc-700">{t.detail.totalDue}</dt>
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
