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

## Extraction cost

Every invoice records what it cost to extract:

| Column | Meaning |
| --- | --- |
| `extraction_provider` | `anthropic`, `google`, or `deepseek` |
| `extraction_model` | The model that actually ran |
| `extraction_input_tokens` / `extraction_output_tokens` | Token counts, `null` when the provider didn't report them |
| `extraction_ms` | End-to-end latency of the provider call |
| `duplicate_hit_count` | How many times the identical file arrived again and reused this row instead of paying for a new extraction |

Spend and dedupe savings for a month:

```sql
select
  extraction_provider,
  count(*)                          as extractions,
  sum(extraction_input_tokens)      as input_tokens,
  sum(extraction_output_tokens)     as output_tokens,
  sum(duplicate_hit_count)          as calls_avoided,
  round(avg(extraction_ms))         as avg_ms
from invoices
where created_at >= date_trunc('month', now())
group by extraction_provider;
```

Documents the model rejects (`is_invoice = false`) cost a call but produce no row, so they
appear in logs only — see
[`docs/superpowers/specs/2026-07-29-extraction-cost-visibility-design.md`](docs/superpowers/specs/2026-07-29-extraction-cost-visibility-design.md).

## Deploy

Target is **Vercel**. Full operator runbook: [`docs/deploy.md`](docs/deploy.md).

Quick checklist:
1. Mirror [`.env.local.example`](.env.local.example) into Vercel env (Preview + Production).
2. Apply migrations: `npx supabase db push`.
3. Deploy background tasks: `npx trigger.dev@latest deploy`.
4. Set Supabase Auth Site URL + Redirect URLs to the production domain.
5. Create the Lemon Squeezy webhook at `https://<domain>/api/webhooks/lemonsqueezy`.
6. Run the post-deploy smoke checklist in [`docs/deploy.md`](docs/deploy.md).

CI gates every PR with `lint → test → tsc --noEmit → build` — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Docs

- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — plan → code → test → security review → deploy
- [`docs/DASHBOARD.md`](docs/DASHBOARD.md) — dashboard UI map
- [`docs/system-hardening.md`](docs/system-hardening.md) — auth recovery, upload dedup, account soft-delete
- [`docs/third-party-services.md`](docs/third-party-services.md) — AgentMail, Trigger.dev, Lemon Squeezy, Upstash setup notes
- [`.claude/rules/`](.claude/rules/) — standing code conventions
