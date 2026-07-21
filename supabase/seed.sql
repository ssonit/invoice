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
end $$;
