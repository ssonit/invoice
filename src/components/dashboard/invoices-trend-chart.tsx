"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { TrendPoint } from "@/lib/invoices";
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n";

export function InvoicesTrendChart({ data }: { data: TrendPoint[] }) {
  const { t } = useDashboardI18n();
  const chartConfig = {
    count: { label: t.charts.invoicesSeries, color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <Card className="rounded-[14px] shadow-none">
      <CardHeader>
        <CardTitle className="text-[13px] font-semibold">{t.charts.invoicesOverTime}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" fill="var(--color-count)" radius={6} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
