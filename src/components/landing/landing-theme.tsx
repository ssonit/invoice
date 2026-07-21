"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type LandingTheme = "dark" | "light"

const STORAGE_KEY = "invoice-landing-theme"

type LandingThemeValue = {
  theme: LandingTheme
  setTheme: (theme: LandingTheme) => void
  toggleTheme: () => void
}

const LandingThemeContext = createContext<LandingThemeValue | null>(null)

export function LandingThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<LandingTheme>("dark")

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "dark" || stored === "light") {
      setThemeState(stored)
    }
  }, [])

  const setTheme = useCallback((next: LandingTheme) => {
    setThemeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      window.localStorage.setItem(STORAGE_KEY, next)
      return next
    })
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
