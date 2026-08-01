-- Soft-delete for vendors — deleteVendor() sets this instead of issuing a
-- physical DELETE, preserving historical vendor data on invoices intact.
alter table public.vendors add column deleted_at timestamptz;

-- Soft-delete for subscription_confirmations — same principle: a vendor
-- "deletion" no longer physically removes the user's confirmation answers.
alter table public.subscription_confirmations add column deleted_at timestamptz;
