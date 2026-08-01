-- Rename Lemon Squeezy columns → Polar (additive — no data lost).
-- See docs/billing-polar.md for the full integration architecture.
alter table public.billing_subscriptions
  rename column ls_customer_id to polar_customer_id;

alter table public.billing_subscriptions
  rename column ls_subscription_id to polar_subscription_id;
