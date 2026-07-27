"use client"

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react"

export type LandingTheme = "dark" | "light"

const STORAGE_KEY = "invoice-landing-theme"
const CHANGE_EVENT = "invoice-landing-theme-change"

type LandingThemeValue = {
  theme: LandingTheme
  setTheme: (theme: LandingTheme) => void
  toggleTheme: () => void
}

const LandingThemeContext = createContext<LandingThemeValue | null>(null)

function isTheme(value: string | null): value is LandingTheme {
  return value === "dark" || value === "light"
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(CHANGE_EVENT, onStoreChange)
  }
}

function getThemeSnapshot(): LandingTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return isTheme(stored) ? stored : "dark"
}

function getServerThemeSnapshot(): LandingTheme {
  return "dark"
}

function writeTheme(next: LandingTheme) {
  window.localStorage.setItem(STORAGE_KEY, next)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function LandingThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getServerThemeSnapshot
  )

  const setTheme = useCallback((next: LandingTheme) => {
    writeTheme(next)
  }, [])

  const toggleTheme = useCallback(() => {
    writeTheme(getThemeSnapshot() === "dark" ? "light" : "dark")
  }, [])

  return (
    <LandingThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      <div
        data-landing-theme={theme}
        className="landing-shell min-h-dvh bg-[var(--landing-bg)] font-[family-name:var(--font-outfit)] text-[var(--landing-fg)] antialiased transition-colors duration-300"
      >
        {children}
      </div>
    </LandingThemeContext.Provider>
  )
}

export function useLandingTheme() {
  const ctx = useContext(LandingThemeContext)
  if (!ctx) {
    throw new Error("useLandingTheme must be used within LandingThemeProvider")
  }
  return ctx
}
