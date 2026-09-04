-- Disposable-only proof that the fresh schema defines the executor capability
-- fail-closed before the existing-database migration is exercised from absence.

do $test$
begin
  if to_regclass('public.account_delete_executors') is null then
    raise exception 'fresh schema omitted account_delete_executors';
  end if;
  if not exists (
    select 1
    from pg_class relation
    where relation.oid = 'public.account_delete_executors'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then
    raise exception 'fresh executor table did not force RLS';
  end if;
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'account_delete_executors'
      and column_name = 'active'
      and data_type = 'boolean'
      and is_nullable = 'NO'
      and column_default in ('false', 'false::boolean')
  ) then
    raise exception 'fresh executor active flag is not fail-closed';
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.account_delete_executors'::regclass
      and conname = 'account_delete_executors_activation_state'
      and contype = 'c'
  ) then
    raise exception 'fresh executor activation constraint is missing';
  end if;
end;
$test$;

-- Recreate through account_delete_executor_role.sql below so this same test run
-- proves the production existing-database path as well as schema parity.
drop table public.account_delete_executors;
