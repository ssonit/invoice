# Lemon Squeezy Billing Integration

**Date:** 2026-07-25  
**Design:** [docs/superpowers/specs/2026-07-25-billing-lemonsqueezy-design.md](./superpowers/specs/2026-07-25-billing-lemonsqueezy-design.md)  
**Plan:** [docs/superpowers/plans/2026-07-25-billing-lemonsqueezy.md](./superpowers/plans/2026-07-25-billing-lemonsqueezy.md)

## Problem

The landing page has advertised a paid "Team" plan ($29/mo) since before this integration,
but there was no way to actually collect payment for it — no checkout, no subscription
state, nothing to gate on even if there had been a feature to gate. This closes that gap:
hosted checkout, a signed webhook that keeps subscription state in sync, and a Settings
billing card, so the app can start generating revenue from the plan it already sells.

## Solution

### 1. Merchant of Record via Lemon Squeezy

Lemon Squeezy is the seller of record — it handles global VAT/sales-tax compliance itself,
at a cost of ~5% + 50¢ per transaction. Stripe Managed Payments (Stripe's own
Merchant-of-Record product) was considered but isn't GA yet; plain Stripe would push tax
compliance onto us directly. For a single-tier MVP, offloading that entirely was worth the
fee.

### 2. `billing_subscriptions` data model

A new table, 1:1 with `profiles` via `user_id`, rather than columns bolted onto `profiles`:

```sql
create table public.billing_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'starter' check (plan in ('starter', 'team')),
  status text not null default 'none'
    check (status in ('none', 'on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired')),
  ls_customer_id text,
  ls_subscription_id text unique,
  customer_portal_url text,
  renews_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now()
);
```

Keeping it a separate table matters for two reasons: webhook-driven state can arrive
out-of-order or be retried, so it deserves its own write path independent of account
identity; and the name would otherwise collide with the existing, unrelated
`subscription_confirmations` table (vendor recurring-charge *detection* — a different
bounded context that happens to share the word "subscription"). RLS grants `authenticated`
`SELECT` only — a user can read their own row but never write it directly. Only the webhook,
via the `service_role` client after HMAC verification, ever mutates billing state.
`handle_new_user()` was extended to insert a default row (`plan = 'starter'`,
`status = 'none'`) alongside the existing `profiles` insert, so every user has exactly one
row and no calling code needs to null-check a missing subscription.

### 3. Webhook: upsert current state, don't branch per event

Every Lemon Squeezy `subscription_*` webhook event carries the *full current* subscription
state in `data.attributes` — not a delta. So `src/app/api/webhooks/lemonsqueezy/route.ts`
doesn't switch on `event_name` (`subscription_created` vs. `subscription_updated` vs.
`subscription_cancelled`, etc.) at all: for any event name starting with `subscription_`, it
verifies the HMAC-SHA256 signature (`verifyWebhookSignature()`,
`src/lib/lemonsqueezy-webhook.ts`, pure/unit-tested), then upserts `billing_subscriptions`
keyed on `user_id` (`onConflict: "user_id"`) from `data.attributes` +
`meta.custom_data.user_id`. This is naturally idempotent — a duplicate or retried delivery
just re-applies the same current state — and it means the handler doesn't need per-event
logic that would drift out of sync with Lemon Squeezy's event taxonomy over time.

### 4. No feature gating in this pass

`hasActiveTeamPlan()` (`src/lib/billing.ts`) is a pure, fully-tested helper — it's correct
today, including the "cancelled but still within the paid period" boundary (`ends_at` in the
future) — but nothing calls it to block access to any route or action. Investigation during
design found the two features the landing page implied Team would unlock,
`/dashboard/analytics` and `/dashboard/exports`, are `ComingSoon` placeholders, not real
functionality; the other gating candidate found in their place (multiple forwarding inboxes)
turns out to need a schema/UI rework of its own. So Team is sold as an early-adopter/support
tier for now, and real feature gating is deferred to a follow-up spec once a gate-able
feature actually ships.

As a direct consequence, the landing page's Team plan feature list was trimmed to only what
exists or is already correctly marked `ComingSoon` elsewhere — "Shared workspace" and
"Priority parsing" were removed from both the English and Vietnamese copy
(`src/lib/landing/dictionary.ts`), since neither exists yet.

## Key files

| File | Role |
|------|------|
| `supabase/migrations/20260725150000_billing_subscriptions.sql` | `billing_subscriptions` table, RLS, grants, `handle_new_user()` extension |
| `src/lib/billing.ts` | `hasActiveTeamPlan()` — pure gating helper (unused for gating today; drives the billing card's own UI) |
| `src/lib/lemonsqueezy-webhook.ts` | `verifyWebhookSignature()` — pure HMAC-SHA256 verification, timing-safe |
| `src/lib/lemonsqueezy.ts` | `createLemonSqueezyCheckout()` — thin `fetch` wrapper around the checkout API, `server-only` |
| `src/app/api/webhooks/lemonsqueezy/route.ts` | Webhook route — verify signature, upsert current state |
| `src/app/dashboard/actions.ts` | `createCheckoutUrl()` Server Action |
| `src/app/dashboard/settings/billing-card.tsx` | Settings UI — Upgrade to Team / Manage subscription |
| `src/lib/landing/dictionary.ts` | Trimmed Team plan feature copy (both locales) |

## Review-driven fixes

Several Important-severity issues were caught and fixed during code review, beyond what the
original design spec called for:

- **Paused/unpaid subscribers routed to the wrong CTA.** The billing card originally used
  `hasActiveTeamPlan()` (which excludes `paused`/`unpaid`) to decide Upgrade vs. Manage,
  so a paused or unpaid subscriber saw "Upgrade to Team" again instead of their existing
  customer-portal link — inviting a duplicate subscription. Fixed by driving the CTA off a
  separate `hasExistingSubscription` check, decoupled from the `isTeam` gating check.
- **Missing `LEMONSQUEEZY_WEBHOOK_SECRET` crashed the webhook route.** The route read
  `process.env.LEMONSQUEEZY_WEBHOOK_SECRET!` straight into signature verification; if unset,
  this threw an unhandled exception instead of failing gracefully. Fixed with an explicit
  guard before signature verification.
- **Checkout API failures discarded the response body.** `createLemonSqueezyCheckout()`'s
  failure branch only logged the HTTP status, throwing away whatever error detail Lemon
  Squeezy's API returned — making a real checkout failure hard to diagnose from logs. Fixed
  to read and log the response body.
- **Settings page silently swallowed a `billing_subscriptions` query error.** The initial
  fetch discarded any Supabase error, so a real failure would render the same "Could not
  load your billing status" fallback as a legitimately-missing row, with nothing in the
  logs. Fixed to log the error server-side.

## Manual verification still needed

`npm run test` (all 19 suites / 172 tests, including the new `billing.test.ts` and
`lemonsqueezy-webhook.test.ts`), `npx tsc --noEmit`, and `npm run build` all pass as of this
writing. What has **not** been run is the manual smoke test through a real (test-mode)
checkout — that requires a Lemon Squeezy test-mode store, a Team variant configured, a
webhook pointed at a local tunnel (e.g. `ngrok http 3000`), and `.env.local` filled in with
`LEMONSQUEEZY_API_KEY` / `LEMONSQUEEZY_STORE_ID` / `LEMONSQUEEZY_TEAM_VARIANT_ID` /
`LEMONSQUEEZY_WEBHOOK_SECRET` — none of which exist in this environment. This is a real gap,
not a formality: it's the only check that exercises the checkout redirect, the live webhook
delivery, and the resulting billing-card state change end-to-end.

Before considering this integration launch-ready, someone with access to a Lemon Squeezy
test-mode store needs to run through **Task 8, Step 4** of the implementation plan
([`docs/superpowers/plans/2026-07-25-billing-lemonsqueezy.md`](./superpowers/plans/2026-07-25-billing-lemonsqueezy.md#task-8-full-verification--docs)),
which walks through: upgrading from the Settings billing card, completing a test-mode
checkout, confirming the webhook flips `billing_subscriptions.status` to `active`, opening
the customer portal, and confirming a mid-period cancellation keeps Team access until
`ends_at`.
