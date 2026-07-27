# Invoice Reader

AI-powered invoice inbox: forward bills to a unique email address or upload PDFs/images, extract vendor/amount/dates with an LLM, and review everything in a dashboard.

## Stack

- **Next.js** (App Router) + React + Tailwind / shadcn
- **Supabase** — Auth, Postgres, Storage, RLS
- **AgentMail** — inbound email forwarding + webhooks
- **Trigger.dev** — background processing for inbound email
- **LLM extraction** — Anthropic / Gemini / DeepSeek (see `EXTRACTION_PROVIDER`)
- **Lemon Squeezy** — billing (Merchant of Record), Team plan checkout + webhook
- **Upstash Redis** — rate limits invoice uploads (optional — no-ops if unset)

## Prerequisites

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (local stack)
- Accounts/keys for AgentMail, Trigger.dev, and at least one extraction provider
- Lemon Squeezy account (billing) and, optionally, an Upstash Redis database
  (upload rate limiting — https://console.upstash.com, free tier)

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in values from .env.local.example comments
```

Start local Supabase (applies migrations from `supabase/migrations/`):

```bash
npx supabase start
# Copy the printed API URL + anon/service-role keys into .env.local
```

Run the app (and Trigger.dev when testing inbound email):

```bash
npm run dev
# In a second terminal, when needed:
npx trigger.dev@latest dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

All required variables are listed in [`.env.local.example`](.env.local.example):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server paths (bypass RLS carefully) |
| `AGENTMAIL_API_KEY` / `AGENTMAIL_WEBHOOK_SECRET` | Inbox provisioning + webhook verification |
| `TRIGGER_SECRET_KEY` / `TRIGGER_PROJECT_REF` | Trigger.dev task queue |
| `EXTRACTION_PROVIDER` + provider API keys | Invoice OCR / extraction |
| `LEMONSQUEEZY_API_KEY` / `LEMONSQUEEZY_STORE_ID` / `LEMONSQUEEZY_TEAM_VARIANT_ID` / `LEMONSQUEEZY_WEBHOOK_SECRET` | Team plan checkout + subscription webhook |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upload rate limiting (optional) |

Everything except the Upstash pair and the extraction-provider keys you're not using is
validated at server startup (`src/instrumentation.ts`) — a missing required variable fails
fast with a clear error instead of an obscure runtime failure. Never commit `.env.local`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build + serve |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (pure `src/lib/` logic) |
| `npx tsc --noEmit` | Typecheck |

## Deploy

Target is **Vercel** (not fully wired yet). Checklist from [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md):

1. Mirror `.env.local.example` into Vercel env (Preview + Production).
2. Apply migrations to the target Supabase project (`npx supabase db push`).
3. Deploy Trigger.dev tasks separately: `npx trigger.dev@latest deploy`.
4. In the Supabase dashboard, set Auth → URL Configuration's Site URL and Redirect URLs to
   the production domain (`supabase/config.toml`'s `127.0.0.1` values are local-only).
5. Create the Lemon Squeezy webhook (Settings → Webhooks) pointing at
   `https://<domain>/api/webhooks/lemonsqueezy`, subscribed to `subscription_*` events.
6. Confirm `npm run lint`, `npm run test`, `npx tsc --noEmit`, and `npm run build` are clean.

## Docs

- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — plan → code → test → security review → deploy
- [`docs/DASHBOARD.md`](docs/DASHBOARD.md) — dashboard UI map
- [`docs/system-hardening.md`](docs/system-hardening.md) — auth recovery, upload dedup, account soft-delete
- [`docs/third-party-services.md`](docs/third-party-services.md) — AgentMail, Trigger.dev, Lemon Squeezy, Upstash setup notes
- [`.claude/rules/`](.claude/rules/) — standing code conventions
