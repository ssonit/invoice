"use client"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export function ReportError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[14px] border border-border px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">
        Could not load this report. Please try again.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[86px] rounded-[14px]" />
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return <Skeleton className="h-[272px] rounded-[14px]" />
}
