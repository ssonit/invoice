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
| `error` | From the task `onFailure` hook after all retries are exhausted, when nothing was saved for this message |

Reply text lives in `src/lib/email-reply-templates.ts`.

## Extraction providers

Extraction stays multi-provider via `extractInvoice()` / `EXTRACTION_PROVIDER` (Anthropic, Google, DeepSeek). The queue does not hard-code Claude.

## Partial-failure retries

Each `batchTriggerAndWait` item carries `idempotencyKey: "<messageId>:<attachmentId>"`,
so if `process-inbound-email` itself retries (a failure unrelated to any single
attachment — attachment failures alone don't throw, they're reported via
`batch.runs[i].ok`), the retry reuses the same child runs instead of spawning
duplicates.

If `process-inbound-email` still exhausts all its own retries, `onFailure` queries
`invoices` by `source_message_id` before replying: any attachment that did save is
reported as `processed` with its invoices, instead of a blanket `error` reply that would
understate what actually landed.

## Local smoke test

1. Set `TRIGGER_SECRET_KEY` in `.env.local` and edit `project` in `trigger.config.ts` to your real project ref.
2. `npm run dev` and `npx trigger.dev@latest dev` in parallel.
3. Deliver a `message.received` webhook; expect `{"status":"queued"}`, a successful `process-inbound-email` run, a child reply run, an `invoices` row with `source` / `source_message_id` / `source_ref`, and an auto-reply. Re-delivering the same `messageId` must not start a duplicate run.

## Related

- Design: [`docs/superpowers/specs/2026-07-23-agentmail-webhook-task-queue-design.md`](superpowers/specs/2026-07-23-agentmail-webhook-task-queue-design.md)
- Plan: [`docs/superpowers/plans/2026-07-23-agentmail-webhook-task-queue.md`](superpowers/plans/2026-07-23-agentmail-webhook-task-queue.md)
- Pricing / setup notes: [`docs/third-party-services.md`](third-party-services.md)
