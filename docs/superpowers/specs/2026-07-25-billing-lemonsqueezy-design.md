# Lemon Squeezy Billing Integration

**Date:** 2026-07-25
**Status:** Approved for implementation

## Goal

Let users pay for the existing "Team" plan advertised on the landing page, so the app can
start generating revenue. Scope is deliberately narrow: payment infrastructure only (Lemon
Squeezy checkout + webhook + subscription state), with **no feature gating** — investigation
during design found that both features the landing page implied Team would unlock
(`/dashboard/analytics`, `/dashboard/exports`) are `ComingSoon` placeholders, not real
functionality, and gating candidate found in their place (multiple forwarding inboxes) turns
out to require a schema/UI rework of its own. Team is sold as an early-adopter/support tier
for now; real feature gating is a follow-up spec once a gate-able feature actually ships.

## Decisions

| Item | Choice |
|---|---|
| Provider | Lemon Squeezy (Merchant of Record) — handles global VAT/sales-tax compliance. Stripe Managed Payments (Stripe's own MoR product) was considered but isn't GA yet; plain Stripe would push tax compliance onto us. |
| Plans | Reuses existing landing-page pricing: Starter ($0) / Team ($29/mo, one variant). `t.pricing.plans` copy (`src/lib/landing/dictionary.ts`, both `en`/`vi` locales) has its "Shared workspace" and "Priority parsing" bullets removed — neither exists; the remaining bullets (trend charts, exports, dashboard review, filters) are either real today or already correctly marked `ComingSoon` elsewhere. |
| Feature gating | **None in this pass.** `hasActiveTeamPlan()` is written and used only to drive the Settings billing card's own UI (Upgrade vs. Manage). No page or Server Action checks it to block access. |
| Data model | New `billing_subscriptions` table, 1:1 with `profiles`, not columns added to `profiles`. Keeps webhook-driven billing state (can be retried/out-of-order) separate from account identity, and avoids name confusion with the unrelated `subscription_confirmations` table (vendor recurring-charge detection — a different bounded context that happens to share the word "subscription"). |
| Webhook handling | Every Lemon Squeezy `subscription_*` event carries the full current subscription state in `data.attributes`. The handler does not branch per event name — it upserts `billing_subscriptions` from `data.attributes` + `meta.custom_data.user_id` for any event whose name starts with `subscription_`. Naturally idempotent: a duplicate/retried webhook re-applies the same current state. |
| Checkout | Lemon Squeezy hosted checkout, created via `POST /v1/checkouts` from a Server Action, redirect-based. Card data never touches our server. |
| Access during cancellation | A cancelled subscription keeps Team status until `ends_at` (the user already paid for that period). `hasActiveTeamPlan()` accounts for this explicitly, even though nothing consumes it for gating yet — so it's correct when gating is added later. |
| Reconciliation | No automatic re-sync if a webhook is lost or delayed. Accepted MVP risk — manual fix via Lemon Squeezy dashboard's "resend webhook" if it ever comes up. Out of scope: an admin "sync now" action. |

## Architecture

```
User clicks "Upgrade to Team"          src/app/dashboard/settings (Billing card)
   │  createCheckoutUrl() Server Action   src/app/dashboard/actions.ts
   ▼  POST https://api.lemonsqueezy.com/v1/checkouts
   │    checkout_data.custom = { user_id }
   redirect → Lemon Squeezy hosted checkout page
   │  (user pays on LS-hosted page — no card data touches our server)
   ▼  LS redirects back to /dashboard/settings?checkout=success
      (billing_subscriptions may not be updated yet — webhook is async;
       UI shows a "processing, refresh shortly" toast)

                     ...meanwhile, asynchronously...

Lemon Squeezy → POST /api/webhooks/lemonsqueezy
   │  verify X-Signature (HMAC-SHA256, LEMONSQUEEZY_WEBHOOK_SECRET)
   │  event_name starts with "subscription_" →
   │    upsert billing_subscriptions (onConflict: user_id)
   │    from data.attributes + meta.custom_data.user_id
   ▼  200 OK

Settings page (Server Component)
   │  reads billing_subscriptions for the current user
   │  hasActiveTeamPlan(row)                 src/lib/billing.ts (pure, tested)
   ▼  Billing card renders Upgrade / Manage subscription accordingly
```

## New files

- `supabase/migrations/20260725150000_billing_subscriptions.sql` — table, RLS, grants, trigger extension.
- `src/lib/billing.ts` — `hasActiveTeamPlan(row: BillingSubscriptionRow | null): boolean`, pure.
- `src/lib/billing.test.ts` — covers active, on_trial, past_due, cancelled-with-future-`ends_at`, cancelled-with-past-`ends_at`, expired, paused, unpaid, `null` row.
- `src/lib/lemonsqueezy.ts` — thin API client: `createCheckoutUrl({ userId, email }): Promise<string>` and `verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean`.
- `src/lib/lemonsqueezy.test.ts` — `verifyWebhookSignature()` only (pure HMAC comparison, fixed secret/payload fixtures). `createCheckoutUrl()` is not unit-tested (I/O, matches `extraction/{anthropic,google,deepseek}.ts` convention).
- `src/app/api/webhooks/lemonsqueezy/route.ts` — signature verification + upsert.
- `src/app/dashboard/settings/billing-card.tsx` — client component, renders plan/status, Upgrade button (calls the Server Action, redirects) or Manage subscription link (`customer_portal_url`, opens in new tab).

## Modified files

- `src/app/dashboard/actions.ts` — add `createCheckoutUrl()` Server Action, alongside the existing `createInbox`/`changePassword`/`deleteAccount` actions (same file, matching how Settings actions are already co-located here rather than a separate `settings/actions.ts`).
- `src/app/dashboard/settings/page.tsx` — fetch the user's `billing_subscriptions` row, render `<BillingCard />` as a new card (same pattern as the existing Password/Danger zone cards).
- `src/lib/landing/dictionary.ts` — trim Team plan's `features` array (both locales): remove "Shared workspace" and "Priority parsing".
- `.env.local.example` — add `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_TEAM_VARIANT_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`.
- `docs/third-party-services.md` — new "Lemon Squeezy" section (fee %, MoR notes, test-mode note).

## Data model changes

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

alter table public.billing_subscriptions enable row level security;

create policy "Users can view their own billing subscription"
  on public.billing_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on table public.billing_subscriptions to authenticated;
grant select, insert, update, delete on table public.billing_subscriptions to service_role;
```

No `insert`/`update`/`delete` policy for `authenticated` — a user can read their own row but
never write it directly; only the webhook (via `service_role`, after HMAC verification) ever
mutates billing state.

`handle_new_user()` (`supabase/migrations/20260720093820_profiles.sql`) is extended to also
insert a default `billing_subscriptions` row (`plan = 'starter'`, `status = 'none'`) alongside
the existing `profiles` insert, so every user has exactly one row and no code needs to
null-check a missing subscription record.

## Gating logic (for future use)

```ts
type BillingSubscriptionRow = {
  status: "none" | "on_trial" | "active" | "paused" | "past_due" | "unpaid" | "cancelled" | "expired";
  endsAt: string | null;
};

function hasActiveTeamPlan(row: BillingSubscriptionRow | null): boolean {
  if (!row) return false;
  if (["active", "on_trial", "past_due"].includes(row.status)) return true;
  if (row.status === "cancelled" && row.endsAt) return new Date(row.endsAt) > new Date();
  return false;
}
```

Not called from any gated route in this pass — only from the Settings billing card, to decide
which button/status to show.

## Error handling

- `createCheckoutUrl()` — Lemon Squeezy API failure → `{ ok: false, error: "Could not start checkout. Please try again." }`, log the real error server-side (`console.error("Failed to create checkout", userId, error)`), never surface the raw API error to the user.
- Webhook signature invalid → `400`, matching the existing AgentMail webhook pattern (`src/app/api/webhooks/agentmail/route.ts`).
- Webhook payload with a `user_id` in `custom_data` that doesn't match any user (tampered, stale, or a checkout initiated without our metadata) → log a warning server-side, still return `200`. Acking prevents Lemon Squeezy from retrying an event we can never successfully apply.
- Missing env vars (`LEMONSQUEEZY_*`) in local dev → `createCheckoutUrl()` throws on startup-style misconfiguration is out of scope; the Server Action's own try/catch turns any failure (including a missing API key) into the generic `ok: false` result above.

## Testing

- `src/lib/billing.test.ts` — full branch coverage of `hasActiveTeamPlan()` per status, plus the cancelled/`ends_at` boundary.
- `src/lib/lemonsqueezy.test.ts` — `verifyWebhookSignature()` against known-good and tampered payloads.
- `createCheckoutUrl()` and the webhook route are not unit-tested (I/O-heavy, matches `.claude/rules/testing.md`'s existing carve-out for Server Actions and API routes). Verified manually instead: a real checkout run in **Lemon Squeezy test mode** (no real charge), confirming `billing_subscriptions` updates via the real webhook delivery, confirming the Settings billing card reflects Upgrade → Manage after payment, and confirming a mid-period cancellation keeps `hasActiveTeamPlan()` true until `ends_at`.
- `npm run test`, `npx tsc --noEmit`, `npm run build` all clean before considering this done, per existing convention.

## Out of scope

- Any feature gating (`/dashboard/analytics`, `/dashboard/exports`, multi-inbox, or otherwise) — follow-up specs once the underlying feature actually exists.
- Multi-inbox support — surfaced during design as a real but separate feature (schema change, new list/manage UI, `createInbox()` rework); not part of this billing pass.
- Usage/volume limits on the Starter plan (invoice count, email count).
- Proration, plan changes/upgrades between multiple paid tiers — there is only one paid variant.
- An admin "resync subscription from Lemon Squeezy" action for lost-webhook recovery.
- Terms of Service / Privacy Policy pages — separate, non-engineering workstream (legal content), tracked outside this spec.
