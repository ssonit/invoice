-- Soft-delete flag for "Delete account". No row is ever physically removed —
-- this column blocks future login (checked in src/app/login/actions.ts).
alter table public.profiles add column deleted_at timestamptz;
