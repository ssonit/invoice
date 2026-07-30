# Subscription Feature Gating — Design Record

**Date:** 2026-07-30
**Plan:** `docs/superpowers/plans/2026-07-30-subscription-gating.md`

## Problem

The billing integration (Lemon Squeezy checkout + webhook) shipped 2026-07-25, but
nothing actually gates features by plan. The landing page sells Team as the analytics +
exports tier, and both features now exist as real pages — so Starter users can use
features they haven't paid for.

## Decisions

### 1. Entitlement API: one function, one call pattern

`getTeamAccess()` in `src/lib/billing/access.ts` — the single function every gated route
calls. It separates pure logic (`isBillingDevUnlockEnabled`, `hasActiveTeamPlan`) from
the I/O-heavy DB lookup, so the pure parts stay unit-testable.

Return type:
```ts
type TeamAccess =
  | { allowed: true; reason: "team" | "dev_unlock" }
  | { allowed: false; reason: "denied" };
```

The discriminator `reason` gives callers visibility into *why* access was granted —
useful for the Settings billing card's "Dev unlock on" badge, and for debugging.

### 2. Dev unlock: env-var guard with defense in depth

`BILLING_DEV_UNLOCK=true` in `.env.local` gives every signed-in user full Team access
**unless** `VERCEL_ENV === "production"` OR `NODE_ENV === "production"`. Both guards
are in the pure function `isBillingDevUnlockEnabled()` itself — there is no way to
accidentally flip the unlock flag without checking the prod guard.

The env var is:
- Validated as optional string in `src/lib/validation/env.ts` (same pattern as Upstash)
- Documented in `.env.local.example` with a loud "NEVER set on Vercel Production" comment
- Surfaced in the Settings billing card as a muted "Dev unlock on" badge

### 3. Paywall UX: upgrade panel, not 404

Gated pages render an upgrade CTA panel (TeamGate component) that explains what Team
unlocks and offers a "Upgrade to Team" button (→ Lemon Squeezy checkout via
`createCheckoutUrl()`). The URL stays the same — the user knows where they'll land after
upgrading.

For the API route (`GET /api/exports/invoices`), a 403 JSON response is the right UX
because the consumer is a CSV download button, not a human navigating to a page.

### 4. No credits, no multi-inbox, no seats

Out of scope for this pass:
- Usage meters / invoice quotas
- Multi-inbox as a Team perk
- Shared workspace / seats
- Admin UI to grant Team (SQL is enough)
- Changing Lemon Squeezy pricing

Team = full access to Analytics + Exports. Starter = everything else. Simple, binary,
easy to explain on the landing page.

## Alternatives considered

| Alternative | Rejected because |
|-------------|-----------------|
| Check on every API call (middleware) | Adds latency to every request; unnecessary for two gated routes |
| Hard 404 | Confusing UX — user should see an upgrade path, not a "page doesn't exist" |
| `getTeamAccess(userId)` param | Redundant — the function gets the user from the session cookie anyway |
| Credits / metered billing | Adds complexity (tracking, fairness, overage UX) for no clear product need at MVP |
| Gating in middleware | Next.js middleware runs on the Edge runtime; can't import server-only Supabase client |

## Key files

| File | Role |
|------|------|
| `src/lib/billing.ts` | Pure helpers: `hasActiveTeamPlan()`, `isBillingDevUnlockEnabled()`, `TeamAccess` type |
| `src/lib/billing/access.ts` | `getTeamAccess()` — I/O orchestration: dev unlock → DB row → hasActiveTeamPlan |
| `src/lib/validation/env.ts` | Optional `BILLING_DEV_UNLOCK` in env schema |
| `src/components/dashboard/team-gate.tsx` | Client component — upgrade CTA panel for gated pages |
| `src/app/dashboard/analytics/page.tsx` | Gated: calls `getTeamAccess()`, renders TeamGate if denied |
| `src/app/dashboard/exports/page.tsx` | Gated: same pattern |
| `src/app/api/exports/invoices/route.ts` | Gated: 403 JSON if denied |
| `src/app/dashboard/settings/billing-card.tsx` | Dev unlock badge when applicable |
| `.env.local.example` | Documented `BILLING_DEV_UNLOCK` entry |
