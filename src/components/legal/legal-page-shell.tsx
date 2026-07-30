"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { BrandLogo } from "@/components/landing/brand-logo"
import { useLandingI18n } from "@/components/landing/landing-i18n"
import { getLegalCopy, type LegalLocale } from "@/lib/legal/dictionary"

export function LegalPageShell({ page }: { page: "terms" | "privacy" }) {
  const { locale, setLocale } = useLandingI18n()
  const { [page]: legal } = getLegalCopy(locale as LegalLocale)

  const toggleLocale = () => {
    setLocale(locale === "en" ? "vi" : "en")
  }

  return (
    <div className="min-h-dvh bg-[var(--landing-bg)] font-[family-name:var(--font-outfit)] text-[var(--landing-fg)] antialiased">
      {/* Header */}
      <header className="border-b border-[var(--landing-border)] bg-[var(--landing-card)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="inline-flex items-center gap-2">
            <BrandLogo size="md" />
          </Link>
          <button
            type="button"
            onClick={toggleLocale}
            className="rounded-full border border-[var(--landing-border)] px-3 py-1.5 text-xs font-medium text-[var(--landing-muted)] transition-colors hover:border-[var(--landing-muted)] hover:text-[var(--landing-fg)]"
          >
            {locale === "en" ? "VI" : "EN"}
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16">
        {/* Back link */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-fg)]"
        >
          <ArrowLeft className="size-3.5" />
          {locale === "en" ? "Back home" : "Về trang chủ"}
        </Link>

        <h1 className="font-[family-name:var(--font-outfit)] text-3xl font-semibold tracking-tight">
          {legal.title}
        </h1>

        <p className="mt-1 text-sm text-[var(--landing-muted)]">
          {locale === "en" ? "Last updated" : "Cập nhật lần cuối"}: {legal.updated}
        </p>

        {/* Draft banner */}
        <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
          {legal.banner}
        </div>

        {/* Sections */}
        <article className="mt-10 space-y-8">
          {legal.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-[family-name:var(--font-outfit)] text-lg font-semibold tracking-tight">
                {section.heading}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--landing-muted)]">
                {section.body}
              </p>
            </section>
          ))}
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--landing-border)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 text-xs text-[var(--landing-muted)] md:px-6">
          <p>
            {locale === "en" ? "© 2026 Invoice Reader." : "© 2026 Invoice Reader."}{" "}
            {locale === "en" ? "All rights reserved." : "Đã đăng ký bản quyền."}
          </p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-[var(--landing-fg)]">
              {locale === "en" ? "Terms" : "Điều khoản"}
            </Link>
            <Link href="/privacy" className="hover:text-[var(--landing-fg)]">
              {locale === "en" ? "Privacy" : "Riêng tư"}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
