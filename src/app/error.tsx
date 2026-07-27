"use client"

import { useEffect } from "react"
import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled app error", error.digest, error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Something went wrong
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
          We hit an unexpected error
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again. If it keeps happening, return home and continue from there.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  )
}
