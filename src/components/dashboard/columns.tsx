"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { compareInvoiceAmounts, type InvoiceRow } from "@/lib/invoices";
import type { DashboardDictionary } from "@/lib/dashboard/i18n";

function SortHeader({
  label,
  column,
}: {
  label: string;
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" };
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-7 px-2 text-[12px] uppercase tracking-wide text-muted-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDown className="ml-1 size-3" />
    </Button>
  );
}

export function getColumns(t: DashboardDictionary): ColumnDef<InvoiceRow>[] {
  return [
  {
    accessorKey: "vendor",
    header: ({ column }) => <SortHeader label={t.invoicesList.colVendor} column={column} />,
    cell: ({ row }) => (
      <span className="font-medium">{row.original.vendor ?? "-"}</span>
    ),
  },
  {
    accessorKey: "invoice_number",
    header: t.invoicesList.colNumber,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.invoice_number ?? "-"}</span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "amount",
    // Amounts in different currencies are not comparable: group by currency,
    // then order by amount within each currency.
    sortingFn: (a, b) => compareInvoiceAmounts(a.original, b.original),
    header: ({ column }) => <SortHeader label={t.invoicesList.colAmount} column={column} />,
    cell: ({ row }) => {
      const { amount, currency } = row.original;
      if (amount == null) return <span className="text-muted-foreground">-</span>;
      const formatted = amount.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
      return (
        <span className="font-mono">{`${formatted} ${currency ?? ""}`.trim()}</span>
      );
    },
  },
  {
    accessorKey: "issue_date",
    header: ({ column }) => <SortHeader label={t.invoicesList.colIssueDate} column={column} />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.issue_date ?? "-"}</span>
    ),
  },
  {
    accessorKey: "source",
    header: t.invoicesList.colSource,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {t.inbox.sourceFilters[row.original.source] ?? row.original.source}
      </span>
    ),
    enableSorting: false,
  },
  {
    id: "status",
    accessorFn: (row) => (row.needs_review ? "review" : "ok"),
    header: t.invoicesList.colStatus,
    cell: ({ row }) =>
      row.original.needs_review ? (
        <Badge variant="secondary">{t.invoicesList.needsReview}</Badge>
      ) : (
        <Badge variant="outline">{t.invoicesList.ok}</Badge>
      ),
    enableSorting: false,
  },
  ];
}
