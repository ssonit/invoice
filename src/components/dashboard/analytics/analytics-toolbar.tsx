"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buildAnalyticsHref, type AnalyticsQuery } from "@/lib/analytics/query";
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n";

const RANGE_OPTIONS: { range: 6 | 12 }[] = [{ range: 6 }, { range: 12 }];

export function AnalyticsToolbar({
  query,
  currencies,
  currency,
}: {
  query: AnalyticsQuery;
  currencies: string[]; // currency keys present in the data ("—" = none)
  currency: string; // currency key currently shown in chart / vendors
}) {
  const { t } = useDashboardI18n();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function go(range: 6 | 12, nextCurrency: string) {
    const base = buildAnalyticsHref({ range });
    const sep = base.includes("?") ? "&" : "?";
    const href =
      currencies.length <= 1 || nextCurrency === currencies[0]
        ? base
        : `${base}${sep}currency=${encodeURIComponent(nextCurrency)}`;
    startTransition(() => router.push(href));
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        {RANGE_OPTIONS.map((option) => (
          <Button
            key={option.range}
            variant={query.range === option.range ? "secondary" : "ghost"}
            size="sm"
            disabled={isPending}
            onClick={() => go(option.range, currency)}
          >
            {option.range === 6 ? t.analytics.range6 : t.analytics.range12}
          </Button>
        ))}
      </div>
      {currencies.length > 1 ? (
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">
            {t.analytics.chartVendorsIn}
          </span>
          {currencies.map((cur) => (
            <Button
              key={cur}
              variant={cur === currency ? "secondary" : "ghost"}
              size="sm"
              disabled={isPending}
              onClick={() => go(query.range, cur)}
            >
              {cur}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
