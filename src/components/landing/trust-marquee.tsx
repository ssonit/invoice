"use client"

import { Marquee } from "@/components/ui/marquee"
import { useLandingI18n } from "@/components/landing/landing-i18n"
import { cn } from "@/lib/utils"

const LOGOS = [
  { name: "Vercel", slug: "vercel" },
  { name: "Stripe", slug: "stripe" },
  { name: "Notion", slug: "notion" },
  { name: "Linear", slug: "linear" },
  { name: "Supabase", slug: "supabase" },
  { name: "Figma", slug: "figma" },
]

function LogoMark({ name, slug }: { name: string; slug: string }) {
  return (
    <div className="mx-8 flex h-10 items-center opacity-50 grayscale transition-opacity hover:opacity-80">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://cdn.simpleicons.org/${slug}/71717a`}
        alt={name}
        width={28}
        height={28}
        className="h-7 w-7"
      />
    </div>
  )
}

export function LandingTrustMarquee({ className }: { className?: string }) {
  const { t } = useLandingI18n()

  return (
    <section
      className={cn(
        "border-y border-[var(--landing-border)] py-12 md:py-14",
        className
      )}
    >
      <p className="mb-8 text-center text-xs font-medium uppercase tracking-[0.18em] text-[var(--landing-muted)]">
        {t.trust.label}
      </p>
      <Marquee pauseOnHover className="[--duration:36s] [--gap:2rem]">
        {LOGOS.map((logo) => (
          <LogoMark key={logo.slug} {...logo} />
        ))}
      </Marquee>
    </section>
  )
}
