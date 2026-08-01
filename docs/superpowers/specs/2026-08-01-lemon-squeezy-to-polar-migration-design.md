# Lemon Squeezy → Polar Migration Design

**Date:** 2026-08-01
**Status:** approved

## Problem

The app currently uses Lemon Squeezy as its Merchant of Record for the Team ($29/mo)
subscription plan. However, Lemon Squeezy does not support payouts to Vietnam — a
blocker for the operator, who is based in Vietnam. Polar (polar.sh), also a MoR,
does support Vietnam-based operators and is widely used by the Vietnamese indie-dev
community.

## Approach: Direct replacement

Same pattern, different provider. No abstraction layer — every Lemon Squeezy
file gets a Polar equivalent, and LS-specific files are deleted once nothing
references them.

## Files changed

### New files

| File | Role |
|------|------|
| `src/lib/polar.ts` | Checkout + customer portal thin wrapper (replaces `lemonsqueezy.ts`). Exports `createPolarCheckout()` and `createPolarCustomerPortal()`. Calls `@polar-sh/sdk` under the hood. |
| `src/lib/polar-webhook.ts` | `verifyPolarWebhookSignature()` — calls `validateEvent` from `@polar-sh/sdk/webhooks`. Pure, unit-testable. |
| `src/lib/polar-webhook.test.ts` | Unit tests for webhook verification. |
| `src/app/api/webhooks/polar/route.ts` | Webhook route handler. Verifies signature → upserts `billing_subscriptions` with current subscription state. Idempotent (re-applies same state on retry). Handles `subscription.active`, `.updated`, `.canceled`, `.revoked` uniformly — no per-event switch. |
| `docs/billing-polar.md` | Polar integration documentation (replaces `billing-lemonsqueezy.md`). |

### Modified files

| File | Change |
|------|--------|
| `src/app/dashboard/actions.ts` | `createCheckoutUrl()` calls `createPolarCheckout()` instead of `createLemonSqueezyCheckout()`. |
| `src/lib/billing.ts` | Re-export `getBillingMode()`, `hasActiveTeamPlan()`, `BillingSubscriptionRow` — drop LS-specific references in comments. `BillingSubscriptionRow` type: rename `ls_customer_id` → `polar_customer_id`, `ls_subscription_id` → `polar_subscription_id`. |
| `src/constants/billing.ts` | Update `BILLING_MODE` doc comment; no logic change. |
| `src/lib/validation/env.ts` | Validate `POLAR_ACCESS_TOKEN`, `POLAR_ORGANIZATION_ID`, `POLAR_TEAM_PRODUCT_ID`, `POLAR_WEBHOOK_SECRET` (was `LEMONSQUEEZY_*`). |
| `src/app/dashboard/settings/billing-card.tsx` | Text labels: "Lemon Squeezy" → "Polar". Portal URL from Polar. |
| `src/app/dashboard/settings/page.tsx` | `searchParams.checkout` handling unchanged (same query param name). |
| `.env.local.example` | Replace `LEMONSQUEEZY_*` with `POLAR_*` env vars. |
| `docs/billing-mode.md` | Update references from Lemon Squeezy → Polar. |
| `supabase/migrations/<timestamp>_rename_ls_to_polar.sql` | Additive migration: rename columns. |

### Deleted files

| File | Reason |
|------|--------|
| `src/lib/lemonsqueezy.ts` | Replaced by `src/lib/polar.ts`. |
| `src/lib/lemonsqueezy-webhook.ts` | Replaced by `src/lib/polar-webhook.ts`. |
| `src/lib/lemonsqueezy-webhook.test.ts` | Replaced by `src/lib/polar-webhook.test.ts`. |
| `src/app/api/webhooks/lemonsqueezy/route.ts` | Replaced by `src/app/api/webhooks/polar/route.ts`. |
| `docs/billing-lemonsqueezy.md` | Replaced by `docs/billing-polar.md`. |

## Database migration

Additive, non-destructive:

```sql
ALTER TABLE public.billing_subscriptions
  RENAME COLUMN ls_customer_id TO polar_customer_id;
ALTER TABLE public.billing_subscriptions
  RENAME COLUMN ls_subscription_id TO polar_subscription_id;
```

`customer_portal_url` — no rename needed (generic).

## Env var mapping

| Old (Lemon Squeezy) | New (Polar) | Notes |
|---------------------|-------------|-------|
| `LEMONSQUEEZY_API_KEY` | `POLAR_ACCESS_TOKEN` | Organization access token from Polar dashboard |
| `LEMONSQUEEZY_STORE_ID` | `POLAR_ORGANIZATION_ID` | Organization ID |
| `LEMONSQUEEZY_TEAM_VARIANT_ID` | `POLAR_TEAM_PRODUCT_ID` | Product ID for the Team plan |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | `POLAR_WEBHOOK_SECRET` | Webhook signing secret (starts with `whsec_`) |

## Webhook handling

Polar uses the Standard Webhooks spec. The SDK's `validateEvent()` handles
HMAC-SHA256 verification automatically (base64-encoded secret, timing-safe).

Subscription lifecycle events carry **full current state** — same as Lemon
Squeezy. The route handler upserts `billing_subscriptions` keyed on `user_id`
from `metadata.userId` (passed at checkout creation). This is naturally
idempotent.

Events handled (no per-event switch — uniform upsert):

| Polar event | Maps to |
|-------------|---------|
| `subscription.active` | status = `active` |
| `subscription.updated` | status = from payload |
| `subscription.canceled` | status = `cancelled`, ends_at from payload |
| `subscription.revoked` | status = `expired` |

## Unchanged

- `BillingSubscriptionRow` type shape (column names only)
- `hasActiveTeamPlan()` logic — pure function, no I/O
- `getTeamAccess()` logic — reads `billing_subscriptions`, unchanged
- `checkStarterQuota()` logic — unchanged
- `BILLING_MODE` env var (none/test/live) — unchanged
- Feature gating (`/analytics`, `/exports`, API exports) — unchanged
- Starter monthly cap (`STARTER_MONTHLY_INVOICE_LIMIT`) — unchanged
- Landing page pricing copy — unchanged (still "$29/mo Team")
- `billing.test.ts` — update type references only

## Testing

- `npm run test` — all existing suites must pass
- `src/lib/polar-webhook.test.ts` — new webhook verification tests
- `src/lib/billing.test.ts` — update type field names if needed
- Manual smoke test: Polar sandbox checkout → webhook → billing card state change (requires Polar sandbox organization + ngrok tunnel)

## Migration order

1. Install `@polar-sh/sdk`
2. Create new Polar files (lib, webhook, route, tests)
3. Update env vars, constants, validation
4. Update database migration (rename columns)
5. Update billing-card UI text
6. Update docs
7. Delete old LS files
8. Quality gate: `npm run test && npm run lint && npx tsc --noEmit`
