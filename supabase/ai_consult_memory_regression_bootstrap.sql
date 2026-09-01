-- Test-only Supabase auth/role shim for ai_consult_memory_regression.sql.
-- Run only in a fresh disposable PostgreSQL database. Never run in Supabase.

create schema auth;

create table auth.users (
  id uuid primary key,
  email text
);

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
