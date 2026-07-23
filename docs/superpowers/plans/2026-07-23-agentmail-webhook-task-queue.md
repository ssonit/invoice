# AgentMail Webhook → Trigger.dev Task Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move invoice extraction out of the AgentMail webhook request path into Trigger.dev background tasks, so the webhook returns `200` immediately, retries are automatic, dedupe is handled by `idempotencyKey`, and the sender gets an auto-reply.

**Architecture:** The webhook route only verifies the svix signature, checks `event_type`, and calls `tasks.trigger("process-inbound-email", payload, { idempotencyKey: messageId })`. The main task looks up the inbox → user, runs the existing multi-provider `extractInvoice()` per attachment (or HTML-body fallback), upserts invoices (idempotent on `(user_id, source_message_id, source_ref)` so retries don't duplicate), then triggers a child task that replies via AgentMail. A concurrency limit of 5 caps simultaneous extractions.

**Tech Stack:** Trigger.dev Cloud (`@trigger.dev/sdk`), Next.js 16 App Router, Supabase (service-role client), AgentMail SDK, Vitest.

**Design spec:** `docs/superpowers/specs/2026-07-23-agentmail-webhook-task-queue-design.md`

**Reference note:** This is a customized Next.js (see `AGENTS.md`). The webhook route stays a standard Route Handler; nothing here needs new Next.js APIs.

---

## Task 1: Trigger.dev setup (SDK, config, env)

**Prerequisite (manual, done by the user — the assistant cannot create accounts):**
1. Create a free account + project at `https://cloud.trigger.dev`.
2. Copy the **Project ref** (looks like `proj_xxxxxxxx`) from Project settings.
3. Copy a **Secret key** (`tr_dev_...`) from the API Keys page.

If these aren't available yet, the implementer should report `BLOCKED` and stop — the rest of Task 1's verification (`trigger.dev dev`) needs the real values, though the code steps below can still be written with placeholders.

**Files:**
- Create: `trigger.config.ts`
- Modify: `package.json` (add `@trigger.dev/sdk` dependency)
- Modify: `.env.local.example`
- Modify: `.gitignore`

- [ ] **Step 1: Install the SDK**

Run:
```bash
npm install @trigger.dev/sdk
```
Expected: `@trigger.dev/sdk` added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `trigger.config.ts` at the repo root**

```ts
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Project ref from the Trigger.dev dashboard (Project settings). Not secret.
  // Replace <project ref> with your real ref, e.g. "proj_abc123".
  project: "<project ref>",
  runtime: "node-22",
  dirs: ["./src/trigger"],
  retries: {
    // Let retries run in the local `trigger.dev dev` CLI too, so we can
    // observe backoff behaviour during the smoke test.
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
});
```

- [ ] **Step 3: Add env vars to `.env.local.example`**

Append after the AgentMail block:
```bash
# Trigger.dev (background task queue for inbound-email processing)
# Get these from https://cloud.trigger.dev → Project settings / API Keys.
TRIGGER_SECRET_KEY=
# Project ref also lives in trigger.config.ts; keep them in sync.
TRIGGER_PROJECT_REF=
```

Then add the real values to your local `.env.local` (not committed).

- [ ] **Step 4: Ignore the Trigger.dev build dir**

Add to `.gitignore` (near the other tool dirs):
```
# trigger.dev
/.trigger/
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (`trigger.config.ts` compiles; the `dirs` folder can be empty at this point.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json trigger.config.ts .env.local.example .gitignore
git commit -m "chore: set up Trigger.dev SDK and config"
```

---

## Task 2: Database migration — `source_ref` + drop `processed_messages`

**Why a plain unique constraint (not a partial index):** `supabase-js` `.upsert({...}, { onConflict: "a,b,c" })` generates `ON CONFLICT (a, b, c)` with no `WHERE`, so the conflict target must be a **non-partial** unique constraint. Upload-sourced rows leave `source_message_id` and `source_ref` NULL; Postgres treats NULLs as distinct in unique constraints, so multiple uploads never collide, and the constraint only ever dedupes email rows (which always set both columns to non-null values).

**Files:**
- Create: `supabase/migrations/20260723100000_webhook_task_queue.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Trigger.dev now dedupes inbound-email processing via idempotencyKey, so the
-- hand-rolled processed_messages table is no longer used.
drop table if exists public.processed_messages;

-- One email can produce several invoices (one per attachment, or 'body' for the
-- HTML-body fallback). source_ref distinguishes them so the extraction task can
-- upsert instead of insert, making a task retry safe (no duplicate rows).
alter table public.invoices add column if not exists source_ref text;

-- Non-partial unique constraint so supabase-js .upsert(onConflict) can target it.
-- Upload rows (source_message_id / source_ref both NULL) are unaffected because
-- NULLs are distinct in a unique constraint.
alter table public.invoices
  add constraint invoices_source_message_ref_key
  unique (user_id, source_message_id, source_ref);
```

- [ ] **Step 2: Apply and verify**

Prerequisite: Docker Desktop running.

Run:
```bash
npx supabase db reset
```
Expected: reset completes, all migrations apply cleanly, no error about `processed_messages` or the new constraint.

- [ ] **Step 3: Confirm the schema change**

Run:
```bash
npx supabase db query "select column_name from information_schema.columns where table_name='invoices' and column_name='source_ref'; select conname from pg_constraint where conname='invoices_source_message_ref_key'; select to_regclass('public.processed_messages') as processed_messages_table"
```
Expected: `source_ref` row present, `invoices_source_message_ref_key` present, `processed_messages_table` is `null` (dropped).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260723100000_webhook_task_queue.sql
git commit -m "feat: add invoices.source_ref, drop processed_messages"
```

---

## Task 3: `email-reply-templates.ts` — pure reply text builder

**Files:**
- Create: `src/lib/email-reply-templates.ts`
- Test: `src/lib/email-reply-templates.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/email-reply-templates.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildReplyText } from "./email-reply-templates";

describe("buildReplyText", () => {
  it("summarizes a single processed invoice with vendor and amount", () => {
    const text = buildReplyText({
      type: "processed",
      invoices: [{ vendor: "Acme SaaS", amount: 19, currency: "USD" }],
    });
    expect(text).toContain("Acme SaaS");
    expect(text).toContain("19 USD");
  });

  it("omits the amount when it is null", () => {
    const text = buildReplyText({
      type: "processed",
      invoices: [{ vendor: "Acme SaaS", amount: null, currency: null }],
    });
    expect(text).toContain("Acme SaaS");
    expect(text).not.toContain("null");
  });

  it("falls back gracefully when the vendor is null", () => {
    const text = buildReplyText({
      type: "processed",
      invoices: [{ vendor: null, amount: 5, currency: "USD" }],
    });
    expect(text).not.toContain("null");
    expect(text.length).toBeGreaterThan(0);
  });

  it("reports a count for multiple processed invoices", () => {
    const text = buildReplyText({
      type: "processed",
      invoices: [
        { vendor: "A", amount: 1, currency: "USD" },
        { vendor: "B", amount: 2, currency: "USD" },
      ],
    });
    expect(text).toContain("2");
  });

  it("tells the sender when nothing looked like an invoice", () => {
    const text = buildReplyText({ type: "skipped" });
    expect(text.toLowerCase()).toContain("invoice");
    expect(text.length).toBeGreaterThan(0);
  });

  it("apologizes on error", () => {
    const text = buildReplyText({ type: "error" });
    expect(text.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/email-reply-templates.test.ts`
Expected: FAIL — `buildReplyText` is not defined / module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/email-reply-templates.ts`:
```ts
export type ReplyInvoiceSummary = {
  vendor: string | null;
  amount: number | null;
  currency: string | null;
};

export type EmailReplyOutcome =
  | { type: "processed"; invoices: ReplyInvoiceSummary[] }
  | { type: "skipped" }
  | { type: "error" };

function formatAmount(amount: number | null, currency: string | null): string | null {
  if (amount === null) return null;
  return currency ? `${amount} ${currency}` : `${amount}`;
}

export function buildReplyText(outcome: EmailReplyOutcome): string {
  switch (outcome.type) {
    case "processed": {
      const { invoices } = outcome;
      if (invoices.length === 1) {
        const invoice = invoices[0]!;
        const vendor = invoice.vendor ?? "your vendor";
        const amount = formatAmount(invoice.amount, invoice.currency);
        const lead = amount
          ? `We received and processed your invoice from ${vendor} — ${amount}.`
          : `We received and processed your invoice from ${vendor}.`;
        return `${lead} You can view it in your Invoice Reader dashboard.`;
      }
      return `We received and processed ${invoices.length} invoices from this email. You can view them in your Invoice Reader dashboard.`;
    }
    case "skipped":
      return "We received your email but couldn't find an invoice to process. If you expected one here, please check the attachment and resend.";
    case "error":
      return "We ran into a problem processing this email. Please try resending it in a little while, or reach out if this keeps happening.";
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/email-reply-templates.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-reply-templates.ts src/lib/email-reply-templates.test.ts
git commit -m "feat: add inbound-email auto-reply text builder"
```

---

## Task 4: `process-extraction.ts` — extract-and-save, upsert-based

Moves the `processExtraction` helper out of the webhook route into a standalone, testable module, switching `insert` → `upsert` (keyed on the new constraint) and returning the saved invoice summary so the reply can describe it.

**Files:**
- Create: `src/lib/invoices/process-extraction.ts`
- Test: `src/lib/invoices/process-extraction.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/invoices/process-extraction.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/extraction", () => ({ extractInvoice: vi.fn() }));
vi.mock("@/lib/vendors", () => ({ ensureVendorRecord: vi.fn() }));

import { extractInvoice } from "@/lib/extraction";
import { ensureVendorRecord } from "@/lib/vendors";
import { processExtraction } from "./process-extraction";

const mockedExtract = vi.mocked(extractInvoice);

function invoiceResult(overrides: Record<string, unknown> = {}) {
  return {
    is_invoice: true,
    vendor: "Acme SaaS",
    invoice_number: "INV-1",
    amount: 19,
    currency: "USD",
    issue_date: "2026-07-01",
    due_date: null,
    tax: null,
    line_items: [],
    confidence_score: 0.9,
    ...overrides,
  };
}

function mockSupabase() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ upsert });
  const upload = vi.fn().mockResolvedValue({ data: { path: "u/p.pdf" }, error: null });
  const storageFrom = vi.fn().mockReturnValue({ upload });
  return {
    client: { from, storage: { from: storageFrom } } as never,
    upsert,
    from,
    upload,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processExtraction", () => {
  it("returns saved:false and writes nothing when not an invoice", async () => {
    mockedExtract.mockResolvedValue(invoiceResult({ is_invoice: false }) as never);
    const sb = mockSupabase();
    const result = await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "body",
      input: { type: "html", html: "<p>hi</p>" },
      fileBuffer: null,
      fileName: null,
    });
    expect(result).toEqual({ saved: false });
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("upserts on the composite conflict target and returns the summary", async () => {
    mockedExtract.mockResolvedValue(invoiceResult() as never);
    const sb = mockSupabase();
    const result = await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "att-1",
      input: { type: "pdf", data: Buffer.from("x") },
      fileBuffer: Buffer.from("x"),
      fileName: "bill.pdf",
    });
    expect(sb.from).toHaveBeenCalledWith("invoices");
    const [row, options] = sb.upsert.mock.calls[0]!;
    expect(options).toEqual({ onConflict: "user_id,source_message_id,source_ref" });
    expect(row).toMatchObject({
      user_id: "user-1",
      source: "email",
      source_message_id: "msg-1",
      source_ref: "att-1",
      vendor: "Acme SaaS",
    });
    expect(result).toEqual({
      saved: true,
      invoice: { vendor: "Acme SaaS", amount: 19, currency: "USD" },
    });
    expect(ensureVendorRecord).toHaveBeenCalledWith(sb.client, "user-1", "Acme SaaS");
  });

  it("flags low-confidence invoices for review", async () => {
    mockedExtract.mockResolvedValue(invoiceResult({ confidence_score: 0.4 }) as never);
    const sb = mockSupabase();
    await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "body",
      input: { type: "html", html: "<p>hi</p>" },
      fileBuffer: null,
      fileName: null,
    });
    expect(sb.upsert.mock.calls[0]![0]).toMatchObject({ needs_review: true });
  });

  it("stores the uploaded file path when a buffer is provided", async () => {
    mockedExtract.mockResolvedValue(invoiceResult() as never);
    const sb = mockSupabase();
    await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "att-1",
      input: { type: "pdf", data: Buffer.from("x") },
      fileBuffer: Buffer.from("x"),
      fileName: "bill.pdf",
    });
    expect(sb.upload).toHaveBeenCalled();
    expect(sb.upsert.mock.calls[0]![0]).toMatchObject({ file_url: "u/p.pdf" });
  });

  it("leaves file_url null when there is no file buffer", async () => {
    mockedExtract.mockResolvedValue(invoiceResult() as never);
    const sb = mockSupabase();
    await processExtraction({
      supabase: sb.client,
      userId: "user-1",
      messageId: "msg-1",
      sourceRef: "body",
      input: { type: "html", html: "<p>hi</p>" },
      fileBuffer: null,
      fileName: null,
    });
    expect(sb.upload).not.toHaveBeenCalled();
    expect(sb.upsert.mock.calls[0]![0]).toMatchObject({ file_url: null });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/invoices/process-extraction.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`src/lib/invoices/process-extraction.ts`:
```ts
import type { createServiceClient } from "@/lib/supabase/service";
import { extractInvoice, type ExtractionInput } from "@/lib/extraction";
import { ensureVendorRecord } from "@/lib/vendors";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type SavedInvoiceSummary = {
  vendor: string | null;
  amount: number | null;
  currency: string | null;
};

export type ProcessExtractionResult =
  | { saved: true; invoice: SavedInvoiceSummary }
  | { saved: false };

/**
 * Run the multi-provider extractor on one input and, if it's an invoice,
 * upsert it. Idempotent on (user_id, source_message_id, source_ref) so a task
 * retry re-processing the same attachment can't create a duplicate row.
 */
export async function processExtraction(params: {
  supabase: ServiceClient;
  userId: string;
  messageId: string;
  sourceRef: string;
  input: ExtractionInput;
  fileBuffer: Buffer | null;
  fileName: string | null;
}): Promise<ProcessExtractionResult> {
  const { supabase, userId, messageId, sourceRef, input, fileBuffer, fileName } = params;

  const extracted = await extractInvoice(input);
  if (!extracted.is_invoice) return { saved: false };

  // invoice-files is a private bucket — store the object path; a signed URL is
  // generated on read (see src/lib/storage.ts).
  let fileUrl: string | null = null;
  if (fileBuffer && fileName) {
    const path = `${userId}/${messageId}-${fileName}`;
    const { data: uploaded } = await supabase.storage
      .from("invoice-files")
      .upload(path, fileBuffer, { upsert: true });
    if (uploaded) fileUrl = uploaded.path;
  }

  await supabase.from("invoices").upsert(
    {
      user_id: userId,
      source: "email",
      vendor: extracted.vendor,
      invoice_number: extracted.invoice_number,
      amount: extracted.amount,
      currency: extracted.currency,
      issue_date: extracted.issue_date,
      due_date: extracted.due_date,
      tax: extracted.tax,
      line_items: extracted.line_items,
      confidence_score: extracted.confidence_score,
      needs_review: extracted.confidence_score < 0.7,
      raw_extracted_json: extracted,
      file_url: fileUrl,
      source_message_id: messageId,
      source_ref: sourceRef,
    },
    { onConflict: "user_id,source_message_id,source_ref" },
  );

  await ensureVendorRecord(supabase, userId, extracted.vendor);
  return {
    saved: true,
    invoice: {
      vendor: extracted.vendor,
      amount: extracted.amount,
      currency: extracted.currency,
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/invoices/process-extraction.test.ts`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/invoices/process-extraction.ts src/lib/invoices/process-extraction.test.ts
git commit -m "feat: extract upsert-based processExtraction into its own module"
```

---

## Task 5: `send-inbound-email-reply.ts` — child reply task

Orchestration task (not unit-tested — needs the Trigger.dev runtime; verified in Task 8's smoke test). The pure text it sends is already covered by Task 3.

**Files:**
- Create: `src/trigger/send-inbound-email-reply.ts`

- [ ] **Step 1: Write the task**

```ts
import { task } from "@trigger.dev/sdk";
import { agentmail } from "@/lib/agentmail";
import { buildReplyText, type EmailReplyOutcome } from "@/lib/email-reply-templates";

export type SendInboundEmailReplyPayload = {
  inboxId: string;
  messageId: string;
  outcome: EmailReplyOutcome;
};

export const sendInboundEmailReply = task({
  id: "send-inbound-email-reply",
  retry: { maxAttempts: 3 },
  run: async (payload: SendInboundEmailReplyPayload) => {
    const text = buildReplyText(payload.outcome);
    await agentmail.inboxes.messages.reply(payload.inboxId, payload.messageId, {
      text,
    });
    return { status: "sent" as const, outcome: payload.outcome.type };
  },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/trigger/send-inbound-email-reply.ts
git commit -m "feat: add AgentMail auto-reply task"
```

---

## Task 6: `process-inbound-email.ts` — main extraction task

Orchestration task. Ports the current webhook body (inbox lookup, document gate, attachment download, extraction) into a Trigger.dev task, with concurrency limit, per-loop collection of saved invoices, a reply trigger at the end, and an `onFailure` hook that triggers the error reply after retries are exhausted.

**Known accepted edge case:** if attachment A saves but attachment B then throws, the whole run is retried; after all retries the sender gets an `error` reply even though A was upserted (and is visible in the dashboard). Acceptable for v1 — the email did fail to fully process, and the upsert means A isn't duplicated across retries.

**Files:**
- Create: `src/trigger/process-inbound-email.ts`

- [ ] **Step 1: Write the task**

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
      // Internal mapping problem, not the sender's fault — log and stop, no reply.
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
            {
              filename: attachment.filename,
              mimeType,
              sizeBytes: attachment.size,
            },
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/trigger/process-inbound-email.ts
git commit -m "feat: add inbound-email extraction task with concurrency limit"
```

---

## Task 7: Slim down the webhook route

Replace the route's inline processing with a signature check + `tasks.trigger()`. The old `processExtraction` helper and the `processed_messages` lookup are removed (now in the task / handled by idempotencyKey).

**Files:**
- Modify: `src/app/api/webhooks/agentmail/route.ts` (full replacement)

- [ ] **Step 1: Replace the route file**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { tasks } from "@trigger.dev/sdk";
import type { AgentMail } from "agentmail";
import type { processInboundEmail } from "@/trigger/process-inbound-email";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const headers = Object.fromEntries(request.headers);

  let event: { event_type: string; message: AgentMail.Message };
  try {
    event = new Webhook(process.env.AGENTMAIL_WEBHOOK_SECRET!).verify(
      payload,
      headers,
    ) as typeof event;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.event_type !== "message.received") {
    return NextResponse.json({ status: "ignored" });
  }

  const message = event.message;

  // Hand off to the background queue and return immediately. idempotencyKey =
  // messageId means an AgentMail webhook retry returns the original run instead
  // of starting a duplicate — no processed_messages table needed.
  await tasks.trigger<typeof processInboundEmail>(
    "process-inbound-email",
    {
      inboxId: message.inboxId,
      messageId: message.messageId,
      subject: message.subject ?? null,
      text: message.text ?? message.extractedText ?? null,
      html: message.html ?? message.extractedHtml ?? null,
      attachments: (message.attachments ?? []).map((attachment) => ({
        attachmentId: attachment.attachmentId,
        filename: attachment.filename ?? null,
        contentType: attachment.contentType ?? null,
        size: attachment.size ?? null,
      })),
    },
    { idempotencyKey: message.messageId },
  );

  return NextResponse.json({ status: "queued" });
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/app/api/webhooks/agentmail/route.ts`
Expected: no errors. (Unused imports from the old version — `agentmail`, `createServiceClient`, `extractInvoice`, document-gate, `ensureVendorRecord` — are gone.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/agentmail/route.ts
git commit -m "refactor: hand webhook off to Trigger.dev task, return 200 immediately"
```

---

## Task 8: Full verification + docs

**Files:**
- Create: `docs/webhook-task-queue.md`

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: all suites pass, including the new `email-reply-templates` (6) and `process-extraction` (5) tests.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds. The `/api/webhooks/agentmail` route compiles; `src/trigger/*` is picked up by `dirs` but isn't part of the Next.js bundle.

- [ ] **Step 3: Manual smoke test (requires Trigger.dev project + keys from Task 1)**

Prerequisites: Docker + local Supabase running, `TRIGGER_SECRET_KEY` and real `project` ref set, dev server running.

1. In one terminal: `npm run dev`.
2. In another: `npx trigger.dev@latest dev` (registers the two tasks; watch its console).
3. Send a test invoice email to the seeded user's AgentMail inbox (or replay a stored `message.received` webhook to `POST /api/webhooks/agentmail` with a valid signature).

Expected:
- The webhook returns `200 {"status":"queued"}` immediately.
- A `process-inbound-email` run appears in the Trigger.dev dashboard/CLI, succeeds, and a child `send-inbound-email-reply` run follows.
- A new `invoices` row exists in Supabase with `source: "email"`, `source_message_id`, and `source_ref` set.
- The sender receives an auto-reply matching the outcome (processed / skipped).
- Re-delivering the **same** webhook (same `messageId`) does **not** create a second run or a duplicate invoice (idempotencyKey).

- [ ] **Step 4: Write `docs/webhook-task-queue.md`**

Record: the request-path vs background-task split; that dedupe is `idempotencyKey: messageId` (no `processed_messages` table anymore); the `source_ref` upsert key and why (retry-safety); the `concurrencyLimit: 5`; the three auto-reply outcomes and that `error` comes only from `onFailure` after retries; that extraction stays multi-provider via `extractInvoice()` / `EXTRACTION_PROVIDER` (not Claude-specific); and the known partial-save-then-error edge case. Link the design spec and `docs/third-party-services.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/webhook-task-queue.md
git commit -m "docs: record webhook task-queue architecture"
```

---

## File Structure Summary

**Created:**
- `trigger.config.ts`
- `supabase/migrations/20260723100000_webhook_task_queue.sql`
- `src/lib/email-reply-templates.ts` + `.test.ts`
- `src/lib/invoices/process-extraction.ts` + `.test.ts`
- `src/trigger/send-inbound-email-reply.ts`
- `src/trigger/process-inbound-email.ts`
- `docs/webhook-task-queue.md`

**Modified:**
- `package.json` (add `@trigger.dev/sdk`)
- `.env.local.example`, `.gitignore`
- `src/app/api/webhooks/agentmail/route.ts` (slimmed to trigger-and-return)

**Deleted (via migration):**
- `public.processed_messages` table
