-- Trigger.dev now dedupes inbound-email processing via idempotencyKey, so the
-- hand-rolled processed_messages table is no longer used.
drop table if exists public.processed_messages;

-- One email can produce several invoices (one per attachment, or 'body' for the
-- HTML-body fallback). source_ref distinguishes them so the extraction task can
-- upsert instead of insert, making a task retry safe (no duplicate rows).
alter table public.invoices add column if not exists source_ref text;

-- Non-partial unique constraint so supabase-js .upsert(onConflict) can target it.
-- Upload rows (source_message_id / source_ref both NULL) are unaffected because
-- NULLs are distinct in a unique constraint.
alter table public.invoices
  add constraint invoices_source_message_ref_key
  unique (user_id, source_message_id, source_ref);
