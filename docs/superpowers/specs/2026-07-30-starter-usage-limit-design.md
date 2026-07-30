# Starter Usage Soft Limit — Design Spec

**Date:** 2026-07-30
**Status:** Implemented

## Motivation

Prevent unbounded LLM cost on the free **Starter** plan. Starter users get a soft monthly
cap on billable invoice extractions. Team users (and `BILLING_DEV_UNLOCK`) stay unlimited.

This is a **subscription + quota** mechanism, not a credit wallet.

## Meter

- **What counts:** One count per `invoices` row created for the user in the current UTC
  calendar month. Dedupe hits that only bump `duplicate_hit_count` (no new row) do **not**
  count. Rejected `is_invoice=false` extractions that insert no row also do not count.
- **No separate usage table** — `count(*)` on `invoices` filtered by `(user_id, created_at)`
  is sufficient at Starter volumes.

## Limits

| Plan | Limit |
|------|-------|
| Starter | `STARTER_MONTHLY_INVOICE_LIMIT` env var (integer), default **50** |
| Team | No cap |
| `BILLING_DEV_UNLOCK=true` | No cap (non-prod only) |

## Enforcement points

1. **`POST /api/invoices/upload`** — after auth + rate limit + dedup, before LLM extraction.
   Over limit → `429` with `{ error, used, limit, resetsAt }`.

2. **Email extraction (`processExtraction`)** — after dedup, before `extractInvoice`.
   Over limit → skip LLM, log "quota exceeded", return `{ saved: false }`.

## Architecture

```
Request (upload or email extract)
  └─ checkStarterQuota(supabase, userId)
       ├─ isBillingDevUnlockEnabled()? → allowed
       ├─ hasActiveTeamPlan(billingRow)? → allowed
       ├─ countBillableInvoicesThisMonth() < limit? → allowed
       └─ otherwise → denied (with usage details)
```

`checkStarterQuota` is self-contained — it queries `billing_subscriptions` internally
rather than requiring a separate `getTeamAccess` call first. This works in both
session-based (upload API) and service-client-based (trigger task) contexts.

## UI

- **Settings → Billing card** shows `used / limit` for Starter users with a progress bar.
- **Soft warn** (amber bar) when `used >= limit * 0.8`.
- **Blocked** (red bar) when `used >= limit` with upgrade CTA.
- **No quota UI** for Team users (the meter is hidden).

## Files

| Path | Role |
|------|------|
| `src/constants/billing.ts` | `STARTER_MONTHLY_INVOICE_LIMIT_DEFAULT` |
| `src/lib/billing/usage.ts` | `getMonthRangeUtc`, `countBillableInvoicesThisMonth`, `getStarterMonthlyLimit`, `checkStarterQuota` |
| `src/lib/billing/usage.test.ts` | Month bounds, under/over limit, team/dev_unlock bypass |
| `src/lib/validation/env.ts` | Optional `STARTER_MONTHLY_INVOICE_LIMIT` |
| `.env.local.example` | Documented env var |
| `src/app/api/invoices/upload/route.ts` | Quota check before LLM |
| `src/lib/invoices/process-extraction.ts` | Quota check before LLM |
| `src/app/dashboard/settings/billing-card.tsx` | Usage meter + progress bar |
| `src/app/dashboard/settings/page.tsx` | Usage data fetching |

## Testing

Set `STARTER_MONTHLY_INVOICE_LIMIT=3` locally to hit the wall quickly:

| Setup | Expect |
|-------|--------|
| Starter, limit=3, 3 invoices this month | 4th upload rejected; Settings shows 3/3 |
| Same + duplicate file upload | Allowed (dedupe, no new row) |
| `BILLING_DEV_UNLOCK=true` | Unlimited even on Starter row |
| Team via `billing_subscriptions` | Unlimited; no quota meter |

## Out of scope

- Credit ledger / purchasable top-ups
- Soft-limit on Analytics/Exports (already Team-gated)
- Changing Lemon Squeezy pricing
- Per-token billing
