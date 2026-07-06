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
