"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Menu, Moon, Sun, X } from "lucide-react"
import { useLenis } from "lenis/react"

import { BrandLogo } from "@/components/landing/brand-logo"
import { useLandingI18n } from "@/components/landing/landing-i18n"
import { useLandingTheme } from "@/components/landing/landing-theme"
import { cn } from "@/lib/utils"

export function LandingNav() {
  const { locale, t, setLocale } = useLandingI18n()
  const { theme, toggleTheme } = useLandingTheme()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const lenis = useLenis((instance) => {
    setScrolled(instance.scroll > 24)
  })

  useEffect(() => {
    if (!menuOpen) return

    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    lenis?.stop()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previous
      lenis?.start()
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [menuOpen, lenis])

  const scrollToId = (id: string) => {
    setMenuOpen(false)
    // Wait for menu close / Lenis resume
    window.requestAnimationFrame(() => {
      const el = document.getElementById(id)
      if (!el) return
      if (lenis) {
        lenis.start()
        lenis.scrollTo(el, { offset: -72, duration: 1 })
      } else {
        el.scrollIntoView({ behavior: "smooth" })
      }
    })
  }

  const navLinks = [
    { id: "how", label: t.nav.how },
    { id: "agents", label: t.nav.agents },
    { id: "features", label: t.nav.features },
    { id: "pricing", label: t.nav.pricing },
  ] as const

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,box-shadow] duration-300",
          scrolled || menuOpen
            ? "border-b border-[var(--landing-border)] bg-[var(--landing-nav)] shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl"
            : "border-b border-transparent bg-[var(--landing-nav)]/60 backdrop-blur-md"
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <Link
            href="/"
            className="shrink-0 transition-opacity hover:opacity-90"
            onClick={() => setMenuOpen(false)}
          >
            <BrandLogo />
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-[var(--landing-muted)] lg:flex">
            {navLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => scrollToId(link.id)}
                className="transition-colors hover:text-[var(--landing-fg)]"
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="hidden items-center rounded-full border border-[var(--landing-border)] p-0.5 text-xs font-medium text-[var(--landing-muted)] sm:flex"
              role="group"
              aria-label="Language"
            >
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={cn(
                  "rounded-full px-2.5 py-1 transition-colors",
                  locale === "en" &&
                    "bg-[color-mix(in_oklab,var(--landing-fg)_10%,transparent)] text-[var(--landing-fg)]"
                )}
              >
                {t.nav.langEn}
              </button>
              <button
                type="button"
                onClick={() => setLocale("vi")}
                className={cn(
                  "rounded-full px-2.5 py-1 transition-colors",
                  locale === "vi" &&
                    "bg-[color-mix(in_oklab,var(--landing-fg)_10%,transparent)] text-[var(--landing-fg)]"
                )}
              >
                {t.nav.langVi}
              </button>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              className="hidden size-9 items-center justify-center rounded-full border border-[var(--landing-border)] text-[var(--landing-fg)] transition-colors hover:bg-[var(--landing-card-soft)] sm:inline-flex"
            >
              {theme === "dark" ? (
                <Sun className="size-4" strokeWidth={1.75} />
              ) : (
                <Moon className="size-4" strokeWidth={1.75} />
              )}
            </button>

            <Link
              href="/login"
              className="hidden text-sm font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-fg)] lg:inline"
            >
              {t.nav.login}
            </Link>

            <Link
              href="/signup"
              className="hidden h-9 items-center rounded-full bg-[var(--landing-accent)] px-4 text-sm font-semibold text-[var(--landing-accent-fg)] transition-transform active:scale-[0.98] lg:inline-flex"
            >
              {t.nav.signup}
            </Link>

            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-md text-[var(--landing-fg)] transition-colors hover:bg-[var(--landing-card-soft)] lg:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X className="size-6" strokeWidth={1.75} />
              ) : (
                <Menu className="size-6" strokeWidth={1.75} />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu - Magic UI style full panel */}
      <div
        id="landing-mobile-menu"
        className={cn(
          "fixed inset-0 z-30 bg-[var(--landing-bg)] pt-16 transition-[opacity,visibility] duration-300 lg:hidden",
          menuOpen
            ? "visible opacity-100"
            : "invisible pointer-events-none opacity-0"
        )}
      >
        <nav className="flex h-full flex-col px-4 pb-8">
          <ul className="mt-2 flex flex-col">
            {navLinks.map((link) => (
              <li
                key={link.id}
                className="border-b border-[var(--landing-border)]"
              >
                <button
                  type="button"
                  onClick={() => scrollToId(link.id)}
                  className="flex w-full items-center py-5 text-left text-sm font-medium uppercase tracking-[0.14em] text-[var(--landing-fg)]"
                >
                  {link.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-auto space-y-4 pt-8">
            <div className="flex items-center justify-between gap-3">
              <div
                className="flex items-center rounded-full border border-[var(--landing-border)] p-0.5 text-xs font-medium text-[var(--landing-muted)]"
                role="group"
                aria-label="Language"
              >
                <button
                  type="button"
                  onClick={() => setLocale("en")}
                  className={cn(
                    "rounded-full px-3 py-1.5 transition-colors",
                    locale === "en" &&
                      "bg-[color-mix(in_oklab,var(--landing-fg)_10%,transparent)] text-[var(--landing-fg)]"
                  )}
                >
                  {t.nav.langEn}
                </button>
                <button
                  type="button"
                  onClick={() => setLocale("vi")}
                  className={cn(
                    "rounded-full px-3 py-1.5 transition-colors",
                    locale === "vi" &&
                      "bg-[color-mix(in_oklab,var(--landing-fg)_10%,transparent)] text-[var(--landing-fg)]"
                  )}
                >
                  {t.nav.langVi}
                </button>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
                className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--landing-border)] text-[var(--landing-fg)]"
              >
                {theme === "dark" ? (
                  <Sun className="size-4" strokeWidth={1.75} />
                ) : (
                  <Moon className="size-4" strokeWidth={1.75} />
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--landing-border)] text-sm font-semibold text-[var(--landing-fg)]"
              >
                {t.nav.login}
              </Link>
              <Link
                href="/signup"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--landing-accent)] text-sm font-semibold text-[var(--landing-accent-fg)]"
              >
                {t.nav.signup}
              </Link>
            </div>
          </div>
        </nav>
      </div>
    </>
  )
}
