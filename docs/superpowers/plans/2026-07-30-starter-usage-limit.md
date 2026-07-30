# Starter Usage Soft Limit — TDD Plan

**Date:** 2026-07-30
**Status:** Implemented

## Implementation order

### 1. Constants and core logic (TDD)

- [x] `src/constants/billing.ts` — `STARTER_MONTHLY_INVOICE_LIMIT_DEFAULT = 50`
- [x] `src/lib/billing/usage.ts` — `getMonthRangeUtc`, `getStarterMonthlyLimit`,
  `countBillableInvoicesThisMonth`, `checkStarterQuota`
- [x] `src/lib/billing/usage.test.ts` — 23 tests covering:
  - Month boundary math (normal, December wrap, January, leap year)
  - Env var parsing (unset, set, invalid, negative, zero)
  - Invoice counting (normal, null count, query error fail-open)
  - Quota decisions (dev unlock, Team active, Team trial, Starter under, Starter at/over, zero-cap, resetsAt)

### 2. Configuration

- [x] `src/lib/validation/env.ts` — add optional `STARTER_MONTHLY_INVOICE_LIMIT`
- [x] `.env.local.example` — document the env var with testing guidance

### 3. Enforcement

- [x] `src/app/api/invoices/upload/route.ts` — quota check after dedup, before LLM;
  returns 429 with `{ error, used, limit, resetsAt }` when blocked
- [x] `src/lib/invoices/process-extraction.ts` — quota check after dedup, before
  `extractInvoice`; skips LLM and returns `{ saved: false }` when blocked

### 4. UI

- [x] `src/app/dashboard/settings/billing-card.tsx` — usage progress bar, soft warn at
  80%, blocked state with upgrade CTA; hidden for Team users
- [x] `src/app/dashboard/settings/page.tsx` — fetch usage data for Starter users

### 5. Verification

- [x] `npm test` — 347 tests pass (33 files)
- [x] `npx tsc --noEmit` — clean
- [x] `npm run build` — successful production build

## Test plan (manual)

| Scenario | Expected |
|----------|----------|
| Starter, 0/50 used | Upload succeeds, Settings shows 0/50 |
| Starter, 49/50 used | Upload succeeds, amber warning at 80% |
| Starter, 50/50 used | Upload returns 429, Settings shows blocked (red) |
| Starter, 50/50, duplicate upload | Allowed (dedupe bypasses quota) |
| `BILLING_DEV_UNLOCK=true` | Unlimited, no quota meter |
| Team plan active | Unlimited, no quota meter |
| `STARTER_MONTHLY_INVOICE_LIMIT=3` | All above scenarios at lower threshold |
