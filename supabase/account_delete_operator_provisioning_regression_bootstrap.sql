-- Test-only Auth/MFA fixtures for executing the documented operator policy.
-- Run only in a disposable PostgreSQL database after the production migrations.

begin;

do $guard$
begin
  if to_regclass('auth.users') is null
     or to_regclass('auth.mfa_factors') is not null
     or (
       select array_agg(attribute.attname::text order by attribute.attname)
       from pg_attribute attribute
       where attribute.attrelid = 'auth.users'::regclass
         and attribute.attnum > 0
         and not attribute.attisdropped
     ) <> array['email', 'id']::text[] then
    raise exception 'refusing to create provisioning fixtures outside the disposable Auth shim';
  end if;
end;
$guard$;

create schema regression_support;
create table regression_support.delete_operator_policy_guard (
  marker boolean primary key check (marker)
);
insert into regression_support.delete_operator_policy_guard (marker) values (true);

alter table auth.users
  add column email_confirmed_at timestamptz;

create table auth.mfa_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  factor_type text not null,
  status text not null
);

insert into auth.users (id, email, email_confirmed_at) values
  (
    'ae000000-0000-4000-8000-000000000001',
    'operator@example.invalid',
    now()
  ),
  (
    'ae000000-0000-4000-8000-000000000002',
    'approver@example.invalid',
    now()
  );

insert into public.profiles (id, email) values (
  'ae000000-0000-4000-8000-000000000002',
  'approver@example.invalid'
);

insert into auth.mfa_factors (user_id, factor_type, status) values (
  'ae000000-0000-4000-8000-000000000001',
  'totp',
  'verified'
);

commit;
