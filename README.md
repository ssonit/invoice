# Invoice Reader

> New here? Start with [docs/SETUP.md](docs/SETUP.md).

AI-powered invoice inbox: forward bills to a unique email address or upload PDFs/images, extract vendor/amount/dates with an LLM, and review everything in a dashboard.

## Stack

- **Next.js** (App Router) + React + Tailwind / shadcn
- **Supabase** — Auth, Postgres, Storage, RLS
- **AgentMail** — inbound email forwarding + webhooks (optional)
- **Trigger.dev** — background processing for inbound email (optional)
- **LLM extraction** — Anthropic / Gemini / DeepSeek (see `EXTRACTION_PROVIDER`)
- **Upstash Redis** — rate limits invoice uploads (optional — no-ops if unset)

## Prerequisites

- Node.js 20.9+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (local stack)
- A key for at least one extraction provider
- Optionally, AgentMail for email forwarding and Trigger.dev for background processing
- Optionally, an Upstash Redis database (upload rate limiting —
  https://console.upstash.com, free tier)

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
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server Supabase client |
| `SUPABASE_SECRET_KEY` | Privileged server paths (bypass RLS carefully) |
| `AGENTMAIL_API_KEY` / `AGENTMAIL_WEBHOOK_SECRET` | Inbox provisioning + webhook verification (set both or neither) |
| `TRIGGER_SECRET_KEY` | Trigger.dev task queue (optional, with the AgentMail pair); edit `project` in `trigger.config.ts` |
| `EXTRACTION_PROVIDER` + provider API keys | Invoice OCR / extraction |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upload rate limiting (optional) |

Supabase and the selected extraction provider's key are validated at server startup
(`src/instrumentation.ts`), as is the AgentMail key pair — a
missing required variable fails fast with a clear error instead of an obscure runtime
failure. Never commit `.env.local`.

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
| `extraction_method` | `local_text` (PDF text extracted locally, cheap text-only LLM call), `vision` (sent as a document/image block, today's original cost), `vision_fallback` (local extraction tried but escalated to vision), or `null` (image/HTML-body input, not routed by this feature) |
| `extraction_input_tokens` / `extraction_output_tokens` | Token counts, `null` when the provider didn't report them |
| `extraction_ms` | End-to-end latency of the provider call |
| `duplicate_hit_count` | How many times the identical file arrived again and reused this row instead of paying for a new extraction |

Spend and dedupe savings for a month:

```sql
select
  extraction_provider,
  extraction_method,
  count(*)                          as extractions,
  sum(extraction_input_tokens)      as input_tokens,
  sum(extraction_output_tokens)     as output_tokens,
  sum(duplicate_hit_count)          as calls_avoided,
  round(avg(extraction_ms))         as avg_ms
from invoices
where created_at >= date_trunc('month', now())
group by extraction_provider, extraction_method;
```

Documents the model rejects (`is_invoice = false`) cost a call but produce no row, so they
appear in logs only — see
[`docs/superpowers/specs/2026-07-29-extraction-cost-visibility-design.md`](docs/superpowers/specs/2026-07-29-extraction-cost-visibility-design.md).

## Deploy

Target is **Vercel**. Full operator runbook: [`docs/deploy.md`](docs/deploy.md).

Quick checklist:
1. Mirror [`.env.local.example`](.env.local.example) into Vercel env (Preview + Production).
2. Apply migrations: `npx supabase db push`.
3. If email forwarding is enabled: deploy background tasks with `npx trigger.dev@latest deploy`.
4. Set Supabase Auth Site URL + Redirect URLs to the production domain.
5. Run the post-deploy smoke checklist in [`docs/deploy.md`](docs/deploy.md).

CI gates every PR with `lint → test → tsc --noEmit → build` — see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Docs

- [`docs/SELL-PRIVATE-INSTALL-VI.md`](docs/SELL-PRIVATE-INSTALL-VI.md) — gói cài riêng, mẫu báo giá, demo và checklist bàn giao cho doanh nghiệp nhỏ
- [`docs/PRIVATE-INSTALL-ACCEPTANCE-VI.md`](docs/PRIVATE-INSTALL-ACCEPTANCE-VI.md) — mẫu biên bản nghiệm thu cho từng khách
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — plan → code → test → security review → deploy
- [`docs/system-hardening.md`](docs/system-hardening.md) — auth recovery, upload dedup, account soft-delete
- [`docs/third-party-services.md`](docs/third-party-services.md) — AgentMail, Trigger.dev, Upstash, Supabase setup notes
- [`.claude/rules/`](.claude/rules/) — standing code conventions
