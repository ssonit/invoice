"use client";

import { useState } from "react";
import {
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Inbox } from "lucide-react";
import { columns } from "./columns";
import type { InvoiceRow } from "@/lib/invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

const STATUS_FILTERS = [
  { label: "All", value: undefined },
  { label: "Needs review", value: "review" },
  { label: "OK", value: "ok" },
] as const;

export function InvoicesTable({ data }: { data: InvoiceRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // TanStack Table returns non-memoizable functions; React Compiler skips it.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const statusValue =
    (table.getColumn("status")?.getFilterValue() as string | undefined) ?? undefined;

  if (data.length === 0) {
    return (
      <Empty className="rounded-[14px] border border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Inbox />
          </EmptyMedia>
          <EmptyTitle>No invoices yet</EmptyTitle>
          <EmptyDescription>
            Forward an invoice to your address in Settings, or upload one directly.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter by vendor..."
          value={(table.getColumn("vendor")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("vendor")?.setFilterValue(e.target.value)}
          className="h-8 max-w-xs"
        />
        <div className="flex items-center gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.label}
              variant={statusValue === f.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => table.getColumn("status")?.setFilterValue(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

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
                <TableRow key={row.id} className="text-[13px]">
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

      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">
          {table.getFilteredRowModel().rows.length} invoice(s)
        </p>
        <div className={cn("flex items-center gap-2")}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="text-[12px] text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
