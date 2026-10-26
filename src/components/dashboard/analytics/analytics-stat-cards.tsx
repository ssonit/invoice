import {
  FileText,
  AlertCircle,
  Wallet,
  Calculator,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatInvoiceMoney } from "@/lib/invoices";
import type { AnalyticsReport } from "@/lib/analytics/report";

export function AnalyticsStatCards({ report }: { report: AnalyticsReport }) {
  const totals = report.totalsByCurrency;
  const joinMoney = (pick: (t: (typeof totals)[number]) => number) =>
    totals.length === 0
      ? "—"
      : totals.map((t) => formatInvoiceMoney(pick(t), t.currency)).join(" + ");

  const tiles = [
    {
      label: "Invoices",
      value: String(report.invoiceCount),
      icon: FileText,
      hint: null,
    },
    {
      label: "Needs review",
      value: String(report.needsReview),
      icon: AlertCircle,
      hint: null,
    },
    {
      label: "Total spend",
      value: joinMoney((t) => t.total),
      icon: Wallet,
      hint: report.multiCurrency ? "per currency, not converted" : null,
    },
    {
      label: "Avg / invoice",
      value: joinMoney((t) => t.average),
      icon: Calculator,
      hint: report.multiCurrency ? "per currency" : null,
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
                <p
                  className={`mt-2 font-semibold tracking-tight ${
                    t.value.length > 16 ? "text-base break-words" : "truncate text-2xl"
                  }`}
                >
                  {t.value}
                </p>
                {t.hint ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {t.hint}
                  </p>
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
