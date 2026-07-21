"use client"

import { Quote } from "lucide-react"

import { useLandingI18n } from "@/components/landing/landing-i18n"

export function LandingTestimonial() {
  const { t } = useLandingI18n()

  return (
    <section className="mx-auto max-w-3xl px-4 py-24 md:px-6 md:py-32">
      <Quote
        className="mb-6 size-8 text-[var(--landing-accent)] opacity-80"
        strokeWidth={1.5}
        aria-hidden
      />
      <blockquote className="font-[family-name:var(--font-outfit)] text-2xl font-medium leading-snug tracking-tight text-[var(--landing-fg)] md:text-3xl">
        {t.testimonial.quote}
      </blockquote>
      <footer className="mt-8 flex items-center gap-3 text-sm text-[var(--landing-muted)]">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--landing-card-soft)] font-[family-name:var(--font-outfit)] text-sm font-semibold text-[var(--landing-accent)]">
          {t.testimonial.name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </span>
        <div>
          <p className="font-medium text-[var(--landing-fg)]">
            {t.testimonial.name}
          </p>
          <p>{t.testimonial.role}</p>
        </div>
      </footer>
    </section>
  )
}
