# Per-Attachment Retry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each email attachment its own Trigger.dev retry so one bad file can't force a full-email re-run of already-saved attachments, and can't produce a misleading "error" reply when most of the email's invoices actually saved.

**Architecture:** `processInboundEmail` keeps its `shouldExtractAttachment` pre-filter, but instead of downloading and extracting each attachment inline in a loop, it fans the survivors out via `tasks.batchTriggerAndWait` to a new `process-attachment` task — one independent task run per attachment, each with its own `retry: { maxAttempts: 3 }`. The parent waits for all of them, aggregates which ones actually got saved via a pure helper function, and sends exactly one reply, same as today.

**Tech Stack:** Trigger.dev SDK 4.5.7 (`tasks.batchTriggerAndWait`), TypeScript, Vitest.

**Spec:** [`docs/superpowers/specs/2026-07-30-per-attachment-retry-design.md`](../specs/2026-07-30-per-attachment-retry-design.md)

---

## File Structure

| File | Created / Modified | Responsibility |
| --- | --- | --- |
| `src/lib/invoices/aggregate-attachment-results.ts` | Create | Pure function: turns a batch of attachment task run results into the list of invoices actually saved |
| `src/lib/invoices/aggregate-attachment-results.test.ts` | Create | Tests for the above |
| `src/trigger/process-attachment.ts` | Create | New Trigger.dev task: downloads one attachment, extracts it, returns the save result. Owns its own retry and concurrency limit |
| `src/trigger/process-inbound-email.ts` | Modify | Attachments branch now filters then fans out instead of looping inline; body-only branch untouched; reply decision becomes 3-way (processed/error/skipped) |

---

## Task 1: Pure aggregation function

**Files:**
- Create: `src/lib/invoices/aggregate-attachment-results.ts`
- Test: `src/lib/invoices/aggregate-attachment-results.test.ts`

This function takes the array of per-attachment results from `batchTriggerAndWait` and pulls
out just the invoices that were actually saved. It's declared against a small local type
rather than importing `TaskRunResult` from `@trigger.dev/sdk` — the real SDK type has extra
fields (`id`, `taskIdentifier`) this function doesn't care about, and TypeScript's structural
typing means the real batch result will satisfy this narrower shape without any cast. That
keeps this function testable with plain object literals, no Trigger.dev types or mocks
involved.

- [ ] **Step 1: Write the failing test**

`src/lib/invoices/aggregate-attachment-results.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aggregateAttachmentResults, type AttachmentTaskRun } from "./aggregate-attachment-results";

function ok(saved: boolean, invoice?: { vendor: string | null; amount: number | null; currency: string | null }): AttachmentTaskRun {
  return saved
    ? { ok: true, output: { saved: true, invoice: invoice! } }
    : { ok: true, output: { saved: false } };
}

function failed(error: unknown = new Error("boom")): AttachmentTaskRun {
  return { ok: false, error };
}

const invoiceA = { vendor: "Acme", amount: 10, currency: "USD" };
const invoiceB = { vendor: "Globex", amount: 20, currency: "USD" };

describe("aggregateAttachmentResults", () => {
  it("collects every saved invoice when all runs succeed", () => {
    const runs = [ok(true, invoiceA), ok(true, invoiceB)];
    expect(aggregateAttachmentResults(runs)).toEqual([invoiceA, invoiceB]);
  });

  it("returns an empty array when every run failed", () => {
    const runs = [failed(), failed()];
    expect(aggregateAttachmentResults(runs)).toEqual([]);
  });

  it("keeps the saved invoices and drops the failed and non-invoice runs in a mix", () => {
    const runs = [ok(true, invoiceA), failed(), ok(false), ok(true, invoiceB)];
    expect(aggregateAttachmentResults(runs)).toEqual([invoiceA, invoiceB]);
  });

  it("ignores a run that completed but decided the attachment was not an invoice", () => {
    const runs = [ok(false)];
    expect(aggregateAttachmentResults(runs)).toEqual([]);
  });

  it("returns an empty array for an empty batch", () => {
    expect(aggregateAttachmentResults([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/invoices/aggregate-attachment-results.test.ts`
Expected: FAIL — `Failed to resolve import "./aggregate-attachment-results"`.

- [ ] **Step 3: Write the implementation**

`src/lib/invoices/aggregate-attachment-results.ts`:

```ts
import type { ProcessExtractionResult, SavedInvoiceSummary } from "./process-extraction";

/**
 * One attachment's outcome from `tasks.batchTriggerAndWait`: either the task
 * run completed (whatever processExtraction decided) or the task itself
 * failed after exhausting its own retries. Declared locally rather than
 * imported from @trigger.dev/sdk's TaskRunResult so this stays a plain
 * function, testable with object literals and no SDK types involved.
 */
export type AttachmentTaskRun =
  | { ok: true; output: ProcessExtractionResult }
  | { ok: false; error: unknown };

/** Pulls the invoices actually saved out of a batch of attachment task runs. */
export function aggregateAttachmentResults(
  runs: readonly AttachmentTaskRun[],
): SavedInvoiceSummary[] {
  const saved: SavedInvoiceSummary[] = [];
  for (const run of runs) {
    if (!run.ok) continue;
    if (run.output.saved) saved.push(run.output.invoice);
  }
  return saved;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/invoices/aggregate-attachment-results.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/aggregate-attachment-results.ts src/lib/invoices/aggregate-attachment-results.test.ts
git commit -m "feat: add pure aggregator for per-attachment task results"
```

---

## Task 2: The `process-attachment` task

This is the code currently living inside `process-inbound-email.ts`'s attachments loop body
(download, build input, call `processExtraction`), moved into its own Trigger.dev task so it
gets an independent retry policy. `trigger.config.ts` already has `dirs: ["./src/trigger"]`,
so this file is auto-discovered — no registration needed elsewhere.

**Files:**
- Create: `src/trigger/process-attachment.ts`

- [ ] **Step 1: Write the task**

`src/trigger/process-attachment.ts`:

```ts
import { task } from "@trigger.dev/sdk";
import { agentmail } from "@/lib/agentmail";
import { createServiceClient } from "@/lib/supabase/service";
import {
  processExtraction,
  type ProcessExtractionResult,
} from "@/lib/invoices/process-extraction";

export type ProcessAttachmentPayload = {
  inboxId: string;
  messageId: string;
  userId: string;
  attachment: {
    attachmentId: string;
    filename: string | null;
    contentType: string | null;
    size: number | null;
  };
};

// Concurrent LLM calls + Supabase writes across the whole system. Each
// attachment is now its own task run rather than one email looping over all
// of its attachments, so this is the queue that actually needs the cap —
// moved here from process-inbound-email.ts for that reason.
export const EXTRACTION_CONCURRENCY_LIMIT = 5;

export const processAttachment = task({
  id: "process-attachment",
  queue: { concurrencyLimit: EXTRACTION_CONCURRENCY_LIMIT },
  retry: { maxAttempts: 3 },
  run: async (payload: ProcessAttachmentPayload): Promise<ProcessExtractionResult> => {
    const supabase = createServiceClient();
    const { attachment } = payload;
    const mimeType = attachment.contentType ?? "application/octet-stream";

    const { downloadUrl } = await agentmail.inboxes.messages.getAttachment(
      payload.inboxId,
      payload.messageId,
      attachment.attachmentId,
    );
    const fileRes = await fetch(downloadUrl);
    const fileBuffer = Buffer.from(await fileRes.arrayBuffer());

    const input =
      mimeType === "application/pdf"
        ? ({ type: "pdf", data: fileBuffer } as const)
        : mimeType.startsWith("image/")
          ? ({ type: "image", data: fileBuffer, mimeType } as const)
          : null;
    // Unreachable in practice today (the parent's shouldExtractAttachment
    // gate already restricts to pdf/image mime types before this task is
    // ever triggered), kept as a defensive fallback matching the original
    // loop's behavior: silently not saved, not treated as a failure.
    if (!input) return { saved: false };

    return processExtraction({
      supabase,
      userId: payload.userId,
      messageId: payload.messageId,
      sourceRef: attachment.attachmentId,
      input,
      fileBuffer,
      fileName: attachment.filename ?? attachment.attachmentId,
    });
  },
});
```

No `onFailure` here — a single attachment's exhausted retries aren't independently reported
to anyone; `process-inbound-email.ts`'s aggregation is where the overall outcome and reply
are decided.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean). If `agentmail`, `createServiceClient`, or `processExtraction`'s
import paths differ from what's shown, fix the import to match the real files — don't guess.

- [ ] **Step 3: Commit**

```bash
git add src/trigger/process-attachment.ts
git commit -m "feat: add process-attachment task"
```

---

## Task 3: Fan out from `process-inbound-email.ts`

**Files:**
- Modify: `src/trigger/process-inbound-email.ts`

The current file in full (for reference — read the real file before editing, in case it has
drifted):

```ts
import { task, tasks } from "@trigger.dev/sdk";
import { agentmail } from "@/lib/agentmail";
import { createServiceClient } from "@/lib/supabase/service";
import {
  shouldExtractAttachment,
  shouldExtractEmailBody,
} from "@/lib/extraction/document-gate";
import {
  processExtraction,
  type SavedInvoiceSummary,
} from "@/lib/invoices/process-extraction";
import type { EmailReplyOutcome } from "@/lib/email-reply-templates";
import type { sendInboundEmailReply } from "./send-inbound-email-reply";

export type ProcessInboundEmailPayload = {
  inboxId: string;
  messageId: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  attachments: {
    attachmentId: string;
    filename: string | null;
    contentType: string | null;
    size: number | null;
  }[];
};

// Cap simultaneous extractions (LLM calls + Supabase writes) regardless of how
// many webhook events arrive at once. Excess runs queue, nothing is dropped.
export const EXTRACTION_CONCURRENCY_LIMIT = 5;

// SavedInvoiceSummary is structurally identical to the reply builder's
// ReplyInvoiceSummary, so a saved-invoices array satisfies EmailReplyOutcome.
function triggerReply(
  inboxId: string,
  messageId: string,
  outcome: EmailReplyOutcome,
  idempotencyKey: string,
) {
  return tasks.trigger<typeof sendInboundEmailReply>(
    "send-inbound-email-reply",
    { inboxId, messageId, outcome },
    { idempotencyKey },
  );
}

export const processInboundEmail = task({
  id: "process-inbound-email",
  queue: { concurrencyLimit: EXTRACTION_CONCURRENCY_LIMIT },
  retry: { maxAttempts: 3 },
  onFailure: async ({ payload }: { payload: ProcessInboundEmailPayload }) => {
    // Fires once, only after all retry attempts are exhausted.
    await triggerReply(
      payload.inboxId,
      payload.messageId,
      { type: "error" },
      `reply:error:${payload.messageId}`,
    );
  },
  run: async (payload: ProcessInboundEmailPayload) => {
    const supabase = createServiceClient();

    const { data: inbox } = await supabase
      .from("inboxes")
      .select("user_id")
      .eq("agentmail_inbox_id", payload.inboxId)
      .maybeSingle();

    if (!inbox) {
      console.error("Inbound-email task for unknown inbox", payload.inboxId);
      return { status: "unknown_inbox" as const };
    }

    const emailContext = {
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    };
    const saved: SavedInvoiceSummary[] = [];

    if (payload.attachments.length === 0) {
      if (shouldExtractEmailBody(emailContext)) {
        const html = payload.html ?? payload.text ?? "";
        const result = await processExtraction({
          supabase,
          userId: inbox.user_id,
          messageId: payload.messageId,
          sourceRef: "body",
          input: { type: "html", html },
          fileBuffer: null,
          fileName: null,
        });
        if (result.saved) saved.push(result.invoice);
      }
    } else {
      for (const attachment of payload.attachments) {
        const mimeType = attachment.contentType ?? "application/octet-stream";
        if (
          !shouldExtractAttachment(
            { filename: attachment.filename, mimeType, sizeBytes: attachment.size },
            emailContext,
          )
        ) {
          continue;
        }

        const { downloadUrl } = await agentmail.inboxes.messages.getAttachment(
          payload.inboxId,
          payload.messageId,
          attachment.attachmentId,
        );
        const fileRes = await fetch(downloadUrl);
        const fileBuffer = Buffer.from(await fileRes.arrayBuffer());

        const input =
          mimeType === "application/pdf"
            ? ({ type: "pdf", data: fileBuffer } as const)
            : mimeType.startsWith("image/")
              ? ({ type: "image", data: fileBuffer, mimeType } as const)
              : null;
        if (!input) continue;

        const result = await processExtraction({
          supabase,
          userId: inbox.user_id,
          messageId: payload.messageId,
          sourceRef: attachment.attachmentId,
          input,
          fileBuffer,
          fileName: attachment.filename ?? attachment.attachmentId,
        });
        if (result.saved) saved.push(result.invoice);
      }
    }

    await triggerReply(
      payload.inboxId,
      payload.messageId,
      saved.length > 0 ? { type: "processed", invoices: saved } : { type: "skipped" },
      `reply:${payload.messageId}`,
    );

    return {
      status: saved.length > 0 ? ("processed" as const) : ("skipped_non_invoice" as const),
      extracted: saved.length,
    };
  },
});
```

- [ ] **Step 1: Update the imports**

Remove `agentmail` (no longer downloaded here — that moved to `process-attachment.ts`).
`processExtraction` stays imported: the body-only branch still calls it directly. Add the
new task's type import and the aggregator:

```ts
import { task, tasks } from "@trigger.dev/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import {
  shouldExtractAttachment,
  shouldExtractEmailBody,
} from "@/lib/extraction/document-gate";
import {
  processExtraction,
  type SavedInvoiceSummary,
} from "@/lib/invoices/process-extraction";
import { aggregateAttachmentResults } from "@/lib/invoices/aggregate-attachment-results";
import type { EmailReplyOutcome } from "@/lib/email-reply-templates";
import type { sendInboundEmailReply } from "./send-inbound-email-reply";
import type { processAttachment, ProcessAttachmentPayload } from "./process-attachment";
```

- [ ] **Step 1a: Delete the old concurrency constant and the parent's queue config**

Delete this line and its comment entirely (it's fully moved to
`process-attachment.ts` in Task 2 — confirmed via `grep -rn "EXTRACTION_CONCURRENCY_LIMIT" src/`
that nothing else in the codebase references it):

```ts
// Cap simultaneous extractions (LLM calls + Supabase writes) regardless of how
// many webhook events arrive at once. Excess runs queue, nothing is dropped.
export const EXTRACTION_CONCURRENCY_LIMIT = 5;
```

Then in the `processInboundEmail` task's config, remove the now-dangling `queue` line — the
parent no longer calls the LLM or writes to Supabase directly in the attachments branch, so
there's nothing left here that needs a concurrency cap:

```ts
export const processInboundEmail = task({
  id: "process-inbound-email",
  queue: { concurrencyLimit: EXTRACTION_CONCURRENCY_LIMIT },  // <- delete this line
  retry: { maxAttempts: 3 },
  onFailure: async ({ payload }: { payload: ProcessInboundEmailPayload }) => {
```

so the task config becomes:

```ts
export const processInboundEmail = task({
  id: "process-inbound-email",
  retry: { maxAttempts: 3 },
  onFailure: async ({ payload }: { payload: ProcessInboundEmailPayload }) => {
```

- [ ] **Step 2: Replace the attachments branch**

Replace the entire `else { for (const attachment of payload.attachments) { ... } }` block
with:

```ts
    } else {
      const attachmentsToProcess = payload.attachments.filter((attachment) => {
        const mimeType = attachment.contentType ?? "application/octet-stream";
        return shouldExtractAttachment(
          { filename: attachment.filename, mimeType, sizeBytes: attachment.size },
          emailContext,
        );
      });

      if (attachmentsToProcess.length > 0) {
        const batch = await tasks.batchTriggerAndWait<typeof processAttachment>(
          "process-attachment",
          attachmentsToProcess.map((attachment) => ({
            payload: {
              inboxId: payload.inboxId,
              messageId: payload.messageId,
              userId: inbox.user_id,
              attachment,
            } satisfies ProcessAttachmentPayload,
          })),
        );

        // batch.runs is positional: Trigger.dev returns results in the same
        // order as the items array passed to batchTriggerAndWait, so zipping
        // by index recovers which attachment a given run belongs to (a
        // TaskRunResult carries the run's own id, not the original payload).
        batch.runs.forEach((run, index) => {
          if (!run.ok) {
            console.error(
              "Attachment processing failed after retries",
              payload.inboxId,
              payload.messageId,
              attachmentsToProcess[index]!.attachmentId,
              run.error,
            );
            anyAttachmentFailed = true;
          }
        });

        saved.push(...aggregateAttachmentResults(batch.runs));
      }
    }
```

This introduces `anyAttachmentFailed`, which needs to exist before this block. Add it right
next to the `saved` declaration:

```ts
    const saved: SavedInvoiceSummary[] = [];
    let anyAttachmentFailed = false;
```

- [ ] **Step 3: Make the reply decision 3-way**

Replace:

```ts
    await triggerReply(
      payload.inboxId,
      payload.messageId,
      saved.length > 0 ? { type: "processed", invoices: saved } : { type: "skipped" },
      `reply:${payload.messageId}`,
    );
```

with:

```ts
    const outcome: EmailReplyOutcome =
      saved.length > 0
        ? { type: "processed", invoices: saved }
        : anyAttachmentFailed
          ? { type: "error" }
          : { type: "skipped" };

    await triggerReply(payload.inboxId, payload.messageId, outcome, `reply:${payload.messageId}`);
```

- [ ] **Step 4: Update the return value's status for the mixed case**

The task's own return value (visible in the Trigger.dev dashboard, not sent to the user)
currently only distinguishes `processed` vs `skipped_non_invoice`. Extend it to surface a
failure when nothing saved but something genuinely failed:

```ts
    return {
      status:
        saved.length > 0
          ? ("processed" as const)
          : anyAttachmentFailed
            ? ("attachments_failed" as const)
            : ("skipped_non_invoice" as const),
      extracted: saved.length,
    };
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean). If `tasks.batchTriggerAndWait<typeof processAttachment>(...)`'s
return type doesn't structurally satisfy `aggregateAttachmentResults`'s `AttachmentTaskRun[]`
parameter, read the actual compiler error — it will name the mismatched field — and adjust
`AttachmentTaskRun` in `aggregate-attachment-results.ts` to match reality rather than forcing
a cast.

- [ ] **Step 6: Run the full gate**

```bash
npm run test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all four succeed. Test count should be 249 (244 before this plan, +5 from Task 1).

- [ ] **Step 7: Commit**

```bash
git add src/trigger/process-inbound-email.ts
git commit -m "feat: fan out attachment processing so each file gets its own retry"
```

---

## Task 4: Manual verification

Trigger.dev tasks aren't unit-tested in this project (`.claude/rules/testing.md` — mixes I/O
with orchestration, verified manually instead). This needs `npx trigger.dev@latest dev`
running alongside the app, per the existing convention for this codepath.

**Files:** none (verification only)

- [ ] **Step 1: Start the stack**

Start the local Supabase stack and the dev server via the preview tool (never `npm run dev`
through Bash), and in a second terminal run:

```bash
npx trigger.dev@latest dev
```

This requires `TRIGGER_SECRET_KEY` and `TRIGGER_PROJECT_REF` in `.env.local`, and a real
`AGENTMAIL_API_KEY`/inbox to forward mail through — if these aren't available in the current
environment, say so explicitly rather than fabricating a result, and fall back to the
narrower checks in Steps 5-6 (which only need `npx tsc --noEmit` and reading the Trigger.dev
dashboard's task graph, not a live send).

- [ ] **Step 2: All attachments valid**

Forward an email with 3 valid invoice attachments (PDFs or images). Expected: 3 invoices
appear in the dashboard, one reply email, `processed` mentioning 3 invoices. In the
Trigger.dev dashboard, confirm the `process-inbound-email` run shows 3 child
`process-attachment` runs.

- [ ] **Step 3: One attachment fails**

Forward an email with 3 attachments where one is a deliberately corrupted/truncated PDF file
(a file with a `.pdf` name and `application/pdf` content-type that isn't valid PDF data, so
extraction throws for that one). Expected: the other 2 attachments save correctly, one reply
says `processed` with those 2, and the corrupted attachment's `process-attachment` run shows
as failed in the dashboard after its own 3 retries — **not** reflected as an error to the
sender.

- [ ] **Step 4: Retries are isolated**

In the Trigger.dev dashboard for the run from Step 3, confirm the corrupted attachment's task
run retried 3 times on its own, and the other 2 attachments' task runs each ran exactly once
— they were not re-triggered by the failing sibling's retries.

- [ ] **Step 5: Dedupe still works across a fan-out**

Re-forward the same 3-attachment email from Step 2 a second time. Expected: the 2
(previously 3, now testing the already-saved ones) already-saved invoices come back as
content-hash dedupe hits with no new model calls (per the existing extraction-cost-visibility
feature), and the reply still says `processed`.

- [ ] **Step 6: All attachments filtered**

Forward an email whose only attachment is something `shouldExtractAttachment` rejects (e.g.
a `.docx` file, or an image filename containing "logo"). Expected: `{ type: "skipped" }`,
and the Trigger.dev dashboard shows **no** `process-attachment` runs were spawned for it.

---

## Task 5: Full gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full gate one more time**

```bash
npm run test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all four succeed, exactly as in Task 3 Step 6 — this just re-confirms nothing
regressed after the manual verification pass (in case `.env.local` or any local edits were
made during Task 4).

---

## Done when

- [ ] `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
- [ ] Task 4's checks pass against a live Trigger.dev dev run, or are explicitly reported as
      not runnable in this environment (missing credentials) rather than assumed to pass.
- [ ] A single failing attachment no longer prevents its siblings from being saved and
      reported, and no longer causes a false `error` reply when other invoices in the same
      email were actually saved.
