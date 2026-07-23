# Unit Test Coverage — `src/lib/`

**Date:** 2026-07-23
**Status:** Approved for implementation

## Goal

Close the unit-test gap in `src/lib/` pure-logic modules. The project already tests pure
functions with Vitest (`subscriptions.ts`, `document-gate.ts`, `email-reply-templates.ts`,
`process-extraction.ts`, `validation/{auth,upload,subscriptions}.ts`); several newer or
core modules never got the same treatment.

## Scope

**In scope** — unit tests for pure/near-pure `lib/` functions:

| File | Priority | Functions |
|---|---|---|
| `src/lib/invoices.ts` | High | `getInboxStatus`, `formatInvoiceMoney`, `formatInvoiceDate`, `inboxGroupLabel`, `inboxTimeLabel`, `normalizeInvoice`, `computeStats`, `monthlyTrend` |
| `src/lib/vendors/query.ts` | High | `parseVendorQuery`, `escapeIlike`, `isDefaultVendorQuery`, `vendorFilterLabel`, `vendorSortLabel` |
| `src/lib/validation/vendors.ts` | High | `parseCreateVendorInput`, `parseUpdateVendorInput`, `parseDeleteVendorInput` |
| `src/lib/vendors.ts` | Medium | `ensureVendorRecord` (mock the existing `Upsertable` interface) |
| `src/lib/agentmail.ts` | Medium | `createUserInbox`, `findExistingInboxForUser` (mock the AgentMail client) |
| `src/lib/nav-config.ts` | Low | `isNavItemActive`, `findNavItem` |

**Out of scope** (unchanged from current project convention — verified manually, not
unit-tested): API routes, Server Actions, `src/trigger/*.ts`, the LLM-provider wrappers
(`extraction/{anthropic,google,deepseek}.ts`), and UI components (no component-testing
tool installed).

## Notable behaviors to cover (not just happy path)

- `computeStats`: multi-currency handling — the function reports the total for the
  currency with the largest summed value and sets `multiCurrency: true` when more than
  one currency appears; verify both.
- `monthlyTrend`: bucket boundaries at month rollover (using UTC month arithmetic).
- `inboxGroupLabel` / `inboxTimeLabel`: "Today" / "Yesterday" / older-date branches, driven
  by an explicit `nowIso` parameter (already designed for deterministic testing).
- `normalizeInvoice`: PostgREST can return `amount`/`tax`/`confidence_score` as numeric
  strings — verify string-to-number coercion and malformed/missing-field fallbacks.
- `escapeIlike`: must escape `\`, `%`, and `_` so user search input can't inject SQL LIKE
  wildcards.
- `createUserInbox`: the `AgentMail.IsTakenError` fallback path (falls back to
  `findExistingInboxForUser`, matching by `metadata.user_id` first, then by email prefix).
- `isNavItemActive` / `findNavItem`: `/dashboard` requires an exact match (no prefix
  match), while nested routes use prefix match; `findNavItem` picks the longest matching
  `href` when routes could nest.

## Testing approach

Same pattern as existing tests: Vitest, `describe`/`it`, no new dependencies. Functions
that take a Supabase-like or SDK-like client accept a minimal structural interface (as
`ensureVendorRecord` already does via `Upsertable`) so tests pass a plain mock object
rather than a real client.
