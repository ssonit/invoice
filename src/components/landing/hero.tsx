"use client"

import { useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight } from "lucide-react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"

import { AnimatedGradientText } from "@/components/ui/animated-gradient-text"
import { Safari } from "@/components/ui/safari"
import { ShimmerButton } from "@/components/ui/shimmer-button"
import { useLandingI18n } from "@/components/landing/landing-i18n"
import { cn } from "@/lib/utils"

gsap.registerPlugin(useGSAP)

export function LandingHero() {
  const { t } = useLandingI18n()
  const router = useRouter()
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".hero-item", {
          y: 28,
          autoAlpha: 0,
          duration: 0.85,
          stagger: 0.1,
          ease: "power3.out",
        })
      })
      return () => mm.revert()
    },
    { scope: root }
  )

  return (
    <section
      ref={root}
      className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-14 text-center md:px-6 md:pb-24 md:pt-20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--landing-accent)_14%,transparent),transparent_55%)]"
      />

      <button
        type="button"
        onClick={() =>
          document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })
        }
        className={cn(
          "hero-item group relative mb-8 inline-flex items-center justify-center rounded-full px-4 py-1.5",
          "bg-[var(--landing-card-soft)] shadow-[inset_0_-8px_10px_color-mix(in_oklab,var(--landing-accent)_8%,transparent)]",
          "backdrop-blur-sm transition-shadow duration-500 ease-out",
          "hover:shadow-[inset_0_-5px_10px_color-mix(in_oklab,var(--landing-accent)_16%,transparent)]"
        )}
      >
        {/* Animated gradient border (Magic UI pattern) */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 block size-full overflow-hidden rounded-[inherit] p-px",
            "animate-gradient bg-linear-to-r from-[var(--landing-text-grad-from)]/80 via-[var(--landing-text-grad-to)]/55 to-[var(--landing-text-grad-from)]/80",
            "bg-size-[300%_100%]",
            "[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]",
            "[mask-composite:exclude] [-webkit-mask-composite:xor]"
          )}
        />

        <span className="badge-sparkle relative mr-1.5 text-sm" aria-hidden>
          ✨
        </span>
        <AnimatedGradientText
          speed={1.2}
          colorFrom="var(--landing-text-grad-from)"
          colorTo="var(--landing-text-grad-to)"
          className="relative text-sm font-medium"
        >
          {t.hero.badge}
        </AnimatedGradientText>
        <ChevronRight className="relative ml-1 size-3.5 text-[var(--landing-muted)] transition-transform duration-300 ease-out group-hover:translate-x-0.5" />
      </button>

      <h1 className="hero-item max-w-3xl font-[family-name:var(--font-outfit)] text-4xl font-semibold tracking-tight text-[var(--landing-fg)] md:text-6xl lg:text-7xl leading-[1.05]">
        {t.hero.headline}{" "}
        <span className="landing-text-gradient">{t.hero.headlineAccent}</span>
      </h1>

      <p className="hero-item mt-5 max-w-[48ch] text-base leading-relaxed text-[var(--landing-muted)] md:text-lg">
        {t.hero.subtext}
      </p>

        <div className="hero-item mt-8">
          <ShimmerButton
            background="linear-gradient(135deg, var(--landing-grad-from), var(--landing-grad-mid), var(--landing-grad-to))"
            shimmerColor="#ffffff"
            className="border-transparent shadow-none"
            onClick={() => router.push("/login")}
          >
            <span className="font-semibold text-[var(--landing-accent-fg)]">
              {t.hero.cta}
            </span>
          </ShimmerButton>
        </div>

      <div className="hero-item relative mt-14 w-full max-w-5xl">
        <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--landing-accent)_12%,transparent),transparent_70%)]" />
        <Safari
          url="invoice.reader/dashboard"
          imageSrc="/landing/hero-inbox.png"
          className="size-full"
        />
        <p className="sr-only">
          Product preview of Invoice Reader inbox and extracted fields.
        </p>
        <div className="mt-4 flex justify-center gap-3 md:hidden">
          <Link
            href="/signup"
            className="text-sm font-medium text-[var(--landing-muted)] underline-offset-4 hover:text-[var(--landing-fg)] hover:underline"
          >
            {t.nav.signup}
          </Link>
        </div>
      </div>
    </section>
  )
}
