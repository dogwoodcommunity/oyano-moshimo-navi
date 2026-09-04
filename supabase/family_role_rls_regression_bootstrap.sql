-- Extra test-only Supabase auth shim for family_role_rls_regression.sql.
-- Run after ai_consult_memory_regression_bootstrap.sql in a disposable DB.

create function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb;
$$;
