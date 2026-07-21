"use client"

import { useEffect, type ReactNode } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ReactLenis, useLenis } from "lenis/react"
import "lenis/dist/lenis.css"

gsap.registerPlugin(ScrollTrigger)

function LenisGsapBridge() {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return

    const onScroll = () => {
      ScrollTrigger.update()
    }

    lenis.on("scroll", onScroll)

    const update = (time: number) => {
      lenis.raf(time * 1000)
    }

    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    ScrollTrigger.refresh()

    return () => {
      lenis.off("scroll", onScroll)
      gsap.ticker.remove(update)
    }
  }, [lenis])

  return null
}

export function LenisProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("landing-scroll")
    return () => {
      document.documentElement.classList.remove("landing-scroll")
    }
  }, [])

  return (
    <ReactLenis
      root
      options={{
        autoRaf: false,
        lerp: 0.1,
        smoothWheel: true,
        syncTouch: false,
      }}
    >
      <LenisGsapBridge />
      {children}
    </ReactLenis>
  )
}
