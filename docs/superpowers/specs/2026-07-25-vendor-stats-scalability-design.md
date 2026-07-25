# Vendor Stats & Subscription Detection — Scalable Rearchitecture

**Date:** 2026-07-25
**Status:** Approved for implementation

## Goal

`/dashboard/vendors` currently does `SELECT * FROM invoices WHERE user_id = ?` with no
bound, every page load, then reduces the full result set in JS to compute per-vendor
totals and subscription cadence. This scales linearly (unbounded) with a user's total
invoice count — both the JSON payload transferred from Postgres and the JS reduction
work grow forever. Flagged during review of the (separately planned, not yet
implemented) Vendors pagination work — pagination alone doesn't fix this, since the full
fetch happens regardless of how many vendors are shown per page.

## Root-cause insight

Only **subscription cadence detection** genuinely needs invoices in date order — and even
that only needs a recent window per vendor (median gap between the last handful of
charges), not the full history. **Vendor totals** (sum spent, invoice count, last date)
never needed row-level data in the app at all — Postgres can compute exact aggregates via
`GROUP BY` in the database, returning one row per vendor regardless of how many
underlying invoice rows exist.

## Decisions

| Item | Decision |
|---|---|
| Vendor totals | New Postgres view `vendor_invoice_stats` — one row per vendor via SQL aggregation, exact, no row cap needed since it's computed in the database, not transferred row-by-row. |
| Subscription detection input | New Postgres view `vendor_recent_invoices` — at most 6 most-recent (by `issue_date`) invoices per vendor, via `ROW_NUMBER() OVER (PARTITION BY ...)`. `detectSubscriptions()` itself (`src/lib/subscriptions.ts`) is **not modified** — it already operates correctly on however many invoices it's given per vendor; only the data fed into it changes from unbounded to windowed. |
| Vendor-key grouping | Both views group by a new **generated, stored, indexed** column `invoices.vendor_key` (same normalization already used for `vendors.name_key`: `lower(regexp_replace(trim(vendor), '\s+', ' ', 'g'))`), rather than recomputing normalization per-query or per-row in JS. |
| Vendor detail Sheet (full invoice history) | Currently shipped eagerly for every vendor on every page load. Switches to **lazy-loaded on demand** — a new Server Action fetches a vendor's full invoice list only when its detail Sheet is opened, matching the "only fetch what's currently displayed" principle already applied to Invoices/Inbox/Vendors-list. The Sheet shows the windowed (≤6) invoices immediately, then swaps in the full list once the on-demand fetch resolves. |
| Orphan vendor-heal | Currently iterates the full unbounded invoice array to find vendor names missing a `vendors` row. Switches to iterating `vendor_invoice_stats` (one row per distinct vendor) instead — same logic, smaller input, faster as a side effect. |

## Schema changes

```sql
-- Generated column: self-maintaining, computed by Postgres whenever `vendor`
-- is written — no app-side normalization duplicated in every query.
alter table public.invoices
  add column vendor_key text generated always as (
    case when vendor is null then null
    else lower(regexp_replace(trim(vendor), '\s+', ' ', 'g'))
    end
  ) stored;

create index invoices_user_vendor_key_idx on public.invoices (user_id, vendor_key);

create view public.vendor_invoice_stats
with (security_invoker = true) as
with agg as (
  select user_id, vendor_key, sum(amount) as total, count(*) as count, max(issue_date) as last_date
  from public.invoices
  where vendor_key is not null
  group by user_id, vendor_key
),
latest as (
  select distinct on (user_id, vendor_key) user_id, vendor_key, vendor as label, currency
  from public.invoices
  where vendor_key is not null
  order by user_id, vendor_key, created_at desc
)
select agg.user_id, agg.vendor_key, latest.label, latest.currency, agg.total, agg.count, agg.last_date
from agg join latest using (user_id, vendor_key);

create view public.vendor_recent_invoices
with (security_invoker = true) as
select * from (
  select
    invoices.*,
    row_number() over (
      partition by user_id, vendor_key
      order by issue_date desc nulls last, created_at desc
    ) as rn
  from public.invoices
  where vendor_key is not null and issue_date is not null
) ranked
where rn <= 6;

grant select on public.vendor_invoice_stats to authenticated, service_role;
grant select on public.vendor_recent_invoices to authenticated, service_role;
```

`security_invoker = true` means both views run with the *querying* role's privileges, so
RLS on the underlying `invoices` table applies exactly as if `invoices` were queried
directly — no need to duplicate a `user_id = auth.uid()` condition inside the view.

`vendor_key` is a **generated** column (Postgres computes and backfills it for all
existing rows automatically on `ALTER TABLE`), not a manually-maintained one like
`vendors.name_key` — no separate backfill statement needed, and it stays correct forever
even if invoice editing is ever added later.

## `page.tsx` data-fetching rewrite

Replaces the single unbounded `invoices` fetch with:
1. `vendor_invoice_stats` — one row per vendor, feeds `total`/`count`/`lastDate`/`label`/`currency` directly (no JS reduction over raw rows).
2. `vendor_recent_invoices` — feeds `detectSubscriptions()` (unchanged function).
3. `vendors` table (unchanged — manual records with notes/created_at) and `subscription_confirmations` (unchanged) — same as today.

The merge step that builds `VendorListItem[]` from these pieces keeps the same shape and
the same `matchesFilter`/`sortVendors` functions — those operate on the final merged
array regardless of where each field came from, so neither needs to change.

`VendorListItem.invoices` becomes the windowed (≤6) set initially (used for the Sheet's
immediate display before the on-demand fetch resolves), not the full per-vendor history.

## Vendor detail Sheet — lazy full-history load

New Server Action in `src/app/dashboard/vendors/actions.ts`:
```ts
export async function getVendorInvoices(vendorKey: string): Promise<
  { ok: true; invoices: VendorListInvoice[] } | { ok: false; error: string }
>
```
Queries `invoices` directly (RLS-scoped client, no service role needed — a user reading
their own rows), filtered by `.eq("vendor_key", vendorKey)`, ordered by `issue_date desc`.
`VendorsList`'s Sheet calls this when it opens (on `selectedKey` becoming non-null),
replacing the initially-shown windowed invoices with the full list once it resolves — a
brief loading state covers the gap, consistent with how other on-demand loads in this app
are handled (e.g. `CreateInboxButton`'s pending state).

## Testing

`detectSubscriptions()` is unchanged — its existing 17-test suite
(`src/lib/subscriptions.test.ts`) remains valid without modification; the function's
*contract* (an array of invoices in, classify by vendor) hasn't changed, only what the
caller now passes in has. No new unit tests are needed for the SQL views themselves (not
unit-testable in this project's Vitest setup — verified manually, consistent with the
existing "routes/queries verified manually" convention). The new `getVendorInvoices`
Server Action is manually verified, matching every other Server Action in this codebase.

## Sequencing with the (separately planned) Vendors pagination work

`docs/superpowers/plans/2026-07-25-vendors-pagination.md` was written and committed
before this deeper issue was raised, and has **not yet been implemented**. This plan's
implementation should land first — it rewrites `page.tsx`'s data-fetching section (the
top half: how `vendors`/`vendorMap`/`subscriptions` get computed) and part of
`vendors-list.tsx` (the Sheet's invoice-loading behavior), while the pagination plan only
touches the tail end of both files (slicing the final computed array, the pagination
footer). Implementing this first, then the pagination plan on top, avoids rebasing one
plan's diffs against the other mid-flight.

## Out of scope

- Changing `detectSubscriptions()`'s internal logic or the monthly/yearly classification
  thresholds — unrelated to this fix.
- Materialized views / caching the aggregate view's results — a plain view recomputes on
  every query, which is fine at this scale (indexed `GROUP BY`); revisit only if this
  specific query is ever profiled as slow.
- Paginating the vendor detail Sheet's full invoice list once loaded (shows all of them,
  matching current behavior) — not requested, and a given vendor's own invoice count is
  bounded by realistic usage in a way the *whole-user* invoice count isn't.
