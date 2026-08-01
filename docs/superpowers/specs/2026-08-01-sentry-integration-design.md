# Sentry Integration Design

**Date**: 2026-08-01
**Status**: design-approved
**Sentry plan**: Developer (free tier)

## Summary

Integrate Sentry for error monitoring in the Invoice Reader app. Phase 1 covers error
monitoring + source maps upload; performance tracing comes in Phase 2 when traffic grows.
Cron monitoring and session replay are excluded (require paid plans).

## Constraints

- **Free tier** — 10K spans/month, no cron monitoring, 60 min replay (not enough for practical use)
- **Best-effort** — Sentry failures never block the app. If `SENTRY_DSN` is missing or Sentry
  is unreachable, the app runs normally, errors are silently dropped.
- **Follow project conventions** — thin `src/lib/sentry/` wrappers, env validation, swappable
  patterns where applicable.

## Architecture

```
src/lib/sentry/
  index.ts         — barrel re-export
  config.ts        — env parsing + validation
  init.ts           — Sentry.init() configuration
  user-context.ts  — attach Supabase user identity to Sentry scope
  trigger.ts       — Trigger.dev task error capture helper

src/instrumentation.ts — updated to call initSentry after env validation

src/app/error.tsx       — updated to capture exceptions via Sentry
src/app/global-error.tsx — updated to capture exceptions via Sentry

src/trigger/*.ts        — updated with captureTaskError in catch blocks

next.config.ts          — wrapped with withSentryConfig

.env.local.example      — new vars: SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
.github/workflows/ci.yml — dummy Sentry env vars for build

docs/third-party-services.md — add Sentry entry
```

## Dependency

Single package: `@sentry/nextjs` (includes `@sentry/node` + `@sentry/react` internally).

```bash
npm install @sentry/nextjs
```

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `SENTRY_DSN` | Runtime | Sentry project DSN (errors go here) |
| `SENTRY_AUTH_TOKEN` | CI + Vercel | Auth token for source maps upload |
| `SENTRY_ORG` | CI + Vercel | Sentry org slug |
| `SENTRY_PROJECT` | CI + Vercel | Sentry project slug |

`SENTRY_ENV` is auto-detected:
- `VERCEL_ENV=production` → `"production"`
- `VERCEL_ENV=preview` → `"preview"`
- Else → `"development"`

## `src/lib/sentry/config.ts`

Parses and validates Sentry environment variables. Returns `null` if `SENTRY_DSN` is missing
(best-effort — silently no-ops).

```ts
type SentryConfig = {
  dsn: string;
  environment: "development" | "preview" | "production";
};

export function parseSentryConfig(): SentryConfig | null;
```

## `src/lib/sentry/init.ts`

Calls `Sentry.init()` with project defaults:

- `tracesSampleRate: 0.1` — sample 10% to stay within free-tier span budget
- `replaysSessionSampleRate: 0` — disabled (free tier 60 min/month is impractical)
- `beforeSend` — strips `Authorization`, `Cookie` headers from event payloads
- Uses `@sentry/nextjs` default integrations (auto-capture React errors, API routes,
  Server Actions, middleware)

```ts
export function initSentry(config: SentryConfig): void;
```

## `src/lib/sentry/user-context.ts`

Attaches Supabase user identity to the current Sentry scope so errors are tagged with the
affected user.

```ts
export function attachUserToSentry(user: { id: string; email?: string | null }): void;
```

Called after auth checks in Server Components and Server Actions (thin wrapper — 1 line per
call site).

## `src/lib/sentry/trigger.ts`

Capture errors from Trigger.dev background tasks. Unlike auto-instrumented API routes,
Trigger.dev runs outside the Next.js runtime so it needs explicit capture.

```ts
export async function captureTaskError(
  taskName: string,
  error: unknown,
  context?: Record<string, unknown>
): Promise<void>;
```

Calls `Sentry.captureException()` then `Sentry.flush(2000)` to drain the event queue
before the serverless function freezes.

## Instrumentation hook (`src/instrumentation.ts`)

Updated flow:

1. Validate environment variables (existing `parseEnvInput` — keep first, fail fast)
2. Parse Sentry config (new — best-effort)
3. `initSentry()` if config is available (new — never throws)

Sentry init runs **after** env validation so invalid env is surfaced clearly, not buried
behind Sentry noise.

## Error boundaries

### `global-error.tsx` (server-level root boundary)

Calls `Sentry.captureException(error, { tags: { boundary: "global-error" } })` in the
`useEffect` before the existing `console.error`. UI unchanged.

### `error.tsx` (route-level boundary)

Same pattern, tag is `boundary: "app-error"`.

All other error surfaces (API routes, Server Actions, React component trees) are
auto-instrumented by `@sentry/nextjs` — no code changes needed.

## Source maps upload

Uses `withSentryConfig()` wrapping `next.config.ts`. Configuration:

```ts
withSentryConfig(nextConfig, {
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },
  autoUploadSourceMaps: !!process.env.SENTRY_AUTH_TOKEN,
});
```

| Environment | Source maps generated | Uploaded to Sentry |
|---|---|---|
| Local dev (`npm run dev`) | No | No |
| CI (GitHub Actions) | Yes (build) | No (no auth token) |
| Vercel Preview | Yes | Yes |
| Vercel Production | Yes | Yes |

`deleteSourcemapsAfterUpload: true` ensures source maps are not served to browser users.

## Trigger.dev task changes

Each of the three trigger task files gets a Sentry capture in its catch block:

- `src/trigger/process-inbound-email.ts`
- `src/trigger/process-attachment.ts`
- `src/trigger/send-inbound-email-reply.ts`

Pattern (same for all three):

```ts
catch (error) {
  console.error("Failed to <action>", context, error);  // existing — keep
  await captureTaskError("task-name", error, { ...context });  // add this
  throw;  // existing — keep (Trigger.dev handles retry)
}
```

The task still re-throws after capture — Sentry is purely observational, doesn't change
the retry/failure behavior.

## CI changes (`.github/workflows/ci.yml`)

Add dummy Sentry env vars so `npm run build` passes without real tokens:

```yaml
SENTRY_DSN: https://example@sentry.io/0
SENTRY_ORG: test-org
SENTRY_PROJECT: test-project
```

`SENTRY_AUTH_TOKEN` is intentionally omitted — auto-upload is gated on its presence,
and we don't want CI uploading source maps from ephemeral builds.

## Vercel configuration

Add these environment variables to the Vercel project (both Preview and Production):

- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Apply via `vercel env add` or the Vercel dashboard UI.

## What's NOT in scope (Phase 1)

| Feature | Reason |
|---|---|
| Performance tracing (full) | Free tier limits to 10K spans — enable `tracesSampleRate: 0.1` baseline, revisit when traffic grows |
| Session replay | Free tier gives 60 min/month — not enough for practical use; wait for Team plan upgrade |
| Cron monitoring | Requires Team plan. Trigger.dev has its own retry/error dashboard as fallback |
| Custom alerts / dashboards | Out of scope — use Sentry's built-in defaults |
| Release tracking | Out of scope for Phase 1 — can be added via `Sentry.setTag("release", gitSha)` later |

## Testing strategy

Following project conventions (`.claude/rules/testing.md`):

- **Unit test** `src/lib/sentry/config.ts` and `src/lib/sentry/user-context.ts` — these are
  pure logic, testable with Vitest
- **Not unit-tested**: `init.ts` (SDK wrapper), `trigger.ts` (side-effect heavy),
  instrumentation hook (runtime bootstrap), error boundaries (UI components)
- **Manual verification**: deploy to Vercel Preview, trigger an error (e.g. navigate to
  a non-existent route, upload an invalid invoice), verify it appears in Sentry dashboard
  within seconds

## Rollout

1. Merge to `main` → Vercel auto-deploys Preview
2. Smoke test on Preview: trigger a few errors, verify in Sentry dashboard
3. Push to Production
4. Monitor Sentry for 1-2 days, check no noise/flood before enabling traces

## Related docs

- [`.claude/rules/errors.md`](../../.claude/rules/errors.md) — project error handling conventions
- [`docs/deploy.md`](../deploy.md) — deploy runbook (needs update with Sentry env vars)
- [`docs/third-party-services.md`](../third-party-services.md) — add Sentry entry after rollout
