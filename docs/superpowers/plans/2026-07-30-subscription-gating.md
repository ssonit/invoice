# Subscription Feature Gating — TDD Implementation Plan

**Design:** `docs/superpowers/specs/2026-07-30-subscription-gating-design.md`
**Date:** 2026-07-30

## Task 1: Library layer — pure helpers + env validation + tests

### Step 1

Add `TeamAccess` type and `isBillingDevUnlockEnabled()` to `src/lib/billing.ts`.

- `TeamAccess` = discriminated union: `{ allowed: true; reason: "team" | "dev_unlock" } | { allowed: false; reason: "denied" }`
- `isBillingDevUnlockEnabled()`: reads `BILLING_DEV_UNLOCK`, `VERCEL_ENV`, `NODE_ENV`

### Step 2

Add tests to `src/lib/billing.test.ts`:

- [x] `BILLING_DEV_UNLOCK=true`, non-prod → true
- [x] `BILLING_DEV_UNLOCK` not set → false
- [x] `BILLING_DEV_UNLOCK` not exactly `"true"` → false
- [x] `VERCEL_ENV=production` → false (even with unlock set)
- [x] `NODE_ENV=production` → false (even with unlock set)
- [x] Both prod guards set → false

### Step 3

Create `src/lib/billing/access.ts` with `getTeamAccess()`:

- Check `isBillingDevUnlockEnabled()` first (no DB hit if true)
- Fall through to `createClient()` → `billing_subscriptions` → `hasActiveTeamPlan()`
- Return `TeamAccess`

### Step 4

Add optional `BILLING_DEV_UNLOCK` to `src/lib/validation/env.ts` env schema.

### Step 5

Verify: `npm run test`, `npx tsc --noEmit`

## Task 2: UI layer — TeamGate + wire gating

### Step 1

Create `src/components/dashboard/team-gate.tsx` ("use client"):

- Upgrade CTA panel with lock icon, "Upgrade to Team" heading, description
- "Upgrade to Team" button → `createCheckoutUrl()` server action
- Pending state with spinner

### Step 2

Gate `src/app/dashboard/analytics/page.tsx`:

- Call `getTeamAccess()` at top of server component
- If denied, render `<TeamGate title="Analytics" description="..." />`
- Otherwise proceed with existing logic

### Step 3

Gate `src/app/dashboard/exports/page.tsx`:

- Same pattern as Analytics

### Step 4

Gate `src/app/api/exports/invoices/route.ts`:

- Call `getTeamAccess()` at top of handler
- If denied, return `NextResponse.json({ error: "Team plan required for CSV exports." }, { status: 403 })`

### Step 5

Update `src/app/dashboard/settings/billing-card.tsx`:

- Import `isBillingDevUnlockEnabled`
- Show muted "Dev unlock on" badge when active

### Step 6

Verify: `npm run test`, `npx tsc --noEmit`, `npm run build`

## Task 3: Documentation

### Step 1

Add `BILLING_DEV_UNLOCK` to `.env.local.example` with defensive comment.

### Step 2

Append gating section to `docs/billing-lemonsqueezy.md`:

- What's gated table
- How gating works (3-step check)
- Dev unlock usage
- SQL grant snippet
- Real test checkout note

### Step 3

Write design record (`docs/superpowers/specs/2026-07-30-subscription-gating-design.md`) and this plan.

### Step 4

Verify: `npm run test`, `npx tsc --noEmit`, `npm run build`

## Verification checklist

- [ ] `npm run test` — all 310 tests pass
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — succeeds
- [ ] Manual: `BILLING_DEV_UNLOCK=true` → Analytics + Exports load without Team row
- [ ] Manual: unlock off, no Team row → upgrade panel on Analytics/Exports, API returns 403
- [ ] Manual: Settings billing card shows "Dev unlock on" badge when active
- [ ] Manual: Settings billing card does NOT show badge when unlock is off
