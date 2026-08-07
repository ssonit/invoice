import Link from "next/link"
import { MailCheck } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { SignupForm } from "./signup-form"

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ check_email?: string }>
}) {
  const { check_email } = await searchParams

  return (
    <AuthShell>
      {check_email ? (
        <div className="flex flex-col items-start gap-4">
          <span className="flex size-11 items-center justify-center rounded-xl bg-[#E8FF47]/12 text-[#E8FF47]">
            <MailCheck className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
              Check your email
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              We sent a confirmation link. Click it to activate your account,
              then sign in.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#E8FF47] text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-[#E8FF47]/90"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-7">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Get started
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Start turning forwarded emails into a clean invoice list.
            </p>
          </div>

          <SignupForm />
        </>
      )}
    </AuthShell>
  )
}
