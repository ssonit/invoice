"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import {
  dictionaries,
  type LandingDictionary,
  type LandingLocale,
} from "@/lib/landing/dictionary"

const STORAGE_KEY = "invoice-landing-locale"

type LandingI18nValue = {
  locale: LandingLocale
  t: LandingDictionary
  setLocale: (locale: LandingLocale) => void
}

const LandingI18nContext = createContext<LandingI18nValue | null>(null)

export function LandingI18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LandingLocale>("en")

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "en" || stored === "vi") {
      setLocaleState(stored)
    }
  }, [])

  const setLocale = useCallback((next: LandingLocale) => {
    setLocaleState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  return (
    <LandingI18nContext.Provider
      value={{ locale, t: dictionaries[locale], setLocale }}
    >
      {children}
    </LandingI18nContext.Provider>
  )
}

export function useLandingI18n() {
  const ctx = useContext(LandingI18nContext)
  if (!ctx) {
    throw new Error("useLandingI18n must be used within LandingI18nProvider")
  }
  return ctx
}
