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

## Deploy (target: Vercel — not yet configured, this is the intended process)

- **Environment variables:** mirror `.env.local.example` into the Vercel project's
  environment variable settings, per environment (Preview / Production). Never commit
  `.env.local`.
- **Supabase:** apply pending migrations against the target Supabase project as part of
  the deploy (`npx supabase db push`, or wire into CI once one exists) — the app must
  never run against a schema older than its own code expects.
- **Trigger.dev:** deployed separately from the Next.js app — `npx trigger.dev@latest
  deploy` pushes `src/trigger/*` tasks to the Trigger.dev cloud project. A Vercel deploy
  alone does not update background tasks.
- **Pre-deploy checklist:** `npm run build` clean, `npm run test` green, `npx tsc --noEmit`
  clean, all migrations applied to the target Supabase project, `security-review` passed
  for any sensitive change since the last deploy.
- No CI/CD pipeline exists yet (no GitHub Actions, no Vercel project). This checklist is
  manual for now. Automating it (a GitHub Actions workflow running build/test/typecheck on
  every PR, Vercel's own git-integration for previews) is a natural follow-up once there's
  a real Vercel project and remote to deploy to — not built speculatively ahead of need.
