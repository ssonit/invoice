-- Manual vendor records. Invoice vendor strings still live on invoices.vendor;
-- this table lets users create/edit/delete vendors independently and keeps a
-- stable name_key for matching invoices + subscription confirmations.
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  name_key text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name_key)
);

create index vendors_user_id_idx on public.vendors (user_id);

alter table public.vendors enable row level security;

create policy "Users can view their own vendors"
  on public.vendors for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own vendors"
  on public.vendors for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own vendors"
  on public.vendors for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own vendors"
  on public.vendors for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.vendors to authenticated;
grant select, insert, update, delete on table public.vendors to service_role;

-- Backfill from existing invoice vendor names (same normalize as normalizeVendorKey).
insert into public.vendors (user_id, name, name_key)
select distinct on (
  user_id,
  lower(regexp_replace(trim(vendor), '\s+', ' ', 'g'))
)
  user_id,
  trim(vendor),
  lower(regexp_replace(trim(vendor), '\s+', ' ', 'g'))
from public.invoices
where vendor is not null
  and trim(vendor) <> ''
order by
  user_id,
  lower(regexp_replace(trim(vendor), '\s+', ' ', 'g')),
  created_at desc
on conflict (user_id, name_key) do nothing;
