-- Report aggregation RPCs. Postgres does the summing so the dashboard never
-- pulls every invoice row through PostgREST (which silently caps a response at
-- ~1000 rows and made Overview / Analytics / Exports totals wrong for big
-- accounts). Additive only: new functions, no table changes.
--
-- All three are SECURITY INVOKER and scoped by auth.uid(), so RLS still applies
-- and a caller can only ever aggregate their own non-deleted invoices.

-- Analytics: one jsonb document holding every aggregate the report needs.
-- Effective date = issue_date, else the UTC date of created_at (matches
-- effectiveInvoiceDate() in src/lib/analytics/report.ts).
create or replace function public.analytics_aggregates(p_start date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with scoped as (
    select
      vendor_key,
      vendor,
      currency,
      amount,
      needs_review,
      coalesce(issue_date, (created_at at time zone 'utc')::date) as eff_date
    from public.invoices
    where user_id = (select auth.uid())
      and deleted_at is null
      and coalesce(issue_date, (created_at at time zone 'utc')::date) >= p_start
  )
  select jsonb_build_object(
    'invoice_count', (select count(*) from scoped),
    'needs_review', (select count(*) from scoped where needs_review),
    'by_currency', coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency', currency, 'total', total, 'count', cnt))
      from (
        select currency, sum(amount) as total, count(amount) as cnt
        from scoped where amount is not null
        group by currency
      ) c
    ), '[]'::jsonb),
    'by_month', coalesce((
      select jsonb_agg(jsonb_build_object(
        'month', month, 'currency', currency, 'total', total))
      from (
        select to_char(date_trunc('month', eff_date), 'YYYY-MM') as month,
               currency, sum(amount) as total
        from scoped where amount is not null
        group by 1, 2
      ) m
    ), '[]'::jsonb),
    'by_vendor', coalesce((
      select jsonb_agg(jsonb_build_object(
        'vendor_key', vendor_key, 'label', label,
        'currency', currency, 'total', total, 'count', cnt))
      from (
        select vendor_key,
               (array_agg(vendor order by eff_date desc))[1] as label,
               currency, sum(amount) as total, count(*) as cnt
        from scoped
        where vendor_key is not null and amount is not null
        group by vendor_key, currency
      ) v
    ), '[]'::jsonb)
  );
$$;

-- Overview: lifetime counts + per-currency totals + monthly created_at counts.
create or replace function public.overview_aggregates(
  p_month_start timestamptz,
  p_trend_start timestamptz
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with mine as (
    select amount, currency, needs_review, created_at
    from public.invoices
    where user_id = (select auth.uid()) and deleted_at is null
  )
  select jsonb_build_object(
    'total', (select count(*) from mine),
    'needs_review', (select count(*) from mine where needs_review),
    'this_month', (select count(*) from mine where created_at >= p_month_start),
    'by_currency', coalesce((
      select jsonb_agg(jsonb_build_object(
        'currency', currency, 'total', total, 'count', cnt))
      from (
        select currency, sum(amount) as total, count(amount) as cnt
        from mine where amount is not null
        group by currency
      ) c
    ), '[]'::jsonb),
    'by_month', coalesce((
      select jsonb_agg(jsonb_build_object('month', month, 'count', cnt))
      from (
        select to_char(created_at at time zone 'utc', 'YYYY-MM') as month,
               count(*) as cnt
        from mine where created_at >= p_trend_start
        group by 1
      ) m
    ), '[]'::jsonb)
  );
$$;

-- Exports: how many invoices a CSV export with these filters would contain.
-- p_start null = all time; p_status is 'all' | 'review' | 'ok'.
create or replace function public.export_invoice_count(
  p_start date,
  p_status text
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)
  from public.invoices
  where user_id = (select auth.uid())
    and deleted_at is null
    and (p_start is null
         or coalesce(issue_date, (created_at at time zone 'utc')::date) >= p_start)
    and (p_status = 'all'
         or (p_status = 'review' and needs_review)
         or (p_status = 'ok' and not needs_review));
$$;

revoke execute on function public.analytics_aggregates(date) from public, anon;
revoke execute on function public.overview_aggregates(timestamptz, timestamptz) from public, anon;
revoke execute on function public.export_invoice_count(date, text) from public, anon;
grant execute on function public.analytics_aggregates(date) to authenticated, service_role;
grant execute on function public.overview_aggregates(timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.export_invoice_count(date, text) to authenticated, service_role;
