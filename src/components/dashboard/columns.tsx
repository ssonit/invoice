"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InvoiceRow } from "@/lib/invoices";

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

export const columns: ColumnDef<InvoiceRow>[] = [
  {
    accessorKey: "vendor",
    header: ({ column }) => <SortHeader label="Vendor" column={column} />,
    cell: ({ row }) => (
      <span className="font-medium">{row.original.vendor ?? "-"}</span>
    ),
    filterFn: "includesString",
  },
  {
    accessorKey: "invoice_number",
    header: "Invoice #",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.invoice_number ?? "-"}</span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "amount",
    header: ({ column }) => <SortHeader label="Amount" column={column} />,
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
    header: ({ column }) => <SortHeader label="Issue date" column={column} />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.issue_date ?? "-"}</span>
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <span className="capitalize text-muted-foreground">{row.original.source}</span>
    ),
    enableSorting: false,
  },
  {
    id: "status",
    accessorFn: (row) => (row.needs_review ? "review" : "ok"),
    header: "Status",
    cell: ({ row }) =>
      row.original.needs_review ? (
        <Badge variant="secondary">Needs review</Badge>
      ) : (
        <Badge variant="outline">OK</Badge>
      ),
    enableSorting: false,
    filterFn: "equalsString",
  },
];
