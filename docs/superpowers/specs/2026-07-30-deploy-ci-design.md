# Deploy CI — Phase 1 Design

**Date:** 2026-07-30
**Status:** implemented
**Plan:** [`docs/superpowers/plans/2026-07-30-deploy-ci.md`](../plans/2026-07-30-deploy-ci.md)

## Scope

Phase 1 delivers a **CI gate on every PR** plus a **documented manual deploy process** for Vercel, Supabase, Trigger.dev, and Lemon Squeezy. No automated migrations or background-task deploys in CI yet — those stay human-operated for safety.

## CI workflow

- **Trigger:** `pull_request` (any target) + `push` to `main`.
- **Fail-fast order:** `lint` → `test` → `tsc --noEmit` → `build`.
- **Runner:** `ubuntu-latest`, Node 20, `npm ci`.
- **Build env:** `src/instrumentation.ts` calls `parseEnvInput(process.env)` at startup and will throw (fail the build) if required keys are missing. CI sets **dummy** values in the job `env:` block so `next build` passes without real secrets. See `.github/workflows/ci.yml` for the current dummy-env table.

### Which vars get dummies

`parseEnvInput` (in `src/lib/validation/env.ts`) requires:

| Variable | Required? | CI dummy |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | always | `https://example.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | always | `test-anon-key` |
| `SUPABASE_SERVICE_ROLE_KEY` | always | `test-service-role-key` |
| `AGENTMAIL_API_KEY` | always | `test-agentmail-key` |
| `AGENTMAIL_WEBHOOK_SECRET` | always | `test-agentmail-webhook-secret` |
| `EXTRACTION_PROVIDER` | optional (defaults `anthropic`) | `anthropic` |
| `ANTHROPIC_API_KEY` | required when provider=anthropic | `test-anthropic-key` |

`TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`, all Lemon Squeezy vars, and Upstash vars are **not** validated by `parseEnvInput` — no dummy needed for the build step to pass. If they are later added to the schema, extend the CI `env:` block accordingly.

### Why no `supabase db push` in CI

Supabase CLI in CI risks:
- Pushing to the wrong project (a `SUPABASE_ACCESS_TOKEN` leak or misconfig).
- Wiping production data with an unchecked migration.
- Needing a linked Supabase project per environment (Preview vs Production), which complicates the workflow significantly.

Phase 1 keeps migrations a deliberate human step. Phase 2 can explore a dedicated migration CI job (e.g., a `workflow_dispatch` migration action with explicit environment approval gates).

### Why no Trigger.dev deploy in CI

Trigger.dev deploys from `npx trigger.dev@latest deploy`, which needs `TRIGGER_SECRET_KEY` and `TRIGGER_PROJECT_REF` set to real values. Putting those in CI secrets and auto-deploying on merge to `main` is the natural Phase 2 follow-up, but for Phase 1 the deploy stays manual to avoid accidental overwrites.

## Vercel integration

Vercel connects to the GitHub repo via its own integration:
- **Preview:** Vercel auto-deploys every PR. Preview shares the same Supabase project (or a separate preview project if isolation is needed).
- **Production:** Vercel auto-deploys on push to `main`.

The agent does not create the Vercel project — the operator follows the dashboard steps in `docs/deploy.md`.

## Env strategy per environment

| Env | Source | Real or dummy? |
|---|---|---|
| Local dev | `.env.local` | Real (individual dev keys) |
| CI (GitHub Actions) | workflow `env:` | Dummy (build-only) |
| Vercel Preview | Vercel dashboard env | Real (shared Supabase project) |
| Vercel Production | Vercel dashboard env | Real (production secrets) |

`BILLING_DEV_UNLOCK` must **never** be set on Vercel Production. Preview can leave it unset; grant your user the Team role via SQL if Insights gating needs testing on Preview.

## What stays manual (Phase 1)

1. **Supabase migrations** — `npx supabase db push` against the target project.
2. **Trigger.dev deploys** — `npx trigger.dev@latest deploy` from a machine with credentials.
3. **Supabase Auth URL config** — Site URL + Redirect URLs in the Supabase dashboard.
4. **Lemon Squeezy webhook** — create/update the webhook endpoint in the LS dashboard.
5. **Initial Vercel project creation** — import repo, set framework, add env vars.

All manual steps are documented in [`docs/deploy.md`](../../deploy.md).

## Out of scope (future phases)

- Auto-migrate from GitHub Actions or Vercel build hooks
- Trigger.dev deploy from CI
- Staging/Preview Supabase branch automation
- Database backup/restore automation
- Monitoring/alerting on deploy failures
