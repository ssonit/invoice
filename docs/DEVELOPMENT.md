# Development Workflow & Conventions

This is the reference for how code gets written in this repo — established patterns
(observed across the codebase) plus explicit rules the user has set. Update this file
whenever a new convention or rule is decided; don't let it silently drift out of date.

---

## 1. Code conventions

**File organization:** Pure, side-effect-light logic lives in `src/lib/` — this is what
gets unit-tested. Orchestration (API routes, Server Actions, pages) stays thin and calls
into `lib/`; it's verified manually, not unit-tested (see [Testing](#3-test)).

**Validation (`src/lib/validation/*.ts`):** Zod schemas, one file per domain (`auth.ts`,
`upload.ts`, `vendors.ts`, `subscriptions.ts`). Every parser returns the same discriminated
union:
```ts
type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };
```
Naming: `parseXInput(input: unknown)` for structured data, `parseXForm(formData: FormData)`
for Server Action form submissions.

**Server Actions:** Co-located as `actions.ts` next to the route segment that uses them
(`src/app/dashboard/actions.ts`, `src/app/dashboard/vendors/actions.ts`, etc.), marked
`"use server"`. Return typed result objects for the client to react to
(`{ ok: true, ... } | { ok: false, error: string }`); use `redirect()` only for actions
that always navigate away on success (login, signup, password reset).

**Supabase client usage — this is a hard rule, not a style preference:**
- `createClient()` (`@/lib/supabase/server`, RLS-scoped) — for reading the current session
  and anything the signed-in user is allowed to touch under RLS.
- `createServiceClient()` (`@/lib/supabase/service`, bypasses RLS) — **only** for
  privileged writes/reads that happen *after* an explicit `if (!user) redirect("/login")`
  check via the RLS client. Never use the service client to skip an auth check.

**Idempotent writes:** Any write keyed by an externally-supplied unique identifier (email
`messageId`, upload content hash) must be `.upsert(..., { onConflict: "..." })` against a
**non-partial** unique constraint — not `.insert()`. Two established reasons this matters
here: (1) `supabase-js` generates `ON CONFLICT (...)` with no `WHERE` clause, so the target
must be a real constraint, not a partial index; (2) background-task retries
(Trigger.dev) re-run the whole task function from scratch, so a retry that re-processes an
already-saved item must not create a duplicate row. See
`invoices_source_message_ref_key` (webhook task-queue) and `invoices_user_content_hash_key`
(upload dedup) for the pattern.

**Migrations:** Every new table gets RLS enabled + `select`/`insert`/`update`/`delete`
policies scoped to `(select auth.uid()) = user_id` **and** explicit `grant` statements to
`authenticated`/`service_role` — RLS policies alone are insufficient on this Supabase
setup; PostgREST returns "permission denied" without the grants too.

**Multi-provider abstraction:** Swappable providers (LLM extraction: anthropic/google/
deepseek) are selected via an env var through a dispatch table
(`src/lib/extraction/index.ts`), never hardcoded inline at the call site. Apply the same
pattern to any future swappable-backend feature.

**Components:** shadcn/ui primitives live in `src/components/ui/`, customized — re-running
`npx shadcn add <name>` must not silently overwrite them (`yes N | npx shadcn add ...`, or
review the diff before accepting). Dark-mode-only design tokens, lime accent (`#E8FF47`),
Outfit display font — full details in [`docs/DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) and
[`docs/DASHBOARD.md`](DASHBOARD.md).

**Naming:** kebab-case file names, PascalCase components, camelCase functions/variables.

---

## 2. Rules

- **Never physically delete user data without the user explicitly asking for it.** Default
  to additive migrations and soft-delete (a `deleted_at`/status flag) over `DROP`/`DELETE`.
  This includes account deletion — see `profiles.deleted_at` in the system-hardening
  feature, not `auth.admin.deleteUser`.
- **Always ship validation + test files** alongside new logic, not as a follow-up.
- **Record new decisions in `docs/*.md`** as they're made — a durable written trail, not
  just chat history.
- **Read `node_modules/next/dist/docs/`** before using an App Router API you're not certain
  about — this project runs a customized Next.js build with breaking changes vs. training
  data (see `AGENTS.md`).
- **Use the `code-review-graph` MCP tools before Grep/Glob** for codebase exploration —
  faster, cheaper, gives structural context file scanning can't (see `CLAUDE.md`).

---

## 3. Workflow: Plan → Code → Test → Security Review → Deploy

### Plan

- Any non-trivial feature: `superpowers:brainstorming` (clarify scope, present a design,
  write it to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`) →
  `superpowers:writing-plans` (bite-sized TDD tasks with real code, written to
  `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`).
- Execution: `superpowers:subagent-driven-development` (fresh subagent per task + two-stage
  review), or direct inline execution for small/mechanical plans.
- Trivial fixes (typo, one-line config, a single obvious bug fix) can skip formal planning.

### Code

- Follow the conventions in [§1](#1-code-conventions).
- Small, focused commits — one logical step per commit (matches the plan's task
  granularity), descriptive messages.
- Reuse existing `lib/` functions instead of duplicating logic (e.g., `escapeIlike`,
  `normalizeVendorKey`, `parsePageParam`) — check for an existing helper before writing a
  new one.

### Test

- **Unit test (Vitest) all pure `src/lib/` logic** — this is the primary automated test
  layer in this project (currently 13 test files / 123+ tests, run via `npm run test`).
- **What to test:** validation schemas (valid + invalid inputs, boundary values), business
  logic (date/aggregation math, formatting, classification), explicitly favoring edge
  cases over happy-path-only coverage.
- **What's deliberately *not* unit-tested** (established convention, not an oversight):
  API routes, Server Actions, `src/trigger/*.ts` background tasks, UI components, and thin
  LLM-SDK wrappers (`extraction/{anthropic,google,deepseek}.ts`) — these mix I/O with
  logic and are verified manually instead, using the in-app browser tools against the
  local dev server + local Supabase (and, for background tasks, `npx trigger.dev@latest
  dev` running alongside).
- Before any commit touching `src/lib/`: `npm run test` and `npx tsc --noEmit`.
- Before calling a feature done: `npm run build`, plus an actual manual smoke test of the
  user-facing flow in-browser — screenshots/DOM checks aren't a substitute for clicking
  through the real thing when the change is UI-observable.

### Review security

Run the `security-review` skill before merging any change that touches:
- Authentication or session handling (login, password reset, account deletion).
- RLS policies or `grant` statements on any table.
- Any code path using the service-role Supabase client (`createServiceClient()`).
- Financial/payment data, once that exists.
- Anything processing external or untrusted input directly (webhooks, file uploads).

### Deploy (target: Vercel — not yet configured, this is the intended process)

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
