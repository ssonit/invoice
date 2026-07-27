-- Payment/subscription state for the app's own billing (Lemon Squeezy), one
-- row per user. Distinct from subscription_confirmations, which tracks
-- detected *vendor* recurring charges — an unrelated domain that happens to
-- share the word "subscription".
create table public.billing_subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'starter' check (plan in ('starter', 'team')),
  status text not null default 'none'
    check (status in ('none', 'on_trial', 'active', 'paused', 'past_due', 'unpaid', 'cancelled', 'expired')),
  ls_customer_id text,
  ls_subscription_id text unique,
  customer_portal_url text,
  renews_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.billing_subscriptions enable row level security;

create policy "Users can view their own billing subscription"
  on public.billing_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- No insert/update/delete policy for authenticated: a user can read their own
-- row but never write it directly. Only the webhook (via service_role, after
-- HMAC verification) ever mutates billing state.
grant select on table public.billing_subscriptions to authenticated;
grant select, insert, update, delete on table public.billing_subscriptions to service_role;

-- Extend the existing profile-creation trigger so every new user also gets a
-- default billing_subscriptions row — no code needs to null-check a missing one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  insert into public.billing_subscriptions (user_id)
  values (new.id);

  return new;
end;
$$;
