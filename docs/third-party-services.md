# Third-party services

Notes on external services this project depends on — free tiers, cost model, and gotchas
worth knowing before scaling up. Add to this file as new services are integrated.

## AgentMail (inbound + outbound email)

- Free plan: $0/month, 100 emails/day. Sends and receives share the same daily quota — an
  auto-reply counts against it the same as an inbound message.
- Paid: Developer $20/month for 10,000 emails/month (provisioned addresses, webhooks,
  threading). Next tier jumps to $200/month — no mid-size plan between the two.
- For local dev / low-volume MVP traffic, the free tier is enough.
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

**Note:** the pricing figures above come from third-party aggregator sites (via web search),
not the vendors' own pricing pages — re-check `trigger.dev/pricing` and `agentmail.to/pricing`
directly before committing to a paid tier.

## Lemon Squeezy (billing)

- Merchant of Record — Lemon Squeezy is the seller of record and handles global
  VAT/sales-tax compliance. Fee: ~5% + 50¢ per transaction.
- One paid variant (Team, $29/mo). Store/variant IDs and API key come from the
  Lemon Squeezy dashboard; set in `.env.local` (`LEMONSQUEEZY_API_KEY`,
  `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_TEAM_VARIANT_ID`,
  `LEMONSQUEEZY_WEBHOOK_SECRET`).
- **Test mode**: Lemon Squeezy stores support a test mode that runs the full
  checkout/webhook flow without a real charge — use it for local dev and the
  manual verification below instead of a real card.
- Webhook endpoint: configure `https://<your-domain>/api/webhooks/lemonsqueezy`
  in the store's Settings → Webhooks, subscribed to `subscription_*` events.
  For local dev, use a tunnel (e.g. `ngrok http 3000`) and point the webhook
  at the tunnel URL.
- Architecture details: [`docs/billing-lemonsqueezy.md`](billing-lemonsqueezy.md).

## Upstash Redis (upload rate limiting)

- Free tier: 500K commands/month, no credit card required — plenty for a per-user
  sliding-window limit on a single route (`/api/invoices/upload`, 10 requests/min/user,
  see `src/lib/rate-limit.ts`).
- Create a Redis database at https://console.upstash.com, then copy the REST URL/token
  into `.env.local` (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
- **Optional, not validated at boot**: if unset, rate limiting silently no-ops (uploads are
  unlimited, same as before this existed) rather than blocking `npm run dev` or the build.
  Set it before a real production launch — without it, an authenticated user can burn
  unlimited LLM extraction calls.
