-- Run this in Supabase SQL Editor after the initial v0.3 setup.
-- It contains production hardening added after the first schema import.

-- 1. Web-to-app handoff tokens are one-time use.
alter table case_results
  add column if not exists app_handoff_consumed_at timestamptz;

create index if not exists idx_case_results_handoff_valid
on case_results(case_id, app_handoff_token, created_at)
where app_handoff_token is not null
  and app_handoff_consumed_at is null;

-- 2. Sensitive information consent is recorded per diagnosis.
alter table cases
  add column if not exists consent_to_sensitive_info boolean default false,
  add column if not exists sensitive_info_consent_version text,
  add column if not exists sensitive_info_consented_at timestamptz;

create index if not exists idx_consent_logs_case_type
on consent_logs(case_id, consent_type, created_at desc);

-- 3. Home photo direct client uploads are disabled. Uploads should go through
-- the Web API that verifies family membership before issuing a signed URL.
drop policy if exists "home photos upload authenticated" on storage.objects;

-- 4. Family owner succession is explicit.
-- Also rerun family_invite_rpc.sql after this file so free-plan invite counting
-- uses the primary owner_user_id instead of role='owner'. That prevents
-- co-owner promotion from becoming a free invite slot bypass.
create or replace function public.promote_family_member_to_owner(p_family_member_id uuid)
returns family_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target family_members;
  v_promoted family_members;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_target
  from family_members
  where id = p_family_member_id
  for update;

  if not found then
    raise exception 'member_not_found';
  end if;

  if not exists (
    select 1
    from family_members
    where family_id = v_target.family_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  ) then
    raise exception 'not_family_admin';
  end if;

  update family_members
  set role = 'owner'
  where id = p_family_member_id
  returning * into v_promoted;

  update families
  set owner_user_id = coalesce(owner_user_id, v_promoted.user_id),
      updated_at = now()
  where id = v_promoted.family_id
    and owner_user_id is null;

  return v_promoted;
end;
$$;

grant execute on function public.promote_family_member_to_owner(uuid) to authenticated;

-- 5. Notification cron claims due rows before sending so concurrent cron runs
-- do not send the same scheduled notification twice.
create or replace function public.claim_due_scheduled_notifications(p_limit int default 100)
returns table (
  id uuid,
  user_id uuid,
  task_id uuid,
  notification_type text,
  scheduled_for timestamptz,
  task_title text,
  assigned_member_id uuid
)
language sql
security definer
set search_path = public
as $$
  with due as (
    select scheduled_notifications.id
    from scheduled_notifications
    where scheduled_notifications.status = 'scheduled'
      and scheduled_notifications.scheduled_for <= now()
    order by scheduled_notifications.scheduled_for asc
    limit least(greatest(p_limit, 1), 500)
    for update skip locked
  ),
  claimed as (
    update scheduled_notifications
    set status = 'sending'
    from due
    where scheduled_notifications.id = due.id
      and scheduled_notifications.status = 'scheduled'
    returning
      scheduled_notifications.id,
      scheduled_notifications.user_id,
      scheduled_notifications.task_id,
      scheduled_notifications.notification_type,
      scheduled_notifications.scheduled_for
  )
  select
    claimed.id,
    claimed.user_id,
    claimed.task_id,
    claimed.notification_type,
    claimed.scheduled_for,
    tasks.title as task_title,
    tasks.assigned_member_id
  from claimed
  left join tasks on tasks.id = claimed.task_id;
$$;

grant execute on function public.claim_due_scheduled_notifications(int) to service_role;

-- 6. Account deletion requests get a durable queue with a 30-day SLA.
create table if not exists account_delete_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  contact_email text,
  reason text,
  status text not null default 'requested' check (status in ('requested', 'reviewing', 'needs_followup', 'completed')),
  requested_from text not null default 'mobile_app',
  due_at timestamptz not null default (now() + interval '30 days'),
  last_status_changed_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references profiles(id) on delete set null,
  handled_by_email text,
  handled_by_method text,
  handled_note text,
  audit_log_id uuid references audit_logs(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_account_delete_requests_status_due
on account_delete_requests(status, due_at);

create index if not exists idx_account_delete_requests_user_status
on account_delete_requests(user_id, status);

create unique index if not exists idx_account_delete_requests_one_open
on account_delete_requests(user_id)
where status in ('requested', 'reviewing', 'needs_followup') and user_id is not null;

alter table account_delete_requests enable row level security;

drop policy if exists "account_delete_requests read own" on account_delete_requests;
create policy "account_delete_requests read own"
on account_delete_requests for select
using (user_id = auth.uid());

drop policy if exists "account_delete_requests admin read" on account_delete_requests;
create policy "account_delete_requests admin read"
on account_delete_requests for select
using (is_app_admin());
