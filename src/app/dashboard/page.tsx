import { createClient } from "@/lib/supabase/server";
import { ContentShell } from "@/components/dashboard/content-shell";
import { UploadInvoiceButton } from "./upload-invoice-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Inbox } from "lucide-react";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <ContentShell
      title="Invoices"
      description="Every invoice extracted from your forwarded email and manual uploads."
      actions={<UploadInvoiceButton />}
    >
      {invoices && invoices.length > 0 ? (
        <div className="overflow-x-auto rounded-[14px] border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground">
                  Vendor
                </TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground">
                  Invoice #
                </TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground">
                  Amount
                </TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground">
                  Issue date
                </TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground">
                  Source
                </TableHead>
                <TableHead className="text-[12px] uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="text-[13px]">
                  <TableCell className="font-medium">{invoice.vendor ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {invoice.invoice_number ?? "-"}
                  </TableCell>
                  <TableCell className="font-mono">
                    {invoice.amount != null
                      ? `${invoice.amount} ${invoice.currency ?? ""}`.trim()
                      : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {invoice.issue_date ?? "-"}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {invoice.source}
                  </TableCell>
                  <TableCell>
                    {invoice.needs_review ? (
                      <Badge variant="secondary">Needs review</Badge>
                    ) : (
                      <Badge variant="outline">OK</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
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
      )}
    </ContentShell>
  );
}
