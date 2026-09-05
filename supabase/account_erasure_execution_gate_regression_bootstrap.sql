-- Disposable PostgreSQL fixture applied before account_erasure_execution_gate.sql.
-- It models a prepared job created by the previous pipeline version, where the
-- bounded preparation timestamps were absent despite an old created_at value.

insert into auth.users (id, email)
values ('ad000000-0000-4000-8000-000000000001', 'legacy-prepared@example.test');

insert into public.profiles (id, email)
values ('ad000000-0000-4000-8000-000000000001', 'legacy-prepared@example.test');

insert into public.account_delete_requests (
  id, user_id, contact_email, reason, status, created_at
) values (
  'ad000000-0000-4000-8000-000000000010',
  'ad000000-0000-4000-8000-000000000001',
  'legacy-prepared@example.test',
  'legacy preparation-window migration fixture',
  'reviewing',
  current_timestamp - interval '3 hours'
);

insert into public.account_erasure_jobs (
  id,
  request_id,
  target_user_id,
  target_user_hash,
  status,
  prepared_at,
  prepared_expires_at,
  created_at,
  updated_at
) values (
  'ad000000-0000-4000-8000-000000000020',
  'ad000000-0000-4000-8000-000000000010',
  'ad000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  'prepared',
  current_timestamp - interval '3 hours',
  null,
  current_timestamp - interval '3 hours',
  current_timestamp - interval '3 hours'
);
