# AgentMail Webhook → Trigger.dev Task Queue

**Date:** 2026-07-23
**Status:** Approved for implementation

## Goal

Move invoice extraction out of the AgentMail webhook request path and into a background
task queue (Trigger.dev), so the webhook responds instantly (`200`) instead of waiting for
LLM extraction + Supabase writes to finish. Use Trigger.dev's built-in `idempotencyKey` to
replace the hand-rolled `processed_messages` dedupe table, get automatic retries on
transient failures, and add an auto-reply back to the sender summarizing what happened.

## Decisions

| Item | Choice |
|---|---|
| Task platform | Trigger.dev Cloud, free tier ($0/mo, $5 compute credit, 20 concurrent runs) — no account/project exists yet, created as part of implementation setup. |
| Webhook route | Verifies signature + checks `event_type` only. No DB reads, no extraction. Triggers the task and returns `200` immediately. |
| Dedupe | `processed_messages` table dropped entirely. Replaced by `tasks.trigger(..., { idempotencyKey: message.messageId })` — Trigger.dev returns the original run instead of starting a new one if the same key is triggered again within the 30-day default TTL. |
| Extraction provider | Unchanged — the task calls the existing `extractInvoice()` (`src/lib/extraction/index.ts`), which already dispatches across `anthropic`/`google`/`deepseek` via `EXTRACTION_PROVIDER`. Nothing in this feature is Claude-specific; do not hardcode a provider anywhere in the new task code. |
| In-task idempotency | Trigger.dev retries re-run the entire task function from the start (no mid-function resume). Invoice writes must be `upsert`, not `insert`, keyed on `(user_id, source_message_id, source_ref)`, so a retry after a partial failure doesn't create duplicate invoice rows. |
| Concurrency | `processInboundEmail` task has `queue: { concurrencyLimit: 5 }` — caps how many extractions (LLM calls + Supabase writes) run at once regardless of how many webhook events arrive in a burst. Excess runs queue, nothing is dropped. |
| Auto-reply | Sent via `agentmail.inboxes.messages.reply()` from a separate child task, for all three outcomes (processed / skipped / error), each with a distinct template. |
| Retry-exhausted handling | `onFailure` lifecycle hook on the main task (runs exactly once, only after all retry attempts are exhausted) triggers the "error" reply. Does not persist a failure row to `invoices` — there's no extracted data to store. |

## Architecture

```
AgentMail webhook
   │  POST /api/webhooks/agentmail
   ▼
route.ts — verify svix signature, check event_type === "message.received"
   │  tasks.trigger("process-inbound-email", payload, { idempotencyKey: message.messageId })
   ▼ returns 200 immediately
processInboundEmail task            src/trigger/process-inbound-email.ts
   │  queue: { concurrencyLimit: 5 }, retry: { maxAttempts: 3 }
   │  look up inbox → user_id (moved here from the route)
   │    unknown inbox → log, return early (no throw, no reply)
   │  for each attachment (or fallback HTML body, via existing document-gate.ts):
   │    extractInvoice() — unchanged multi-provider dispatch
   │    processExtraction() — upsert into invoices, ensureVendorRecord, storage upload
   │  trigger("send-inbound-email-reply", outcome, { idempotencyKey: `reply:${messageId}` })
   │
   │  onFailure (only after all 3 attempts fail):
   │    trigger("send-inbound-email-reply", { type: "error", ... })
   ▼
sendInboundEmailReply task          src/trigger/send-inbound-email-reply.ts
   │  buildReplyText(outcome)        src/lib/email-reply-templates.ts (pure, testable)
   ▼  agentmail.inboxes.messages.reply(inboxId, messageId, { text })
```

## New files

- `trigger.config.ts` (root) — `project: "<project ref>"`, `dirs: ["./src/trigger"]`, `runtime: "node-22"`, `retries.default.maxAttempts: 3`.
- `src/trigger/process-inbound-email.ts` — main task. Payload: `{ inboxId, messageId, subject, text, html, attachments }` (shaped fields the route extracts from the AgentMail message, not the raw SDK type).
- `src/trigger/send-inbound-email-reply.ts` — child task, sends the reply.
- `src/lib/invoices/process-extraction.ts` — moved out of `route.ts`'s local `processExtraction`, now upsert-based, unit-testable with a mock Supabase client (same pattern as `src/lib/vendors.ts`).
- `src/lib/email-reply-templates.ts` — `buildReplyText(outcome: EmailReplyOutcome): string`, pure function, no I/O.

## Modified files

- `src/app/api/webhooks/agentmail/route.ts` — stripped down to signature verification, `event_type` check, and `tasks.trigger()`. All DB lookups, extraction, and save logic removed (moved into the task).
- `package.json` — add `@trigger.dev/sdk`.

## Data model changes

New migration:
```sql
alter table public.invoices add column source_ref text;

create unique index invoices_source_message_ref_uidx
  on public.invoices (user_id, source_message_id, source_ref)
  where source_message_id is not null;
```

`source_ref` = the attachment's `attachmentId` when the invoice came from an attachment, or
the literal string `'body'` when it came from the HTML-body fallback path. Manually-uploaded
invoices (`source: "upload"`) leave both `source_message_id` and `source_ref` `null` and are
unaffected by the unique index (partial index only applies where `source_message_id is not null`).

Another migration drops the now-unused dedupe table:
```sql
drop table if exists public.processed_messages;
```

`ensureVendorRecord` (`src/lib/vendors.ts`) and the storage upload (`storage.upload(path, buffer, { upsert: true })`) are already idempotent and need no changes.

## Auto-reply

```ts
export type EmailReplyOutcome =
  | { type: "processed"; invoices: { vendor: string | null; amount: number | null; currency: string | null }[] }
  | { type: "skipped" }
  | { type: "error" };

export function buildReplyText(outcome: EmailReplyOutcome): string;
```

- `processed`, 1 invoice → e.g. `"We received and processed your invoice from {vendor} — {amount} {currency}."`
- `processed`, multiple invoices (multiple attachments) → summarized count, e.g. `"We processed {n} invoices from this email."`
- `skipped` → `"This didn't look like an invoice, so we skipped it. If that's wrong, please check the attachment and resend."`
- `error` → `"Something went wrong processing this email. Please try resending it, or reach out if this keeps happening."`

Outcome selection when an email has a mix of results (e.g. 2 attachments, 1 saved as an
invoice and 1 skipped as not-an-invoice): the task collects every successfully-saved invoice
into a list as it loops. After the loop, outcome is `processed` if that list is non-empty
(even if some attachments were individually skipped), otherwise `skipped`. `error` is never
decided inside `run()` — it only ever comes from the `onFailure` hook after retries are
exhausted.

`sendInboundEmailReply` triggered with `idempotencyKey: \`reply:${messageId}\`` — protects against a duplicate reply if `processInboundEmail` is retried after already having triggered the reply once.

## Error handling

- Unknown inbox (`message.inboxId` doesn't map to any user) → logged, task returns early. No throw (not retryable), no reply (not the sender's fault, not their problem to fix).
- Content judged not-an-invoice (existing `shouldExtractAttachment`/`shouldExtractEmailBody` gates, or `extractInvoice()` returning `is_invoice: false`) → not an error, no throw. Triggers the `skipped` reply.
- Genuine extraction failure (LLM API error, network error, Supabase write error) → thrown normally, causing Trigger.dev's automatic retry (`maxAttempts: 3`, exponential backoff). Only once all attempts are exhausted does `onFailure` fire and trigger the `error` reply — avoids sending a false "something went wrong" reply on an attempt that a later retry would have fixed.

## Testing

- `src/lib/email-reply-templates.test.ts` — all three outcome shapes, including multi-invoice `processed`.
- `src/lib/invoices/process-extraction.test.ts` — upsert behavior against a mock Supabase client (conflict target, idempotent re-save with identical `source_ref`).
- `src/lib/extraction/document-gate.test.ts` — unchanged, already covered.
- `src/trigger/*.ts` (task orchestration itself) is not unit-testable without the Trigger.dev runtime. Verified instead via manual smoke test: `npx trigger.dev@latest dev` running locally alongside `npm run dev`, a real webhook delivery, checking the run in the Trigger.dev dashboard, the resulting `invoices` row in Supabase, and the reply email received in the test inbox.

## Out of scope

- Retrying or replaying failed runs automatically beyond the configured 3 attempts (Trigger.dev dashboard allows manual replay if needed later).
- Persisting a "failed" row to `invoices` for genuinely-failed extractions — there's no extracted data to store; the sender is informed via the error reply instead.
- Changing the manual upload route (`src/app/api/invoices/upload/route.ts`) — this plan only touches the AgentMail webhook path.
- Vercel env-var sync (`syncVercelEnvVars` build extension) — relevant only once deploying to Vercel; local dev only needs `TRIGGER_SECRET_KEY` in `.env.local`.
