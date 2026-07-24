---
description: Supabase client usage, migrations, and idempotent writes
paths:
  - "supabase/migrations/**"
  - "src/lib/supabase/**"
  - "src/app/**/actions.ts"
  - "src/app/api/**/route.ts"
  - "src/trigger/**"
---

# Supabase conventions

**Client usage is a hard rule, not a style preference:**
- `createClient()` (`@/lib/supabase/server`, RLS-scoped) — for reading the current session
  and anything the signed-in user is allowed to touch under RLS.
- `createServiceClient()` (`@/lib/supabase/service`, bypasses RLS) — **only** for
  privileged writes/reads that happen *after* an explicit `if (!user) redirect("/login")`
  check via the RLS client. Never use the service client to skip an auth check.

**Every new migration for a new table** gets RLS enabled + `select`/`insert`/`update`/
`delete` policies scoped to `(select auth.uid()) = user_id`, **and** explicit `grant`
statements to `authenticated`/`service_role`. RLS policies alone are insufficient on this
Supabase setup — PostgREST returns "permission denied" without the grants too.

**Idempotent writes:** any write keyed by an externally-supplied unique identifier (email
`messageId`, upload content hash) must be `.upsert(..., { onConflict: "..." })` against a
**non-partial** unique constraint — never `.insert()`. Two reasons this matters here:
1. `supabase-js` generates `ON CONFLICT (...)` with no `WHERE` clause, so the conflict
   target must be a real constraint, not a partial index.
2. Background-task retries (Trigger.dev) re-run the whole task function from scratch, so a
   retry that re-processes an already-saved item must not create a duplicate row.

See `invoices_source_message_ref_key` (webhook task-queue) and
`invoices_user_content_hash_key` (upload dedup) for the pattern. See also
`.claude/rules/data-safety.md` — soft delete uses this same additive-migration approach.
