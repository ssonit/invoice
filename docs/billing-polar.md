# Polar Billing Integration

**Date:** 2026-08-01
**Replaces:** [billing-lemonsqueezy.md](billing-lemonsqueezy.md) (archived)

## Problem

The app originally used Lemon Squeezy as its Merchant of Record, but Lemon Squeezy
does not support payouts to Vietnam. Polar (polar.sh), also a MoR, supports Vietnam-based
operators and is widely used by the Vietnamese indie-dev community.

## Solution

### 1. Merchant of Record via Polar

Polar is the seller of record — it handles global VAT/sales-tax compliance, at a cost
of ~5% + per-transaction fees. The official `@polar-sh/sdk` provides typed APIs for
checkout creation, customer portal sessions, and Standard Webhooks verification.

### 2. `billing_subscriptions` data model

Same table structure as before, with columns renamed:

| Old (LS) | New (Polar) |
|----------|-------------|
| `ls_customer_id` | `polar_customer_id` |
| `ls_subscription_id` | `polar_subscription_id` |

`customer_portal_url` stays (generic name). All other columns unchanged.

### 3. Webhook: upsert current state, don't branch per event

Polar uses the Standard Webhooks spec. The SDK's `validateEvent()` handles
HMAC-SHA256 verification automatically (base64-encoded secret, timing-safe).

Every subscription webhook event carries the **full current** subscription state in
`data` (a `Subscription` object). The route handler upserts `billing_subscriptions`
keyed on `user_id` from `metadata.userId` — naturally idempotent.

### 4. Plan matrix

| | **Starter** `$0` | **Team** `$29/mo` |
|--|--|--|
| Manual upload + AI extract | Yes (soft limit **50**/mo) | Unlimited |
| Dashboard, filters, vendors | Yes | Yes |
| Analytics | Yes | Yes |
| AgentMail forwarding inbox | No (new provision) | Yes |
| CSV exports | No | Yes |

`getTeamAccess()` (`src/lib/billing/access.ts`) gates **Exports** (page + API). Order:

1. **Billing disabled** (`BILLING_MODE=none`) — full access.
2. **Dev unlock** (`isBillingDevUnlockEnabled()`): if `BILLING_DEV_UNLOCK=true` (non-prod).
3. **Database row**: loads `billing_subscriptions`, passes through `hasActiveTeamPlan()`.
4. **Default**: denied.

Inbox provisioning uses `canProvisionInbox()` (same bypasses + Team). Existing
Starter inboxes are **grandfathered** — they keep working; only **new** creates
require Team.

### 5. Starter usage soft limit

Starter-plan users capped at `STARTER_MONTHLY_INVOICE_LIMIT` (default 50) per month.

## Key files

| File | Role |
|------|------|
| `src/lib/polar.ts` | `createPolarCheckout()`, `createPolarCustomerPortal()` — thin wrappers around `@polar-sh/sdk` |
| `src/lib/polar-webhook.ts` | `verifyPolarWebhook()` — delegates to SDK's `validateEvent()` |
| `src/app/api/webhooks/polar/route.ts` | Webhook route — verify signature, upsert current state |
| `src/app/dashboard/actions.ts` | `createCheckoutUrl()`, `openCustomerPortal()` Server Actions |
| `src/app/dashboard/settings/billing-card.tsx` | Settings UI — Upgrade to Team / Manage subscription |
| `src/lib/billing.ts` | `hasActiveTeamPlan()`, `canProvisionInbox()`, `getBillingMode()`, `isBillingDevUnlockEnabled()` |
| `src/components/dashboard/inbox-provision-panel.tsx` | Create inbox or Upgrade CTA |

## Setup

### 1. Polar sandbox account

Create a Polar account at [polar.sh](https://polar.sh), set up an organization, create
a Team product ($29/mo recurring), and generate:

- **Organization Access Token** → `POLAR_ACCESS_TOKEN`
- **Organization ID** → `POLAR_ORGANIZATION_ID`
- **Team Product ID** → `POLAR_TEAM_PRODUCT_ID`

### 2. Webhook

In Polar dashboard → Settings → Webhooks, create an endpoint pointing at
`https://<your-domain>/api/webhooks/polar`. Select all subscription events.
Copy the webhook secret → `POLAR_WEBHOOK_SECRET`.

### 3. Env vars

```env
POLAR_ACCESS_TOKEN=
POLAR_ORGANIZATION_ID=
POLAR_TEAM_PRODUCT_ID=
POLAR_WEBHOOK_SECRET=
BILLING_MODE=test
```

### 4. Local testing

Run a tunnel (e.g. `ngrok http 3000`) and point the Polar webhook at it for local
development.

## Manual verification

- Complete a sandbox checkout from the Settings billing card
- Confirm the webhook flips `billing_subscriptions.status` to `active`
- Open the customer portal from the billing card
- Cancel a subscription and confirm Team access persists until `ends_at`
