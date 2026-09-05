-- Least-privilege account-erasure operator capability for existing databases.
-- Run after admin_auth_hardening.sql and before account_deletion_pipeline.sql.
-- This file creates no user and assigns the capability to nobody.

begin;

create table if not exists public.account_delete_executors (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  note text,
  active boolean not null default false,
  activated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.account_delete_executors
  add column if not exists active boolean not null default false,
  add column if not exists activated_at timestamptz,
  add column if not exists revoked_at timestamptz;

alter table public.account_delete_executors
  drop constraint if exists account_delete_executors_activation_state;
alter table public.account_delete_executors
  add constraint account_delete_executors_activation_state
  check (
    (not active and activated_at is null and revoked_at is null)
    or (active and activated_at is not null and revoked_at is null)
    or (
      not active
      and activated_at is not null
      and revoked_at is not null
      and revoked_at >= activated_at
    )
  );

alter table public.account_delete_executors enable row level security;
alter table public.account_delete_executors force row level security;

comment on table public.account_delete_executors is
  'Owner-only allowlist for account-deletion operations; membership does not grant general app_admin access.';

-- Remove the short-lived development guard if this migration is reapplied to
-- a disposable database. Emergency revocation of a compromised executor must
-- always remain possible; last-role protection belongs to target erasure.
drop trigger if exists account_delete_executors_last_operator_guard
  on public.account_delete_executors;
drop function if exists public.guard_last_account_delete_executor();

create or replace function public.account_erasure_operator_method(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select case
    when exists (
      select 1
      from public.app_admins admin
      where admin.user_id = p_user_id
    ) then 'supabase_app_admin'
    when exists (
      select 1
      from public.account_delete_executors executor
      where executor.user_id = p_user_id
        and executor.active
        and executor.activated_at is not null
        and executor.revoked_at is null
    ) then 'supabase_account_delete_executor'
    else null
  end;
$$;

revoke all on table public.account_delete_executors
  from public, anon, authenticated, service_role;

revoke all on function public.account_erasure_operator_method(uuid)
  from public, anon, authenticated, service_role;

commit;
