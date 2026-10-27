-- Address the invoice email came from (AgentMail `from`). Null for manual
-- uploads and for emails received before this column existed. Additive only.
alter table public.invoices add column if not exists source_sender text;
