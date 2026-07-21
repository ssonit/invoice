"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { AnimatedGradientText } from "@/components/ui/animated-gradient-text"
import { BorderBeam } from "@/components/ui/border-beam"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { useLandingI18n } from "@/components/landing/landing-i18n"

export function LandingFinalCta() {
  const { t } = useLandingI18n()
  const router = useRouter()

  return (
    <section className="px-4 pb-24 md:px-6 md:pb-32">
      <div className="landing-card-gradient relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-[var(--landing-border)] px-8 py-16 text-center md:px-16 md:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-24 size-64 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--landing-grad-from)_40%,transparent),transparent_70%)] blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -right-14 size-72 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--landing-grad-to)_32%,transparent),transparent_70%)] blur-2xl"
        />

        <BorderBeam
          size={160}
          duration={8}
          colorFrom="var(--landing-grad-from)"
          colorTo="var(--landing-grad-to)"
          borderWidth={1.5}
        />

        <h2 className="relative font-[family-name:var(--font-outfit)] text-3xl font-semibold tracking-tight md:text-5xl">
          <AnimatedGradientText
            speed={1.15}
            colorFrom="var(--landing-text-grad-from)"
            colorTo="var(--landing-text-grad-to)"
          >
            {t.cta.title}
          </AnimatedGradientText>
        </h2>

        <p className="relative mx-auto mt-4 max-w-[42ch] text-base text-[var(--landing-muted)] md:text-lg">
          {t.cta.body}
        </p>

        <div className="relative mt-8 flex justify-center">
          <ShimmerButton
            background="linear-gradient(135deg, var(--landing-grad-from), var(--landing-grad-mid), var(--landing-grad-to))"
            shimmerColor="#ffffff"
            className="border-transparent shadow-none"
            onClick={() => router.push("/login")}
          >
            <span className="font-semibold text-[var(--landing-accent-fg)]">
              {t.cta.button}
            </span>
          </ShimmerButton>
        </div>

        <p className="relative mt-4 text-xs text-[var(--landing-muted)]">
          <Link href="/signup" className="underline-offset-4 hover:underline">
            {t.nav.signup}
          </Link>
        </p>
      </div>
    </section>
  )
}
