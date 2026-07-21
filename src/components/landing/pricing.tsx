"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"

import { BlurFade } from "@/components/ui/blur-fade"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { useLandingI18n } from "@/components/landing/landing-i18n"
import { cn } from "@/lib/utils"

export function LandingPricing() {
  const { t } = useLandingI18n()
  const router = useRouter()

  return (
    <section id="pricing" className="scroll-mt-24 px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto max-w-6xl">
        <BlurFade delay={0.05} inView>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium text-[var(--landing-muted)]">
              {t.pricing.eyebrow}
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-outfit)] text-3xl font-semibold tracking-tight text-[var(--landing-fg)] md:text-5xl">
              {t.pricing.title}
            </h2>
            <p className="mt-4 text-base text-[var(--landing-muted)] md:text-lg">
              {t.pricing.subtitle}
            </p>
          </div>
        </BlurFade>

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
          {t.pricing.plans.map((plan, index) => (
            <BlurFade key={plan.name} delay={0.1 + index * 0.08} inView>
              <article
                className={cn(
                  "relative flex h-full flex-col overflow-hidden rounded-2xl border p-7 md:p-8",
                  plan.featured
                    ? "landing-card-gradient border-[color-mix(in_oklab,var(--landing-grad-to)_35%,var(--landing-border))]"
                    : "border-[var(--landing-border)] bg-[var(--landing-card-soft)]"
                )}
              >
                <div>
                  <h3 className="font-[family-name:var(--font-outfit)] text-xl font-semibold text-[var(--landing-fg)]">
                    {plan.name}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--landing-muted)]">
                    {plan.description}
                  </p>
                </div>

                <p className="mt-6 flex items-baseline gap-1">
                  <span
                    className={cn(
                      "font-[family-name:var(--font-outfit)] text-4xl font-semibold tracking-tight",
                      plan.featured
                        ? "landing-text-gradient"
                        : "text-[var(--landing-fg)]"
                    )}
                  >
                    {plan.price}
                  </span>
                  <span className="text-sm text-[var(--landing-muted)]">
                    {plan.period}
                  </span>
                </p>

                {plan.featured ? (
                  <ShimmerButton
                    className="mt-6 w-full border-transparent shadow-none"
                    background="linear-gradient(135deg, var(--landing-grad-from), var(--landing-grad-mid), var(--landing-grad-to))"
                    shimmerColor="#ffffff"
                    onClick={() => router.push("/signup")}
                  >
                    <span className="font-semibold text-[var(--landing-accent-fg)]">
                      {plan.cta}
                    </span>
                  </ShimmerButton>
                ) : (
                  <Link
                    href="/login"
                    className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full border border-[var(--landing-border)] bg-[var(--landing-card)] text-sm font-semibold text-[var(--landing-fg)] transition-colors hover:bg-[var(--landing-card-soft)]"
                  >
                    {plan.cta}
                  </Link>
                )}

                <div className="my-6 h-px bg-[var(--landing-border)]" />

                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-[var(--landing-fg)]"
                    >
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-[var(--landing-accent)]"
                        strokeWidth={2.25}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  )
}
