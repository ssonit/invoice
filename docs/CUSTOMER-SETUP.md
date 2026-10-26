# Customer setup guide

End-to-end path from a fresh copy of the code to a live production site. Follow the
steps in order; each one says how to confirm it worked. Reference docs for each part:
[`SETUP.md`](SETUP.md) (local run), [`deploy.md`](deploy.md) (deploy runbook),
[`third-party-services.md`](third-party-services.md) (costs and limits).

## What you need

| Item | Needed for | Cost |
|------|-----------|------|
| Node.js 20.9+ (22+ recommended) and git | everything | free |
| [Supabase](https://supabase.com) project | database, auth, file storage | free tier OK |
| One LLM key: Anthropic, Google Gemini or DeepSeek | reading invoices | pay per use |
| [Vercel](https://vercel.com) account | hosting | free tier OK |
| [Upstash](https://console.upstash.com) Redis | rate limiting (strongly recommended) | free tier OK |
| [AgentMail](https://agentmail.to) + [Trigger.dev](https://cloud.trigger.dev) | email forwarding (optional) | see below |

Email forwarding is optional. Without it, users upload PDFs and images in the dashboard
and everything else works.

## Part 1 — Core app (no email forwarding)

### 1. Install and configure

```bash
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
  — Supabase dashboard → **Connect** (URL) and **Project Settings → API Keys**.
- `EXTRACTION_PROVIDER` — `anthropic`, `google` or `deepseek`, plus the matching
  `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `DEEPSEEK_API_KEY`. Use `anthropic` or `google`
  if users will upload PDFs or images; `deepseek` reads HTML/text only.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — recommended; without them uploads
  and login attempts are unlimited.
- Leave `AGENTMAIL_*` and `TRIGGER_SECRET_KEY` empty for now.

The secret key and LLM keys must never be committed or exposed to the browser. Only the
`NEXT_PUBLIC_*` values are public.

### 2. Create the database

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The project ref is the subdomain in your Supabase URL. `db push` creates all tables,
security policies and the private `invoice-files` storage bucket.

**Check:** Supabase dashboard → Table Editor lists `invoices`, `profiles`, `vendors`, etc.

### 3. Supabase Auth URLs

Supabase → **Authentication → URL Configuration**:

- Site URL: `http://localhost:3000` for now (switch to your domain in Part 3).
- Redirect URLs: `http://localhost:3000/**`.

New projects require email confirmation on sign-up. Click the link in the confirmation
email, or turn off **Authentication → Sign In / Providers → Email → Confirm email** for a
quick local test only.

### 4. Run and smoke test locally

```bash
npm run dev
```

Open http://localhost:3000, sign up, log in, upload a PDF or image.

**Check:** the invoice appears in the list with vendor, amount and date, and the CSV
export from the Exports page downloads.

## Part 2 — Email forwarding (optional)

Each user gets a private forwarding address. Mail sent to it is received by AgentMail,
which calls your webhook; the webhook queues a Trigger.dev background task that
downloads attachments, extracts invoices and replies to the sender.

> **Status:** the webhook signature check, queueing and task code are implemented, but
> the full chain (real email → AgentMail → webhook → Trigger.dev → invoice row → reply)
> has not been re-verified end to end since the last refactor. Run the verification
> below before enabling this for customers.

> **Cost and abuse warning.** Email intake has no rate limit. Anyone who knows a
> forwarding address can trigger LLM calls on your key, and every user consumes one
> AgentMail inbox (Free = 3, $20/mo = 10, $200/mo = 150; there is no tier between 10 and
> 150). Enable only for trusted users and watch LLM spend and inbox count.

### 1. Trigger.dev

1. Create a project at https://cloud.trigger.dev.
2. In `trigger.config.ts`, replace the `project` value with your own project ref
   (Project settings). The value in the repo belongs to the original author and will not
   work for you.
3. Copy the project's secret key (API Keys, use the **Prod** key for production, **Dev**
   for local) into `TRIGGER_SECRET_KEY`.

### 2. AgentMail

1. Create an account and an API key; set `AGENTMAIL_API_KEY`.
2. Add a webhook for the event `message.received` pointing to
   `https://<your-domain>/api/webhooks/agentmail`. Copy its signing secret into
   `AGENTMAIL_WEBHOOK_SECRET`.

Set all three variables (`AGENTMAIL_API_KEY`, `AGENTMAIL_WEBHOOK_SECRET`,
`TRIGGER_SECRET_KEY`) or none. A partial set stops the app at startup.

### 3. Verify (do this on a deployed URL, or locally through a tunnel)

AgentMail must reach your webhook over the public internet, so local testing needs a
tunnel (for example `cloudflared` or `ngrok`) whose URL you register as the webhook.

Local:

```bash
npm run dev
npx trigger.dev@latest dev
```

Production:

```bash
npx trigger.dev@latest deploy
```

Then:

1. Log in, open **Automation**, create the forwarding address.
2. From any mailbox, send an email with an invoice PDF attached to that address.
3. **Check:** within about a minute (a) the Trigger.dev dashboard shows a successful
   `process-inbound-email` run and a child `process-attachment` run, (b) the invoice
   appears in the dashboard, (c) the sender receives an automatic reply.
4. Forward the same email again. **Check:** no duplicate invoice (duplicates are keyed on
   the message id).

If the invoice does not appear, open the failed run in Trigger.dev first; its logs name
the cause (unknown inbox, extraction error, missing attachment).

## Part 3 — Go live on Vercel

1. Vercel → **Add New → Project**, import your repository, framework **Next.js**. Do not
   deploy yet.
2. Add every variable from your `.env.local` under **Environment Variables**, for
   Production (and Preview if you use it). Use production keys, not dev ones.
3. Supabase → **Authentication → URL Configuration**: set Site URL to
   `https://<your-domain>` and Redirect URLs to `https://<your-domain>/**`. Add
   `https://*.vercel.app/**` if you use preview deployments.
4. Deploy.
5. If using email forwarding: update the AgentMail webhook URL to the production domain
   and run `npx trigger.dev@latest deploy`.
6. Keep the free Supabase project awake: add an HTTP monitor (for example UptimeRobot)
   on `https://<your-domain>/api/health` every 5 minutes. Free projects pause after
   7 days idle.

### Post-deploy checklist

- [ ] Sign up and log in with a new account
- [ ] Dashboard loads
- [ ] Upload a PDF or image and see the extracted invoice
- [ ] Settings page loads
- [ ] CSV export downloads
- [ ] Session survives closing and reopening the browser
- [ ] (Email forwarding) forwarded invoice appears and the sender gets a reply
- [ ] `/api/health` returns 200

## Before you sell or hand over

- Replace branded copy and legal text: `src/lib/legal/dictionary.ts` (privacy and terms),
  `src/lib/landing/dictionary.ts` (landing page). If email forwarding is off, also edit the
  mentions listed at the bottom of [`SETUP.md`](SETUP.md).
- Rotate any keys that were ever shared or committed, and never ship your own `.env` or
  `.env.local` to a customer.
- Confirm the license terms in the repository match what you are selling.

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| App fails at startup naming env keys | Missing or partial env set, especially the email trio |
| Sign-up works but no confirmation email | Supabase email limits; configure custom SMTP or disable confirmation for testing |
| Password-reset link goes to localhost | Site URL / Redirect URLs not updated for production |
| Upload fails with an extraction error | Wrong `EXTRACTION_PROVIDER`/key pairing, or `deepseek` with a PDF/image |
| Webhook returns 404 | Email env vars not all set on the deployed environment |
| Webhook returns 400 | `AGENTMAIL_WEBHOOK_SECRET` does not match the AgentMail webhook |
| Webhook returns `queued` but nothing happens | Tasks not deployed, or `TRIGGER_SECRET_KEY` / `project` ref wrong |
| Supabase calls start failing after idle days | Free project paused; restore it and set up the health monitor |
