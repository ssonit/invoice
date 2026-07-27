"use client"

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import {
  dictionaries,
  type LandingDictionary,
  type LandingLocale,
} from "@/lib/landing/dictionary"

const STORAGE_KEY = "invoice-landing-locale"
const CHANGE_EVENT = "invoice-landing-locale-change"

type LandingI18nValue = {
  locale: LandingLocale
  t: LandingDictionary
  setLocale: (locale: LandingLocale) => void
}

const LandingI18nContext = createContext<LandingI18nValue | null>(null)

function isLocale(value: string | null): value is LandingLocale {
  return value === "en" || value === "vi"
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(CHANGE_EVENT, onStoreChange)
  }
}

function getLocaleSnapshot(): LandingLocale {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isLocale(stored) ? stored : "en"
}

function getServerLocaleSnapshot(): LandingLocale {
  return "en"
}

export function LandingI18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribe,
    getLocaleSnapshot,
    getServerLocaleSnapshot
  )

  const setLocale = useCallback((next: LandingLocale) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
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
