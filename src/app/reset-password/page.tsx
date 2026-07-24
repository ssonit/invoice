import { AuthShell } from "@/components/auth/auth-shell";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updatePassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <AuthShell>
      <div className="mb-7">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Reset password
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
          Choose a new password
        </h1>
      </div>

      <form action={updatePassword}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
              placeholder="••••••••"
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
            Update password
          </Button>
        </FieldGroup>
      </form>
    </AuthShell>
  );
}
