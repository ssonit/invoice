-- processed_messages is only ever read/written by the backend via the
-- service role key (which bypasses RLS). No policies are added here on
-- purpose, so anon/authenticated clients get zero access through the API.
alter table public.processed_messages enable row level security;
