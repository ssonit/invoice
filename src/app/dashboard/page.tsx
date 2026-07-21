import { createClient } from "@/lib/supabase/server";
import { ContentShell } from "@/components/dashboard/content-shell";
import { StatCards } from "@/components/dashboard/stat-cards";
import { InvoicesTrendChart } from "@/components/dashboard/invoices-trend-chart";
import { InvoicesTable } from "@/components/dashboard/invoices-table";
import { UploadInvoiceButton } from "./upload-invoice-button";
import { computeStats, monthlyTrend, normalizeInvoice } from "@/lib/invoices";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const invoices = (data ?? []).map(normalizeInvoice);
  const stats = computeStats(invoices);
  const trend = monthlyTrend(invoices);

  return (
    <ContentShell
      title="Invoices"
      description="Every invoice extracted from your forwarded email and manual uploads."
      actions={<UploadInvoiceButton />}
    >
      <div className="flex flex-col gap-5">
        <StatCards stats={stats} />
        <InvoicesTrendChart data={trend} />
        <InvoicesTable data={invoices} />
      </div>
    </ContentShell>
  );
}
