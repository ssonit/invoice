# Development Workflow

This is the reference for how a change moves from idea to production in this repo.

For code conventions and standing rules (Supabase client usage, validation patterns,
testing scope, data-safety, component customization, etc.), see
[`.claude/rules/`](../.claude/rules/) — those load automatically as Claude Code works on
matching files, so they're kept there rather than duplicated in this doc. Update the
relevant `.claude/rules/*.md` file whenever a new convention or rule is decided; don't let
either that directory or this file silently drift out of date.

---

## Plan

- Any non-trivial feature: `superpowers:brainstorming` (clarify scope, present a design,
  write it to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`) →
  `superpowers:writing-plans` (bite-sized TDD tasks with real code, written to
  `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`).
- Execution: `superpowers:subagent-driven-development` (fresh subagent per task + two-stage
  review), or direct inline execution for small/mechanical plans.
- Trivial fixes (typo, one-line config, a single obvious bug fix) can skip formal planning.

## Code

- Follow `.claude/rules/`.
- Small, focused commits — one logical step per commit (matches the plan's task
  granularity), descriptive messages.

## Test

- Unit test (Vitest) all pure `src/lib/` logic — see `.claude/rules/testing.md` for what
  is and isn't covered, and why.
- Run `npm run test` + `npx tsc --noEmit` before any commit touching `src/lib/`.
- Run `npm run build` plus a manual browser smoke test of the actual user flow before
  calling a feature done.

## Review security

Run the `security-review` skill before merging any change that touches:
- Authentication or session handling (login, password reset, account deletion).
- RLS policies or `grant` statements on any table.
- Any code path using the service-role Supabase client (`createServiceClient()`).
- Financial/payment data, once that exists.
- Anything processing external or untrusted input directly (webhooks, file uploads).

## CI

Every PR and push to `main` is gated by [`.github/workflows/ci.yml`](../.github/workflows/ci.yml):

```
npm ci → lint → test → tsc --noEmit → build (dummy env)
```

The workflow uses **dummy environment variables** so `next build` passes without real
secrets — `src/instrumentation.ts` calls `parseEnvInput` at startup, which would otherwise
fail the build. Real services (Supabase, AgentMail, LLM providers) are never contacted from
CI. See the workflow file's `env:` block for the current dummy-variable table.

## Deploy (target: Vercel)

The full operator runbook is in [`docs/deploy.md`](deploy.md). Quick summary:

- **Environment variables:** mirror `.env.local.example` into the Vercel project's
  environment variable settings, per environment (Preview / Production). Never commit
  `.env.local`.
- **Supabase:** apply pending migrations against the target Supabase project as part of
  the deploy (`npx supabase db push`) — the app must never run against a schema older
  than its own code expects.
- **Trigger.dev:** deployed separately from the Next.js app — `npx trigger.dev@latest
  deploy` pushes `src/trigger/*` tasks to the Trigger.dev cloud project. A Vercel deploy
  alone does not update background tasks.
- **Pre-deploy checklist:** CI green on the PR, `npm run build` clean (with real env),
  all migrations applied to the target Supabase project, `security-review` passed for
  any sensitive change since the last deploy.
- **Post-deploy smoke:** signup/login, dashboard, upload/forward one invoice, Settings
  billing card — full checklist in [`docs/deploy.md`](deploy.md).
