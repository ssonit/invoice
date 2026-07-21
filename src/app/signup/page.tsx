import Link from "next/link"
import { MailCheck } from "lucide-react"

import { AuthShell } from "@/components/auth/auth-shell"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { signup } from "./actions"

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check_email?: string }>
}) {
  const { error, check_email } = await searchParams

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

          <form action={signup}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                  className="h-10"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">
                  Use at least 6 characters.
                </p>
              </Field>
              {error ? (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </div>
              ) : null}
              <Button
                type="submit"
                size="lg"
                className="mt-1 h-11 w-full rounded-full bg-[#E8FF47] text-[#0a0a0a] hover:bg-[#E8FF47]/90"
              >
                Create account
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </FieldGroup>
          </form>
        </>
      )}
    </AuthShell>
  )
}
