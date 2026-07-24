---
description: Naming conventions for files, functions, booleans, and types
---

# Naming conventions

Sourced from established practice in this codebase, cross-checked against the
[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html) and
[clean-code-typescript](https://github.com/labs42io/clean-code-typescript).

**Files:** kebab-case (`invoices-toolbar.tsx`, `process-extraction.ts`).

**Components:** PascalCase, matching the file's default export
(`InvoicesTable`, `SubscriptionConfirmButtons`).

**Functions/variables:** camelCase, verb-first for functions that do something
(`fetchInvoice`, `normalizeInvoice`, `parseVendorQuery`) — a function name should say what
it does, not just what it's about.

**Booleans:** prefix with `is`/`has`/`can`/`should` (`isPending`, `hasActive`,
`needsConfirmation`, `canDelete`). Avoid negative names (`isNotReady`) — they force a
double-negative at every call site (`if (!isNotReady)`).

**Types/interfaces:** PascalCase, no `I` prefix (`InvoiceRow`, not `IInvoiceRow`). Name a
type for what it represents, not for the fact that it's a type
(`SubscriptionConfirmation`, not `SubscriptionConfirmationType`).

**Discriminated unions:** the discriminant field is `type` or `status` depending on
context — `type` for a one-shot outcome (`EmailReplyOutcome`: `"processed" | "skipped" |
"error"`), `status` for a value with a lifecycle (`SubscriptionStatus`: `"upcoming" |
"due" | "confirmed_active" | "cancelled"`). Keep using whichever the surrounding domain
already uses rather than mixing both in one union.

**Validation functions:** `parseXInput(input: unknown)` for structured data,
`parseXForm(formData: FormData)` for a Server Action's form submission — see
`.claude/rules/validation.md`.

**Descriptive over short.** Don't abbreviate in a way that isn't immediately obvious to
someone outside this project (`req`/`res` are fine and universal; a made-up shorthand like
`invStat` for `invoiceStatus` is not). Prefer a name that's greppable — a unique,
descriptive identifier is easier to search for across the codebase than a generic one
reused in ten unrelated places.
