"use client"

import { Check, Circle } from "lucide-react"

import { cn } from "@/lib/utils"
import type { InvoiceInboxStatus } from "@/lib/invoices"

const statusConfig: Record<
  InvoiceInboxStatus,
  { label: string; className: string; icon?: "dot" | "check" }
> = {
  extracted: {
    label: "Extracted",
    className: "border-[#E8FF47]/25 bg-[#E8FF47]/10 text-[#E8FF47]",
  },
  review: {
    label: "Review",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    icon: "dot",
  },
  approved: {
    label: "Approved",
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    icon: "check",
  },
}

export function InboxStatusBadge({
  status,
  className,
}: {
  status: InvoiceInboxStatus
  className?: string
}) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] font-semibold tracking-wide",
        config.className,
        className
      )}
    >
      {config.icon === "dot" ? (
        <Circle className="size-1.5 fill-current" />
      ) : null}
      {config.icon === "check" ? <Check className="size-3" strokeWidth={2.5} /> : null}
      {config.label}
    </span>
  )
}
