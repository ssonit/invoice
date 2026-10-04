# Setup

## Minimum — run the app in ~10 minutes
You need: Node 20.9 or newer (22+ recommended; CI uses 24), a free Supabase project, one LLM key.

1. `npm install`
2. `cp .env.local.example .env.local`, then set:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (Supabase dashboard → **Connect** for the URL, **Project Settings → API Keys** for the publishable and secret keys)
   - `EXTRACTION_PROVIDER` (`anthropic` | `google` | `deepseek`) and the matching key: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `DEEPSEEK_API_KEY`. `deepseek` reads HTML/text only and cannot extract uploaded PDFs or images — use `anthropic` or `google` for the upload flow. (`GOOGLE_API_KEY` is accepted as a legacy alias for `GEMINI_API_KEY`.)
   - Leave the email-forwarding block at the bottom empty.
3. Apply the database schema (tables, RLS policies, and the private `invoice-files` storage bucket all come from `supabase/migrations/`):
   `npx supabase login`, then `npx supabase link --project-ref <ref>` (the ref is in your project URL; you'll be asked for the database password), then `npx supabase db push`.
4. Supabase → **Authentication → URL Configuration**: Site URL `http://localhost:3000`, and add `http://localhost:3000/**` to Redirect URLs (used by password-reset links).
   New Supabase projects require email confirmation on sign-up. Either click the link in the confirmation email and then log in, or for a quick local test turn off **Authentication → Sign In / Providers → Email → Confirm email**.
5. `npm run dev` → open http://localhost:3000, sign up, upload a PDF or image.

Everything works at this point except forwarding by email.

## Recommended before going public — rate limiting
Upstash limits two things only: uploads (10/min/user) and login / sign-up / password-reset attempts. Without it, any signed-in user can trigger unlimited LLM calls on your key through uploads, and auth attempts are not throttled.
Create a free Upstash Redis database (https://console.upstash.com) and set `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. When unset, every limiter silently no-ops.
Upstash does **not** cover email forwarding — that path has no rate limit at all (see the warning below).

## Optional — email forwarding
Adds a per-user forwarding address; forwarded emails are parsed automatically.
Set **all three** or none (the app refuses to start with a partial setup):
- `AGENTMAIL_API_KEY`, `AGENTMAIL_WEBHOOK_SECRET` — agentmail.to; webhook URL `https://<your-domain>/api/webhooks/agentmail`, event `message.received`.
  Cost note: one inbox per user. At time of writing: Free = 3 inboxes, $20/mo = 10, $200/mo = 150.
- `TRIGGER_SECRET_KEY` — cloud.trigger.dev. Edit `project` in `trigger.config.ts` to your own project ref, then `npx trigger.dev@latest deploy` (locally, run `npx trigger.dev@latest dev` next to `npm run dev`).

When none are set, the Automation page and the forwarding address are hidden and the webhook route returns 404.

> **Warning — email intake is not rate-limited or capped.** Upstash only limits uploads and auth. With email enabled:
> - every signed-up user can create an AgentMail inbox, and each one counts against your AgentMail plan's inbox quota (once it runs out, inbox creation fails for everyone else);
> - anyone who knows a forwarding address can send unlimited mail, and every message with attachments triggers LLM extractions on your API key.
>
> Enable email forwarding only for trusted users (e.g. a closed or invite-only sign-up), and monitor your LLM provider spend and AgentMail inbox count.

The landing page, auth pages and legal pages mention email forwarding regardless of this setting. If you leave it off, edit that copy in `src/lib/landing/dictionary.ts`, `src/components/auth/auth-aside.tsx` (the side panel on the login and sign-up pages), `src/app/signup/page.tsx`, `src/app/page.tsx` (metadata description) and `src/lib/legal/dictionary.ts`.

## Production
See `docs/deploy.md` (Vercel). Supabase free tier pauses after 7 days idle — see `docs/third-party-services.md` (`/api/health` keep-alive).
