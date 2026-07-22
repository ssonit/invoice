# Subscription Reminders

**Status:** Shipped 2026-07-22
**Design:** [`docs/superpowers/specs/2026-07-22-subscription-reminders-design.md`](superpowers/specs/2026-07-22-subscription-reminders-design.md)
**Plan:** [`docs/superpowers/plans/2026-07-22-subscription-reminders.md`](superpowers/plans/2026-07-22-subscription-reminders.md)

## What it does

Detects recurring (subscription) invoices from a user's existing invoice history and
periodically asks the user, in-dashboard, whether they're still using each one — so
forgotten subscriptions get noticed and can be cancelled. Surfaced on `/dashboard/vendors`
(promoted from a `status: "soon"` placeholder to `status: "live"` in `src/lib/nav-config.ts`).

No AI/LLM involved in detection, no outbound email — everything is computed at request
time from data already stored, and confirmations are shown as an in-dashboard banner only.

## Detection heuristic

Pure functions in [`src/lib/subscriptions.ts`](../src/lib/subscriptions.ts):

1. Group invoices by `normalizeVendorKey(vendor)` (lowercase, trimmed, whitespace-collapsed).
2. Skip vendors with fewer than 2 invoices — no pattern to detect from a single data point.
3. Sort each group by `issue_date` ascending, compute the day-gaps between consecutive
   invoices, and take the **median** gap (robust to one irregular gap in the history).
4. Classify by median gap: `[25, 35]` days → `monthly`, `[350, 380]` days → `yearly`.
   Anything outside both ranges is not a recognizable subscription and is dropped.
5. `nextExpectedDate` = last `issue_date` + a fixed cycle length (30 or 365 days, not the
   raw median), so projections stay predictable rather than drifting with irregular history.

All date math uses UTC day boundaries, matching the existing convention in
`src/lib/invoices.ts` (`computeStats`, `monthlyTrend`).

## Reminder window

A detected subscription needs the user's confirmation when today falls inside
`[nextExpectedDate - 3 days, nextExpectedDate + 21 days]` — `withConfirmationStatus()`
in the same file. Confirmation state layers on top:

- No confirmation, today in window → `due` (shown in "Needs your confirmation").
- Confirmed `active` within the current cycle → `confirmed_active` (no reminder until
  the next cycle's window opens).
- Confirmed `cancelled` → `cancelled`, unless a newer invoice has arrived since the
  cancellation (billing resumed) — in that case it re-enters `due`/`upcoming` evaluation.
- Otherwise → `upcoming` (no reminder yet).

## Data model

Only the user's yes/no answer is persisted, in `subscription_confirmations`
(migration `supabase/migrations/20260722200000_subscription_confirmations.sql`):
one row per `(user_id, vendor_key)`, upserted on every answer — no history log.
Detected subscriptions themselves are never persisted; they're recomputed on every
page load from `invoices`, so there's no second table to keep in sync.

## Out of scope (v1)

- Manual "mark as subscription" override for vendors the auto-detector misses.
- Outbound email reminders via AgentMail send (AgentMail is receive-only today).
- Confirmation history/audit log (upsert-only, latest state wins).
- Cost/savings estimate ("you could save $X/year by cancelling").
