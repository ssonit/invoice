# Deploy Runbook

Step-by-step operator checklist for deploying Invoice Reader to production (and setting up Preview environments). All steps are manual in Phase 1 — CI gates PRs but does not auto-deploy infrastructure.

## One-time setup

### 1. Create the Vercel project

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. Import `ssonit/invoice` from GitHub.
3. Set **Framework** to Next.js.
4. Do NOT deploy yet — add environment variables first.

### 2. Environment variables (Vercel)

Copy every key from [`.env.local.example`](.env.local.example) into the Vercel project **Environment Variables** section. Apply to both **Preview** and **Production** environments with real values.

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `EXTRACTION_PROVIDER` (e.g. `anthropic`)
- `ANTHROPIC_API_KEY` (or `GEMINI_API_KEY` / `DEEPSEEK_API_KEY` per provider)

Optional (skip if not using):
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (rate limiting — strongly recommended for a public deploy)
- Email forwarding — set **all three or none** (a partial set fails at startup):
  - `AGENTMAIL_API_KEY`
  - `AGENTMAIL_WEBHOOK_SECRET`
  - `TRIGGER_SECRET_KEY`

### 3. Supabase — push migrations

```bash
# Against the production Supabase project:
npx supabase db push
```

If you use a separate Supabase project for Preview environments, push there too.

### 4. Supabase Auth — URL configuration

In the Supabase dashboard → **Authentication** → **URL Configuration**:

- **Site URL:** `https://<prod-domain>`
- **Redirect URLs:** `https://<prod-domain>/**`

If using Vercel Preview deployments, also add the preview URL pattern (e.g. `https://*.vercel.app/**`).

### 5. Trigger.dev — deploy background tasks

If you use email forwarding:

```bash
npx trigger.dev@latest deploy
```

Uses `TRIGGER_SECRET_KEY` from your local `.env.local` (production value); edit `project` in `trigger.config.ts` to your own Trigger.dev project ref first.

## Every deploy — pre-flight

Before cutting to production:

- [ ] `npm run lint` — clean
- [ ] `npm run test` — all green
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — clean (with real env or CI, not dummies)
- [ ] CI is green on the PR
- [ ] Migrations applied to the target Supabase project (`npx supabase db push`)
- [ ] `security-review` passed for any sensitive change (auth, RLS, service-role paths, financial data, untrusted input)

## Post-deploy smoke checklist

After Vercel deploys (Preview or Production):

- [ ] **Signup:** Create a new account (or log in with an existing one).
- [ ] **Dashboard:** Dashboard loads without errors.
- [ ] **Upload invoice:** Upload a PDF or image → extraction completes → invoice appears in the list.
- [ ] **Forward invoice (if email forwarding is configured):** Send an email to your AgentMail inbox → invoice appears (verify Trigger.dev is processing).
- [ ] **Settings:** Settings page loads.
- [ ] **Exports:** CSV export downloads.
- [ ] **Logout/Login:** Session persistence works across browser restart.

## CI (GitHub Actions)

On every PR and push to `main`, [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs:

```
lint → test → tsc --noEmit → build (dummy env)
```

A green CI check is required before merging. The workflow uses dummy environment variables (safe for public repos) — it validates the code builds, not that it connects to real services.

## Rollback

If a production deploy causes issues:

1. In the Vercel dashboard, go to the **Deployments** tab for the project.
2. Find the last known-good deployment, click **…** → **Redeploy**.
3. If migrations were part of the bad deploy, assess whether a revert migration is needed — Supabase does not auto-rollback.

## Related docs

- [`.env.local.example`](../.env.local.example) — all environment variables with comments
- [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) — full development workflow
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — CI workflow definition
