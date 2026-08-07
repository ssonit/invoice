"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { PASSWORD_MIN_LENGTH } from "@/constants/validation";
import { initialSignupState, signup } from "./actions";

export function SignupForm() {
  const [state, formAction] = useActionState(signup, initialSignupState);

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Full name</FieldLabel>
          <Input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Alex Johnson"
            className="h-10"
          />
        </Field>
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
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            Use at least {PASSWORD_MIN_LENGTH} characters.
          </p>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className="h-10"
          />
        </Field>
        {state.error ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </div>
        ) : null}
        <SubmitButton
          type="submit"
          size="lg"
          className="mt-1 h-11 w-full rounded-full bg-[#E8FF47] text-[#0a0a0a] hover:bg-[#E8FF47]/90"
        >
          Create account
        </SubmitButton>
        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to the{" "}
          <Link
            href="/terms"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Privacy Policy
          </Link>
          .
        </p>
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
  );
}
