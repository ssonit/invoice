-- Soft-hide duplicate invoices (never physically deleted — see
-- .claude/rules/data-safety.md). Hidden rows keep their content_hash so a
-- re-upload of the same file is still recognised as already processed.
alter table public.invoices add column deleted_at timestamptz;

-- Fold each duplicate's hit count into the oldest row of its
-- (user, vendor, invoice number) group, then hide the later rows.
with ranked as (
  select
    id,
    user_id,
    vendor_key,
    invoice_number,
    duplicate_hit_count,
    first_value(id) over w as keeper_id,
    row_number() over w as rn
  from public.invoices
  where vendor_key is not null
    and invoice_number is not null
    and trim(invoice_number) <> ''
  window w as (partition by user_id, vendor_key, trim(invoice_number) order by created_at, id)
),
folded as (
  update public.invoices k
  set duplicate_hit_count = coalesce(k.duplicate_hit_count, 0) + s.extra
  from (
    select keeper_id, sum(1 + coalesce(duplicate_hit_count, 0)) as extra
    from ranked where rn > 1 group by keeper_id
  ) s
  where k.id = s.keeper_id
  returning k.id
)
update public.invoices i
set deleted_at = now()
from ranked r
where i.id = r.id and r.rn > 1;

create index invoices_user_active_idx on public.invoices (user_id) where deleted_at is null;

-- Vendor views must ignore hidden rows. invoices.* now includes deleted_at, so
-- the views are dropped and recreated (create or replace can't change columns).
drop view public.vendor_recent_invoices;
drop view public.vendor_invoice_stats;

create view public.vendor_invoice_stats
with (security_invoker = true) as
with agg as (
  select user_id, vendor_key, sum(amount) as total, count(*) as count, max(issue_date) as last_date
  from public.invoices
  where vendor_key is not null and deleted_at is null
  group by user_id, vendor_key
),
latest as (
  select distinct on (user_id, vendor_key) user_id, vendor_key, vendor as label, currency
  from public.invoices
  where vendor_key is not null and deleted_at is null
  order by user_id, vendor_key, issue_date desc nulls last, created_at desc
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
  where vendor_key is not null and issue_date is not null and deleted_at is null
) ranked
where rn <= 6;

grant select on public.vendor_invoice_stats to authenticated, service_role;
grant select on public.vendor_recent_invoices to authenticated, service_role;
