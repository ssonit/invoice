import Link from "next/link"

import { AuthAside } from "./auth-aside"
import { BrandLogo } from "@/components/landing/brand-logo"

// Split-screen auth layout: brand panel left, form right.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-2">
      <AuthAside />
      <div className="relative flex flex-col justify-center px-4 py-10 sm:px-6">
        <div className="absolute left-4 top-4 sm:left-6 sm:top-6 lg:hidden">
          <Link href="/" className="inline-flex transition-opacity hover:opacity-80">
            <BrandLogo />
          </Link>
        </div>

        <div className="mx-auto w-full max-w-[400px]">
          <div className="rounded-2xl border border-border/80 bg-card/40 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-8">
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
