"use client"

import { FEATURE_ICONS } from "@/components/landing/landing-icons"
import { useLandingI18n } from "@/components/landing/landing-i18n"
import { Marquee } from "@/components/ui/marquee"

export function LandingFeaturesPan() {
  const { t } = useLandingI18n()

  return (
    <section
      id="features"
      className="relative scroll-mt-24 overflow-hidden bg-[var(--landing-bg)] py-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="font-[family-name:var(--font-outfit)] text-3xl font-semibold tracking-tight text-[var(--landing-fg)] md:text-4xl">
          {t.features.title}
        </h2>
      </div>

      <div className="relative mt-10">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-linear-to-r from-[var(--landing-bg)] to-transparent md:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-linear-to-l from-[var(--landing-bg)] to-transparent md:w-24" />

        <Marquee
          pauseOnHover
          className="[--duration:45s] [--gap:1.5rem]"
        >
          {t.features.items.map((item, index) => {
            const Icon = FEATURE_ICONS[index] ?? FEATURE_ICONS[0]
            return (
              <article
                key={item.title}
                className="w-[min(85vw,320px)] shrink-0 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-card)] p-7 md:w-[340px] md:p-8"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--landing-accent)_18%,transparent)] text-[var(--landing-accent)]">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-5 font-[family-name:var(--font-outfit)] text-lg font-semibold tracking-tight text-[var(--landing-fg)] md:text-xl">
                  {item.title}
                </h3>
                <p className="mt-3 max-w-[34ch] text-sm leading-relaxed text-[var(--landing-muted)] md:text-base">
                  {item.body}
                </p>
              </article>
            )
          })}
        </Marquee>
      </div>
    </section>
  )
}
