-- Content-hash dedup for manually uploaded invoices (email invoices already
-- dedupe via source_ref/source_message_id). NULLs are distinct in a unique
-- constraint, so email-sourced rows (content_hash always null) never collide.
alter table public.invoices add column content_hash text;

alter table public.invoices
  add constraint invoices_user_content_hash_key
  unique (user_id, content_hash);
