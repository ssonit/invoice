"use client"

import { useEffect, useRef, useState } from "react"

const DEFAULT_ROOT_MARGIN = "200px"

/**
 * Flips `isInView` to true the first time the element scrolls near the
 * viewport, then disconnects the IntersectionObserver. Used to defer report
 * RPCs until the block is actually about to be seen.
 */
export function useInView<T extends Element>(rootMargin = DEFAULT_ROOT_MARGIN) {
  const ref = useRef<T | null>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || isInView) return
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setIsInView(true), 0)
      return () => clearTimeout(timer)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [isInView, rootMargin])

  return { ref, isInView }
}
