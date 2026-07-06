-- Monthly check-in reminders for low-frequency/high-importance retention.
-- Run after notification_delivery_hardening.sql.

create unique index if not exists idx_scheduled_monthly_checkins_unique
on scheduled_notifications(user_id, notification_type, scheduled_for)
where task_id is null
  and notification_type = 'monthly_checkin';

create or replace function public.ensure_monthly_checkin_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  with candidates as (
    select distinct
      push_tokens.user_id,
      (
        (
          (timezone('Asia/Tokyo', now())::date + interval '30 days')::timestamp
          + time '09:00'
        ) at time zone 'Asia/Tokyo'
      ) as scheduled_for
    from push_tokens
    left join notification_preferences
      on notification_preferences.user_id = push_tokens.user_id
    where push_tokens.is_active = true
      and push_tokens.user_id is not null
      and coalesce(notification_preferences.reminders_enabled, true) = true
      and not exists (
        select 1
        from scheduled_notifications
        where scheduled_notifications.user_id = push_tokens.user_id
          and scheduled_notifications.notification_type = 'monthly_checkin'
          and scheduled_notifications.status = 'scheduled'
          and scheduled_notifications.scheduled_for > now()
      )
  ),
  inserted as (
    insert into scheduled_notifications (
      user_id,
      task_id,
      notification_type,
      scheduled_for,
      status
    )
    select
      candidates.user_id,
      null,
      'monthly_checkin',
      candidates.scheduled_for,
      'scheduled'
    from candidates
    on conflict do nothing
    returning 1
  )
  select count(*) into v_inserted
  from inserted;

  return v_inserted;
end;
$$;

revoke all on function public.ensure_monthly_checkin_notifications() from public;
grant execute on function public.ensure_monthly_checkin_notifications() to service_role;
