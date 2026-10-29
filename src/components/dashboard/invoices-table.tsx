"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Inbox } from "lucide-react";
import { getColumns } from "./columns";
import { useDashboardI18n } from "./dashboard-i18n";
import { InvoicesToolbar } from "./invoices-toolbar";
import { InvoiceDetail } from "./invoice-detail";
import { INTL_LOCALE } from "@/lib/dashboard/format-date";
import { normalizeSearchText } from "@/lib/invoices/search";
import type { InvoiceRow } from "@/lib/invoices";
import type { InvoiceListQuery } from "@/lib/invoices/query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function InvoicesTable({
  data: serverData,
  query,
  totalCount: serverTotalCount,
  pageCount,
  isEmailIntakeEnabled,
}: {
  data: InvoiceRow[];
  query: InvoiceListQuery;
  totalCount: number;
  pageCount: number;
  isEmailIntakeEnabled: boolean;
}) {
  const { t, locale } = useDashboardI18n();
  const columns = useMemo(() => getColumns(t, INTL_LOCALE[locale]), [t, locale]);
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Rows hidden the moment a delete succeeds, before the refreshed server data
  // arrives; once a refresh drops them from `serverData` they no longer count.
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(new Set());
  // What the user has typed but the server hasn't answered yet.
  const [typedSearch, setTypedSearch] = useState<string | null>(null);

  const withoutDeleted = useMemo(
    () => serverData.filter((invoice) => !deletedIds.has(invoice.id)),
    [serverData, deletedIds],
  );
  const removedCount = serverData.length - withoutDeleted.length;
  const isSearchPending =
    typedSearch !== null &&
    normalizeSearchText(typedSearch) !== normalizeSearchText(query.vendor);
  // Filter the loaded page instantly while the server query is in flight.
  const data = useMemo(() => {
    if (!isSearchPending) return withoutDeleted;
    const needle = normalizeSearchText(typedSearch ?? "");
    return withoutDeleted.filter((invoice) =>
      normalizeSearchText(`${invoice.vendor ?? ""} ${invoice.invoice_number ?? ""}`).includes(needle),
    );
  }, [withoutDeleted, isSearchPending, typedSearch]);
  const totalCount = isSearchPending ? data.length : Math.max(serverTotalCount - removedCount, 0);
  const selectedInvoice = data.find((invoice) => invoice.id === selectedId) ?? null;

  // TanStack Table returns non-memoizable functions; React Compiler skips it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function goToPage(page: number) {
    const params = new URLSearchParams();
    if (query.vendor) params.set("vendor", query.vendor);
    if (query.status !== "all") params.set("status", query.status);
    if (page !== 1) params.set("page", String(page));
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  // Onboarding copy is only right for an account with no invoices at all; a
  // filtered search that matches nothing falls through to the table's
  // "no matches" row, keeping the toolbar's Clear button reachable.
  const hasActiveFilters = Boolean(query.vendor) || query.status !== "all" || isSearchPending;
  const isEmpty = data.length === 0 && totalCount === 0 && !hasActiveFilters;

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-3">
        <InvoicesToolbar query={query} resultCount={totalCount} onSearchChange={setTypedSearch} />
        <Empty className="rounded-[14px] border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>{t.invoicesList.emptyTitle}</EmptyTitle>
            <EmptyDescription>
              {isEmailIntakeEnabled
                ? t.invoicesList.emptyWithEmail
                : t.invoicesList.emptyNoEmail}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <InvoicesToolbar query={query} resultCount={totalCount} onSearchChange={setTypedSearch} />

      <div className={isPending ? "opacity-70" : undefined}>
        <div className="overflow-x-auto rounded-[14px] border border-border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="bg-muted/40 hover:bg-muted/40">
                  {hg.headers.map((header) => (
                    <TableHead key={header.id} className="text-[12px]">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer text-[13px]"
                    tabIndex={0}
                    onClick={() => setSelectedId(row.original.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") setSelectedId(row.original.id);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-20 text-center text-[13px] text-muted-foreground"
                  >
                    {t.invoicesList.noMatches}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[12px] text-muted-foreground">{t.invoicesList.totalCount.replace("{count}", String(totalCount))}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(query.page - 1)}
              disabled={query.page <= 1}
            >
              {t.invoicesList.previous}
            </Button>
            <span className="text-[12px] text-muted-foreground">
              {t.invoicesList.pageOf
                .replace("{page}", String(query.page))
                .replace("{total}", String(pageCount))}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(query.page + 1)}
              disabled={query.page >= pageCount}
            >
              {t.invoicesList.next}
            </Button>
          </div>
        </div>
      </div>

      <Sheet
        open={selectedInvoice != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" showCloseButton={false}>
          <SheetTitle className="sr-only">{t.invoicesList.detailsTitle}</SheetTitle>
          <SheetDescription className="sr-only">
            {t.invoicesList.detailsDescription}
          </SheetDescription>
          {selectedInvoice ? (
            <InvoiceDetail
              key={selectedInvoice.id}
              invoice={selectedInvoice}
              onClose={() => setSelectedId(null)}
              onDeleted={(id) => setDeletedIds((current) => new Set(current).add(id))}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
