import { Progress } from "@/components/ui/progress"

type CreditsUsageProps = {
  used?: number
  limit?: number
  renewsInDays?: number
}

function formatCredits(n: number) {
  return n.toLocaleString("en-US")
}

export function CreditsUsage({
  used = 4320,
  limit = 10_000,
  renewsInDays = 14,
}: CreditsUsageProps) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 group-data-[collapsible=icon]:hidden">
      <p className="text-[11px] text-zinc-500">AI credits used</p>
      <p className="mt-1 text-sm font-semibold tracking-tight text-zinc-100 tabular-nums">
        {formatCredits(used)}
        <span className="font-normal text-zinc-500">
          {" "}
          / {formatCredits(limit)}
        </span>
      </p>
      <Progress
        value={pct}
        className="mt-2.5 gap-0 **:data-[slot=progress-track]:h-1.5 **:data-[slot=progress-track]:bg-white/10 **:data-[slot=progress-indicator]:bg-[#E8FF47]"
      />
      <p className="mt-2 text-[11px] text-zinc-500">
        Renews in {renewsInDays} {renewsInDays === 1 ? "day" : "days"}
      </p>
    </div>
  )
}
