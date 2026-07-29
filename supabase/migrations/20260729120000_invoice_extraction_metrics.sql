-- Per-extraction cost/latency, recorded on the invoice the extraction produced.
-- Purely additive: existing rows keep working with nulls and a zero counter.
--
-- duplicate_hit_count answers "how many model calls did content-hash dedupe
-- avoid" without a second table: sum(duplicate_hit_count) across invoices.
alter table public.invoices
  add column extraction_provider text,
  add column extraction_model text,
  add column extraction_input_tokens integer,
  add column extraction_output_tokens integer,
  add column extraction_ms integer,
  add column duplicate_hit_count integer not null default 0;
