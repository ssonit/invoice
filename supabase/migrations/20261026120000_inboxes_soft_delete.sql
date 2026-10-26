-- Soft-delete for inboxes — deleteInbox() sets this after removing the inbox on
-- the AgentMail side, instead of issuing a physical DELETE. The row stays as
-- history; invoices extracted from the inbox are untouched.
alter table public.inboxes add column deleted_at timestamptz;

-- "One inbox per user" now applies to active (not deleted) inboxes only, so a
-- user can create a fresh forwarding address after deleting the old one.
-- createInbox() uses a plain insert and handles 23505, so a partial unique
-- index is enough here (no ON CONFLICT target involved).
alter table public.inboxes drop constraint inboxes_user_id_unique;
create unique index inboxes_user_id_active_key
  on public.inboxes (user_id)
  where deleted_at is null;
