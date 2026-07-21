-- Private bucket for original invoice files (PDF/image). All access goes
-- through the backend (service role), which bypasses RLS, so no public
-- storage.objects policies are defined here.
insert into storage.buckets (id, name, public)
values ('invoice-files', 'invoice-files', false)
on conflict (id) do nothing;
