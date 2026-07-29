# Extraction Dedupe and Cost Visibility

**Date:** 2026-07-29
**Status:** Approved for implementation
**Source:** `Invoice_Reader_Product_Ideas.md` §1 (Cached document), plus the measurement gap
found while deferring [`2026-07-29-extraction-routing-design.md`](2026-07-29-extraction-routing-design.md)

## Goal

Two gaps, one purpose: stop paying twice for the same file, and start recording what
extraction actually costs.

**Duplicate spend.** The upload path already dedupes on a SHA-256 of the file
(`src/app/api/invoices/upload/route.ts:56-70`): hash, look up `content_hash`, return the
existing invoice without an LLM call. The email path has no equivalent — `processExtraction`
dedupes only on `(user_id, source_message_id, source_ref)`, which catches a task retry
re-processing the same message but nothing else. The same PDF arriving from a second sender,
a re-forward, or a CC'd copy pays full price again.

**No measurement.** Nothing in `src/lib/extraction/` records tokens, cost, or latency. That
is why routing was deferred: the saving depends on a text-PDF-to-scan ratio nobody has
measured, and there is no baseline to compare against. Every optimization decision after this
one needs this data.

These ship together because they meet at the number that matters — how many model calls were
avoided. Measuring before the cache exists would establish the wrong baseline.

## Scope decision

| Item | Decision |
| --- | --- |
| Content-aware provider routing | Deferred, see the routing spec. Revisit once this telemetry has run for a while |
| Known-template regex parser | Deferred. Needs repeat-vendor data this telemetry will produce |
| Per-attachment task split (§2) | Separate spec. Reliability, not cost |
| Landing positioning (§5/§7) | Separate spec. Pure copy |
| Hashing the HTML email body | Out of scope. Body-only invoices are the minority, and HTML varies between sends of the same content, so a hash would rarely hit |

## Design decisions

**Metrics live as columns on `invoices`, not in a new table.** Every invoice carries the cost
of producing it, aggregation is one query, and no new RLS policies or grants are needed since
`invoices` already has them. A dedicated `extraction_events` table was considered and
rejected: it would capture more (see the known limitation below) at the price of a new table,
new policies, and a retention plan for a table that only grows.

**A cache hit reuses the existing invoice and creates no second row.** This mirrors what the
upload path already returns (`{ invoice, duplicate: true }`) and keeps one invoice per unique
file per user. The alternative — inserting a second row that points at the same extraction —
would need the `invoices_user_content_hash_key` constraint relaxed and would show users the
same bill twice.

On the email path a cache hit still returns `{ saved: true, invoice }` from
`processExtraction`, so the auto-reply lists the invoice as processed. From the sender's point
of view the forward worked and the bill is in their dashboard, which is true — it just cost
nothing this time. Reporting it as skipped would read as a failure.

**Providers return usage; the dispatcher adds provider name and timing.** Each layer reports
only what it actually knows: the wrapper knows the model and token counts from its own SDK
response, `extractInvoice()` in `index.ts` knows which provider it dispatched to and can time
the call in one place instead of repeating timing code in all three wrappers.

**`duplicate_hit_count` is the metric that justifies the cache.** Incrementing a counter on
the original invoice each time the same file arrives again means `sum(duplicate_hit_count)`
answers "how many model calls did dedupe avoid" directly, without a second table and without
parsing logs.

## Architecture

```text
email attachment / uploaded file
        │
        ▼
   sha256Hex(buffer)
        │
        ├── hash found for this user
        │       → duplicate_hit_count += 1
        │       → return the existing invoice        (no LLM call)
        │
        └── hash not found
                → extractInvoice(input)
                     └── providers[provider](input) → { extraction, usage }
                     └── wrap with provider name + durationMs
                → save invoice + content_hash + extraction metrics
```

## Components

| File | Created / Modified | Responsibility |
| --- | --- | --- |
| `supabase/migrations/20260729120000_invoice_extraction_metrics.sql` | Create | Adds the six columns below, all nullable or defaulted |
| `src/lib/extraction/schema.ts` | Modify | Add `ExtractionUsage` and `ExtractionResult` types |
| `src/lib/extraction/anthropic.ts` | Modify | Return `{ extraction, usage }` from `response.usage` |
| `src/lib/extraction/google.ts` | Modify | Return `{ extraction, usage }` from `response.usageMetadata` |
| `src/lib/extraction/deepseek.ts` | Modify | Return `{ extraction, usage }` from the response body's `usage` |
| `src/lib/extraction/index.ts` | Modify | Time the provider call, attach the provider name, return `ExtractionResult` |
| `src/lib/extraction/usage.ts` | Create | `buildExtractionMetrics({ provider, usage, durationMs })` — pure, normalizes missing or nonsensical token counts |
| `src/lib/extraction/usage.test.ts` | Create | Boundary tests for the normalizer |
| `src/lib/invoices/process-extraction.ts` | Modify | Hash lookup before extraction, duplicate increment, write metrics on save |
| `src/app/api/invoices/upload/route.ts` | Modify | Increment `duplicate_hit_count` on its existing duplicate branch; write metrics on save |
| `README.md` | Modify | Document the new columns and how to query cost |

## Migration

```sql
alter table public.invoices
  add column extraction_provider text,
  add column extraction_model text,
  add column extraction_input_tokens integer,
  add column extraction_output_tokens integer,
  add column extraction_ms integer,
  add column duplicate_hit_count integer not null default 0;
```

Purely additive: existing rows keep working with nulls and a zero counter, matching the
additive-migration preference in `.claude/rules/data-safety.md`. No new RLS policies or grants
— `invoices` already carries both.

## The usage normalizer

`buildExtractionMetrics` is the one piece of real logic here, so it is a pure function and the
only new unit-tested unit:

```ts
type ExtractionUsage = {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

type ExtractionMetrics = {
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
};
```

It coerces anything unusable to `null` rather than writing junk into the table: missing
fields, `undefined`, `NaN`, negative counts, and non-integers. Token counts are diagnostic —
a wrong number is worse than no number, because a wrong one will be summed into a cost report
and believed.

## Error handling

Following `.claude/rules/errors.md`:

- **Concurrent inserts of the same hash.** Two attachments carrying the same file can both
  miss the lookup and both insert; one violates `invoices_user_content_hash_key`. Catch
  Postgres error code `23505`, re-read the existing row, and treat it as a duplicate — the
  same pattern `createInbox()` already uses at
  [`src/app/dashboard/actions.ts:56`](../../../src/app/dashboard/actions.ts).
- **A task retry is not a duplicate arrival.** Trigger.dev re-runs the whole task function on
  retry, so attempt two hashes the same attachment and finds the row attempt one already
  saved. Incrementing `duplicate_hit_count` there would count our own retries as user
  duplicates and corrupt the only metric this feature exists to produce. The counter is
  therefore incremented **only when the existing row came from a different
  `(source_message_id, source_ref)`**; a same-source hit returns the invoice untouched.
- **Usage missing from an SDK response.** Store `null` and continue. Metrics must never block
  saving an invoice; the invoice is the product, the numbers are diagnostics.
- **The `duplicate_hit_count` increment fails.** Log with context
  (`console.error("Failed to record duplicate extraction hit", userId, error)`) and still
  return the existing invoice. A lost counter tick is not worth failing a user's forward over.
- **SDK field names.** `usage.input_tokens` (Anthropic), `usageMetadata.promptTokenCount`
  (Google), `usage.prompt_tokens` (DeepSeek) are the expected shapes, but each must be
  verified against the installed SDK version during implementation rather than assumed.

## Known limitation

A document the model rejects (`is_invoice=false`) costs a real LLM call but produces no
invoice row, so its cost never reaches the table — only the logs. Same for the model call
avoided on a cache hit, which is captured as a counter rather than a cost. Capturing every
call would require the `extraction_events` table rejected above. This is an accepted gap: the
majority of spend is on documents that do become invoices, and those are recorded exactly.

## Testing

Unit tests (Vitest, per `.claude/rules/testing.md`):

- `src/lib/extraction/usage.test.ts` — missing usage object, missing individual fields, `NaN`,
  negative counts, floats, zero tokens (valid, must stay `0` and not become `null`), and a
  normal well-formed response.

Not unit-tested, matching existing convention: the three provider wrappers (thin SDK
wrappers), `processExtraction` and the upload route (I/O plus orchestration).

Manual verification against the local stack:

1. Forward a PDF, then forward the identical PDF again from a different message. Expect: one
   invoice row, `duplicate_hit_count = 1`, and no second model call (confirm via the provider's
   own dashboard or by watching latency drop to near-zero on the second run).
2. Upload the same file twice through the UI. Expect the existing duplicate response, now with
   the counter incremented.
3. Check a freshly-created invoice row: `extraction_provider`, `extraction_model`,
   `extraction_input_tokens`, `extraction_output_tokens`, `extraction_ms` all populated.
4. Simulate a provider response without usage (temporarily strip the field) and confirm the
   invoice still saves with null metrics.
5. Existing flows unchanged: a non-duplicate email attachment, an HTML-body invoice, and a
   rejected non-invoice all behave exactly as before.

Gates: `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Out of scope

Provider routing, template parsing, the per-attachment task split, landing copy, and any
cost-reporting UI. Once the columns are populated, a dashboard view can be specced separately
if the numbers turn out to be worth showing.
