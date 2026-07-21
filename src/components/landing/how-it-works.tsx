"use client"

import { useRef } from "react"
import { Check } from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"

import { HOW_ICONS } from "@/components/landing/landing-icons"
import { useLandingI18n } from "@/components/landing/landing-i18n"

gsap.registerPlugin(ScrollTrigger, useGSAP)

export function LandingHowItWorks() {
  const { t } = useLandingI18n()
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const cards = gsap.utils.toArray<HTMLElement>(".stack-card")
        cards.forEach((card, i) => {
          if (i === cards.length - 1) return
          ScrollTrigger.create({
            trigger: card,
            start: "top top",
            endTrigger: cards[cards.length - 1],
            end: "top top",
            pin: true,
            pinSpacing: false,
          })
          gsap.to(card, {
            scale: 0.94,
            autoAlpha: 0.55,
            ease: "none",
            scrollTrigger: {
              trigger: cards[i + 1],
              start: "top bottom",
              end: "top top",
              scrub: true,
            },
          })
        })
      })
      return () => mm.revert()
    },
    { scope: root, dependencies: [t.how.title] }
  )

  return (
    <section ref={root} className="relative bg-[var(--landing-bg)]">
      <div className="mx-auto max-w-6xl px-4 pt-24 md:px-6">
        <h2 className="font-[family-name:var(--font-outfit)] text-3xl font-semibold tracking-tight text-[var(--landing-fg)] md:text-4xl">
          {t.how.title}
        </h2>
        <p className="mt-3 max-w-[42ch] text-base text-[var(--landing-muted)]">
          {t.how.subtitle}
        </p>

        <ol className="mt-8 flex flex-wrap gap-2">
          {t.how.steps.map((step, index) => {
            const Icon = HOW_ICONS[index] ?? HOW_ICONS[0]
            return (
              <li
                key={step.title}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--landing-border)] bg-[var(--landing-card-soft)] px-3 py-1.5 text-xs font-medium text-[var(--landing-muted)]"
              >
                <Icon className="size-3.5 text-[var(--landing-accent)]" strokeWidth={2} />
                {step.title}
              </li>
            )
          })}
        </ol>
      </div>

      <div className="relative mt-10">
        {t.how.steps.map((step, index) => {
          const Icon = HOW_ICONS[index] ?? HOW_ICONS[0]
          return (
            <div
              key={step.title}
              className="stack-card sticky top-0 flex min-h-dvh items-center justify-center px-4 py-24 md:px-6"
            >
              <div className="grid w-full max-w-5xl gap-6 rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:grid-cols-[1.05fr_0.95fr] md:gap-10 md:p-10">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-12 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_18%,transparent)] text-[var(--landing-accent)]">
                      <Icon className="size-6" strokeWidth={1.75} />
                    </span>
                  </div>

                  <h3 className="mt-6 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight text-[var(--landing-fg)] md:text-3xl">
                    {step.title}
                  </h3>
                  <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-[var(--landing-muted)]">
                    {step.body}
                  </p>

                  <ul className="mt-6 space-y-3">
                    {step.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2.5 text-sm text-[var(--landing-fg)]"
                      >
                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--landing-accent)_22%,transparent)] text-[var(--landing-accent)]">
                          <Check className="size-3" strokeWidth={2.5} />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-[var(--landing-border)] bg-[var(--landing-bg)] p-5">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--landing-grid)_1px,transparent_1px),linear-gradient(to_bottom,var(--landing-grid)_1px,transparent_1px)] bg-size-[24px_24px] opacity-70"
                  />
                  <div className="relative">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--landing-muted)]">
                      Preview
                    </p>
                    <p className="mt-2 font-mono text-sm text-[var(--landing-accent)]">
                      {step.preview}
                    </p>

                    <div className="mt-6 space-y-3">
                      {[0.92, 0.7, 0.55].map((width, i) => (
                        <div
                          key={i}
                          className="h-10 rounded-lg border border-[var(--landing-border)] bg-[var(--landing-card-soft)] px-3 flex items-center"
                        >
                          <span
                            className="h-2 rounded-full bg-[color-mix(in_oklab,var(--landing-accent)_55%,transparent)]"
                            style={{ width: `${width * 100}%` }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-2">
                      {["PDF", "AI", "Row"].map((label) => (
                        <div
                          key={label}
                          className="rounded-lg border border-[var(--landing-border)] bg-[var(--landing-card)] px-2 py-3 text-center"
                        >
                          <p className="font-mono text-xs font-semibold text-[var(--landing-fg)]">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
