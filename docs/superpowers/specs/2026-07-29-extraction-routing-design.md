# Content-Aware Extraction Routing

**Date:** 2026-07-29
**Status:** Deferred (design approved, implementation postponed 2026-07-29)
**Source:** `Invoice_Reader_Product_Ideas.md` §1 (Processing Architecture)

## Why this is deferred

The design holds up; the timing doesn't. Three things argue against building it now:

- **There is no traffic to optimize.** The product isn't in production yet
  ([`README.md`](../../../README.md) still lists Vercel as "not fully wired yet"). A large
  percentage saving on near-zero volume is near-zero money, while the complexity is paid
  immediately and permanently.
- **It can cost more than it saves.** Flattened PDF text loses layout, and layout is how a
  model tells a line-item price from an invoice total. `processExtraction` flags anything
  under `confidence_score < 0.7` as `needs_review`, which converts a bad extraction into
  human work. Human review time dwarfs the price of an inference call, so a few points of
  accuracy regression wipes out the saving and then some.
- **Availability becomes the product of two vendors.** Under `auto`, an outage at either
  DeepSeek or Gemini breaks extraction, where today only one provider can fail.

**Nothing here was measured.** `src/lib/extraction/` records no token usage, cost, or latency,
and the ratio of text-layer PDFs to scans in real user mail is unknown — that ratio is the
multiplier on the entire saving.

**Revisit when:** the monthly extraction bill is large enough to notice, and telemetry shows
what share of documents are text-layer PDFs. Then the thresholds in this spec can be set from
data instead of guessed.

**Doing first instead:** SHA256 dedupe on the email path and extraction telemetry — see
[`2026-07-29-extraction-cost-visibility-design.md`](2026-07-29-extraction-cost-visibility-design.md).

## Goal

Every extraction today costs the same regardless of what the document is. `extractInvoice()`
sends whatever it gets to a single provider chosen at deploy time by `EXTRACTION_PROVIDER`
(`src/lib/extraction/index.ts:22`), so a text-based PDF invoice, a scanned photocopy, and a
phone snapshot of a receipt all go to the same model at the same price.

Most business invoices are digital PDFs with a real text layer. Reading that text costs a
fraction of sending the file to a vision model. This routes each document to the cheapest
model that can actually read it:

| Input | Route | Why |
| --- | --- | --- |
| PDF with a usable text layer | extract text, send text to DeepSeek | Cheapest path, no vision needed |
| PDF without usable text (scan) | send the file to Gemini Flash | Only a vision model can read it |
| Image | send the file to Gemini Flash | Same |
| Email HTML body | send HTML to DeepSeek | Already text, unchanged behavior |

Every document costs **exactly one LLM call**. No path calls a model twice.

## Scope decision

Routing only. The other §1 items and the rest of the backlog stay out:

| Item | Decision |
| --- | --- |
| SHA256 cache on the email path | Separate spec. Small and self-contained; `process-extraction.ts` currently dedupes only on `(user_id, source_message_id, source_ref)`, so the same file forwarded twice pays twice |
| Known-template regex parser (skip AI entirely) | Deferred. YAGNI until repeat-vendor data exists to justify per-vendor parsers |
| Per-attachment task split (§2) | Separate spec. Reliability, not cost |
| Landing positioning (§5/§7) | Separate spec. Pure copy |

## Design decisions

**Routing is opt-in via `EXTRACTION_PROVIDER=auto`.** A new value alongside
`anthropic` / `google` / `deepseek`. Existing single-provider deployments keep working
untouched. When `auto` is set, env validation requires **both** `DEEPSEEK_API_KEY` and
`GEMINI_API_KEY` (or `GOOGLE_API_KEY`) and fails fast at boot via `instrumentation.ts` —
rather than discovering a missing key mid-extraction. Auto mode never uses Anthropic; a
deployment that wants Claude keeps `EXTRACTION_PROVIDER=anthropic`.

**A deterministic text-quality pre-check decides the route, not a retry.** A PDF can carry a
text layer that is garbage (broken font encoding, mojibake, an empty OCR layer). Sending that
to a text model returns `is_invoice=false` and the invoice disappears silently — the worst
failure mode this product has, because the user forwards a bill and nothing appears. The
alternative considered was retrying with vision whenever the text path rejects a document;
that was rejected because it charges two calls for every genuinely-not-an-invoice file. The
pre-check scores the extracted text before any model sees it, so cost stays at one call per
document and the decision is a pure function that can be unit-tested.

**`auto` is an entry in the existing dispatch table.** `src/lib/extraction/index.ts` keeps its
shape; `providers.auto = extractWithRouting`. Call sites (`src/app/api/invoices/upload/route.ts`,
`src/lib/invoices/process-extraction.ts`) do not change at all — they still call
`extractInvoice(input)` and know nothing about routing. This is the swappable-backend rule in
`.claude/rules/code-style.md`: a provider is selected through a dispatch table, never
hardcoded at the call site.

Two alternatives were rejected: routing at the call site (duplicates identical logic in two
places that will drift apart), and a second entry point `extractInvoiceRouted()` alongside
`extractInvoice()` (two doors to the same room; the next person won't know which to use).

**PDF text extraction uses `unpdf`** (1.8.0 at the time of writing). It targets serverless
runtimes, ships a prebuilt pdfjs so there is no worker configuration to get wrong, and returns
page count alongside the text — which the per-page threshold needs. `pdf-parse` wraps a legacy
pdfjs 1.x; `pdfjs-dist` needs worker setup; `pdf2json` returns a structure richer than needed.
The real API is verified after install rather than assumed.

## Architecture

```text
buffer / html
     │
     ▼
extractInvoice(input)                    ← call sites unchanged
     │
     └── providers.auto = extractWithRouting(input)
             ├── html   → DeepSeek (html)
             ├── text   → DeepSeek (text)
             ├── image  → Gemini Flash (file)
             └── pdf    → extractPdfText(buffer)
                            → scoreTextQuality({ text, pageCount })
                                ├── isUsable      → DeepSeek (text, truncated)
                                └── not usable    → Gemini Flash (original file)
```

## Components

| File | Created / Modified | Responsibility |
| --- | --- | --- |
| `src/lib/extraction/pdf-text.ts` | Create | `extractPdfText(buffer)` → `{ text, pageCount }`. A thin `unpdf` wrapper, same shape as the existing provider wrappers |
| `src/lib/extraction/text-quality.ts` | Create | `scoreTextQuality({ text, pageCount })` → `TextQuality`. Pure, no I/O |
| `src/lib/extraction/text-quality.test.ts` | Create | Boundary-heavy tests for the scorer |
| `src/lib/extraction/router.ts` | Create | `chooseRoute({ inputType, quality })` (pure) + `extractWithRouting(input)` (orchestration) |
| `src/lib/extraction/router.test.ts` | Create | Tests `chooseRoute` only |
| `src/lib/extraction/schema.ts` | Modify | Add `{ type: "text"; text: string }` to `ExtractionInput` |
| `src/lib/extraction/deepseek.ts` | Modify | Accept `type: "text"` in addition to `html`; today it throws on anything but HTML (`deepseek.ts:31`) |
| `src/lib/extraction/index.ts` | Modify | Add `auto` to the `Provider` union and the `providers` table |
| `src/lib/validation/env.ts` | Modify | `auto` requires DeepSeek **and** Gemini keys |
| `src/lib/validation/env.test.ts` | Modify | Cover the new `auto` requirements |
| `src/constants/extraction.ts` | Create | Thresholds and the text length cap |
| `package.json` | Modify | Add `unpdf` |
| `.env.local.example` / `README.md` | Modify | Document `auto` and what it requires |

## The text-quality score

`scoreTextQuality` returns `{ isUsable, charsPerPage, printableRatio, hasNumericSignal }` and
combines three signals:

- **Characters per page** — a scanned PDF's text layer is empty or near-empty, while a real
  text layer carries hundreds of characters per page.
- **Printable-character ratio** — catches a text layer that exists but decodes to mojibake or
  replacement characters, which reads as "text present" by length alone.
- **Numeric signal** — an invoice always contains digits (amounts, dates, invoice numbers).
  Text with no digits at all is not an invoice's text layer, whatever else it is.

`isUsable` requires all three. Anything short of that is treated as a scan and goes to vision,
which is the safe direction to be wrong in: vision reads text PDFs correctly too, it just
costs more.

Starting thresholds, all named in `src/constants/extraction.ts` rather than inlined:

| Constant | Value | Reasoning |
| --- | --- | --- |
| `MIN_CHARS_PER_PAGE` | 120 | A real invoice page carries several hundred to a few thousand characters; a scan's text layer carries none, or a handful of stray header characters. 120 sits well clear of both ends |
| `MIN_PRINTABLE_RATIO` | 0.85 | Tolerates normal punctuation and accented characters (Vietnamese invoices included) while rejecting text that is mostly replacement or control characters |
| `EXTRACTION_TEXT_MAX_CHARS` | 20000 | Roughly 5k tokens. Far more than any invoice needs, small enough that a 60-page document can't run up a bill |

**Text is truncated at `EXTRACTION_TEXT_MAX_CHARS` before the model sees it.** A 60-page PDF
would otherwise blow through context and cost real money for a document that almost certainly
isn't an invoice. Invoices are short; the head of the document is where the vendor, number,
and total live.

## Error handling

Following `.claude/rules/errors.md` — anticipated outcomes are return values, genuine failures
throw and are logged with context.

- **`unpdf` throws** (corrupt, encrypted, or malformed PDF): caught in the router, logged as
  `console.error("PDF text extraction failed, routing to vision", error)`, then routed to
  Gemini with the original file. This is a mechanical failure *before* any model call, so the
  one-call-per-document rule still holds — it is not the retry-after-rejection pattern that
  was explicitly rejected above.
- **A provider call fails**: propagates unchanged. Trigger.dev retries the task; the upload
  route returns its existing 500 with a generic message. No new behavior.
- **A key is missing under `auto`**: the process refuses to boot with a clear message. Never a
  runtime surprise mid-extraction.
- **Route visibility**: the chosen route is logged once per extraction. Without it there is no
  way to confirm routing works in production or to audit where the spend is going, and the
  whole point of this feature is spend.

## Testing

Unit tests (Vitest, per `.claude/rules/testing.md` — pure `src/lib/` logic):

- `text-quality.test.ts` — empty string, whitespace only, mojibake-heavy text, single page vs
  many pages, text with and without digits, and values sitting exactly on each threshold.
- `router.test.ts` — `chooseRoute` across all four input types crossed with usable/unusable
  text quality.
- `env.test.ts` — `auto` with both keys passes; `auto` missing either key fails with a message
  naming the missing variable; the three existing single-provider values keep their current
  behavior.

Deliberately **not** unit-tested, matching existing convention: `pdf-text.ts` (a thin
third-party wrapper, like `anthropic.ts` / `google.ts` / `deepseek.ts`) and
`extractWithRouting` (mixes I/O with orchestration).

Manual verification against the local stack:

1. A text-layer PDF forwarded by email → log shows the DeepSeek text route, invoice appears.
2. A scanned PDF (no text layer) → log shows the vision route, invoice appears.
3. An image receipt → vision route.
4. A deliberately corrupt PDF → error logged, falls back to vision, does not crash the task.
5. `EXTRACTION_PROVIDER=anthropic` still behaves exactly as before (no routing).
6. `EXTRACTION_PROVIDER=auto` with `DEEPSEEK_API_KEY` removed → boot fails with a clear message.

Gates before the feature is done: `npm run test`, `npx tsc --noEmit`, `npm run lint`,
`npm run build`.

## Out of scope

Template/regex parsing that skips the model entirely, the email-path SHA256 cache, the
per-attachment task split, and landing copy. Each gets its own spec.
