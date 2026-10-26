"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Inbox } from "lucide-react";
import { columns } from "./columns";
import { InvoicesToolbar } from "./invoices-toolbar";
import { InvoiceDetail } from "./invoice-detail";
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
  data,
  query,
  totalCount,
  pageCount,
  isEmailIntakeEnabled,
}: {
  data: InvoiceRow[];
  query: InvoiceListQuery;
  totalCount: number;
  pageCount: number;
  isEmailIntakeEnabled: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const isEmpty = data.length === 0 && totalCount === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-3">
        <InvoicesToolbar query={query} resultCount={totalCount} />
        <Empty className="rounded-[14px] border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No invoices yet</EmptyTitle>
            <EmptyDescription>
              {isEmailIntakeEnabled
                ? "Forward an invoice to your address in Settings, or upload one directly."
                : "Upload an invoice to get started."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <InvoicesToolbar query={query} resultCount={totalCount} />

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
                    No invoices match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[12px] text-muted-foreground">{totalCount} invoice(s) total</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(query.page - 1)}
              disabled={query.page <= 1}
            >
              Previous
            </Button>
            <span className="text-[12px] text-muted-foreground">
              Page {query.page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(query.page + 1)}
              disabled={query.page >= pageCount}
            >
              Next
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
          <SheetTitle className="sr-only">Invoice details</SheetTitle>
          <SheetDescription className="sr-only">
            View and edit the extracted fields of this invoice.
          </SheetDescription>
          {selectedInvoice ? (
            <InvoiceDetail
              key={selectedInvoice.id}
              invoice={selectedInvoice}
              onClose={() => setSelectedId(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
