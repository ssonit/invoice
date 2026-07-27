import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That URL does not exist, or the page has moved.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className={cn(buttonVariants())}>
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
