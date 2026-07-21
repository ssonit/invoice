import Link from "next/link"
import { Construction, Sparkles, type LucideIcon } from "lucide-react"

type ComingSoonProps = {
  title: string
  description: string
  icon?: LucideIcon
  status?: "soon" | "beta"
}

export function ComingSoon({
  title,
  description,
  icon: Icon = Construction,
  status = "soon",
}: ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl border border-white/10 bg-[#E8FF47]/10 text-[#E8FF47]">
        <Icon className="size-7" strokeWidth={1.75} />
        <span className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full border border-[#E8FF47]/30 bg-[#0a0a0a] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E8FF47]">
          <Sparkles className="size-2.5" />
          {status === "beta" ? "Beta" : "Soon"}
        </span>
      </div>

      <h1 className="font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <p className="mt-2 text-xs text-muted-foreground/80">
        Đang phát triển — sắp release. Tab đã sẵn, tính năng sẽ lên sau.
      </p>

      <Link
        href="/dashboard"
        className="mt-8 inline-flex h-10 items-center justify-center rounded-full bg-[#E8FF47] px-5 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-[#E8FF47]/90"
      >
        Back to overview
      </Link>
    </div>
  )
}
