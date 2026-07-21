-- Newer Supabase defaults revoke SELECT/INSERT/UPDATE/DELETE from Data API
-- roles on newly created public tables. Without these grants, PostgREST returns
-- "permission denied for table ..." even when RLS policies exist.
--
-- Grant the minimum needed for this app:
-- - authenticated: user-facing reads/writes (RLS still applies)
-- - service_role: server-side provisioning / webhooks (bypasses RLS)

grant select, insert on table public.inboxes to authenticated;
grant select, insert, update, delete on table public.inboxes to service_role;

grant select, insert, update on table public.invoices to authenticated;
grant select, insert, update, delete on table public.invoices to service_role;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;

-- Backend-only idempotency table: no authenticated access.
grant select, insert, update, delete on table public.processed_messages to service_role;
