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
- `AGENTMAIL_API_KEY`
- `AGENTMAIL_WEBHOOK_SECRET`
- `TRIGGER_SECRET_KEY`
- `TRIGGER_PROJECT_REF`
- `EXTRACTION_PROVIDER` (e.g. `anthropic`)
- `ANTHROPIC_API_KEY` (or `GEMINI_API_KEY` / `DEEPSEEK_API_KEY` per provider)
- `POLAR_ACCESS_TOKEN`
- `POLAR_ORGANIZATION_ID`
- `POLAR_TEAM_PRODUCT_ID`
- `POLAR_WEBHOOK_SECRET`

Optional (skip if not using):
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (upload rate limiting)

**Important:** Never set `BILLING_DEV_UNLOCK` on Production. Preview can leave it unset; if you need Team features on Preview, grant your user the Team role via SQL instead.

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

```bash
npx trigger.dev@latest deploy
```

Requires `TRIGGER_SECRET_KEY` and `TRIGGER_PROJECT_REF` set to production values in your local `.env.local`.

### 6. Polar — webhook

In the Polar dashboard → **Settings** → **Webhooks**:

- **URL:** `https://<prod-domain>/api/webhooks/polar`
- **Events:** `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_expired`, `subscription_payment_success`, `subscription_payment_failed`
- Copy the signing secret into `POLAR_WEBHOOK_SECRET` on Vercel.

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
- [ ] **Forward invoice:** Send an email to your AgentMail inbox → invoice appears (verify Trigger.dev is processing).
- [ ] **Settings:** Settings page loads, billing card shows (Polar integration working).
- [ ] **Analytics:** Available on Starter (and Team).
- [ ] **Exports / inbox:** Team plan unlocks CSV exports and new forwarding-inbox create.
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
