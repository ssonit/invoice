-- Accent-insensitive search across vendor / invoice number / currency / source.
-- search_text holds lower(unaccent(...)); the app folds the query the same way
-- (src/lib/invoices/search.ts) and ILIKEs this single column. Additive only.
create extension if not exists unaccent with schema extensions;

alter table public.invoices add column if not exists search_text text;

create or replace function public.invoices_set_search_text()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.search_text := lower(extensions.unaccent(
    concat_ws(' ', new.vendor, new.invoice_number, new.currency, new.source)
  ));
  return new;
end;
$$;

drop trigger if exists invoices_set_search_text on public.invoices;
create trigger invoices_set_search_text
  before insert or update of vendor, invoice_number, currency, source
  on public.invoices
  for each row execute function public.invoices_set_search_text();

-- Backfill existing rows.
update public.invoices
set search_text = lower(extensions.unaccent(
  concat_ws(' ', vendor, invoice_number, currency, source)
))
where search_text is null;

-- Explicit "Mark approved" from the inbox (distinct from high extraction
-- confidence, which also reads as approved).
alter table public.invoices add column if not exists approved_at timestamptz;
