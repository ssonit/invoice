# Local-First Extraction Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route text-based PDFs through local extraction (`@firecrawl/pdf-inspector`) plus a cheap text-only LLM call instead of the current full vision (document/image content block) call, escalating back to vision automatically when local confidence is low or classification fails.

**Architecture:** `extractInvoice()` in `src/lib/extraction/index.ts` gains a branch for `type: "pdf"` inputs only. It classifies the PDF locally (`pdf-classify.ts`, wrapping `@firecrawl/pdf-inspector`); a confident `TextBased` result with extracted markdown is sent through the existing provider dispatch as a new cheap `{ type: "text" }` input instead of the raw file; a low-confidence result escalates to today's unchanged `{ type: "pdf" }` vision call. Every other input type (`image`, `html`) is untouched. Both call sites (`upload/route.ts`, `process-extraction.ts`) already just call `extractInvoice()` and read back `{ extraction, metrics }` — neither needs new logic, only one new field to persist.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres, untyped `supabase-js` client), Trigger.dev background tasks, Anthropic / Google GenAI / DeepSeek SDKs, `@firecrawl/pdf-inspector` (Rust/napi), Vitest.

**Spec:** [`docs/superpowers/specs/2026-09-05-local-extraction-routing-design.md`](../specs/2026-09-05-local-extraction-routing-design.md)

## Global Constraints

- Purely additive migration — new column is nullable, no backfill, no RLS/grant changes (`invoices` already has both). See `.claude/rules/data-safety.md`.
- Provider/model selection is unchanged — `EXTRACTION_PROVIDER` still picks the model. This plan only changes what content block is sent to it for the PDF case.
- Photo/image uploads (`png`/`jpg`/`webp`/`gif`) are untouched — `pdf-inspector` is PDF-only.
- No call in this plan reaches a Firecrawl-hosted endpoint (no `--ocr hosted`, no hosted-fallback) — zero added run-cost.
- Classification/local-extraction failure must never fail an upload — always fail safe to the existing vision path.
- Third-party wrapper files (`pdf-classify.ts`, `anthropic.ts`, `google.ts`, `deepseek.ts`) are not unit-tested, per `.claude/rules/testing.md` — verified manually instead. Pure logic (`usage.ts`) is unit-tested.
- One confidence threshold, named once (`EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD = 0.7`), reused for both `needs_review` and the escalation decision — no second inline `0.7`.
- `@firecrawl/pdf-inspector`'s exact TypeScript field names (`classifyPdfAsync`, `extractPagesMarkdownAsync` result shapes) must be confirmed against the installed package before Task 5's implementation step — verify, don't assume.

---

## File Structure

| File | Created / Modified | Responsibility |
| --- | --- | --- |
| `supabase/migrations/20260905120000_invoice_extraction_method.sql` | Create | Adds `extraction_method text` to `invoices` |
| `src/constants/extraction.ts` | Create | `EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD` |
| `src/lib/extraction/usage.ts` | Modify | `ExtractionMetrics.method` + `buildExtractionMetrics` passthrough |
| `src/lib/extraction/usage.test.ts` | Modify | Cover `method` default and passthrough |
| `src/lib/extraction/schema.ts` | Modify | Add `{ type: "text"; text: string }` to `ExtractionInput` |
| `src/lib/extraction/anthropic.ts` | Modify | Handle `type: "text"` |
| `src/lib/extraction/google.ts` | Modify | Handle `type: "text"` |
| `src/lib/extraction/deepseek.ts` | Modify | Accept `type: "text"` alongside `"html"` |
| `src/lib/extraction/pdf-classify.ts` | Create | `classifyPdf(buffer)` wrapping `@firecrawl/pdf-inspector` |
| `src/lib/extraction/index.ts` | Modify | `extractInvoice()` routing logic for `type: "pdf"` |
| `src/app/api/invoices/upload/route.ts` | Modify | Use the named threshold; save `extraction_method` |
| `src/lib/invoices/process-extraction.ts` | Modify | Same two changes |
| `package.json` | Modify | Add `@firecrawl/pdf-inspector` |
| `README.md` | Modify | Document `extraction_method` |

---

## Task 1: Migration

**Files:**
- Create: `supabase/migrations/20260905120000_invoice_extraction_method.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Records how a PDF extraction was produced: "local_text" (pdf-inspector
-- extracted the text locally; only a cheap text-only LLM call was made),
-- "vision" (sent as a document/image block to a vision model — today's
-- original behavior), or "vision_fallback" (local extraction was tried but
-- its confidence was too low, so it re-ran through vision). Null for image
-- and HTML-body inputs, which this feature does not route.
alter table public.invoices
  add column extraction_method text;
```

No RLS policies or grants are needed: `invoices` already has both, and adding a column to an
existing table inherits them.

- [ ] **Step 2: Apply it to the local database**

Run: `npx supabase migration up`
Expected: the new migration is listed as applied, no errors.

- [ ] **Step 3: Verify the column exists**

```bash
npx supabase status
```

Copy the printed `SERVICE_ROLE_KEY`, then:

```bash
curl -sS "http://127.0.0.1:54321/rest/v1/invoices?select=id,extraction_method&limit=1" -H "apikey: <SERVICE_KEY>" -H "Authorization: Bearer <SERVICE_KEY>"
```

Expected: HTTP 200 with `[]` or a row — **not** an error mentioning that a column does not
exist.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260905120000_invoice_extraction_method.sql
git commit -m "feat: add extraction_method column to invoices"
```

---

## Task 2: Named confidence threshold

**Files:**
- Create: `src/constants/extraction.ts`
- Modify: `src/app/api/invoices/upload/route.ts`
- Modify: `src/lib/invoices/process-extraction.ts`

- [ ] **Step 1: Create the constant**

`src/constants/extraction.ts`:

```ts
// Confidence below which an extraction is flagged for manual review
// (`needs_review`), and below which a local text-only extraction escalates
// to the full vision model instead of being trusted as-is.
export const EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD = 0.7;
```

- [ ] **Step 2: Use it in the upload route**

In `src/app/api/invoices/upload/route.ts`, add the import alongside the existing ones:

```ts
import { EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD } from "@/constants/extraction";
```

Replace:

```ts
        needs_review: extracted.confidence_score < 0.7,
```

with:

```ts
        needs_review: extracted.confidence_score < EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD,
```

- [ ] **Step 3: Use it in the email extraction path**

In `src/lib/invoices/process-extraction.ts`, add the same import, then replace:

```ts
      needs_review: extracted.confidence_score < 0.7,
```

with:

```ts
      needs_review: extracted.confidence_score < EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD,
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/constants/extraction.ts src/app/api/invoices/upload/route.ts src/lib/invoices/process-extraction.ts
git commit -m "refactor: name the extraction confidence review threshold"
```

---

## Task 3: `method` on extraction metrics

The pure-logic task — same shape as the existing `buildExtractionMetrics` normalizer, extended
with one more field. `method` defaults to `null` so this task ships without touching
`index.ts`, which still calls `buildExtractionMetrics` without a `method` argument until Task 6.

**Files:**
- Modify: `src/lib/extraction/usage.ts`
- Modify: `src/lib/extraction/usage.test.ts`

**Interfaces:**
- Produces: `ExtractionMetrics` now includes `method: "local_text" | "vision" | "vision_fallback" | null`. `buildExtractionMetrics(params)` accepts an optional `method` in `params`, defaulting to `null` when omitted.

- [ ] **Step 1: Write the failing tests**

In `src/lib/extraction/usage.test.ts`, update the first test's expectation and add two new
tests. Replace:

```ts
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
```

with:

```ts
  it("passes through a well-formed usage payload", () => {
    expect(
      buildExtractionMetrics({ provider: "anthropic", usage, durationMs: 812 }),
    ).toEqual({
      provider: "anthropic",
      model: "claude-haiku-4-5",
      inputTokens: 1200,
      outputTokens: 300,
      durationMs: 812,
      method: null,
    });
  });

  it("defaults method to null when not provided", () => {
    const metrics = buildExtractionMetrics({ provider: "anthropic", usage, durationMs: 1 });
    expect(metrics.method).toBeNull();
  });

  it("passes through an explicit method", () => {
    const metrics = buildExtractionMetrics({
      provider: "anthropic",
      usage,
      durationMs: 1,
      method: "local_text",
    });
    expect(metrics.method).toBe("local_text");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/extraction/usage.test.ts`
Expected: FAIL — the first test fails because the returned object has no `method` key yet;
the "explicit method" test fails the same way.

- [ ] **Step 3: Implement**

Replace the contents of `src/lib/extraction/usage.ts` with:

```ts
import type { ExtractionUsage } from "./schema";

export type ExtractionMetrics = {
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  // How the extraction was produced. Set by the caller that knows which
  // routing branch ran (see index.ts); null for input types this feature
  // doesn't route (image, html).
  method: "local_text" | "vision" | "vision_fallback" | null;
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
  method?: ExtractionMetrics["method"];
}): ExtractionMetrics {
  const { provider, usage, durationMs, method = null } = params;
  return {
    provider,
    model: usage.model,
    inputTokens: normalizeTokenCount(usage.inputTokens),
    outputTokens: normalizeTokenCount(usage.outputTokens),
    durationMs: Math.max(0, Math.round(durationMs)),
    method,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/extraction/usage.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Verify nothing else broke**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean — `index.ts` still calls `buildExtractionMetrics` without `method`, which is
now valid because the parameter is optional.

- [ ] **Step 6: Commit**

```bash
git add src/lib/extraction/usage.ts src/lib/extraction/usage.test.ts
git commit -m "feat: add method field to extraction metrics"
```

---

## Task 4: `text` input type across schema and providers

This changes a shared union type that every provider wrapper pattern-matches on, so the
wrappers must move together or the build breaks (adding a new union member turns the existing
final `else` in each wrapper into a compile error, since it can no longer assume the remaining
type is `html`). `npx tsc --noEmit` is the gate.

**Files:**
- Modify: `src/lib/extraction/schema.ts`
- Modify: `src/lib/extraction/anthropic.ts`
- Modify: `src/lib/extraction/google.ts`
- Modify: `src/lib/extraction/deepseek.ts`

**Interfaces:**
- Produces: `ExtractionInput` gains `{ type: "text"; text: string }`, a fourth variant alongside `pdf`/`image`/`html`. All three provider wrappers accept it and frame it as `"Extracted document text:\n\n${text}"` (distinct from the `"Email HTML content:\n\n"` framing used for `html`).

- [ ] **Step 1: Add the variant to the schema**

In `src/lib/extraction/schema.ts`, replace:

```ts
export type ExtractionInput =
  | { type: "pdf"; data: Buffer }
  | { type: "image"; data: Buffer; mimeType: string }
  | { type: "html"; html: string };
```

with:

```ts
export type ExtractionInput =
  | { type: "pdf"; data: Buffer }
  | { type: "image"; data: Buffer; mimeType: string }
  | { type: "html"; html: string }
  | { type: "text"; text: string };
```

- [ ] **Step 2: Handle it in the Anthropic wrapper**

In `src/lib/extraction/anthropic.ts`, replace:

```ts
  } else if (input.type === "image") {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: input.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: input.data.toString("base64"),
      },
    });
  } else {
    content.push({ type: "text", text: `Email HTML content:\n\n${input.html}` });
  }
```

with:

```ts
  } else if (input.type === "image") {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: input.mimeType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
        data: input.data.toString("base64"),
      },
    });
  } else if (input.type === "text") {
    content.push({ type: "text", text: `Extracted document text:\n\n${input.text}` });
  } else {
    content.push({ type: "text", text: `Email HTML content:\n\n${input.html}` });
  }
```

- [ ] **Step 3: Handle it in the Google wrapper**

In `src/lib/extraction/google.ts`, replace:

```ts
  } else if (input.type === "image") {
    parts.push({
      inlineData: { mimeType: input.mimeType, data: input.data.toString("base64") },
    });
  } else {
    parts.push({ text: `Email HTML content:\n\n${input.html}` });
  }
```

with:

```ts
  } else if (input.type === "image") {
    parts.push({
      inlineData: { mimeType: input.mimeType, data: input.data.toString("base64") },
    });
  } else if (input.type === "text") {
    parts.push({ text: `Extracted document text:\n\n${input.text}` });
  } else {
    parts.push({ text: `Email HTML content:\n\n${input.html}` });
  }
```

- [ ] **Step 4: Handle it in the DeepSeek wrapper**

DeepSeek is text-only already — `text` is its most natural input, alongside `html`. In
`src/lib/extraction/deepseek.ts`, replace:

```ts
  if (input.type !== "html") {
    throw new Error(
      "DeepSeek cannot read PDF/image attachments — set EXTRACTION_PROVIDER=anthropic or google for file input.",
    );
  }
```

with:

```ts
  if (input.type !== "html" && input.type !== "text") {
    throw new Error(
      "DeepSeek cannot read PDF/image attachments — set EXTRACTION_PROVIDER=anthropic or google for file input.",
    );
  }

  const userContent =
    input.type === "text"
      ? `Extracted document text:\n\n${input.text}`
      : `Email HTML content:\n\n${input.html}`;
```

Then replace the `user` message in the `messages` array:

```ts
        { role: "user", content: `Email HTML content:\n\n${input.html}` },
```

with:

```ts
        { role: "user", content: userContent },
```

- [ ] **Step 5: Verify**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: all existing tests pass, typecheck silent, lint clean. (`index.ts` and both call
sites don't reference `.type` directly, so nothing else needs to change for the build to stay
green.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/extraction/schema.ts src/lib/extraction/anthropic.ts src/lib/extraction/google.ts src/lib/extraction/deepseek.ts
git commit -m "feat: add text-only input type to extraction providers"
```

---

## Task 5: Local PDF classification wrapper

**Files:**
- Modify: `package.json` (dependency)
- Create: `src/lib/extraction/pdf-classify.ts`

**Interfaces:**
- Produces: `classifyPdf(data: Buffer): Promise<{ pdfType: string; markdown: string | null }>`. `markdown` is non-null only when the PDF is confidently `TextBased` and extraction produced non-empty content; every other case (including a thrown error from the native module) returns `markdown: null`. Never throws.

- [ ] **Step 1: Install the dependency**

```bash
npm install @firecrawl/pdf-inspector
```

Expected: `package.json` gains a `@firecrawl/pdf-inspector` entry (npm resolves a `^1.x`
range); `node_modules/@firecrawl/pdf-inspector-<platform>` (a platform-specific optional
dependency) is installed alongside it.

- [ ] **Step 2: Confirm the real API shape against a sample PDF**

Get any text-based PDF onto disk (a real invoice you have, or any webpage printed to PDF via
your browser's Print → Save as PDF). Run:

```bash
node --input-type=module -e "
import { classifyPdfAsync, extractPagesMarkdownAsync } from '@firecrawl/pdf-inspector';
import { readFileSync } from 'node:fs';
const pdf = readFileSync(process.argv[1]);
const classification = await classifyPdfAsync(pdf);
console.log(classification);
if (classification.pdfType === 'TextBased') {
  const result = await extractPagesMarkdownAsync(pdf);
  console.log(JSON.stringify(result, null, 2).slice(0, 2000));
}
" /path/to/your/sample.pdf
```

Expected: `classification` prints `{ pdfType: 'TextBased', pageCount, pagesNeedingOcr: [],
confidence }`, and the second call prints an object containing a `pages` array. Note the
exact key each page entry uses for its markdown string (the published API reference calls it
`pages`, e.g. `result.pages[0].markdown` — confirm against this actual output, since minor
versions can rename fields) — Step 3 below assumes `page.markdown`; adjust it if the real
output differs.

- [ ] **Step 3: Write the wrapper**

`src/lib/extraction/pdf-classify.ts`:

```ts
import "server-only";
import { classifyPdfAsync, extractPagesMarkdownAsync } from "@firecrawl/pdf-inspector";

export type PdfClassificationResult = {
  pdfType: string;
  // Non-null only when the PDF is confidently TextBased and extraction
  // produced non-empty content. Every other case — Scanned/ImageBased/Mixed,
  // an empty result, or a thrown error — returns null so the caller falls
  // back to sending the raw file to a vision model.
  markdown: string | null;
};

/**
 * Local, offline PDF classification + text extraction — no network call, no
 * LLM. Never throws: any failure from the native module is caught and
 * reported as an unclassifiable PDF (pdfType: "unknown", markdown: null) so
 * callers can treat it identically to a Scanned result.
 */
export async function classifyPdf(data: Buffer): Promise<PdfClassificationResult> {
  let classification: Awaited<ReturnType<typeof classifyPdfAsync>>;
  try {
    classification = await classifyPdfAsync(data);
  } catch (err) {
    console.error("PDF classification failed", err);
    return { pdfType: "unknown", markdown: null };
  }

  if (classification.pdfType !== "TextBased") {
    return { pdfType: classification.pdfType, markdown: null };
  }

  try {
    const { pages } = await extractPagesMarkdownAsync(data);
    const markdown = pages
      .map((page) => page.markdown)
      .join("\n\n")
      .trim();
    return { pdfType: classification.pdfType, markdown: markdown.length > 0 ? markdown : null };
  } catch (err) {
    console.error("PDF text extraction failed after TextBased classification", err);
    return { pdfType: classification.pdfType, markdown: null };
  }
}
```

If Step 2 showed a different field name than `page.markdown`, use the real one here instead —
this is the one place in the file that depends on it.

- [ ] **Step 4: Manual smoke test of the wrapper**

```bash
node --input-type=module -e "
import { classifyPdf } from './src/lib/extraction/pdf-classify.ts';
import { readFileSync } from 'node:fs';
const result = await classifyPdf(readFileSync(process.argv[1]));
console.log(result.pdfType, result.markdown?.length);
" /path/to/your/sample.pdf
```

If this errors on the `.ts` import (Node's native loader may not resolve it without a
transform), instead verify by temporarily importing `classifyPdf` at the top of
`src/lib/extraction/index.ts` behind a one-off `console.log(await classifyPdf(...))` using a
buffer read from a test fixture path, run `npm run test` (which goes through Vitest's
transform) to confirm it doesn't throw, then remove the temporary log line.

Expected: `pdfType` is `"TextBased"` and `markdown.length` is a plausible positive number for
your sample file.

- [ ] **Step 5: Verify the project still builds**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. (`pdf-classify.ts` is not imported anywhere yet, so nothing else changes.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/extraction/pdf-classify.ts
git commit -m "feat: add local PDF classification wrapper"
```

---

## Task 6: Route `extractInvoice()` through local extraction for PDFs

The integration task — wires Tasks 2–5 together. This is the only task that changes
`extractInvoice()`'s actual behavior; the previous tasks were purely additive.

**Files:**
- Modify: `src/lib/extraction/index.ts`

**Interfaces:**
- Consumes: `EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD` (Task 2), `ExtractionMetrics.method` + `buildExtractionMetrics({ ..., method })` (Task 3), `ExtractionInput` `{ type: "text"; text }` (Task 4), `classifyPdf(data): Promise<{ pdfType, markdown }>` (Task 5).
- Produces: `extractInvoice(input): Promise<ExtractionOutcome>` — **signature and return shape unchanged** from what both call sites already use.

- [ ] **Step 1: Rewrite the dispatcher**

Replace the contents of `src/lib/extraction/index.ts` with:

```ts
import "server-only";
import type { ExtractionInput, ExtractionResult, InvoiceExtraction } from "./schema";
import { buildExtractionMetrics, type ExtractionMetrics } from "./usage";
import { extractWithAnthropic } from "./anthropic";
import { extractWithGoogle } from "./google";
import { extractWithDeepseek } from "./deepseek";
import { classifyPdf } from "./pdf-classify";
import { EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD } from "@/constants/extraction";

export type { ExtractionInput, InvoiceExtraction } from "./schema";
export type { ExtractionMetrics } from "./usage";

/** What one extraction produced, plus what it cost to produce it. */
export type ExtractionOutcome = {
  extraction: InvoiceExtraction;
  metrics: ExtractionMetrics;
};

// Which model reads invoices. Override per deployment via EXTRACTION_PROVIDER.
//   anthropic → Claude Haiku 4.5  (PDF / image / HTML / text)
//   google    → Gemini 2.5 Flash  (PDF / image / HTML / text)
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

async function callProvider(
  provider: Provider,
  input: ExtractionInput,
  method: ExtractionMetrics["method"],
): Promise<ExtractionOutcome> {
  // Timed here rather than in each wrapper: this is the one layer that knows
  // which provider ran, and it keeps the wrappers free of timing code.
  const startedAt = Date.now();
  const result = await providers[provider](input);
  return {
    extraction: result.extraction,
    metrics: buildExtractionMetrics({
      provider,
      method,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
    }),
  };
}

export async function extractInvoice(input: ExtractionInput): Promise<ExtractionOutcome> {
  const provider = resolveProvider();

  // Only PDFs can carry a local text layer worth extracting — image and
  // HTML-body inputs are unchanged from today's behavior.
  if (input.type !== "pdf") {
    return callProvider(provider, input, null);
  }

  const classification = await classifyPdf(input.data);
  if (!classification.markdown) {
    return callProvider(provider, input, "vision");
  }

  const localOutcome = await callProvider(
    provider,
    { type: "text", text: classification.markdown },
    "local_text",
  );

  if (localOutcome.extraction.confidence_score >= EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD) {
    return localOutcome;
  }

  // Local extraction wasn't confident enough to trust — pay for the full
  // vision call instead of returning a low-quality result. The discarded
  // local call's cost is logged, not persisted: the invoice row records
  // whichever call actually produced its data, same convention as a
  // rejected (is_invoice=false) document costing a call with nothing to
  // show for it in the metrics columns.
  console.log("Local text extraction below confidence threshold, escalating to vision", {
    confidenceScore: localOutcome.extraction.confidence_score,
    threshold: EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD,
    discardedInputTokens: localOutcome.metrics.inputTokens,
    discardedOutputTokens: localOutcome.metrics.outputTokens,
  });

  return callProvider(provider, input, "vision_fallback");
}
```

- [ ] **Step 2: Verify the whole thing still builds and passes**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: all existing tests pass, typecheck silent, lint clean. Both call sites still
destructure `{ extraction, metrics }` (or just `{ extraction: extracted }` — check each
file), which remains valid since the return shape didn't change.

- [ ] **Step 3: Commit**

```bash
git add src/lib/extraction/index.ts
git commit -m "feat: route text-based PDFs through local extraction"
```

---

## Task 7: Persist `extraction_method` on saved invoices

**Files:**
- Modify: `src/app/api/invoices/upload/route.ts`
- Modify: `src/lib/invoices/process-extraction.ts`

- [ ] **Step 1: Save it on the upload path**

In `src/app/api/invoices/upload/route.ts`, add one field to the `.upsert(...)` object, directly
after `extraction_ms: metrics.durationMs,`:

```ts
        extraction_method: metrics.method,
```

- [ ] **Step 2: Save it on the email path**

In `src/lib/invoices/process-extraction.ts`, add the same field to its `.upsert(...)` object,
directly after `extraction_ms: metrics.durationMs,` (match that file's indentation, one level
shallower than the upload route's):

```ts
      extraction_method: metrics.method,
```

- [ ] **Step 3: Verify**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/invoices/upload/route.ts src/lib/invoices/process-extraction.ts
git commit -m "feat: record extraction_method on saved invoices"
```

---

## Task 8: Manual verification

Extraction call sites, API routes, and background tasks are not unit-tested in this project
(`.claude/rules/testing.md`) — they get a manual pass instead.

**Files:** none (verification only)

- [ ] **Step 1: Start the local stack**

```bash
npx supabase start
```

Copy the printed `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY` into `.env.local` along with a
real key for whichever `EXTRACTION_PROVIDER` you test with. Start the dev server with the
preview tool (never `npm run dev` through Bash).

- [ ] **Step 2: Verify a text-based PDF uses the cheap path**

Upload a real, text-based PDF invoice (not a scan/photo) through `/dashboard/invoices`. Read
the row back:

```bash
curl -sS "http://127.0.0.1:54321/rest/v1/invoices?select=id,extraction_method,extraction_input_tokens,extraction_output_tokens&order=created_at.desc&limit=1" -H "apikey: <SERVICE_KEY>" -H "Authorization: Bearer <SERVICE_KEY>"
```

Expected: `extraction_method = "local_text"`, and `extraction_input_tokens` noticeably lower
than a comparable vision call (a few hundred tokens, versus the thousands a document/image
block typically costs).

- [ ] **Step 3: Verify a scanned/photo file still uses vision**

Upload a scanned PDF or a plain photo (png/jpg) of a receipt. Re-run the curl from Step 2.
Expected: `extraction_method = "vision"`, and the invoice data is populated exactly as it was
before this change.

- [ ] **Step 4: Verify escalation on low local confidence**

Find or construct a text-based PDF with an unusual/garbled layout likely to produce a low
`confidence_score` from the local-text call (e.g. a PDF with heavy tables or multi-column
layout pdf-inspector's markdown conversion handles poorly). Upload it and check the row.
Expected: `extraction_method = "vision_fallback"`, not `"local_text"`, and the saved
`vendor`/`amount` fields look correct (i.e., the escalation actually produced a better
result). Check the dev server console for the "Local text extraction below confidence
threshold, escalating to vision" log line.

- [ ] **Step 5: Verify classification failure fails safe**

Temporarily edit `src/lib/extraction/pdf-classify.ts` to throw unconditionally at the top of
`classifyPdf` (e.g. `throw new Error("forced test failure");` as the first line of the
function body). Upload any PDF and confirm it still saves successfully with
`extraction_method = "vision"` (the safe fallback for an unclassifiable PDF) and a
`console.error("PDF classification failed", ...)` line in the dev server output. Revert the
edit afterward.

- [ ] **Step 6: Verify nothing else regressed**

- Forward an HTML-body-only email invoice (no attachment) — confirm it still extracts and
  saves with `extraction_method` left `null`.
- Upload the exact same PDF twice — confirm the second upload returns `duplicate: true` and
  does not re-run extraction at all (this path returns before `extractInvoice()` is ever
  called, so it's unaffected by this feature, but worth confirming no regression).
- Forward an obvious non-invoice attachment — confirm it's still rejected without creating a
  row.
- If you can, exhaust the Starter quota (or set `STARTER_MONTHLY_INVOICE_LIMIT=0`) and confirm
  uploads are still blocked before `extractInvoice()` runs (i.e., no local classification
  happens on a quota-blocked upload).

- [ ] **Step 7: Note the deploy-target caveat**

This environment's OS/architecture may not match the deployed platform's. `@firecrawl/pdf-inspector`
ships prebuilt binaries for Linux x64 (glibc) among others, which covers typical Vercel Node.js
function runtimes, but this cannot be confirmed from local manual testing. After the first
deploy that includes this change, check the build/runtime logs for a successful
`@firecrawl/pdf-inspector-<platform>` optional-dependency install and confirm at least one
real upload in that environment reaches `extraction_method = "local_text"` or `"vision"`
(either is fine — what matters is it doesn't throw on missing the native binary, which Task 6's
error handling would silently mask as an unconditional fallback to vision, so also check for
any repeated `"PDF classification failed"` log lines in production, which would mean the
native module never actually loaded there).

---

## Task 9: Document and run the full gate

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the new column**

Add this row to the "Extraction cost" table added by the prior cost-visibility work in
`README.md` (find the table with `extraction_provider`, `extraction_model`, etc.):

```markdown
| `extraction_method` | `local_text` (PDF text extracted locally, cheap text-only LLM call), `vision` (sent as a document/image block, today's original cost), `vision_fallback` (local extraction tried but escalated to vision), or `null` (image/HTML-body input, not routed by this feature) |
```

Also update the cost query shown immediately below that table to break down by method too —
replace:

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

with:

```sql
select
  extraction_provider,
  extraction_method,
  count(*)                          as extractions,
  sum(extraction_input_tokens)      as input_tokens,
  sum(extraction_output_tokens)     as output_tokens,
  sum(duplicate_hit_count)          as calls_avoided,
  round(avg(extraction_ms))         as avg_ms
from invoices
where created_at >= date_trunc('month', now())
group by extraction_provider, extraction_method;
```

- [ ] **Step 2: Run the full gate**

```bash
npm run test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all four succeed. Fix anything that fails before committing — do not commit over a
red gate.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document extraction_method column"
```

---

## Done when

- [ ] `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all pass.
- [ ] Task 8's manual checks all pass against the local stack, including the classification
      failure fail-safe.
- [ ] A text-based PDF upload saves with `extraction_method = "local_text"` and visibly fewer
      input tokens than the vision path.
- [ ] A scanned/photo upload saves with `extraction_method = "vision"`, unchanged from before
      this plan.
- [ ] A forced low-confidence local extraction saves with `extraction_method = "vision_fallback"`.
- [ ] Email attachment extraction, HTML-body extraction, content-hash dedupe, and Starter quota
      enforcement all behave exactly as before this plan.
