"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { buildAnalyticsHref, type AnalyticsQuery } from "@/lib/analytics/query";

const RANGE_OPTIONS: { label: string; range: 6 | 12 }[] = [
  { label: "6 months", range: 6 },
  { label: "12 months", range: 12 },
];

export function AnalyticsToolbar({ query }: { query: AnalyticsQuery }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1">
      {RANGE_OPTIONS.map((option) => (
        <Button
          key={option.range}
          variant={query.range === option.range ? "secondary" : "ghost"}
          size="sm"
          disabled={isPending}
          onClick={() => {
            startTransition(() => {
              router.push(buildAnalyticsHref({ range: option.range }));
            });
          }}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
