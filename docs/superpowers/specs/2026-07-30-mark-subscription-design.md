# Mark As Subscription — Design Spec

**Status:** In progress
**Date:** 2026-07-30
**Parent:** [Subscription Reminders](../2026-07-22-subscription-reminders-design.md)

## Goal

Let users manually mark a vendor as a monthly/yearly subscription when the auto-detector
misses them (e.g. only 1 invoice, or irregular gaps), so it shows up in the Subscription
filter, gets a cycle badge, and can later be confirmed/cancelled like detected ones.

## Why schema change is required

Today `detectSubscriptions` alone builds candidates; `confirmSubscription` only stores
yes/no. A confirmation **without** a detected candidate never appears on the page
(`page.tsx` only attaches `subscription` when `subscriptions.find(...)` hits). Manual mark
must persist **cycle** and produce a **synthetic candidate**.

## Design decisions

- **Extend `subscription_confirmations`**, not a new table:
  - `origin text not null default 'reminder' check (origin in ('reminder', 'manual'))`
  - `cycle text check (cycle in ('monthly', 'yearly'))` — **required when `origin = 'manual'`**; null for reminder-only rows
- **Eligibility:** vendor must have **>=1 invoice with `issue_date`** (use latest). No invoices -> toast error, no row.
- **Action:** `markVendorAsSubscription(vendorKey, cycle)` -> upsert `origin=manual`, `cycle`, `status=active`, `confirmed_at=now()`.
- **Merge:** pure `buildManualCandidates(invoices, manualRows)` + `mergeSubscriptionCandidates(detected, manual)` (manual overrides same `vendorKey`).
- **UI:** on vendor detail Sheet when `subscription == null`: "Mark as subscription" -> two choices Monthly / Yearly.
- **Reminders:** manual candidates get `nextExpectedDate = lastIssueDate + 30|365` and enter the same due window.

## Architecture

```
ui["Mark as subscription" UI] -> action["markVendorAsSubscription"]
action -> upsert["upsert subscription_confirmations origin=manual"]
page["vendors/page.tsx"] -> detect["detectSubscriptions"]
page -> manuals["buildManualCandidates"]
detect -> merge["mergeSubscriptionCandidates"]
manuals -> merge
merge -> status["withConfirmationStatus"]
status -> list["VendorListItem.subscription"]
```

## Files

| Path | Change |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_subscription_manual_mark.sql` | Add `origin`, `cycle` + check constraint |
| `src/constants/subscriptions.ts` | `SUBSCRIPTION_ORIGIN` |
| `src/lib/subscriptions.ts` | `buildManualCandidates`, `mergeSubscriptionCandidates` |
| `src/lib/subscriptions.test.ts` | Cover 1-invoice manual, merge override, skip no issue_date |
| `src/lib/validation/subscriptions.ts` | `parseMarkSubscriptionInput` |
| `src/app/dashboard/vendors/actions.ts` | `markVendorAsSubscription` |
| `src/components/dashboard/vendors/mark-subscription-button.tsx` | Client UI |
| `src/components/dashboard/vendors/vendors-list.tsx` | Wire button in Sheet |
| `src/app/dashboard/vendors/page.tsx` | Load `origin`/`cycle`; merge manuals into pipeline |
| `docs/subscription-reminders.md` | Document manual mark; remove from out-of-scope |

## Out of scope

- Deploy/CI
- Analytics / Exports / gating
- Editing cycle after mark (cancel + re-mark is enough)
- Creating subscriptions with no invoice history
- Outbound email reminders
