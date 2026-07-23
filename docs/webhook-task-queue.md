# AgentMail webhook → Trigger.dev task queue

Inbound invoice email is no longer processed inside the AgentMail webhook request.
The route verifies the Svix signature, filters to `message.received`, then hands off
to Trigger.dev and returns `200 { "status": "queued" }` immediately.

## Request path vs background work

| Layer | Responsibility |
| --- | --- |
| `POST /api/webhooks/agentmail` | Signature verify → `tasks.trigger("process-inbound-email", …)` |
| `process-inbound-email` | Inbox → user lookup, document gate, download attachments, `extractInvoice()`, upsert invoices, trigger reply |
| `send-inbound-email-reply` | Build reply text and call AgentMail `messages.reply` |

## Deduplication

- **Webhook / task runs:** `idempotencyKey: messageId` on `tasks.trigger`. AgentMail retries reuse the original run; the old `processed_messages` table is gone.
- **Invoice rows:** upsert on `(user_id, source_message_id, source_ref)`. One email can yield several invoices (`source_ref` = attachment id, or `"body"` for HTML fallback). Retries overwrite the same row instead of inserting duplicates. Upload-sourced rows leave both columns NULL; Postgres treats NULLs as distinct, so uploads never collide on this constraint.

## Concurrency

`process-inbound-email` uses `queue: { concurrencyLimit: 5 }` so at most five extractions (LLM + Supabase writes) run at once. Extra events queue; nothing is dropped.

## Auto-reply outcomes

| Outcome | When |
| --- | --- |
| `processed` | At least one invoice was saved |
| `skipped` | Email handled but nothing looked like an invoice |
| `error` | Only from the task `onFailure` hook after all retries are exhausted |

Reply text lives in `src/lib/email-reply-templates.ts`.

## Extraction providers

Extraction stays multi-provider via `extractInvoice()` / `EXTRACTION_PROVIDER` (Anthropic, Google, DeepSeek). The queue does not hard-code Claude.

## Known edge case (accepted for v1)

If attachment A saves and attachment B then throws, the whole run retries. After retries are exhausted the sender gets an `error` reply even though A was upserted (and is visible in the dashboard). Upsert still prevents A from being duplicated across retries.

## Local smoke test

1. Set `TRIGGER_SECRET_KEY` in `.env.local` and put the real project ref in `trigger.config.ts` (and `TRIGGER_PROJECT_REF`).
2. `npm run dev` and `npx trigger.dev@latest dev` in parallel.
3. Deliver a `message.received` webhook; expect `{"status":"queued"}`, a successful `process-inbound-email` run, a child reply run, an `invoices` row with `source` / `source_message_id` / `source_ref`, and an auto-reply. Re-delivering the same `messageId` must not start a duplicate run.

## Related

- Design: [`docs/superpowers/specs/2026-07-23-agentmail-webhook-task-queue-design.md`](superpowers/specs/2026-07-23-agentmail-webhook-task-queue-design.md)
- Plan: [`docs/superpowers/plans/2026-07-23-agentmail-webhook-task-queue.md`](superpowers/plans/2026-07-23-agentmail-webhook-task-queue.md)
- Pricing / setup notes: [`docs/third-party-services.md`](third-party-services.md)
