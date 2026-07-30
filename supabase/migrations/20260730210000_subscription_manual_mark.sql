-- Mark as subscription: extend subscription_confirmations with origin + cycle
-- so users can manually mark vendors the auto-detector misses.

alter table public.subscription_confirmations
  add column if not exists origin text not null default 'reminder'
  check (origin in ('reminder', 'manual'));

alter table public.subscription_confirmations
  add column if not exists cycle text
  check (cycle is null or cycle in ('monthly', 'yearly'));

-- Re-issue grants for the updated table (authenticated doesn't need new
-- column grants — the table-level grants already cover the added columns).
grant select, insert, update on table public.subscription_confirmations to authenticated;
grant select, insert, update, delete on table public.subscription_confirmations to service_role;
