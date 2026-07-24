---
description: Error handling conventions — thrown vs returned, logging format, redirect gotcha
---

# Error handling

**Expected errors → return values, not exceptions.** This is the established pattern in
this codebase (matches official Next.js guidance: model anticipated failures — validation
failure, "not found", "permission denied" — as typed return values a caller checks, not
`throw`/`catch`). Every Server Action already does this:
```ts
type ActionResult = { ok: true; ... } | { ok: false; error: string };
```
Don't switch to throwing for a case that's a normal, anticipated outcome (bad input,
missing record, business-rule rejection).

**Unexpected errors → throw, catch at the boundary, log with context.** A third-party
API failing, a database write erroring for no anticipated reason — these are genuine bugs
or infra failures. Established logging format, used consistently across the codebase —
match it:
```ts
console.error("Failed to <do the thing>", <relevant id, e.g. userId>, error);
```
Human-readable message first, identifying context second, the error object last. Never
surface `error.message` (or any raw driver/SDK error) directly to the end user — log it
server-side, return a generic, actionable message instead:
```ts
return { ok: false, error: "Could not create the forwarding address. Please try again." };
```

**`redirect()` must never be called inside a `try`/`catch`.** Next.js's `redirect()` works
by throwing internally — if it's inside a `try` block, your own `catch` swallows it and the
redirect silently fails to happen. Always call it as a top-level statement, or after the
`try`/`catch` has already completed:
```ts
// Wrong — redirect() thrown here gets caught by the surrounding catch:
try {
  await doSomething();
  redirect("/dashboard");
} catch (err) { ... }

// Right:
try {
  await doSomething();
} catch (err) { ... return { ok: false, error: "..." }; }
redirect("/dashboard");
```
No violation of this exists in the codebase today — keep it that way.

**Known gap:** no `error.tsx` or `global-error.tsx` exists yet anywhere under `src/app/`,
so a genuinely unexpected/unhandled exception in a Server/Client Component currently falls
through to Next.js's default error UI rather than an app-styled one. Worth adding before a
real launch; not fabricated as already present here.
