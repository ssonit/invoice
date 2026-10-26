"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import {
  DASHBOARD_LOCALE_COOKIE,
  DASHBOARD_LOCALE_COOKIE_MAX_AGE_SECONDS,
  dashboardDictionaries,
  type DashboardDictionary,
  type DashboardLocale,
} from "@/lib/dashboard/i18n"

type DashboardI18nValue = {
  locale: DashboardLocale
  t: DashboardDictionary
  setLocale: (locale: DashboardLocale) => void
}

const DashboardI18nContext = createContext<DashboardI18nValue | null>(null)

export function DashboardI18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: DashboardLocale
  children: ReactNode
}) {
  const router = useRouter()
  const [locale, setLocaleState] = useState(initialLocale)

  const setLocale = useCallback(
    (next: DashboardLocale) => {
      document.cookie = `${DASHBOARD_LOCALE_COOKIE}=${next}; path=/; max-age=${DASHBOARD_LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`
      setLocaleState(next)
      // Re-render Server Components, which read the cookie.
      router.refresh()
    },
    [router]
  )

  return (
    <DashboardI18nContext.Provider
      value={{ locale, t: dashboardDictionaries[locale], setLocale }}
    >
      {children}
    </DashboardI18nContext.Provider>
  )
}

export function useDashboardI18n(): DashboardI18nValue {
  const ctx = useContext(DashboardI18nContext)
  if (!ctx) {
    throw new Error("useDashboardI18n must be used within DashboardI18nProvider")
  }
  return ctx
}
