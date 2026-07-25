-- Generated, stored, indexed vendor-normalization column — Postgres computes
-- and backfills it automatically, and keeps it in sync forever (no separate
-- backfill step, unlike vendors.name_key which is a manually-maintained
-- column on a different table).
alter table public.invoices
  add column vendor_key text generated always as (
    case when vendor is null then null
    else lower(regexp_replace(trim(vendor), '\s+', ' ', 'g'))
    end
  ) stored;

create index invoices_user_vendor_key_idx on public.invoices (user_id, vendor_key);

-- One row per vendor with exact totals, computed by Postgres regardless of
-- how many underlying invoice rows exist — replaces JS-side reduction over
-- every invoice on every /dashboard/vendors load.
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

-- At most 6 most-recent (by issue_date) invoices per vendor — enough for
-- detectSubscriptions() to compute a reliable median gap without ever
-- fetching a vendor's full history.
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
