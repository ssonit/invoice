# Local-First Extraction Routing

**Date:** 2026-09-05
**Status:** Approved for implementation
**Source:** Follow-up to [`2026-07-29-extraction-cost-visibility-design.md`](2026-07-29-extraction-cost-visibility-design.md)
— that spec measured cost and deferred "content-aware provider routing" pending data. This
spec is that routing, scoped down to the change with the best cost/complexity ratio.

## Goal

Stop paying vision-model prices for a PDF that already carries its own text. Today
`extractInvoice()` sends every PDF and image as a base64 document/image content block to
whichever provider `EXTRACTION_PROVIDER` selects — same cost whether the file is a
five-page text-based invoice or a blurry phone photo of a receipt. A text-based PDF's
content can instead be pulled out locally, in milliseconds, for free, and handed to the
same model as plain text — a content block an order of magnitude cheaper in input tokens
than a document block, with no change to accuracy-relevant model choice.

This does not eliminate the LLM call for text-based PDFs — extracting structured fields
(vendor, amount, dates, line items) from arbitrary invoice layouts still needs a model.
It eliminates the *expensive* call: sending the raw file instead of its text.

## Scope decision

| Item | Decision |
| --- | --- |
| Local PDF classification + text extraction (`pdf-inspector`) | In scope |
| Apply to both the upload route and the email attachment path | In scope — both call `extractInvoice()`, so routing lives there once |
| Escalate to today's vision path when local confidence is low | In scope |
| Local OCR for scanned/image-based PDFs (`pdf-inspector`'s bundled PP-OCRv6, needs PDFium + ONNX Runtime) | Deferred — needs its own spec once `extraction_method` telemetry from this feature shows how much scanned volume remains |
| Hosted OCR (Firecrawl Parse, via `anydoc --ocr hosted` or pdf-inspector's hosted-fallback) | Deferred, same reason. Not used anywhere in this spec — nothing here calls a Firecrawl-hosted endpoint, so this ships at zero added run-cost |
| Expanding accepted upload formats (docx/xlsx/csv via `anydoc`) | Out of scope — separate feature, not a cost concern |
| Known-template regex parser | Still deferred, per the prior spec — unaffected by this change |
| Provider/model selection | Unchanged. `EXTRACTION_PROVIDER` still picks the model; this spec only changes what content block is sent to it for the PDF case |
| Photo/image uploads (png/jpg/webp/gif) | Unchanged — `pdf-inspector` is PDF-only, these have no text layer to extract, they keep going straight to the vision path |

## Design decisions

**Routing lives inside `extractInvoice()`, not at the call sites.** Both
`src/app/api/invoices/upload/route.ts` and `src/lib/invoices/process-extraction.ts` already
just call `extractInvoice(input)` and read back `{ extraction, metrics }`. Neither needs to
change: the branching on PDF type happens once, inside the function both already call. This
matches the existing swappable-backend dispatch pattern in `src/lib/extraction/index.ts` —
callers stay decoupled from how the extraction actually happens.

**A new `ExtractionInput` variant, not a reuse of `"html"`.** The existing `{ type: "html",
html }` variant exists for email bodies and its prompt framing says so explicitly
(`"Email HTML content:\n\n${input.html}"` in `anthropic.ts`). Feeding PDF-extracted markdown
through that path would mislabel it to the model. Add a sibling `{ type: "text"; text:
string }` variant with its own neutral framing (`"Extracted document text:\n\n${input.text}"`).
Each of the three provider wrappers (`anthropic.ts`, `google.ts`, `deepseek.ts`) gets one
new `else if` branch for it — small, mechanical, consistent with how they already branch on
`pdf` / `image` / `html`.

**Classification is a thin, unmeasured wrapper — new file, no unit test.** `pdf-classify.ts`
wraps the `@firecrawl/pdf-inspector` native binding the same way `anthropic.ts` wraps the
Anthropic SDK: it does I/O-adjacent work (native parsing) with no business logic of its own,
so it's verified manually rather than unit-tested, matching the existing convention for
`extraction/{anthropic,google,deepseek}.ts`.

**One confidence threshold, reused, now named.** `needs_review: extracted.confidence_score <
0.7` is already duplicated inline in `upload/route.ts:147` and `process-extraction.ts:126`.
This spec needs the identical threshold for its own escalation decision — a third inline
`0.7` would be one more place for the numbers to drift apart. Pull it into
`src/constants/extraction.ts` as `EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD` and point all three
call sites (the two existing `needs_review` checks, plus the new escalation check) at it.

**Escalation re-runs the existing vision path unchanged.** When the local-text extraction
comes back with `confidence_score` below the threshold, `extractInvoice()` calls
`providers[provider]({ type: "pdf", data: buffer })` — exactly what happens today for every
PDF. This is strictly additive: the worst case for a text-based PDF is one extra model call
(the cheap text one that triggered escalation) beyond what happens today; there is no case
where this path costs more than today's steady state for a PDF that would have failed
locally anyway.

**Classification failure fails safe to the vision path, not to an error.** If `pdf-inspector`
throws (corrupted PDF, unsupported PDF feature, native module unavailable), the invoice must
still get processed. Catch at the classification call and fall through to
`{ type: "pdf", data: buffer }` exactly as if the file had classified as `Scanned`.

**"Usable" local extraction means `pdfType === "TextBased"` and non-empty markdown — no
second confidence threshold.** `pdf-inspector` reports its own 0.0-1.0 confidence on the
*classification* (TextBased vs. Scanned/etc.), separate from the *extraction*
`confidence_score` the invoice model reports. Gating on the classifier's own confidence
too would need a second tuned threshold with no data yet to tune it against; the type +
non-empty-markdown check is the simpler bar, and a wrong classification is already caught
downstream by the existing escalation (a TextBased misclassification just produces a
low-confidence local extraction, which escalates to vision same as today). The exact field
name for this confidence value on the installed package version isn't used by this design,
but must still be checked against `node_modules/@firecrawl/pdf-inspector` during
implementation, same as the SDK usage field names were in the prior cost-visibility spec.

## Architecture

```text
ExtractionInput
        │
        ├── type: "image" ──────────────────────────────────► providers[provider](input)   [unchanged]
        │
        ├── type: "html" ───────────────────────────────────► providers[provider](input)   [unchanged]
        │
        └── type: "pdf"
                │
                ▼
          classifyPdf(data)   ← pdf-inspector, local, ~10-50ms, no network
                │
                ├── throws / pdfType ∈ {Scanned, ImageBased, Mixed} / no markdown
                │         │
                │         ▼
                │   providers[provider]({ type: "pdf", data })         [vision, unchanged path]
                │         → method: "vision"
                │
                └── pdfType = TextBased, markdown present
                          │
                          ▼
                    providers[provider]({ type: "text", text: markdown })   [same provider, text-only, cheap]
                          │
                          ├── confidence_score ≥ EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD
                          │         → method: "local_text"
                          │
                          └── confidence_score < EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD
                                    │
                                    ▼
                              providers[provider]({ type: "pdf", data })   [vision fallback]
                                    → method: "vision_fallback"
```

`extractInvoice()` keeps its existing signature and return shape
(`{ extraction, metrics }`); `metrics` grows one field, `method`, so callers that already
spread `metrics` onto the invoice row pick it up with a one-line addition each.

## Components

| File | Created / Modified | Responsibility |
| --- | --- | --- |
| `supabase/migrations/20260905120000_invoice_extraction_method.sql` | Create | Adds `extraction_method text` to `invoices`, nullable, additive |
| `src/constants/extraction.ts` | Create | `EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD = 0.7` |
| `src/lib/extraction/pdf-classify.ts` | Create | `classifyPdf(buffer): { pdfType, markdown }` wrapping `@firecrawl/pdf-inspector`; returns `markdown: null` on anything but a confident `TextBased` result or on a thrown error |
| `src/lib/extraction/schema.ts` | Modify | Add `{ type: "text"; text: string }` to `ExtractionInput`; add `method` to `ExtractionMetrics` |
| `src/lib/extraction/anthropic.ts` | Modify | Handle `type: "text"` with neutral framing |
| `src/lib/extraction/google.ts` | Modify | Same |
| `src/lib/extraction/deepseek.ts` | Modify | Same (already text-only provider — this is its most natural input type) |
| `src/lib/extraction/usage.ts` | Modify | `buildExtractionMetrics` accepts and passes through `method` |
| `src/lib/extraction/index.ts` | Modify | `extractInvoice()` gains the classify → route → (maybe escalate) logic for `type: "pdf"` inputs only |
| `src/app/api/invoices/upload/route.ts` | Modify | Use `EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD` for `needs_review`; save `extraction_method` |
| `src/lib/invoices/process-extraction.ts` | Modify | Same two changes |
| `package.json` | Modify | Add `@firecrawl/pdf-inspector` dependency |
| `README.md` | Modify | Document the `extraction_method` column, matching how the extraction-metrics columns are already documented |

## Migration

```sql
alter table public.invoices
  add column extraction_method text;
```

Purely additive — existing rows keep working with `null`, matching
`.claude/rules/data-safety.md`. No RLS/grant changes: `invoices` already has both.

## Error handling

Following `.claude/rules/errors.md`:

- **`classifyPdf` throws.** Caught inside `extractInvoice()`, logged
  (`console.error("PDF classification failed, falling back to vision extraction", ..., error)`
  — no `userId` is available at this layer, so log whatever identifying context
  `extractInvoice()` has, e.g. none beyond the error itself), and treated identically to a
  `Scanned` classification: fall through to the vision path. Classification is a cost
  optimization, never a correctness gate — it must never be able to fail an upload.
- **The escalated vision call also fails.** No new behavior — this is the same
  `providers[provider](...)` call `extractInvoice()` already makes today for every PDF, and
  its existing try/catch at the call sites (`upload/route.ts:102-112`,
  implicitly propagated in `process-extraction.ts`) is unchanged.
- **`@firecrawl/pdf-inspector` native module fails to load at all** (missing prebuilt
  binary for the deploy target). Same handling as a thrown classification error — caught,
  logged once, fall through to vision. This is checked explicitly in manual verification
  against the actual deploy target (see Testing) since it's the one failure mode local dev
  won't surface if dev and prod run the same OS/arch.

## Known limitation

A text-based PDF that gets misclassified as needing vision (a false negative on
classification) simply costs what it costs today — no regression, no missed invoice, just a
missed optimization. A text-based PDF that classifies correctly but whose local extraction
is wrong in a way that still scores high confidence would previously have looked identical
under the vision path too, since `confidence_score` is self-reported by the model either way;
this spec doesn't change how trustworthy that self-report is, only what content produced it.

## Testing

Unit tests (Vitest, per `.claude/rules/testing.md`):

- `src/lib/extraction/pdf-classify.test.ts` — not written; `pdf-classify.ts` is a thin
  third-party wrapper, same convention as the provider wrappers.
- Any pure decision logic extracted for the escalation check (e.g. a
  `shouldEscalateToVision(confidenceScore: number): boolean` if the conditional is worth
  naming) gets a `.test.ts` covering the boundary at
  `EXTRACTION_CONFIDENCE_REVIEW_THRESHOLD`.

Manual verification against the local stack:

1. Upload a real text-based PDF invoice. Confirm `extraction_method = "local_text"` and that
   `extraction_input_tokens` is markedly lower than an equivalent vision call (compare
   against an existing row from before this change, or against the same file forced through
   the vision path).
2. Upload a scanned/photo-style PDF and a plain image (png/jpg). Confirm both save with
   `extraction_method = "vision"` and behave exactly as before.
3. Force a low-confidence local result (e.g. a text-based PDF with an unusual layout) and
   confirm it re-extracts via vision and saves with `extraction_method = "vision_fallback"`,
   not `"local_text"`.
4. Temporarily break `classifyPdf` (throw unconditionally) and confirm uploads still succeed
   end-to-end via the vision fallback — this is the fail-safe path and must never block a
   real upload.
5. Existing flows unchanged: email attachment extraction, HTML-body-only extraction, the
   content-hash duplicate path, and the Starter quota check all behave exactly as before.

Gates: `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Out of scope

Local or hosted OCR for scanned/image-based PDFs, expanding accepted upload mime types via
`anydoc`, known-template parsing, and any cost-reporting UI for the new `extraction_method`
column (the existing extraction-metrics columns don't have one either; a dashboard can be
specced separately if the numbers turn out to be worth showing).
