"use client"

import Link from "next/link"
import { useLenis } from "lenis/react"

import { BrandLogo } from "@/components/landing/brand-logo"
import { useLandingI18n } from "@/components/landing/landing-i18n"

export function LandingFooter() {
  const { t } = useLandingI18n()
  const lenis = useLenis()
  const year = new Date().getFullYear()

  const scrollToId = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    if (lenis) lenis.scrollTo(el, { offset: -72, duration: 1 })
    else el.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <footer className="border-t border-[var(--landing-border)] bg-[var(--landing-card)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.3fr_1fr_1fr_1fr] md:gap-8 md:px-6 md:py-16">
        <div>
          <BrandLogo size="md" />
          <p className="mt-4 max-w-[28ch] text-sm leading-relaxed text-[var(--landing-muted)]">
            {t.footer.tagline}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[var(--landing-fg)]">
            {t.footer.productLabel}
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--landing-muted)]">
            <li>
              <button
                type="button"
                className="hover:text-[var(--landing-fg)]"
                onClick={() => scrollToId("how")}
              >
                {t.footer.links.how}
              </button>
            </li>
            <li>
              <button
                type="button"
                className="hover:text-[var(--landing-fg)]"
                onClick={() => scrollToId("pricing")}
              >
                {t.footer.links.pricing}
              </button>
            </li>
            <li>
              <Link
                href="/dashboard"
                className="hover:text-[var(--landing-fg)]"
              >
                {t.footer.links.dashboard}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[var(--landing-fg)]">
            {t.footer.accountLabel}
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--landing-muted)]">
            <li>
              <Link href="/login" className="hover:text-[var(--landing-fg)]">
                {t.footer.links.login}
              </Link>
            </li>
            <li>
              <Link href="/signup" className="hover:text-[var(--landing-fg)]">
                {t.footer.links.signup}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[var(--landing-fg)]">
            {t.footer.legalLabel}
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--landing-muted)]">
            <li>
              <span className="cursor-default opacity-70">
                {t.footer.links.terms}
              </span>
            </li>
            <li>
              <span className="cursor-default opacity-70">
                {t.footer.links.privacy}
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-[var(--landing-border)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-[var(--landing-muted)] sm:flex-row sm:items-center sm:justify-between md:px-6">
          <p>
            Copyright © {year}{" "}
            <span className="text-[var(--landing-fg)]">{t.footer.product}</span>
            . {t.footer.rights}
          </p>
          <p>{t.footer.legal}</p>
        </div>
      </div>
    </footer>
  )
}
