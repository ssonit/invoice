import { FileText } from "lucide-react"

import { cn } from "@/lib/utils"

type BrandLogoProps = {
  className?: string
  markClassName?: string
  showWordmark?: boolean
  size?: "sm" | "md"
}

export function BrandLogo({
  className,
  markClassName,
  showWordmark = true,
  size = "sm",
}: BrandLogoProps) {
  const markSize = size === "md" ? "size-9" : "size-7"
  const iconSize = size === "md" ? "size-4" : "size-3.5"
  const textSize = size === "md" ? "text-base" : "text-sm"

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative inline-flex items-center justify-center rounded-lg landing-brand-mark",
          markSize,
          markClassName
        )}
        aria-hidden
      >
        <FileText className={iconSize} strokeWidth={2.25} />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--landing-fg)] ring-2 ring-[var(--landing-bg)]" />
      </span>
      {showWordmark ? (
        <span
          className={cn(
            "font-[family-name:var(--font-outfit)] font-semibold tracking-tight text-[var(--landing-fg,#f4f4f5)]",
            textSize
          )}
        >
          Invoice Reader
        </span>
      ) : null}
    </span>
  )
}
