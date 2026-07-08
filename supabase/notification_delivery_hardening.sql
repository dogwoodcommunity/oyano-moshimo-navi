-- Notification delivery hardening for low-frequency/high-importance reminders.
-- Run after schema.sql and before task_notification_generation.sql.

alter table scheduled_notifications
  alter column task_id drop not null;

alter table scheduled_notifications
  add column if not exists notification_type text not null default 'due_1d';

alter table scheduled_notifications
  add column if not exists opened_at timestamptz;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'scheduled_notifications_task_id_fkey'
  ) then
    alter table scheduled_notifications
      drop constraint scheduled_notifications_task_id_fkey;
  end if;

  alter table scheduled_notifications
    add constraint scheduled_notifications_task_id_fkey
    foreign key (task_id)
    references tasks(id)
    on delete cascade;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'scheduled_notifications_user_task_type_key'
  ) then
    alter table scheduled_notifications
      add constraint scheduled_notifications_user_task_type_key
      unique (user_id, task_id, notification_type);
  end if;
end;
$$;

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
