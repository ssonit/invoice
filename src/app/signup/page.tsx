import Link from "next/link";
import { Receipt, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check_email?: string }>;
}) {
  const { error, check_email } = await searchParams;

  return (
    <AuthShell>
      <div className="mb-8 flex items-center gap-2 lg:hidden">
        <span className="flex size-7 items-center justify-center rounded-[8px] bg-primary text-primary-foreground">
          <Receipt className="size-[15px]" strokeWidth={1.75} />
        </span>
        <span className="text-[14px] font-semibold">Invoice Reader</span>
      </div>

      {check_email ? (
        <div className="flex flex-col items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-[10px] bg-emerald-500/10 text-emerald-500">
            <MailCheck className="size-[18px]" strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">Check your email</h1>
            <p className="mt-[2px] text-[13px] text-muted-foreground">
              We sent a confirmation link. Click it to activate your account, then sign in.
            </p>
          </div>
          <Link
            href="/login"
            className="text-[13px] font-medium text-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-[15px] font-semibold tracking-tight">Create your account</h1>
            <p className="mt-[2px] text-[13px] text-muted-foreground">
              Start turning forwarded emails into a clean invoice list.
            </p>
          </div>

          <form action={signup}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" name="email" type="email" required autoComplete="email" />
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
                />
              </Field>
              {error ? (
                <p className="text-[13px] text-destructive">{error}</p>
              ) : null}
              <Button type="submit" className="w-full">
                Create account
              </Button>
              <p className="text-center text-[13px] text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Sign in
                </Link>
              </p>
            </FieldGroup>
          </form>
        </>
      )}
    </AuthShell>
  );
}
