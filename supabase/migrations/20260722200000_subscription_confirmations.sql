create table public.subscription_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vendor_key text not null,
  status text not null check (status in ('active', 'cancelled')),
  confirmed_at timestamptz not null default now(),
  unique (user_id, vendor_key)
);

alter table public.subscription_confirmations enable row level security;

create policy "Users can view their own subscription confirmations"
  on public.subscription_confirmations for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own subscription confirmations"
  on public.subscription_confirmations for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own subscription confirmations"
  on public.subscription_confirmations for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Newer Supabase defaults revoke Data API grants on new tables even with RLS
-- policies in place (see supabase/migrations/20260720110000_grant_table_privileges.sql
-- for the same gotcha hit earlier in this project).
grant select, insert, update on table public.subscription_confirmations to authenticated;
grant select, insert, update, delete on table public.subscription_confirmations to service_role;
