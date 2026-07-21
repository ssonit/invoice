"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useLenis } from "lenis/react"

import { cn } from "@/lib/utils"

export function LandingScrollbar() {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [progress, setProgress] = useState(0)
  const [thumbRatio, setThumbRatio] = useState(0.2)
  const lenis = useLenis((instance) => {
    if (!dragging.current) {
      setProgress(instance.progress)
    }
  })

  const refreshThumb = useCallback(() => {
    if (!lenis) return
    const limit = lenis.limit || 1
    const view = window.innerHeight
    setThumbRatio(Math.min(Math.max(view / (view + limit), 0.12), 1))
  }, [lenis])

  useEffect(() => {
    refreshThumb()
    window.addEventListener("resize", refreshThumb)
    return () => window.removeEventListener("resize", refreshThumb)
  }, [refreshThumb])

  useEffect(() => {
    if (!lenis) return
    setProgress(lenis.progress)
    refreshThumb()
  }, [lenis, refreshThumb])

  const scrollToProgress = useCallback(
    (next: number) => {
      if (!lenis) return
      const clamped = Math.min(Math.max(next, 0), 1)
      setProgress(clamped)
      lenis.scrollTo(clamped * lenis.limit, { immediate: dragging.current })
    },
    [lenis]
  )

  const progressFromPointer = useCallback(
    (clientY: number) => {
      const track = trackRef.current
      if (!track) return 0
      const rect = track.getBoundingClientRect()
      const thumbH = rect.height * thumbRatio
      const travel = Math.max(rect.height - thumbH, 1)
      return (clientY - rect.top - thumbH / 2) / travel
    },
    [thumbRatio]
  )

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return
      scrollToProgress(progressFromPointer(event.clientY))
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.removeProperty("user-select")
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [progressFromPointer, scrollToProgress])

  const thumbTop = progress * (1 - thumbRatio) * 100

  return (
    <div
      className="fixed inset-y-0 right-0 z-50 flex w-4 items-stretch justify-center py-3 pr-1.5"
      aria-hidden
    >
      <div
        ref={trackRef}
        className="relative h-full w-1.5 cursor-pointer rounded-full bg-[var(--landing-rail)]"
        onPointerDown={(event) => {
          dragging.current = true
          document.body.style.userSelect = "none"
          scrollToProgress(progressFromPointer(event.clientY))
        }}
      >
        <button
          type="button"
          aria-label="Scroll"
          className={cn(
            "absolute left-1/2 w-3 -translate-x-1/2 rounded-full bg-[var(--landing-accent)]",
            "shadow-[0_0_12px_color-mix(in_oklab,var(--landing-accent)_40%,transparent)]",
            "transition-[height] duration-75",
            "hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--landing-accent)]/50"
          )}
          style={{
            top: `${thumbTop}%`,
            height: `${thumbRatio * 100}%`,
            minHeight: 28,
          }}
          onPointerDown={(event) => {
            event.stopPropagation()
            dragging.current = true
            document.body.style.userSelect = "none"
            ;(event.target as HTMLElement).setPointerCapture?.(event.pointerId)
          }}
        />
      </div>
    </div>
  )
}
