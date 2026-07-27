import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <AuthShell>
      <div className="mb-7">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Reset password
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
          Forgot your password?
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Enter your email and we will send you a reset link.
        </p>
      </div>

      {sent ? (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
          If an account exists for that email, a reset link is on its way. Check your
          inbox.
        </div>
      ) : (
        <form action={requestPasswordReset}>
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
              Send reset link
            </Button>
          </FieldGroup>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
