"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardI18n } from "@/components/dashboard/dashboard-i18n";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  buildExportHref,
  type ExportQuery,
} from "@/lib/exports/query";

const RANGE_VALUES: ExportQuery["range"][] = [6, 12, "all"];
const STATUS_VALUES: ExportQuery["status"][] = ["all", "review", "ok"];

const MAX_EXPORT_ROWS = 5_000;

function buildPageHref(query: ExportQuery): string {
  const params = new URLSearchParams();
  if (query.range !== 6) params.set("range", String(query.range));
  if (query.status !== "all") params.set("status", query.status);
  const qs = params.toString();
  return qs ? `/dashboard/exports?${qs}` : "/dashboard/exports";
}

export function ExportsPanel({
  query: committedQuery,
  count,
}: {
  query: ExportQuery;
  count: number;
}) {
  const { t } = useDashboardI18n();
  const rangeLabels = {
    6: t.exports.range6,
    12: t.exports.range12,
    all: t.exports.rangeAll,
  };
  const statusLabels = {
    all: t.exports.statusAll,
    review: t.exports.statusReview,
    ok: t.exports.statusOk,
  };
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Highlight the clicked filter immediately; the count below is stale until
  // the server answers, so it shows a placeholder while pending.
  const [targetQuery, setTargetQuery] = useState<ExportQuery>(committedQuery);
  const query = isPending ? targetQuery : committedQuery;

  function selectFilter(next: ExportQuery) {
    setTargetQuery(next);
    startTransition(() => {
      router.push(buildPageHref(next));
    });
  }
  const capped = count > MAX_EXPORT_ROWS;
  const downloadHref = buildExportHref(query);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          {RANGE_VALUES.map((value) => (
            <Button
              key={String(value)}
              variant={query.range === value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => selectFilter({ ...query, range: value })}
            >
              {rangeLabels[value]}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {STATUS_VALUES.map((value) => (
            <Button
              key={value}
              variant={query.status === value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => selectFilter({ ...query, status: value })}
            >
              {statusLabels[value]}
            </Button>
          ))}
        </div>
      </div>

      {isPending ? (
        <div
          className="rounded-[14px] border border-border p-6"
          role="status"
          aria-live="polite"
        >
          <p className="text-[13px] text-muted-foreground">{t.exports.calculating}</p>
        </div>
      ) : count === 0 ? (
        <Empty className="rounded-[14px] border border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Download />
            </EmptyMedia>
            <EmptyTitle>{t.exports.emptyTitle}</EmptyTitle>
            <EmptyDescription>{t.exports.emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-[14px] border border-border p-6">
          <p className="text-[13px] text-muted-foreground">
            {t.exports.description}
          </p>
          <p className="mt-3 text-[13px]">
            <span className="font-semibold tabular-nums">
              {capped
                ? MAX_EXPORT_ROWS.toLocaleString()
                : count.toLocaleString()}
            </span>{" "}
            {t.exports.willInclude.replace(
              "{count}",
              capped || count !== 1 ? t.exports.invoiceMany : t.exports.invoiceOne,
            )}
            {capped ? (
              <span className="ml-1 text-muted-foreground">
                {t.exports.capped.replace("{max}", MAX_EXPORT_ROWS.toLocaleString())}
              </span>
            ) : null}
          </p>
          <a
            href={downloadHref}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "mt-4",
            )}
          >
            <Download data-icon="inline-start" />
            {t.exports.download}
          </a>
        </div>
      )}
    </div>
  );
}
