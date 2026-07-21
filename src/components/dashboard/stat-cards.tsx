import { FileText, AlertCircle, CalendarDays, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { InvoiceStats } from "@/lib/invoices";

function formatValue(stats: InvoiceStats): string {
  if (stats.total === 0 || stats.totalValue === 0) return "—";
  const amount = stats.totalValue.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return stats.currency ? `${amount} ${stats.currency}` : amount;
}

export function StatCards({ stats }: { stats: InvoiceStats }) {
  const tiles = [
    { label: "Total invoices", value: String(stats.total), icon: FileText, hint: null },
    { label: "Needs review", value: String(stats.needsReview), icon: AlertCircle, hint: null },
    { label: "This month", value: String(stats.thisMonth), icon: CalendarDays, hint: null },
    {
      label: "Total value",
      value: formatValue(stats),
      icon: Wallet,
      hint: stats.multiCurrency ? "top currency" : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <Card key={t.label} className="rounded-[14px] shadow-none">
            <CardContent className="flex items-start justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t.label}
                </p>
                <p className="mt-2 truncate text-2xl font-semibold tracking-tight">
                  {t.value}
                </p>
                {t.hint ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{t.hint}</p>
                ) : null}
              </div>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-muted text-foreground">
                <Icon className="size-[15px]" strokeWidth={1.75} />
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
