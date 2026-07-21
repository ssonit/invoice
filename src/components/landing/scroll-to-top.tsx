"use client"

import { useState } from "react"
import { ArrowUp } from "lucide-react"
import { useLenis } from "lenis/react"

import { cn } from "@/lib/utils"

export function LandingScrollToTop() {
  const [visible, setVisible] = useState(false)
  const lenis = useLenis((instance) => {
    setVisible(instance.scroll > 480)
  })

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() => lenis?.scrollTo(0, { duration: 1.1 })}
      className={cn(
        "fixed bottom-6 left-6 z-50 inline-flex size-11 items-center justify-center rounded-full border border-[var(--landing-border)] bg-[var(--landing-card)] text-[var(--landing-fg)] shadow-[0_12px_40px_rgba(0,0,0,0.25)] transition-all duration-300",
        "hover:border-[var(--landing-accent)] hover:text-[var(--landing-accent)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)]",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      )}
    >
      <ArrowUp className="size-4" strokeWidth={2.25} />
    </button>
  )
}
