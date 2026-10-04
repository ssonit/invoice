# Third-party services

Notes on external services this project depends on — free tiers, cost model, and gotchas
worth knowing before scaling up. Add to this file as new services are integrated.

## AgentMail (inbound + outbound email)

Pricing verified directly against `agentmail.to/pricing` on 2026-08-23.

| Plan | Price | **Inboxes** | Emails |
|------|-------|-------------|--------|
| Free | $0 | **3** | 3,000/mo (100/day) |
| Developer | $20/mo | **10** | 10,000/mo (1,000/day) |
| Startup | $200/mo | **150** | ~15,000/day |
| Enterprise | custom | unlimited | custom |

- **The binding constraint is inbox count, not email volume.** This product provisions one
  inbox per customer (`createUserInbox`), so customers map 1:1 onto the inbox quota:
  customer #4 forces the $20 plan, and **customer #11 forces a 10x jump to $200/mo**.
  There is no tier between $20 and $200.
- Sends and receives share the same quota — an auto-reply costs the same as an inbound
  message.
- **Pods do not reduce cost.** Pods (`client.pods.*`) give per-tenant data isolation,
  scoped API keys, and webhook filtering by `pod_ids` — but inboxes inside a pod still
  count against the org's inbox quota, and AgentMail publishes no separate pod pricing.
  Reach for pods for isolation, not for billing.
- **Per-customer organizations via `agent.signUp` are NOT an approved cost workaround.**
  `POST /v0/agent/sign-up` is a public, unauthenticated endpoint (verified in the SDK: it
  is the only method that never calls `authProvider.getAuthRequest()`), so the server can
  provision an org per end user and pay $0. But AgentMail ships Pods as its official
  multi-tenant answer, so mass-provisioning free orgs is plausibly ToS-violating and
  trivially detectable (`source`/`referrer` fields, idempotency keyed on `human_email`).
  **Confirm with AgentMail before building on it** — if they revoke it, every customer
  loses their inbox at once.
- `client.inboxes.messages.reply(inboxId, messageId, { text })` sends a reply threaded to
  the original message — used by the webhook task-queue auto-reply feature (see
  [`2026-07-23-agentmail-webhook-task-queue-design.md`](superpowers/specs/2026-07-23-agentmail-webhook-task-queue-design.md)).

## Trigger.dev (background task queue)

- Free tier: $0/month, ~$5 monthly compute credit, 20 concurrent runs, unlimited tasks,
  1-day log retention. Paid tiers (Hobby $10/mo, Pro $50/mo) add more concurrency and
  longer log retention.
- SDK + tasks are wired in-repo (`trigger.config.ts`, `src/trigger/*`); you still need a
  Trigger.dev Cloud project ref and `TRIGGER_SECRET_KEY` in `.env.local` (account/project
  creation is manual — CLI login needs a browser).
- Local dev requires running `npx trigger.dev@latest dev` alongside `npm run dev`.
- Architecture details: [`docs/webhook-task-queue.md`](webhook-task-queue.md).

**Note:** the Trigger.dev figures above come from third-party aggregator sites (via web
search), not the vendor's own pricing page — re-check `trigger.dev/pricing` before
committing to a paid tier. The AgentMail table was verified against `agentmail.to/pricing`
directly on 2026-08-23.

## Upstash Redis (upload + auth rate limiting)

- Free tier: 500K commands/month, no credit card required — plenty for sliding-window
  limits on uploads (`/api/invoices/upload`, 10 requests/min/user) and login / sign-up /
  password-reset attempts (see `src/lib/rate-limit.ts`). Email intake is **not** limited.
- Create a Redis database at https://console.upstash.com, then copy the REST URL/token
  into `.env.local` (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
- **Optional, not validated at boot**: if unset, rate limiting silently no-ops (uploads and
  auth attempts are unlimited) rather than blocking `npm run dev` or the build.
  Set it before a real production launch — without it, an authenticated user can burn
  unlimited LLM extraction calls.

## Supabase (free tier auto-pause)

- Free-tier Supabase projects auto-pause after **7 days with no API activity** (REST/
  Auth/Storage/Realtime requests reaching the project) — a dormant staging/side project
  hits this easily. Pausing is recoverable from the dashboard, but breaks prod until
  someone notices and manually restores it.
- **Keep-alive endpoint**: [`/api/health`](../src/app/api/health/route.ts) queries the
  `profiles` table (`select id limit 1`) via the service-role client. It must make a real
  Supabase query, not just return `200` — pinging a route that never touches Supabase does
  nothing to prevent the pause, which is the mistake this endpoint is written to avoid.
- **External ping**: set up a free [UptimeRobot](https://uptimerobot.com) HTTP(s) monitor
  hitting `https://<your-domain>/api/health` (5 min interval on the free plan — far more
  often than the 7-day pause window needs, but it doubles as uptime/downtime alerting for
  the app itself). Vercel Cron is a same-platform alternative if alerting isn't needed, but
  the Hobby plan caps cron at 1 run/day.
- Verify it's working: check Supabase Dashboard → Logs → API Logs for incoming requests
  after the monitor has run a few times.
