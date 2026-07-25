# Vendor Stats & Subscription Detection Scalability

**Date:** 2026-07-25  
**Design:** [docs/superpowers/specs/2026-07-25-vendor-stats-scalability-design.md](./superpowers/specs/2026-07-25-vendor-stats-scalability-design.md)  
**Plan:** [docs/superpowers/plans/2026-07-25-vendor-stats-scalability.md](./superpowers/plans/2026-07-25-vendor-stats-scalability.md)

## Problem

`/dashboard/vendors` used to run an unbounded `SELECT * FROM invoices WHERE user_id = ?`
on every page load, then reduce the full result set in JavaScript for:

1. Per-vendor totals (sum, count, last date)
2. Subscription cadence detection (`detectSubscriptions`)
3. Eager full invoice history for every vendor's detail Sheet

Payload size and JS work grew forever with a user's invoice count. Vendors-list
pagination alone cannot fix this — the full fetch happened regardless of how many
vendors were shown per page.

## Solution

### 1. Generated `invoices.vendor_key`

A stored generated column normalizes vendor names the same way `vendors.name_key` does
(`lower(regexp_replace(trim(vendor), '\s+', ' ', 'g'))`). Postgres backfills and keeps
it in sync when `vendor` is written — no separate backfill job.

Indexed as `(user_id, vendor_key)` so rename/delete and the views can filter without
scanning every invoice and normalizing in the app.

### 2. `vendor_invoice_stats` (exact aggregates)

One row per `(user_id, vendor_key)` with `total`, `count`, `last_date`, plus the latest
invoice's `label`/`currency`. Replaces JS-side reduction over every invoice. Totals
remain exact no matter how many rows exist under a vendor.

### 3. `vendor_recent_invoices` (windowed sample)

At most 6 most-recent invoices per vendor (`ROW_NUMBER() … ORDER BY issue_date DESC`).
Enough for median-gap subscription detection without transferring a vendor's full
history on every page load.

### 4. `detectSubscriptions()` unchanged

`src/lib/subscriptions.ts` already works on whatever invoices it receives per vendor.
Only the input is bounded (windowed view instead of all invoices). Existing unit tests
pass without edits.

### 5. Lazy detail Sheet history

`getVendorInvoices(vendorKey)` loads the full list for one vendor when the Sheet opens.
Until that resolves, the UI shows the windowed sample (with a small spinner).

### 6. Rename / delete via `vendor_key`

`updateVendor` / `deleteVendor` no longer fetch all invoices and filter in JS. They
bulk-update by `vendor_key`; updating `vendor` recomputes the generated column.

## Key files

| File | Role |
|------|------|
| `supabase/migrations/20260725140000_vendor_stats_views.sql` | `vendor_key`, views, grants |
| `src/app/dashboard/vendors/page.tsx` | Queries the two views instead of all invoices |
| `src/app/dashboard/vendors/actions.ts` | Bulk rename/delete; `getVendorInvoices` |
| `src/components/dashboard/vendors/vendors-list.tsx` | On-demand full history in the Sheet |

## Sequencing

Implement this before Vendors URL-driven pagination
(`docs/superpowers/plans/2026-07-25-vendors-pagination.md`) — pagination without
bounded invoice fetching would still leave the unbounded load in place.
