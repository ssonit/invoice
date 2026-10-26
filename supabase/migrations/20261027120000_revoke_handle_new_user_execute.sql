-- handle_new_user() only runs as the on_auth_user_created trigger; nobody needs
-- to call it over PostgREST (/rest/v1/rpc/handle_new_user). Flagged by the
-- Supabase security advisor. Triggers don't need caller EXECUTE, so this
-- changes no behaviour.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
