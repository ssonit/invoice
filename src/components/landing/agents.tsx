"use client"

import { useRef } from "react"
import Link from "next/link"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"
import { ArrowRight } from "lucide-react"

import { AUTOMATION_AGENTS } from "@/lib/automation/agents"
import { BrandGlyph } from "@/components/dashboard/automation/brand-glyph"
import { useLandingI18n } from "@/components/landing/landing-i18n"

gsap.registerPlugin(ScrollTrigger, useGSAP)

export function LandingAgents() {
  const { t } = useLandingI18n()
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tiles = gsap.utils.toArray<HTMLElement>(".agent-tile")
        gsap.fromTo(
          tiles,
          { y: 32, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.6,
            stagger: 0.08,
            ease: "power2.out",
            scrollTrigger: {
              trigger: root.current,
              start: "top 85%",
              toggleActions: "play none none none",
            },
          }
        )
      })
      return () => mm.revert()
    },
    { scope: root, dependencies: [t.agents.title] }
  )

  return (
    <section
      ref={root}
      id="agents"
      className="relative scroll-mt-24 bg-[var(--landing-bg)] py-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--landing-accent)]">
          {t.agents.eyebrow}
        </p>
        <h2 className="mt-3 font-[family-name:var(--font-outfit)] text-3xl font-semibold tracking-tight text-[var(--landing-fg)] md:text-4xl">
          {t.agents.title}
        </h2>
        <p className="mt-3 max-w-[42ch] text-base text-[var(--landing-muted)]">
          {t.agents.body}
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          {AUTOMATION_AGENTS.map((agent) => (
            <div
              key={agent.id}
              className="agent-tile flex items-center gap-2.5 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-card)] px-4 py-3"
            >
              <BrandGlyph name={agent.name} slug={agent.iconSlug} />
              <span className="text-sm font-medium text-[var(--landing-fg)]">
                {agent.name}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/signup"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--landing-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--landing-accent-fg)] transition-transform active:scale-[0.98]"
        >
          {t.agents.cta}
          <ArrowRight className="size-4" strokeWidth={2} />
        </Link>
      </div>
    </section>
  )
}
