import Link from "next/link";
import { Receipt } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell>
      <div className="mb-8 flex items-center gap-2 lg:hidden">
        <span className="flex size-7 items-center justify-center rounded-[8px] bg-primary text-primary-foreground">
          <Receipt className="size-[15px]" strokeWidth={1.75} />
        </span>
        <span className="text-[14px] font-semibold">Invoice Reader</span>
      </div>

      <div className="mb-6">
        <h1 className="text-[15px] font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-[2px] text-[13px] text-muted-foreground">
          Sign in to your invoice dashboard.
        </p>
      </div>

      <form action={login}>
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
              autoComplete="current-password"
            />
          </Field>
          {error ? (
            <p className="text-[13px] text-destructive">{error}</p>
          ) : null}
          <Button type="submit" className="w-full">
            Sign in
          </Button>
          <p className="text-center text-[13px] text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
              Sign up
            </Link>
          </p>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
