"use client"

import { LegalPageShell } from "@/components/legal/legal-page-shell"
import { LandingI18nProvider } from "@/components/landing/landing-i18n"
import { LandingThemeProvider } from "@/components/landing/landing-theme"

export function LegalPageClient({ page }: { page: "terms" | "privacy" }) {
  return (
    <LandingI18nProvider>
      <LandingThemeProvider>
        <LegalPageShell page={page} />
      </LandingThemeProvider>
    </LandingI18nProvider>
  )
}
