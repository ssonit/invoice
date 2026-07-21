-- Local dev only. Runs automatically on `supabase start` / `supabase db reset`.
-- Never applied to a remote/hosted project (supabase db push ignores seed.sql).
--
-- Creates a ready-to-use admin login so you don't have to sign up again after
-- every reset:
--   email:    admin@local.test
--   password: admin12345

do $$
declare
  admin_user_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    admin_user_id,
    'authenticated',
    'authenticated',
    'admin@local.test',
    crypt('admin12345', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    admin_user_id,
    admin_user_id::text,
    format('{"sub":"%s","email":"%s"}', admin_user_id, 'admin@local.test')::jsonb,
    'email',
    now(),
    now(),
    now()
  );

  update public.profiles set role = 'admin' where id = admin_user_id;

  -- Sample invoices for local dashboard / table / chart testing
  insert into public.invoices (
    user_id, source, vendor, invoice_number, amount, currency,
    issue_date, due_date, tax, confidence_score, needs_review,
    line_items, created_at
  ) values
    (
      admin_user_id, 'email', 'FPT Telecom', 'FPT-2026-8841',
      1250000, 'VND', '2026-07-01', '2026-07-15', 0, 0.96, false,
      '[{"description":"Fiber 1Gbps — July","amount":1250000}]'::jsonb,
      now() - interval '2 days'
    ),
    (
      admin_user_id, 'email', 'AWS', 'AWS-779201',
      248.50, 'USD', '2026-06-28', '2026-07-28', 0, 0.91, false,
      '[{"description":"EC2 + S3 usage","amount":248.50}]'::jsonb,
      now() - interval '5 days'
    ),
    (
      admin_user_id, 'upload', 'Grab', 'GRAB-INV-55201',
      890000, 'VND', '2026-07-10', '2026-07-20', 0, 0.72, true,
      '[{"description":"Business rides — week 28","amount":890000}]'::jsonb,
      now() - interval '1 day'
    ),
    (
      admin_user_id, 'email', 'Notion Labs', 'NOTION-44102',
      96.00, 'USD', '2026-05-12', '2026-06-12', 0, 0.94, false,
      '[{"description":"Team plan — annual prorate","amount":96.00}]'::jsonb,
      now() - interval '40 days'
    ),
    (
      admin_user_id, 'email', 'VNG Cloud', 'VNG-CLD-1902',
      4500000, 'VND', '2026-04-03', '2026-04-18', 450000, 0.88, false,
      '[{"description":"vServer Pro × 2","amount":4050000},{"description":"VAT 10%","amount":450000}]'::jsonb,
      now() - interval '70 days'
    ),
    (
      admin_user_id, 'upload', 'Adobe', 'ADOBE-CC-88291',
      59.99, 'USD', '2026-07-15', '2026-08-15', 0, 0.65, true,
      '[{"description":"Creative Cloud — Individual","amount":59.99}]'::jsonb,
      now() - interval '8 hours'
    ),
    (
      admin_user_id, 'email', 'Shopee Express', 'SPX-VN-77301',
      320000, 'VND', '2026-03-22', '2026-04-05', 0, 0.90, false,
      '[{"description":"Outbound shipping — March","amount":320000}]'::jsonb,
      now() - interval '100 days'
    ),
    (
      admin_user_id, 'email', 'OpenAI', 'OA-INV-120948',
      142.30, 'USD', '2026-07-08', '2026-08-08', 0, 0.93, false,
      '[{"description":"API usage — GPT-4o","amount":142.30}]'::jsonb,
      now() - interval '3 days'
    ),
    (
      admin_user_id, 'upload', 'Công ty TNHH Minh Phát', 'MP-2026-044',
      18500000, 'VND', '2026-06-15', '2026-07-15', 1681818, 0.58, true,
      '[{"description":"Thiết kế website","amount":16818182},{"description":"VAT 10%","amount":1681818}]'::jsonb,
      now() - interval '12 days'
    ),
    (
      admin_user_id, 'email', 'Linear', 'LIN-2026-991',
      80.00, 'USD', '2026-02-01', '2026-03-01', 0, 0.97, false,
      '[{"description":"Business plan — Feb","amount":80.00}]'::jsonb,
      now() - interval '140 days'
    );
end $$;
