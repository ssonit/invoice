-- One-time backfill: every user who signed up before billing_subscriptions
-- existed (handle_new_user() only creates a row for new signups going
-- forward) needs a default row too, or their Settings billing card can
-- never load. Additive only — no data touched, no destructive operation.
insert into public.billing_subscriptions (user_id)
select id from public.profiles
where id not in (select user_id from public.billing_subscriptions)
on conflict (user_id) do nothing;
