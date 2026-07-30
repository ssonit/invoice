"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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

const RANGE_OPTIONS: { label: string; value: ExportQuery["range"] }[] = [
  { label: "6 months", value: 6 },
  { label: "12 months", value: 12 },
  { label: "All time", value: "all" },
];

const STATUS_OPTIONS: { label: string; value: ExportQuery["status"] }[] = [
  { label: "All", value: "all" },
  { label: "Needs review", value: "review" },
  { label: "OK", value: "ok" },
];

const MAX_EXPORT_ROWS = 5_000;

function buildPageHref(query: ExportQuery): string {
  const params = new URLSearchParams();
  if (query.range !== 6) params.set("range", String(query.range));
  if (query.status !== "all") params.set("status", query.status);
  const qs = params.toString();
  return qs ? `/dashboard/exports?${qs}` : "/dashboard/exports";
}

export function ExportsPanel({
  query,
  count,
}: {
  query: ExportQuery;
  count: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const capped = count > MAX_EXPORT_ROWS;
  const downloadHref = buildExportHref(query);

  if (count === 0) {
    return (
      <Empty className="rounded-[14px] border border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Download />
          </EmptyMedia>
          <EmptyTitle>No invoices match your filters</EmptyTitle>
          <EmptyDescription>
            Try a longer range or change the status filter to see more results.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={String(option.value)}
              variant={query.range === option.value ? "secondary" : "ghost"}
              size="sm"
              disabled={isPending}
              onClick={() => {
                startTransition(() => {
                  router.push(
                    buildPageHref({ ...query, range: option.value }),
                  );
                });
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={query.status === option.value ? "secondary" : "ghost"}
              size="sm"
              disabled={isPending}
              onClick={() => {
                startTransition(() => {
                  router.push(
                    buildPageHref({ ...query, status: option.value }),
                  );
                });
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Description + Count + Download */}
      <div className="rounded-[14px] border border-border p-6">
        <p className="text-[13px] text-muted-foreground">
          Download invoices as CSV for spreadsheets or bookkeeping.
        </p>
        <p className="mt-3 text-[13px]">
          <span className="font-semibold tabular-nums">
            {capped
              ? MAX_EXPORT_ROWS.toLocaleString()
              : count.toLocaleString()}
          </span>{" "}
          invoice{capped || count !== 1 ? "s" : ""} will be included
          {capped ? (
            <span className="ml-1 text-muted-foreground">
              — export capped at {MAX_EXPORT_ROWS.toLocaleString()} rows. Narrow
              your filters for a smaller set.
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
          Download CSV
        </a>
      </div>
    </div>
  );
}
