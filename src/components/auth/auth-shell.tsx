import { AuthAside } from "./auth-aside";

// Split-screen auth layout: animated intro on the left, form on the right.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <AuthAside />
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}
