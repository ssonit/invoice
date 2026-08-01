# Sentry Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Sentry error monitoring into the Next.js app with source maps upload and Trigger.dev task error capture.

**Architecture:** Thin `src/lib/sentry/` facade layer over `@sentry/nextjs` SDK, following existing project conventions (validation → config → init, best-effort, never throws). Source maps uploaded via `withSentryConfig` wrapper on Vercel builds only.

**Tech Stack:** `@sentry/nextjs`, Next.js 16, TypeScript, Vitest

## Global Constraints

- **Sentry plan:** Developer (free tier) — no cron monitoring, no session replay
- **Best-effort:** Sentry failures never block the app — silently no-ops if unconfigured
- **Naming:** files kebab-case, functions camelCase, types PascalCase, bools prefixed `is`/`has`
- **Testing:** unit test pure `src/lib/sentry/*.ts` logic with Vitest; error boundaries, init wrappers, and trigger tasks verified manually
- **No magic strings:** Sentry-related constants in `src/constants/` if reused
- **Prefer early return** over nested conditionals

---

### Task 1: Install @sentry/nextjs

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `@sentry/nextjs` available as project dependency

- [ ] **Step 1: Install package**

```bash
npm install @sentry/nextjs
```

- [ ] **Step 2: Verify install**

```bash
npm ls @sentry/nextjs
```

Expected: `@sentry/nextjs@<version>` appears in tree

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @sentry/nextjs"

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Task 2: Create src/lib/sentry/config.ts

**Files:**
- Create: `src/lib/sentry/config.ts`
- Create: `src/lib/sentry/config.test.ts`

**Interfaces:**
- Produces: `parseSentryConfig(): SentryConfig | null`
- Type: `SentryConfig = { dsn: string; environment: "development" | "preview" | "production" }`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/sentry/config.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseSentryConfig } from "./config";

describe("parseSentryConfig", () => {
  let originalEnv: typeof process.env;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.SENTRY_DSN;
    delete process.env.VERCEL_ENV;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns null when SENTRY_DSN is not set", () => {
    expect(parseSentryConfig()).toBeNull();
  });

  it("returns null when SENTRY_DSN is empty string", () => {
    process.env.SENTRY_DSN = "";
    expect(parseSentryConfig()).toBeNull();
  });

  it("returns config with production environment when VERCEL_ENV=production", () => {
    process.env.SENTRY_DSN = "https://example@sentry.io/123";
    process.env.VERCEL_ENV = "production";
    const config = parseSentryConfig();
    expect(config).toEqual({
      dsn: "https://example@sentry.io/123",
      environment: "production",
    });
  });

  it("returns config with preview environment when VERCEL_ENV=preview", () => {
    process.env.SENTRY_DSN = "https://example@sentry.io/123";
    process.env.VERCEL_ENV = "preview";
    const config = parseSentryConfig();
    expect(config).toEqual({
      dsn: "https://example@sentry.io/123",
      environment: "preview",
    });
  });

  it("returns config with development environment when neither VERCEL_ENV nor production NODE_ENV", () => {
    process.env.SENTRY_DSN = "https://example@sentry.io/123";
    process.env.NODE_ENV = "development";
    const config = parseSentryConfig();
    expect(config).toEqual({
      dsn: "https://example@sentry.io/123",
      environment: "development",
    });
  });

  it("detects production from NODE_ENV when VERCEL_ENV is unset", () => {
    process.env.SENTRY_DSN = "https://example@sentry.io/123";
    process.env.NODE_ENV = "production";
    const config = parseSentryConfig();
    expect(config).toEqual({
      dsn: "https://example@sentry.io/123",
      environment: "production",
    });
  });

  it("prefers VERCEL_ENV over NODE_ENV", () => {
    process.env.SENTRY_DSN = "https://example@sentry.io/123";
    process.env.VERCEL_ENV = "preview";
    process.env.NODE_ENV = "production";
    const config = parseSentryConfig();
    expect(config).toEqual({
      dsn: "https://example@sentry.io/123",
      environment: "preview",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/sentry/config.test.ts
```

Expected: all 7 tests FAIL with "Cannot find module" — file doesn't exist yet

- [ ] **Step 3: Write implementation**

Create `src/lib/sentry/config.ts`:

```ts
export type SentryConfig = {
  dsn: string;
  environment: "development" | "preview" | "production";
};

/** Parse and validate Sentry environment configuration.
 * Returns null if SENTRY_DSN is missing (best-effort — silently no-ops). */
export function parseSentryConfig(): SentryConfig | null {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;

  const environment = detectSentryEnvironment();

  return { dsn, environment };
}

function detectSentryEnvironment(): SentryConfig["environment"] {
  // Vercel sets VERCEL_ENV to "production", "preview", or "development"
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "preview";

  // Fall back to NODE_ENV for non-Vercel environments
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/sentry/config.test.ts
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sentry/config.ts src/lib/sentry/config.test.ts
git commit -m "feat: add Sentry config parser with env detection

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Create src/lib/sentry/init.ts

**Files:**
- Create: `src/lib/sentry/init.ts`

**Interfaces:**
- Consumes: `SentryConfig` from `./config`
- Produces: `initSentry(config: SentryConfig): void`
- External: `@sentry/nextjs` — `Sentry.init()`

- [ ] **Step 1: Write implementation**

Create `src/lib/sentry/init.ts`:

```ts
import * as Sentry from "@sentry/nextjs";
import type { SentryConfig } from "./config";

/** Initialize Sentry with project defaults.
 * Call once at startup from instrumentation.ts.
 * Never throws — failures are silently swallowed (best-effort). */
export function initSentry(config: SentryConfig): void {
  try {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,

      // Free tier: sample 10% to stay within 10K spans/month budget
      tracesSampleRate: 0.1,

      // Session replay disabled — free tier 60 min/month is not enough for practical use
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,

      // Strip sensitive headers before sending to Sentry
      beforeSend(event) {
        scrubSensitiveHeaders(event);
        return event;
      },
    });
  } catch {
    // Best-effort: if Sentry init fails, the app continues without it
  }
}

function scrubSensitiveHeaders(event: Sentry.ErrorEvent): void {
  const request = event.request;
  if (!request?.headers) return;

  const sensitiveHeaders = ["authorization", "cookie", "x-api-key"];
  for (const header of sensitiveHeaders) {
    if (request.headers[header]) {
      request.headers[header] = "[filtered]";
    }
  }
}
```

> **Note:** `initSentry` is deliberately not unit-tested — it's a thin SDK wrapper with side effects. Manual verification on Preview deploy.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/sentry/init.ts
git commit -m "feat: add Sentry init with sensitive-header scrubbing

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Create src/lib/sentry/user-context.ts

**Files:**
- Create: `src/lib/sentry/user-context.ts`
- Create: `src/lib/sentry/user-context.test.ts`

**Interfaces:**
- Produces: `attachUserToSentry(user: { id: string; email?: string | null }): void`
- External: `@sentry/nextjs` — `Sentry.setUser()`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/sentry/user-context.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { attachUserToSentry } from "./user-context";

vi.mock("@sentry/nextjs", () => ({
  setUser: vi.fn(),
}));

describe("attachUserToSentry", () => {
  it("calls Sentry.setUser with id and email", async () => {
    const { setUser } = await import("@sentry/nextjs");
    attachUserToSentry({ id: "user-123", email: "test@example.com" });
    expect(setUser).toHaveBeenCalledWith({
      id: "user-123",
      email: "test@example.com",
    });
  });

  it("calls Sentry.setUser with id only when email is null", async () => {
    const { setUser } = await import("@sentry/nextjs");
    attachUserToSentry({ id: "user-123", email: null });
    expect(setUser).toHaveBeenCalledWith({ id: "user-123" });
  });

  it("calls Sentry.setUser with id only when email is undefined", async () => {
    const { setUser } = await import("@sentry/nextjs");
    attachUserToSentry({ id: "user-123" });
    expect(setUser).toHaveBeenCalledWith({ id: "user-123" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/sentry/user-context.test.ts
```

Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Write implementation**

Create `src/lib/sentry/user-context.ts`:

```ts
import * as Sentry from "@sentry/nextjs";

/** Attach Supabase user identity to the current Sentry scope.
 * Call after auth verification in Server Components and Server Actions.
 * Errors from this call are silently ignored (best-effort). */
export function attachUserToSentry(user: { id: string; email?: string | null }): void {
  try {
    Sentry.setUser({
      id: user.id,
      ...(user.email ? { email: user.email } : {}),
    });
  } catch {
    // Best-effort: if Sentry is unavailable, don't block the caller
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/sentry/user-context.test.ts
```

Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/sentry/user-context.ts src/lib/sentry/user-context.test.ts
git commit -m "feat: add Sentry user context helper

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Create src/lib/sentry/trigger.ts

**Files:**
- Create: `src/lib/sentry/trigger.ts`

**Interfaces:**
- Produces: `captureTaskError(taskName: string, error: unknown, context?: Record<string, unknown>): Promise<void>`
- External: `@sentry/nextjs` — `Sentry.captureException()`, `Sentry.flush()`

- [ ] **Step 1: Write implementation**

Create `src/lib/sentry/trigger.ts`:

```ts
import * as Sentry from "@sentry/nextjs";

/** Capture an error from a Trigger.dev background task.
 * Flushes the event queue before returning so Sentry can send
 * the error before the serverless function freezes. */
export async function captureTaskError(
  taskName: string,
  error: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    Sentry.captureException(error, {
      tags: { component: "trigger", task: taskName },
      extra: context,
    });
    // Drain the event queue — Vercel serverless may freeze the runtime
    // after the task handler returns. 2s is a reasonable upper bound.
    await Sentry.flush(2000);
  } catch {
    // Best-effort: if Sentry is down, the task still completes normally
  }
}
```

> **Note:** `captureTaskError` is deliberately not unit-tested — it's a thin SDK wrapper with side effects (network flush). Verified manually by triggering a test error via Trigger.dev dev tunnel.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/sentry/trigger.ts
git commit -m "feat: add Sentry error capture for Trigger.dev tasks

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Create src/lib/sentry/index.ts barrel export

**Files:**
- Create: `src/lib/sentry/index.ts`

**Interfaces:**
- Consumes: `./config`, `./init`, `./user-context`, `./trigger`
- Produces: aggregated public API

- [ ] **Step 1: Write barrel file**

Create `src/lib/sentry/index.ts`:

```ts
export { parseSentryConfig } from "./config";
export type { SentryConfig } from "./config";
export { initSentry } from "./init";
export { attachUserToSentry } from "./user-context";
export { captureTaskError } from "./trigger";
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/sentry/index.ts
git commit -m "feat: add sentry lib barrel export

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Update instrumentation.ts

**Files:**
- Modify: `src/instrumentation.ts`

**Interfaces:**
- Consumes: `parseEnvInput` from `@/lib/validation/env` (existing), `parseSentryConfig`, `initSentry` from `@/lib/sentry`
- Produces: updated `register()` that initializes Sentry after env validation

- [ ] **Step 1: Update instrumentation.ts**

Read `src/instrumentation.ts` first, then replace with:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // 1. Validate environment variables (existing — fail fast if misconfigured)
  const { parseEnvInput } = await import("@/lib/validation/env");
  const result = parseEnvInput(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error}`);
  }

  // 2. Initialize Sentry (new — best-effort, never throws)
  const { parseSentryConfig } = await import("@/lib/sentry/config");
  const sentryConfig = parseSentryConfig();
  if (sentryConfig) {
    const { initSentry } = await import("@/lib/sentry/init");
    initSentry(sentryConfig);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Verify existing behavior preserved**

```bash
npm run test
```

Expected: all existing 358 tests still pass (instrumentation is not loaded in test environment)

- [ ] **Step 4: Commit**

```bash
git add src/instrumentation.ts
git commit -m "feat: integrate Sentry init into instrumentation hook

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Update error boundaries

**Files:**
- Modify: `src/app/error.tsx`
- Modify: `src/app/global-error.tsx`

**Interfaces:**
- External: `@sentry/nextjs` — `Sentry.captureException()`

- [ ] **Step 1: Update global-error.tsx**

Read `src/app/global-error.tsx` first, then update the `useEffect` to add Sentry capture:

```tsx
"use client"

import { useEffect } from "react"
import Link from "next/link"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log locally
    console.error("Unhandled global error", error.digest, error)
    // Capture in Sentry (best-effort — silently no-ops if not configured)
    import("@sentry/nextjs").then((Sentry) =>
      Sentry.captureException(error, {
        tags: { boundary: "global-error" },
      })
    )
  }, [error])

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-dvh flex-col items-center justify-center px-4">
          <div className="mx-auto w-full max-w-md text-center">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Something went wrong
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight">
              We hit an unexpected error
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Try again. If it keeps happening, return home and continue from there.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button type="button" onClick={reset}>
                Try again
              </Button>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Back to home
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Update error.tsx**

Read `src/app/error.tsx` first, then update the `useEffect`:

```tsx
useEffect(() => {
  console.error("Unhandled app error", error.digest, error)
  import("@sentry/nextjs").then((Sentry) =>
    Sentry.captureException(error, {
      tags: { boundary: "app-error" },
    })
  )
}, [error])
```

The JSX for `error.tsx` stays unchanged (it already has the right structure — single `<main>` without `<html>`/`<body>` wrappers, which `global-error.tsx` needs but `error.tsx` must not have).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/error.tsx src/app/global-error.tsx
git commit -m "feat: add Sentry exception capture to error boundaries

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Update next.config.ts with withSentryConfig

**Files:**
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: existing `nextConfig` object
- External: `@sentry/nextjs` — `withSentryConfig()`

- [ ] **Step 1: Update next.config.ts**

Read `next.config.ts` first, then replace with:

```ts
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // agentmail dynamically imports the optional peer @x402/fetch; keep it
  // external so the bundler doesn't try to statically resolve that import.
  serverExternalPackages: ["agentmail"],

  // Baseline hardening headers. Deliberately not a full Content-Security-Policy —
  // this app pulls from enough third-party origins (Supabase, Lemon Squeezy,
  // AgentMail) that a CSP needs its own dedicated audit rather than a guess here.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Upload source maps to Sentry on Vercel builds only.
  // Local dev and CI skip the upload (no SENTRY_AUTH_TOKEN).
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },
  autoUploadSourceMaps: !!process.env.SENTRY_AUTH_TOKEN,
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Verify build succeeds locally (without Sentry token)**

```bash
npm run build
```

Expected: build succeeds (source maps generated but upload skipped — `autoUploadSourceMaps` is `false` because `SENTRY_AUTH_TOKEN` is unset locally)

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat: wrap next.config with withSentryConfig for source maps

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Add Sentry env vars to .env.local.example

**Files:**
- Modify: `.env.local.example`

**Interfaces:**
- Produces: documented env vars for Sentry configuration

- [ ] **Step 1: Append Sentry section to .env.local.example**

Read `.env.local.example` first, then append at the end:

```env
# Sentry — error monitoring & tracing (Developer free tier)
# Get the DSN from sentry.io → Settings → Projects → Client Keys (DSN).
SENTRY_DSN=
# Auth token for source maps upload on Vercel (not needed locally).
# Create at sentry.io → Settings → Auth Tokens → Create New Token
# with project:write scope.
SENTRY_AUTH_TOKEN=
# Org slug and project slug for source maps upload (Vercel only).
SENTRY_ORG=
SENTRY_PROJECT=
```

- [ ] **Step 2: Commit**

```bash
git add .env.local.example
git commit -m "chore: add Sentry env vars to local example

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Update CI workflow with dummy Sentry vars

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: CI build passes without real Sentry tokens

- [ ] **Step 1: Add Sentry env vars to ci.yml**

Read `.github/workflows/ci.yml` first, then update the `env` block:

Add these lines after the existing `ANTHROPIC_API_KEY: test-anthropic-key` line:

```yaml
SENTRY_DSN: https://example@sentry.io/0
SENTRY_ORG: test-org
SENTRY_PROJECT: test-project
```

> **Note:** `SENTRY_AUTH_TOKEN` is intentionally omitted — `autoUploadSourceMaps` gates on its presence, so CI builds generate source maps but don't attempt to upload them.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore: add dummy Sentry env vars to CI workflow

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: Add Sentry capture to Trigger.dev tasks

**Files:**
- Modify: `src/trigger/process-inbound-email.ts`
- Modify: `src/trigger/process-attachment.ts`
- Modify: `src/trigger/send-inbound-email-reply.ts`

**Interfaces:**
- Consumes: `captureTaskError` from `@/lib/sentry/trigger`
- Produces: each task now reports errors to Sentry in addition to its existing logging

- [ ] **Step 1: Read each trigger file to understand existing catch patterns**

Read the three files:
```
src/trigger/process-inbound-email.ts
src/trigger/process-attachment.ts
src/trigger/send-inbound-email-reply.ts
```

Identify the catch block in each task's `run` handler.

- [ ] **Step 2: Add Sentry capture to each catch block**

Pattern — in each file, add the import and the capture call:

```ts
import { captureTaskError } from "@/lib/sentry/trigger";
```

Inside each existing `catch (error)` block, add this line **after** `console.error` and **before** `throw`:

```ts
await captureTaskError("<task-name>", error, {
  // pass relevant context specific to the task, e.g.:
  // messageId: payload.messageId,
  // inboxId: payload.inboxId,
});
```

Task names to use:
- `"process-inbound-email"`
- `"process-attachment"`
- `"send-inbound-email-reply"`

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/trigger/process-inbound-email.ts src/trigger/process-attachment.ts src/trigger/send-inbound-email-reply.ts
git commit -m "feat: add Sentry error capture to Trigger.dev tasks

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: Update documentation

**Files:**
- Modify: `docs/third-party-services.md`
- Modify: `docs/deploy.md`

- [ ] **Step 1: Add Sentry entry to third-party-services.md**

Read `docs/third-party-services.md` first, then append after the Upstash Redis section:

```markdown
## Sentry (error monitoring)

- Free tier: Developer plan, $0/month. 5K events/month, 10K spans/month, 60 min replay
  (disabled — not enough for practical use). 1 user, 7-day data retention.
- SDK: `@sentry/nextjs` (wraps `@sentry/node` + `@sentry/react`).
- Source maps uploaded automatically on Vercel builds via `withSentryConfig`.
- Local dev: set `SENTRY_DSN` to a real or fake DSN — if unset, Sentry silently no-ops.
- Architecture: [`docs/superpowers/specs/2026-08-01-sentry-integration-design.md`](superpowers/specs/2026-08-01-sentry-integration-design.md).
```

- [ ] **Step 2: Add Sentry env vars to deploy runbook**

Read `docs/deploy.md` first, then in section **2. Environment variables (Vercel)**, add to the required variables list:

```markdown
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
```

Also add a note after the Upstash Redis line:

```markdown
- `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` (source maps upload on Vercel builds)
```

- [ ] **Step 3: Commit**

```bash
git add docs/third-party-services.md docs/deploy.md
git commit -m "docs: add Sentry to third-party services and deploy runbook

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 14: Final quality gate

- [ ] **Step 1: Run full test suite**

```bash
npm run test
```

Expected: all 358+ tests pass (including new Sentry lib tests)

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: clean, no errors

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: clean, no errors

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected: build succeeds without Sentry auth token

- [ ] **Step 5: Commit if any fixes were needed**

```bash
git add .
git commit -m "chore: quality gate fixes for Sentry integration"
```

If no fixes needed, skip this step.

---
