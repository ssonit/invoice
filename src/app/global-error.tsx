"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Inter, Outfit } from "next/font/google"

import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
})

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled global error", error.digest, error)
  }, [error])

  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <main className="flex min-h-dvh flex-col items-center justify-center px-4">
          <div className="mx-auto w-full max-w-md text-center">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Something went wrong
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
              The app failed to load
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Try again. If the problem continues, refresh the page or return
              home.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium"
              >
                Back to home
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
