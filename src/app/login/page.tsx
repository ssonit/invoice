import { AuthShell } from "@/components/auth/auth-shell"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <AuthShell>
      <div className="mb-7">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Sign in
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to your invoice dashboard.
        </p>
      </div>

      <LoginForm />
    </AuthShell>
  )
}
