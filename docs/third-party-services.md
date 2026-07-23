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
