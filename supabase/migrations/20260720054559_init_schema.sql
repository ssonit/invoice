-- Inboxes: one AgentMail inbox per user
create table public.inboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agentmail_inbox_id text not null,
  email_address text not null,
  created_at timestamptz not null default now()
);

create index inboxes_user_id_idx on public.inboxes (user_id);

alter table public.inboxes enable row level security;

create policy "Users can view their own inboxes"
  on public.inboxes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own inboxes"
  on public.inboxes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Invoices: extracted invoice data, from either 'email' or 'upload'
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('email', 'upload')),
  vendor text,
  invoice_number text,
  amount numeric,
  currency text,
  issue_date date,
  due_date date,
  line_items jsonb,
  tax numeric,
  confidence_score numeric,
  needs_review boolean not null default false,
  raw_extracted_json jsonb,
  file_url text,
  source_message_id text,
  created_at timestamptz not null default now()
);

create index invoices_user_id_idx on public.invoices (user_id);
create index invoices_source_message_id_idx on public.invoices (source_message_id);

alter table public.invoices enable row level security;

create policy "Users can view their own invoices"
  on public.invoices for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own invoices"
  on public.invoices for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own invoices"
  on public.invoices for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Processed messages: idempotency guard for AgentMail webhook redelivery.
-- No RLS: only ever touched by the backend using the service role key.
create table public.processed_messages (
  message_id text primary key,
  inbox_id text not null,
  processed_at timestamptz not null default now()
);
