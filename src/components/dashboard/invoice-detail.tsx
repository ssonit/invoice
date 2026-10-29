"use client"

import { useState, useTransition, type ReactNode } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Calendar,
  ChevronDown,
  Download,
  Maximize2,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"

import {
  deleteInvoice,
  previewInvoiceExtraction,
  setInvoiceReviewStatus,
  updateInvoice,
} from "@/app/dashboard/invoices/actions"
import {
  formatInvoiceDate,
  formatInvoiceMoney,
  getInboxStatus,
  type InvoiceRow,
  type InvoiceLineItem,
} from "@/lib/invoices"
import { INTL_LOCALE } from "@/lib/dashboard/format-date"
import { INVOICE_REVIEW_STATUS } from "@/lib/validation/invoices"
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n"
import { cn } from "@/lib/utils"
import { mimeTypeFromPath } from "@/lib/invoices/file-type"
import { InboxStatusBadge } from "@/components/dashboard/inbox/inbox-status-badge"
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
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
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
  line_items?: InvoiceLineItem[]
}

function toEditForm(invoice: Pick<InvoiceRow, "vendor" | "invoice_number" | "issue_date" | "due_date" | "amount" | "currency" | "tax">): EditForm {
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
  const { t, locale } = useDashboardI18n()
  const intlLocale = INTL_LOCALE[locale]
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState<EditForm | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const isPreview = form?.line_items !== undefined
  const isEditing = form !== null
  const status = getInboxStatus(invoice)
  const title = [invoice.vendor ?? t.detail.unknownVendor, invoice.invoice_number]
    .filter(Boolean)
    .join(" · ")

  function setField(field: Exclude<keyof EditForm, "line_items">, value: string) {
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

  function remove() {
    startTransition(async () => {
      const result = await deleteInvoice({ id: invoice.id })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(t.detail.deleted)
      setIsDeleteOpen(false)
      onClose?.()
      router.refresh()
    })
  }

  function retry() {
    startTransition(async () => {
      const toastId = toast.loading(t.detail.rereading)
      const result = await previewInvoiceExtraction({ id: invoice.id })
      if (!result.ok) {
        toast.error(result.error, { id: toastId })
        return
      }
      toast.success(t.detail.previewReady, { id: toastId })
      setForm({ ...toEditForm(result.extraction), line_items: result.extraction.line_items })
      setActiveTab("overview")
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
                  disabled={isPending || isEditing}
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
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setIsDeleteOpen(true)}
                >
                  <Trash2 />
                  {t.detail.delete}
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-h-0 flex-1 gap-0">
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

        {isPreview ? (
          <p role="status" className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
            {t.detail.previewHelp}
          </p>
        ) : null}

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
                    disabled={isPending}
                    onClick={() => setForm(toEditForm(invoice))}
                  >
                    <Pencil className="size-3" />
                    {t.detail.edit}
                  </Button>
                )}
              </div>
              {form ? (
                <FieldGroup className="grid gap-3 sm:grid-cols-2">
                  <EditField label={t.detail.vendor} previous={isPreview ? invoice.vendor ?? "—" : undefined}>
                    <Input
                      value={form.vendor}
                      onChange={(e) => setField("vendor", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.invoiceNumber} previous={isPreview ? invoice.invoice_number ?? "—" : undefined}>
                    <Input
                      value={form.invoice_number}
                      onChange={(e) => setField("invoice_number", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.invoiceDate} previous={isPreview ? formatInvoiceDate(invoice.issue_date, intlLocale) : undefined}>
                    <Input
                      type="date"
                      value={form.issue_date}
                      onChange={(e) => setField("issue_date", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.dueDate} previous={isPreview ? formatInvoiceDate(invoice.due_date, intlLocale) : undefined}>
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setField("due_date", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.totalAmount} previous={isPreview ? formatInvoiceMoney(invoice.amount, invoice.currency) : undefined}>
                    <Input
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => setField("amount", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.currency} previous={isPreview ? invoice.currency ?? "—" : undefined}>
                    <Input
                      value={form.currency}
                      maxLength={3}
                      placeholder="USD"
                      onChange={(e) => setField("currency", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                  <EditField label={t.detail.tax} previous={isPreview ? formatInvoiceMoney(invoice.tax, invoice.currency) : undefined}>
                    <Input
                      inputMode="decimal"
                      value={form.tax}
                      onChange={(e) => setField("tax", e.target.value)}
                      disabled={isPending}
                    />
                  </EditField>
                </FieldGroup>
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
                  {invoice.source_sender ? (
                    <DetailField label={t.detail.sender} value={invoice.source_sender} />
                  ) : null}
                  <DetailField
                    label={t.detail.invoiceDate}
                    value={formatInvoiceDate(invoice.issue_date, intlLocale)}
                    icon={<Calendar className="size-3 text-muted-foreground" />}
                  />
                  <DetailField
                    label={t.detail.totalAmount}
                    value={formatInvoiceMoney(invoice.amount, invoice.currency)}
                    highlight
                  />
                  <DetailField
                    label={t.detail.dueDate}
                    value={formatInvoiceDate(invoice.due_date, intlLocale)}
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
            {isPreview ? (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm">{t.detail.savedLineItems}</summary>
                <ul className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
                  {invoice.line_items.length === 0 ? <li>{t.detail.noLineItems}</li> : invoice.line_items.map((item, i) => (
                    <li key={i}>
                      {item.description} · {item.quantity ?? "—"} × {formatInvoiceMoney(item.unit_price, invoice.currency)} = {formatInvoiceMoney(item.amount, invoice.currency)}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {(form?.line_items ?? invoice.line_items).length === 0 ? (
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
                      <th className="px-3 py-2 text-right font-medium">{t.detail.unitPrice}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.detail.amount}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(form?.line_items ?? invoice.line_items).map((item, i) => (
                      <tr key={`${item.description}-${i}`}>
                        <td className="px-3 py-2.5">{item.description || "—"}</td>
                        <td className="px-3 py-2.5 text-muted-foreground tabular-nums">
                          {item.quantity ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                          {formatInvoiceMoney(item.unit_price, isPreview ? form.currency : invoice.currency)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums">
                          {formatInvoiceMoney(item.amount, isPreview ? form.currency : invoice.currency)}
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

      <AlertDialog open={isDeleteOpen} onOpenChange={(next) => !isPending && setIsDeleteOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.detail.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.detail.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t.detail.cancel}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault()
                remove()
              }}
            >
              {isPending ? t.detail.deleting : t.detail.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function EditField({ label, previous, children }: { label: string; previous?: string; children: ReactNode }) {
  const { t } = useDashboardI18n()
  return (
    <Field className="rounded-xl border border-border/80 p-3">
      <FieldLabel className="flex-col items-stretch">
        {label}
        {children}
      </FieldLabel>
      {previous !== undefined ? <FieldDescription>{t.detail.savedValue.replace("{value}", previous)}</FieldDescription> : null}
    </Field>
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
  const mimeType = invoice.file_url ? mimeTypeFromPath(invoice.file_url) : null
  const fileUrl = `/api/invoices/${invoice.id}/file`
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h3 className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t.detail.document}
        </h3>
        {mimeType ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" nativeButton={false}
              render={<a href={`${fileUrl}?download=1`} download />} aria-label={t.detail.download}>
              <Download data-icon="inline-start" />
            </Button>
            <Button variant="ghost" size="icon-sm" nativeButton={false}
              render={<a href={fileUrl} target="_blank" rel="noopener noreferrer" />} aria-label={t.detail.fullscreen}>
              <Maximize2 data-icon="inline-start" />
            </Button>
          </div>
        ) : null}
      </div>
      {mimeType === "application/pdf" ? (
        <iframe src={fileUrl} title={t.detail.document} className="h-[32rem] w-full" />
      ) : mimeType ? (
        <Image src={fileUrl} alt={t.detail.document} width={1000} height={1400} unoptimized className="h-auto w-full" />
      ) : (
        <p className="p-6 text-sm text-muted-foreground">{t.detail.noOriginalFile}</p>
      )}
    </div>
  )
}
