# Extraction Dedupe and Cost Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop paying twice for the same forwarded file, and record what every extraction cost, so the deferred routing work can later be justified with data instead of guesses.

**Architecture:** Provider wrappers start returning token usage alongside the extraction; `extractInvoice()` times the call and attaches the provider name; both call sites write those numbers onto the invoice row. Separately, the email path gains the SHA-256 dedupe the upload path already has, and a `duplicate_hit_count` column records how many model calls dedupe avoided.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres, untyped `supabase-js` client), Trigger.dev background tasks, Anthropic / Google GenAI / DeepSeek SDKs, Vitest.

**Spec:** [`docs/superpowers/specs/2026-07-29-extraction-cost-visibility-design.md`](../specs/2026-07-29-extraction-cost-visibility-design.md)

---

## File Structure

| File | Created / Modified | Responsibility |
| --- | --- | --- |
| `supabase/migrations/20260729120000_invoice_extraction_metrics.sql` | Create | Six additive columns on `invoices` |
| `src/lib/extraction/schema.ts` | Modify | `ExtractionUsage` and `ExtractionResult` types |
| `src/lib/extraction/usage.ts` | Create | `ExtractionMetrics` type + `buildExtractionMetrics()` (pure) |
| `src/lib/extraction/usage.test.ts` | Create | Boundary tests for the normalizer |
| `src/lib/extraction/anthropic.ts` | Modify | Return `{ extraction, usage }` |
| `src/lib/extraction/google.ts` | Modify | Return `{ extraction, usage }` |
| `src/lib/extraction/deepseek.ts` | Modify | Return `{ extraction, usage }` |
| `src/lib/extraction/index.ts` | Modify | Time the call, attach provider name, return `ExtractionOutcome` |
| `src/lib/invoices/process-extraction.ts` | Modify | Hash dedupe, duplicate counter, metrics on save, upsert error handling |
| `src/app/api/invoices/upload/route.ts` | Modify | Metrics on save, duplicate counter on its existing duplicate branch |
| `README.md` | Modify | Document the columns and a cost query |

---

## Task 1: Migration

**Files:**
- Create: `supabase/migrations/20260729120000_invoice_extraction_metrics.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Per-extraction cost/latency, recorded on the invoice the extraction produced.
-- Purely additive: existing rows keep working with nulls and a zero counter.
--
-- duplicate_hit_count answers "how many model calls did content-hash dedupe
-- avoid" without a second table: sum(duplicate_hit_count) across invoices.
alter table public.invoices
  add column extraction_provider text,
  add column extraction_model text,
  add column extraction_input_tokens integer,
  add column extraction_output_tokens integer,
  add column extraction_ms integer,
  add column duplicate_hit_count integer not null default 0;
```

No RLS policies or grants are needed: `invoices` already has both, and adding columns to an
existing table inherits them.

- [ ] **Step 2: Apply it to the local database**

Run: `npx supabase migration up`
Expected: the new migration is listed as applied, no errors.

- [ ] **Step 3: Verify the columns exist**

The `psql` binary is not available in this environment — check through PostgREST instead. Get
the local service key first:

```bash
npx supabase status
```

Then request one of the new columns (replace `<SERVICE_KEY>` with the `SERVICE_ROLE_KEY` value
printed above):

```bash
curl -sS "http://127.0.0.1:54321/rest/v1/invoices?select=id,extraction_provider,duplicate_hit_count&limit=1" -H "apikey: <SERVICE_KEY>" -H "Authorization: Bearer <SERVICE_KEY>"
```

Expected: HTTP 200 with `[]` or a row — **not** an error mentioning that a column does not
exist.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260729120000_invoice_extraction_metrics.sql
git commit -m "feat: add extraction metrics columns to invoices"
```

---

## Task 2: Usage types and normalizer

The one piece of real logic in this feature, so it is a pure function with its own tests.

**Files:**
- Modify: `src/lib/extraction/schema.ts`
- Create: `src/lib/extraction/usage.ts`
- Test: `src/lib/extraction/usage.test.ts`

- [ ] **Step 1: Add the types to `schema.ts`**

Append to `src/lib/extraction/schema.ts`, directly after the existing `ExtractionInput` union:

```ts
/** What a provider reports about the call it just made. */
export type ExtractionUsage = {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type ExtractionResult = {
  extraction: InvoiceExtraction;
  usage: ExtractionUsage;
};
```

- [ ] **Step 2: Write the failing test**

`src/lib/extraction/usage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildExtractionMetrics } from "./usage";

const usage = { model: "claude-haiku-4-5", inputTokens: 1200, outputTokens: 300 };

describe("buildExtractionMetrics", () => {
  it("passes through a well-formed usage payload", () => {
    expect(
      buildExtractionMetrics({ provider: "anthropic", usage, durationMs: 812 }),
    ).toEqual({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      inputTokens: 1200,
      outputTokens: 300,
      durationMs: 812,
    });
  });

  it("keeps a zero token count rather than nulling it", () => {
    const metrics = buildExtractionMetrics({
      provider: "google",
      usage: { ...usage, outputTokens: 0 },
      durationMs: 5,
    });
    expect(metrics.outputTokens).toBe(0);
  });

  it("nulls missing token counts", () => {
    const metrics = buildExtractionMetrics({
      provider: "google",
      usage: { model: "gemini-2.5-flash", inputTokens: null, outputTokens: null },
      durationMs: 5,
    });
    expect(metrics.inputTokens).toBeNull();
    expect(metrics.outputTokens).toBeNull();
  });

  it("nulls NaN and negative counts", () => {
    const metrics = buildExtractionMetrics({
      provider: "deepseek",
      usage: { model: "deepseek-chat", inputTokens: Number.NaN, outputTokens: -4 },
      durationMs: 10,
    });
    expect(metrics.inputTokens).toBeNull();
    expect(metrics.outputTokens).toBeNull();
  });

  it("nulls fractional counts", () => {
    const metrics = buildExtractionMetrics({
      provider: "deepseek",
      usage: { model: "deepseek-chat", inputTokens: 12.5, outputTokens: 1 },
      durationMs: 1,
    });
    expect(metrics.inputTokens).toBeNull();
    expect(metrics.outputTokens).toBe(1);
  });

  it("rounds the duration and never reports a negative one", () => {
    expect(
      buildExtractionMetrics({ provider: "anthropic", usage, durationMs: 12.6 }).durationMs,
    ).toBe(13);
    expect(
      buildExtractionMetrics({ provider: "anthropic", usage, durationMs: -1 }).durationMs,
    ).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/extraction/usage.test.ts`
Expected: FAIL — `Failed to resolve import "./usage"`.

- [ ] **Step 4: Write the implementation**

`src/lib/extraction/usage.ts`:

```ts
import type { ExtractionUsage } from "./schema";

export type ExtractionMetrics = {
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
};

// Token counts are diagnostics that get summed into cost reports and believed,
// so a wrong number is worse than no number. Anything that isn't a
// non-negative integer becomes null.
function normalizeTokenCount(value: number | null | undefined): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isInteger(value) || value < 0) return null;
  return value;
}

export function buildExtractionMetrics(params: {
  provider: string;
  usage: ExtractionUsage;
  durationMs: number;
}): ExtractionMetrics {
  const { provider, usage, durationMs } = params;
  return {
    provider,
    model: usage.model,
    inputTokens: normalizeTokenCount(usage.inputTokens),
    outputTokens: normalizeTokenCount(usage.outputTokens),
    durationMs: Math.max(0, Math.round(durationMs)),
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/extraction/usage.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/extraction/schema.ts src/lib/extraction/usage.ts src/lib/extraction/usage.test.ts
git commit -m "feat: add extraction usage types and metrics normalizer"
```

---

## Task 3: Providers return usage

This task changes a shared return type, so the three wrappers, the dispatcher, and both call
sites must move together or the build breaks. `npx tsc --noEmit` is the gate.

**Files:**
- Modify: `src/lib/extraction/anthropic.ts`
- Modify: `src/lib/extraction/google.ts`
- Modify: `src/lib/extraction/deepseek.ts`
- Modify: `src/lib/extraction/index.ts`
- Modify: `src/lib/invoices/process-extraction.ts`
- Modify: `src/app/api/invoices/upload/route.ts`

**Before writing any of this:** the expected SDK field names below (`response.usage.input_tokens`,
`response.usageMetadata.promptTokenCount`, `body.usage.prompt_tokens`) are what the installed
versions are believed to return. Verify each against the actual installed SDK — check
`node_modules/@anthropic-ai/sdk` and `node_modules/@google/genai` type definitions, or log one
real response — and adjust the property access if it differs. Do not adjust the shape of
`ExtractionUsage` to match an SDK; map into it.

- [ ] **Step 1: Update the Anthropic wrapper**

In `src/lib/extraction/anthropic.ts`, change the import to pull in the result type:

```ts
import {
  EXTRACTION_PROMPT,
  InvoiceExtractionSchema,
  type ExtractionInput,
  type ExtractionResult,
} from "./schema";
```

Change the signature:

```ts
export async function extractWithAnthropic(
  input: ExtractionInput,
): Promise<ExtractionResult> {
```

Replace the final `return response.parsed_output;` with:

```ts
  return {
    extraction: response.parsed_output,
    usage: {
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
    },
  };
```

`response.model` is the model the API actually ran, which is more trustworthy than re-reading
the env var.

- [ ] **Step 2: Update the Google wrapper**

In `src/lib/extraction/google.ts`, change the import:

```ts
import {
  EXTRACTION_PROMPT,
  InvoiceExtractionSchema,
  type ExtractionInput,
  type ExtractionResult,
} from "./schema";
```

Change the signature:

```ts
export async function extractWithGoogle(
  input: ExtractionInput,
): Promise<ExtractionResult> {
```

Replace the final `return InvoiceExtractionSchema.parse(JSON.parse(text));` with:

```ts
  return {
    extraction: InvoiceExtractionSchema.parse(JSON.parse(text)),
    usage: {
      model: process.env.GOOGLE_EXTRACTION_MODEL || DEFAULT_MODEL,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    },
  };
```

- [ ] **Step 3: Update the DeepSeek wrapper**

In `src/lib/extraction/deepseek.ts`, change the import:

```ts
import {
  EXTRACTION_PROMPT,
  InvoiceExtractionSchema,
  type ExtractionInput,
  type ExtractionResult,
} from "./schema";
```

Change the signature:

```ts
export async function extractWithDeepseek(
  input: ExtractionInput,
): Promise<ExtractionResult> {
```

Widen the response body type to include the fields we now read:

```ts
  const body = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
```

Replace the final `return InvoiceExtractionSchema.parse(JSON.parse(content));` with:

```ts
  return {
    extraction: InvoiceExtractionSchema.parse(JSON.parse(content)),
    usage: {
      model: body.model ?? process.env.DEEPSEEK_EXTRACTION_MODEL ?? DEFAULT_MODEL,
      inputTokens: body.usage?.prompt_tokens ?? null,
      outputTokens: body.usage?.completion_tokens ?? null,
    },
  };
```

- [ ] **Step 4: Update the dispatcher**

Rewrite `src/lib/extraction/index.ts` as:

```ts
import "server-only";
import type { ExtractionInput, ExtractionResult, InvoiceExtraction } from "./schema";
import { buildExtractionMetrics, type ExtractionMetrics } from "./usage";
import { extractWithAnthropic } from "./anthropic";
import { extractWithGoogle } from "./google";
import { extractWithDeepseek } from "./deepseek";

export type { ExtractionInput, InvoiceExtraction } from "./schema";
export type { ExtractionMetrics } from "./usage";

/** What one extraction produced, plus what it cost to produce it. */
export type ExtractionOutcome = {
  extraction: InvoiceExtraction;
  metrics: ExtractionMetrics;
};

// Which model reads invoices. Override per deployment via EXTRACTION_PROVIDER.
//   anthropic → Claude Haiku 4.5  (PDF / image / HTML)
//   google    → Gemini 2.5 Flash  (PDF / image / HTML)
//   deepseek  → DeepSeek Chat      (HTML / text only)
type Provider = "anthropic" | "google" | "deepseek";

const providers: Record<Provider, (input: ExtractionInput) => Promise<ExtractionResult>> = {
  anthropic: extractWithAnthropic,
  google: extractWithGoogle,
  deepseek: extractWithDeepseek,
};

function resolveProvider(): Provider {
  const configured = (process.env.EXTRACTION_PROVIDER || "anthropic").toLowerCase();
  if (configured in providers) return configured as Provider;
  throw new Error(
    `Unknown EXTRACTION_PROVIDER "${configured}" — use anthropic, google, or deepseek.`,
  );
}

export async function extractInvoice(input: ExtractionInput): Promise<ExtractionOutcome> {
  const provider = resolveProvider();
  // Timed here rather than in each wrapper: this is the one layer that knows
  // which provider ran, and it keeps the wrappers free of timing code.
  const startedAt = Date.now();
  const result = await providers[provider](input);
  return {
    extraction: result.extraction,
    metrics: buildExtractionMetrics({
      provider,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
    }),
  };
}
```

- [ ] **Step 5: Update the two call sites so the build compiles**

Both files currently do `const extracted = await extractInvoice(input);`. Replace that line in
**each** file with:

```ts
  const { extraction: extracted } = await extractInvoice(input);
```

Destructure only `extraction` here, not `metrics`: nothing consumes metrics until Task 4, and
an unused variable would fail lint and leave this task's gate red. Task 4 widens the
destructure at the same moment it starts using the value.

- [ ] **Step 6: Verify the whole thing still builds and passes**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: 233+ tests pass, typecheck silent, lint clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/extraction src/lib/invoices/process-extraction.ts src/app/api/invoices/upload/route.ts
git commit -m "feat: return token usage from extraction providers"
```

---

## Task 4: Record metrics on the invoice row

**Files:**
- Modify: `src/lib/invoices/process-extraction.ts`
- Modify: `src/app/api/invoices/upload/route.ts`

- [ ] **Step 1: Capture metrics in the email path**

In `src/lib/invoices/process-extraction.ts`, change the destructure back to include metrics:

```ts
  const { extraction: extracted, metrics } = await extractInvoice(input);
```

Then add these five fields to the object passed to `supabase.from("invoices").upsert(...)`,
directly after `raw_extracted_json: extracted,`:

```ts
      extraction_provider: metrics.provider,
      extraction_model: metrics.model,
      extraction_input_tokens: metrics.inputTokens,
      extraction_output_tokens: metrics.outputTokens,
      extraction_ms: metrics.durationMs,
```

- [ ] **Step 2: Capture metrics in the upload path**

In `src/app/api/invoices/upload/route.ts`, change the destructure the same way:

```ts
  const { extraction: extracted, metrics } = await extractInvoice(input);
```

And add the same five fields to its `.upsert(...)` object, after `raw_extracted_json: extracted,`:

```ts
        extraction_provider: metrics.provider,
        extraction_model: metrics.model,
        extraction_input_tokens: metrics.inputTokens,
        extraction_output_tokens: metrics.outputTokens,
        extraction_ms: metrics.durationMs,
```

Note the indentation differs between the two files (the upload route's upsert object is nested
one level deeper) — match the surrounding code in each.

- [ ] **Step 3: Verify**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: all green, no unused-variable warnings.

- [ ] **Step 4: Commit**

```bash
git add src/lib/invoices/process-extraction.ts src/app/api/invoices/upload/route.ts
git commit -m "feat: record extraction cost on each invoice"
```

---

## Task 5: Content-hash dedupe on the email path

The upload path already does this (`src/app/api/invoices/upload/route.ts:56-70`). This brings
the email path to parity, with one extra rule: a Trigger.dev retry re-processing the same
attachment must not be counted as a user duplicate.

**Files:**
- Modify: `src/lib/invoices/process-extraction.ts`

- [ ] **Step 1: Import the hasher**

Add to the imports at the top of `src/lib/invoices/process-extraction.ts`:

```ts
import { sha256Hex } from "@/lib/file-hash";
```

- [ ] **Step 2: Hash and look up before extracting**

Insert this immediately after the `const { supabase, userId, messageId, sourceRef, input, fileBuffer, fileName } = params;`
destructure and **before** the `extractInvoice` call:

```ts
  // Same file, seen before → reuse the invoice instead of paying for another
  // extraction. Only attachments can be hashed; an HTML body has no buffer.
  const contentHash = fileBuffer ? sha256Hex(fileBuffer) : null;

  if (contentHash) {
    const { data: existing } = await supabase
      .from("invoices")
      .select("id, vendor, amount, currency, source_message_id, source_ref, duplicate_hit_count")
      .eq("user_id", userId)
      .eq("content_hash", contentHash)
      .maybeSingle();

    if (existing) {
      // A task retry re-runs this function from scratch and finds the row the
      // previous attempt saved. That is our own retry, not a second arrival
      // from the user, so it must not inflate the counter.
      const isSameSource =
        existing.source_message_id === messageId && existing.source_ref === sourceRef;

      if (!isSameSource) {
        const { error: hitError } = await supabase
          .from("invoices")
          .update({ duplicate_hit_count: (existing.duplicate_hit_count ?? 0) + 1 })
          .eq("id", existing.id);
        if (hitError) {
          console.error("Failed to record duplicate extraction hit", userId, hitError);
        }
      }

      return {
        saved: true,
        invoice: {
          vendor: existing.vendor,
          amount: existing.amount,
          currency: existing.currency,
        },
      };
    }
  }
```

A failed counter update is logged and swallowed on purpose: losing a metric tick is not worth
failing a user's forwarded invoice.

- [ ] **Step 3: Store the hash on new rows**

In the same file, add `content_hash: contentHash,` to the upsert object, directly after
`source_ref: sourceRef,`.

- [ ] **Step 4: Handle the unique-violation race**

The upsert currently ignores its result entirely. Now that email rows carry a content hash,
two attachments with identical content processed concurrently can both miss the lookup and
both insert, and one will violate `invoices_user_content_hash_key`. Replace:

```ts
  await supabase.from("invoices").upsert(
```

with a captured result — change that line to:

```ts
  const { error: upsertError } = await supabase.from("invoices").upsert(
```

and insert this block immediately after the upsert call's closing `);`:

```ts
  if (upsertError) {
    // 23505 = unique violation. A concurrent attachment with the same content
    // hash won the race; treat this one as a duplicate rather than failing.
    if (upsertError.code === "23505" && contentHash) {
      const { data: winner } = await supabase
        .from("invoices")
        .select("vendor, amount, currency")
        .eq("user_id", userId)
        .eq("content_hash", contentHash)
        .maybeSingle();
      if (winner) {
        return {
          saved: true,
          invoice: {
            vendor: winner.vendor,
            amount: winner.amount,
            currency: winner.currency,
          },
        };
      }
    }
    console.error("Failed to save extracted invoice", userId, upsertError);
    throw new Error("Could not save the extracted invoice");
  }
```

Throwing on an unexpected save failure is a deliberate improvement over the current silent
success: Trigger.dev then retries the task, and its `onFailure` hook sends the sender an error
reply instead of the task reporting a save that never happened. This matches
`.claude/rules/errors.md` — unexpected failures throw and are caught at the boundary.

- [ ] **Step 5: Verify**

Run: `npm run test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/invoices/process-extraction.ts
git commit -m "feat: dedupe email attachments by content hash"
```

---

## Task 6: Count duplicate uploads too

The upload route already returns the existing invoice on a hash hit; it just doesn't count it.
Without this, `sum(duplicate_hit_count)` only tells half the story.

**Files:**
- Modify: `src/app/api/invoices/upload/route.ts`

- [ ] **Step 1: Increment the counter on the existing duplicate branch**

Replace this block (around line 68):

```ts
  if (existing) {
    return NextResponse.json({ invoice: existing, duplicate: true });
  }
```

with:

```ts
  if (existing) {
    const { error: hitError } = await service
      .from("invoices")
      .update({ duplicate_hit_count: (existing.duplicate_hit_count ?? 0) + 1 })
      .eq("id", existing.id);
    if (hitError) {
      console.error("Failed to record duplicate upload hit", user.id, hitError);
    }
    return NextResponse.json({ invoice: existing, duplicate: true });
  }
```

The existing lookup uses `.select()` with no argument, so it already returns every column
including `duplicate_hit_count` — no query change needed.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invoices/upload/route.ts
git commit -m "feat: count duplicate uploads"
```

---

## Task 7: Manual verification

Extraction call sites, Server Actions, and API routes are not unit-tested in this project
(`.claude/rules/testing.md`) — they get a manual pass instead.

**Files:** none (verification only)

- [ ] **Step 1: Start the local stack**

```bash
npx supabase start
```

Copy the printed `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY` into `.env.local` along with a
real key for whichever `EXTRACTION_PROVIDER` you test with. Start the dev server with the
preview tool (never `npm run dev` through Bash), and start `npx trigger.dev@latest dev` in a
second terminal so inbound-email tasks actually run.

- [ ] **Step 2: Verify metrics are written**

Upload an invoice PDF through `/dashboard/invoices`. Then read the row back (substitute your
service key):

```bash
curl -sS "http://127.0.0.1:54321/rest/v1/invoices?select=id,extraction_provider,extraction_model,extraction_input_tokens,extraction_output_tokens,extraction_ms&order=created_at.desc&limit=1" -H "apikey: <SERVICE_KEY>" -H "Authorization: Bearer <SERVICE_KEY>"
```

Expected: provider and model populated, both token counts non-null integers, `extraction_ms`
a plausible latency (hundreds to a few thousand).

- [ ] **Step 3: Verify upload dedupe counts**

Upload the exact same file again. Expected: the response is the existing invoice with
`duplicate: true`, no new row is created, and re-running the curl above shows
`duplicate_hit_count` incremented to 1 on that row.

- [ ] **Step 4: Verify email dedupe counts**

Forward an email with a PDF attachment to the workspace address, wait for the Trigger.dev task
to finish, then forward the **same attachment again from a different message**. Expected: one
invoice row total, `duplicate_hit_count = 1`, and the second run finishes noticeably faster
because no model call happened. Confirm in the Trigger.dev dev-server output that the second
run did not log an extraction.

- [ ] **Step 5: Verify a retry does not inflate the counter**

In the Trigger.dev dashboard, replay the first successful run. Expected: the run succeeds,
returns the same invoice, and `duplicate_hit_count` stays where it was — the same-source check
suppressed the increment.

- [ ] **Step 6: Verify missing usage degrades gracefully**

Temporarily edit the wrapper for your configured provider to return
`usage: { model: "test", inputTokens: null, outputTokens: null }`, upload a new file, and
confirm the invoice still saves with null token columns and a populated `extraction_ms`.
Revert the edit afterwards.

- [ ] **Step 7: Verify nothing else regressed**

Forward an HTML-body invoice (no attachment) and confirm it still extracts and saves.
Forward a non-invoice attachment and confirm it is still rejected without creating a row.

---

## Task 8: Document the columns and run the full gate

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the new columns**

Add this section to `README.md`, immediately after the "Scripts" table:

````markdown
## Extraction cost

Every invoice records what it cost to extract:

| Column | Meaning |
| --- | --- |
| `extraction_provider` | `anthropic`, `google`, or `deepseek` |
| `extraction_model` | The model that actually ran |
| `extraction_input_tokens` / `extraction_output_tokens` | Token counts, `null` when the provider didn't report them |
| `extraction_ms` | End-to-end latency of the provider call |
| `duplicate_hit_count` | How many times the identical file arrived again and reused this row instead of paying for a new extraction |

Spend and dedupe savings for a month:

```sql
select
  extraction_provider,
  count(*)                          as extractions,
  sum(extraction_input_tokens)      as input_tokens,
  sum(extraction_output_tokens)     as output_tokens,
  sum(duplicate_hit_count)          as calls_avoided,
  round(avg(extraction_ms))         as avg_ms
from invoices
where created_at >= date_trunc('month', now())
group by extraction_provider;
```

Documents the model rejects (`is_invoice = false`) cost a call but produce no row, so they
appear in logs only — see
[`docs/superpowers/specs/2026-07-29-extraction-cost-visibility-design.md`](docs/superpowers/specs/2026-07-29-extraction-cost-visibility-design.md).
````

- [ ] **Step 2: Run the full gate**

```bash
npm run test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all four succeed. Fix anything that fails before committing — do not commit over a
red gate.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document extraction cost columns"
```

---

## Done when

- [ ] `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
- [ ] Task 7's seven manual checks all pass against the local stack.
- [ ] A freshly extracted invoice carries provider, model, both token counts, and latency.
- [ ] The same file forwarded twice produces one row with `duplicate_hit_count = 1`, and a
      Trigger.dev retry of the same message leaves that counter alone.
