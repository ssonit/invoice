# Subscription Reminders — Invoice Reader

**Date:** 2026-07-22
**Status:** Approved for implementation

## Goal

Detect recurring (subscription) invoices from a user's existing invoice data, and periodically ask the user to confirm whether they're still using each subscription — so they can catch and cancel ones they've forgotten about. Surfaced on the existing `/dashboard/vendors` route (currently a `status: "soon"` placeholder in `nav-config.ts`), which is promoted to `status: "live"`.

## Decisions

| Item | Choice |
|---|---|
| Detection | Rule-based: group invoices by normalized vendor, classify by median day-gap between consecutive invoices. No AI/LLM involved — deterministic, unit-testable. |
| Reminder channel | In-dashboard banner only (no outbound email — AgentMail is receive-only today; sending is out of scope). |
| Persisted state | Only the user's yes/no answer per vendor (`subscription_confirmations`). Detected subscriptions themselves are computed on read from `invoices`, not persisted — avoids a second table that must stay in sync with invoice data. |
| Surface | `/dashboard/vendors` (promote existing placeholder), not a new nav item. |
| Manual override | None in v1 — pure auto-detection. (Noted as a fast-follow, not building now — see Out of scope.) |

## Architecture

```
invoices (existing table)
   │  query per request
   ▼
detectSubscriptions()          src/lib/subscriptions.ts (pure fn)
   │  candidates: {vendorKey, vendorLabel, cycle, lastIssueDate, nextExpectedDate}
   ▼
withConfirmationStatus()       src/lib/subscriptions.ts (pure fn)
   │  joins candidates + subscription_confirmations rows → status per vendor
   ▼
/dashboard/vendors (Server Component)
   │  renders "Needs confirmation" + "All vendors" sections
   ▼
confirmSubscription() Server Action   src/app/dashboard/vendors/actions.ts
   │  upsert subscription_confirmations, revalidatePath
   ▼
subscription_confirmations (new table, RLS: user_id = auth.uid())
```

No new background jobs, no cron, no email. Everything computes at request time from data already being queried elsewhere in the app (same pattern as `computeStats`/`monthlyTrend` in `src/lib/invoices.ts`).

## Data model

New migration, new table only (no changes to `invoices`):

```sql
create table public.subscription_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vendor_key text not null,
  status text not null check (status in ('active', 'cancelled')),
  confirmed_at timestamptz not null default now(),
  unique (user_id, vendor_key)
);
```

RLS: enable, policies for `select`/`insert`/`update` scoped to `(select auth.uid()) = user_id` (same shape as the existing `invoices` policies). One row per `(user_id, vendor_key)` — each new confirmation **upserts** (overwrites), no history log in v1.

## Detection logic (`src/lib/subscriptions.ts`)

```ts
export type SubscriptionCycle = "monthly" | "yearly";

export type SubscriptionCandidate = {
  vendorKey: string;        // normalized grouping key (lowercase, trimmed, whitespace-collapsed)
  vendorLabel: string;      // display name, taken from the most recent invoice
  cycle: SubscriptionCycle;
  invoiceCount: number;
  lastAmount: number | null;
  currency: string | null;
  lastIssueDate: string;    // ISO date of the most recent matching invoice
  nextExpectedDate: string; // ISO date = lastIssueDate + cycle length
};

export function normalizeVendorKey(vendor: string): string;
export function detectSubscriptions(invoices: InvoiceRow[]): SubscriptionCandidate[];
```

Algorithm:
1. Filter invoices with non-null `vendor` and `issue_date`.
2. Group by `normalizeVendorKey(vendor)`.
3. Skip groups with fewer than 2 invoices (no pattern to detect).
4. Sort group by `issue_date` ascending, compute day-gaps between consecutive invoices, take the **median** gap (robust to one irregular gap).
5. Classify: median in `[25, 35]` → `monthly`; median in `[350, 380]` → `yearly`; otherwise the group is not a recognizable subscription and is dropped.
6. `nextExpectedDate` = last `issue_date` + fixed cycle length (30 or 365 days — not the raw median, so projections stay predictable).

All date math uses UTC day boundaries (`Date.UTC(...)` / `getUTC*()`), matching the existing convention in `src/lib/invoices.ts` (`computeStats`, `monthlyTrend`) — no local-timezone drift between server render and stored `issue_date` strings.

## Reminder eligibility (`src/lib/subscriptions.ts`)

```ts
export type SubscriptionStatus = "upcoming" | "due" | "confirmed_active" | "cancelled";

export type SubscriptionWithStatus = SubscriptionCandidate & {
  status: SubscriptionStatus;
  needsConfirmation: boolean;
};

export function withConfirmationStatus(
  candidates: SubscriptionCandidate[],
  confirmations: Map<string, { status: "active" | "cancelled"; confirmedAt: string }>,
  today?: Date,
): SubscriptionWithStatus[];
```

Per candidate, reminder window = `[nextExpectedDate - 3 days, nextExpectedDate + 21 days]`:
- `confirmation.status === "cancelled"` → `status: "cancelled"`, `needsConfirmation: false`.
- `confirmation.status === "active"` and `confirmedAt` falls within the current cycle (after `nextExpectedDate - cycleLengthDays`) → `status: "confirmed_active"`, `needsConfirmation: false`.
- Otherwise, if `today` is inside the reminder window → `status: "due"`, `needsConfirmation: true`.
- Otherwise → `status: "upcoming"`, `needsConfirmation: false`.

## Validation (`src/lib/validation/subscriptions.ts`)

Following the pattern in `src/lib/validation/auth.ts` / `upload.ts`: a small Zod schema for the confirm action's input (`vendorKey`: non-empty string, `status`: enum `active`/`cancelled`), used in the Server Action before the DB write.

## UI — `/dashboard/vendors`

Replaces the current `ComingSoon` placeholder. Server Component:
1. Query `invoices` for the user (same query shape as the Overview page) + `subscription_confirmations` for the user.
2. Compute `detectSubscriptions()` → `withConfirmationStatus()`.
3. Render:
   - **"Needs your confirmation"** section (only rendered if any `status === "due"`): one card per due subscription — vendor name, cycle badge (Monthly/Yearly), last amount, two buttons `Still using it` / `Cancelled` wired to `confirmSubscription` via a small client component (matches the `CreateInboxButton` pattern already in `dashboard/settings`).
   - **"All vendors"** section: a table of every vendor seen in `invoices` (not just subscriptions) — total spent, invoice count, last invoice date — subscriptions additionally show the cycle badge + current status (Active/Cancelled/Upcoming). This fulfills the placeholder's original description ("vendor list, dedupe, spend history").
4. `nav-config.ts`: change the Vendors item's `status` from `"soon"` to `"live"`.

## Testing (`src/lib/subscriptions.test.ts`, `src/lib/validation/subscriptions.test.ts`)

- `normalizeVendorKey`: casing/whitespace variants collapse to the same key.
- `detectSubscriptions`:
  - 3 invoices ~30 days apart → detected as `monthly`, correct `nextExpectedDate`.
  - 2 invoices ~365 days apart → detected as `yearly`.
  - irregular gaps (e.g. 10, 90, 5 days) → not detected.
  - single invoice for a vendor → not detected.
  - multiple vendors → grouped independently, no cross-contamination.
- `withConfirmationStatus`:
  - no confirmation + today inside window → `due`.
  - confirmed `active` within the current cycle → `confirmed_active`.
  - confirmed `cancelled` → `cancelled`.
  - today before the window → `upcoming`.
- `subscriptions` validation schema: valid/invalid `vendorKey`/`status` payloads.

## Error handling

- No invoices / no detected subscriptions → "All vendors" section shows existing `Empty` component; no "Needs confirmation" section rendered.
- `confirmSubscription` DB error → Server Action returns/redirects with an inline error (same pattern as `createInbox` in `dashboard/actions.ts`), no silent failure.
- Detection is defensive against malformed rows (missing vendor/issue_date already filtered; NaN amounts already normalized upstream by `normalizeInvoice`).

## Out of scope (fast-follows, not building now)

- Manual "mark as subscription" override for vendors the auto-detector misses (e.g. only 1 invoice seen so far, or irregular billing).
- Outbound email reminders via AgentMail send.
- Confirmation history/audit log (currently upsert-only, latest state wins).
- Cost/savings estimate ("you could save $X/year by cancelling").
