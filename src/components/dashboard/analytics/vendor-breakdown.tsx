import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInvoiceMoney } from "@/lib/invoices";
import type { VendorSpendSlice } from "@/lib/analytics/report";

function shareBarWidth(amount: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((amount / total) * 100)}%`;
}

export function VendorBreakdown({
  vendors,
  total,
  currency,
}: {
  vendors: VendorSpendSlice[];
  total: number;
  currency: string | null;
}) {
  return (
    <Card className="rounded-[14px] shadow-none">
      <CardHeader>
        <CardTitle className="text-[13px] font-semibold">Top vendors</CardTitle>
      </CardHeader>
      <CardContent>
        {vendors.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">
            No vendor data in this period.
          </p>
        ) : (
          <ul className="space-y-3">
            {vendors.map((v) => {
              const isOther = v.key === "other";
              return (
                <li key={v.key} className="flex items-center gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-[6px] bg-muted">
                    <Building2 className="size-[13px] text-muted-foreground" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-[13px] font-medium ${
                          isOther ? "text-muted-foreground" : ""
                        }`}
                      >
                        {v.label}
                      </span>
                      <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                        {formatInvoiceMoney(v.amount, currency)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: shareBarWidth(v.amount, total),
                          backgroundColor: "var(--chart-2)",
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
