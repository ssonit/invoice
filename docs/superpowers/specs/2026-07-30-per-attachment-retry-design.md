# Per-Attachment Retry for Inbound Email

**Date:** 2026-07-30
**Status:** Approved for implementation
**Source:** `Invoice_Reader_Product_Ideas.md` §2 (Queue instead of batching — "Retry individual files")

## Goal

`processInboundEmail` (`src/trigger/process-inbound-email.ts`) currently loops over every
attachment in a single Trigger.dev task run and calls `processExtraction` on each one in
sequence. If any single attachment throws — a transient AgentMail download failure, a
provider rate limit, the unexpected-upsert-failure throw added by the extraction-cost-
visibility work — the whole task throws, and Trigger.dev retries the **entire email**, not
just the attachment that failed.

Two concrete problems follow from that:

1. **Wasted work.** Attachments that already succeeded get re-run on retry. Content-hash
   dedupe (already shipped) makes the re-run cheap rather than free, but it's still an
   unnecessary round trip per already-saved attachment, and the extra latency compounds
   across all 3 retry attempts.
2. **A misleading reply.** If retries exhaust before that one bad attachment ever succeeds,
   `onFailure` fires and the sender gets `{ type: "error" }` — *"We ran into a problem
   processing this email"* — even when 4 of the email's 5 invoices are sitting in their
   dashboard, successfully saved. The reply doesn't reflect what actually happened.

This gives each attachment its own retry, isolated from its siblings, so one bad file can't
take three good ones down with it, and the reply the sender gets is honest about what was
actually saved.

## Scope decision

Only the attachment-processing path changes. Explicitly out of scope:

| Area | Decision |
| --- | --- |
| Email-body-only path (no attachments) | **Unchanged, stays inline in the parent task.** There is only ever one item to process in this branch, so there is no partial-failure problem to solve — fan-out here would add a Trigger.dev queue round trip for zero reliability benefit. |
| `EmailReplyOutcome` shape | **Unchanged** — still exactly `processed` / `skipped` / `error`, no fourth "partial" variant. See design decision below. |
| Content-aware provider routing, landing copy, known-template parsing | Separate specs / deferred, unrelated to this change. |

## Design decisions

**Fan-out via `tasks.batchTriggerAndWait`, only for the attachments branch.** Verified
against the installed `@trigger.dev/sdk` (4.5.7): `batchTriggerAndWait(id, items, options)`
returns `Promise<BatchResult>` where `BatchResult = { id: string; runs: TaskRunResult[] }`
and each `TaskRunResult` is `{ ok: true; output } | { ok: false; error }`
(`node_modules/@trigger.dev/core/dist/esm/v3/types/tasks.d.ts`). This is exactly the
primitive needed: each attachment becomes an independent task run with its own retry
policy, the parent waits for all of them, and gets back a clean per-item ok/error result to
aggregate.

Two alternatives were considered and rejected:

- **Try/catch inside the existing loop, no new task.** Lowest risk (no queue
  restructuring), but attachments still process sequentially in one task run, and a
  transient failure on one attachment only gets retried by retrying the *whole email*
  (Trigger.dev retries the task, not a loop iteration) — it doesn't actually deliver
  per-file retry, just per-file failure *isolation* within a single attempt. Doesn't match
  the stated goal.
- **Fan-out everything, including the body-only path, through one unified per-item task.**
  Architecturally tidier (one code path for "process one item" regardless of source), but
  forces the common case — a single invoice pasted in the email body, no attachment — through
  an extra Trigger.dev queue hop that buys nothing, since a single item has no partial-failure
  case to isolate.

**The reply model does not change.** A mixed outcome (some attachments saved, one
permanently failed) is reported as `processed` with whatever invoices were actually saved —
the same as today when everything succeeds. The failed attachment is logged, not mentioned
to the sender. Rationale: many of what would show up as "failures" are attachments the model
correctly rejected as not being invoices (logos, signatures that slipped past the filename
filter, etc.) — introducing a fourth outcome and new copy risks alarming a sender over what
is often a non-event, for a codepath (permanent per-attachment failure after 3 retries) that
should be rare given the existing pre-filter. `error` is still reported when nothing was
saved and something in the batch genuinely failed (as opposed to everything being filtered
out as non-invoice, which stays `skipped`).

**The concurrency limit's meaning shifts from "concurrent emails" to "concurrent
attachment extractions".** `EXTRACTION_CONCURRENCY_LIMIT` moves from
`processInboundEmail`'s queue onto the new `processAttachment` task's queue. This is more
accurate: the thing that actually needs capping is concurrent LLM calls and Supabase writes,
which happens per attachment now, not per email.

## Architecture

```text
processInboundEmail (parent — thin orchestrator)
      │
      ├── no attachments
      │       └── unchanged: inline processExtraction on the HTML/text body
      │
      └── has attachments
              ├── pre-filter with shouldExtractAttachment (as today — an attachment
              │     that fails the gate never spawns a task run, same cost profile as now)
              ├── tasks.batchTriggerAndWait("process-attachment", items)
              │       → one independent task run per attachment
              │       → each has its own retry: { maxAttempts: 3 }
              │       → concurrency capped by process-attachment's own queue
              └── aggregate BatchResult.runs[].ok → SavedInvoiceSummary[]
      │
      └── exactly one reply sent, same as today (processed / skipped / error)
```

## Components

| File | Created / Modified | Responsibility |
| --- | --- | --- |
| `src/trigger/process-attachment.ts` | Create | New Trigger.dev task. Downloads one attachment from AgentMail, calls `processExtraction`, returns `{ saved: true; invoice: SavedInvoiceSummary } \| { saved: false }` — the same shape `processExtraction` already returns, so nothing needs re-mapping. Owns `retry: { maxAttempts: 3 }` and `queue: { concurrencyLimit: EXTRACTION_CONCURRENCY_LIMIT }`. No `onFailure` — a single attachment's exhausted retries aren't independently reported; the parent's aggregation is where the outcome is decided. |
| `src/trigger/process-inbound-email.ts` | Modify | Body-only branch untouched. Attachments branch: keep the `shouldExtractAttachment` pre-filter loop (unchanged), but instead of calling `processExtraction` directly, collect the surviving attachments into batch items and call `batchTriggerAndWait`. Replace the manual `saved: SavedInvoiceSummary[]` accumulation with one built from the batch result. `EXTRACTION_CONCURRENCY_LIMIT` constant moves to (or is re-exported from) `process-attachment.ts`, since that's the queue it now governs. |
| `src/lib/invoices/aggregate-attachment-results.ts` | Create | `aggregateAttachmentResults(runs: TaskRunResult<...>[]): SavedInvoiceSummary[]` — pure function, filters to `ok: true` runs and extracts each one's saved invoice. Lives in `src/lib/` (not inline in the task) specifically so it's unit-testable without mocking Trigger.dev, per `.claude/rules/code-style.md`'s thin-orchestration/logic-in-lib split. `TaskRunResult`/`BatchResult` are re-exported from `@trigger.dev/sdk` via `tasks.js` → `v3/index.js` (traced through `node_modules/@trigger.dev/sdk/dist/esm/v3/{tasks,index}.d.ts`); confirm the exact import path resolves against the installed version before finalizing — if it doesn't, define an equivalent local type shaped `{ ok: true; output: ProcessExtractionResult } | { ok: false; error: unknown }` instead of blocking on the SDK's re-export. |
| `src/lib/invoices/aggregate-attachment-results.test.ts` | Create | See Testing section. |

## Error handling

Following `.claude/rules/errors.md`:

- **A single attachment fails all 3 of its own retries.** Its entry in `BatchResult.runs` is
  `{ ok: false, error }`. The parent logs it —
  `console.error("Attachment processing failed after retries", { inboxId, messageId, attachmentId }, error)`
  — and excludes it from the saved-invoices list. This is an anticipated outcome at the
  parent's level (some attachments fail; that's why they're isolated), so the parent does
  not re-throw for this case.
- **`batchTriggerAndWait` itself throws** (Trigger.dev API unreachable when dispatching the
  batch, not a per-attachment failure) — propagates unchanged, so the parent task's own
  `retry: { maxAttempts: 3 }` and `onFailure` (unchanged, still fires the `{ type: "error" }`
  reply) still apply. This is correct: at that point no attachment has run yet, so there is
  nothing to isolate — retrying the whole email is the only option and the existing
  behavior already handles it.
- **Every attachment is filtered out by `shouldExtractAttachment`** (no batch triggered at
  all, because the surviving-items list is empty): unchanged, same `{ type: "skipped" }`
  path as today.

## Testing

Per `.claude/rules/testing.md`, Trigger.dev tasks themselves are not unit-tested (they mix
I/O with orchestration, verified manually instead, matching the existing convention for
`src/trigger/*.ts`).

What *is* worth extracting and unit-testing: `aggregateAttachmentResults`, the pure step
that turns a `BatchResult`'s `runs` array (each `{ ok: true, output } | { ok: false, error }`)
into the final `SavedInvoiceSummary[]` the reply is built from. This function has real logic
(filter to `ok: true`, extract `.output.invoice` from each successful, ignore `.output` when
`saved: false`, skip failed runs entirely) and is exactly the kind of pure `src/lib/` logic
this project's test layer targets.

Test cases (`aggregate-attachment-results.test.ts`): all runs succeed and saved an invoice,
all runs fail, a mix of succeeded/failed/filtered-non-invoice, and an empty array (no
attachments survived the pre-filter — in practice the parent returns before ever calling
`batchTriggerAndWait` in that case, but the aggregation function should still handle an
empty input safely on its own).

Manual verification against the local stack (`npx trigger.dev@latest dev` alongside
`npm run dev`, per the existing project convention for this codepath):

1. Forward an email with 3 attachments, all valid invoices → 3 invoices saved, one reply,
   `processed` with all 3.
2. Forward an email with 3 attachments where one is a deliberately corrupted PDF (forces a
   real extraction/download failure) → the other 2 save correctly, one reply says
   `processed` with those 2, the corrupted one is visible only in the Trigger.dev run logs
   as a failed attachment run.
3. Confirm in the Trigger.dev dashboard that the corrupted attachment's task run retried 3
   times **independently** — the other 2 attachments' runs are not re-executed.
4. Re-forward the same 3-attachment email a second time (content-hash dedupe from the prior
   feature should apply) — confirm the 2 already-saved invoices come back as dedupe hits
   with no new model calls, and the reply still reports `processed`.
5. An email with zero valid attachments (all filtered by `shouldExtractAttachment`) still
   produces `{ type: "skipped" }`, no task runs spawned for the filtered attachments.

Gates: `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Out of scope

Content-aware extraction provider routing (separate, deferred spec), the email-body-only
path, changing the `EmailReplyOutcome` shape, and any UI surfacing of per-attachment failure
detail. If per-attachment failure visibility becomes a real user need later, that's a
follow-up spec, not part of this one.
