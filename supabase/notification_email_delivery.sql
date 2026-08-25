-- Add channel-level delivery tracking and allow monthly check-ins by email.
-- Run after notification_delivery_hardening.sql and monthly_checkin_notifications.sql.

alter table scheduled_notifications
  add column if not exists push_sent_at timestamptz;

alter table scheduled_notifications
  add column if not exists email_sent_at timestamptz;

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
      profiles.id as user_id,
      (
        (
          (timezone('Asia/Tokyo', now())::date + interval '30 days')::timestamp
          + time '09:00'
        ) at time zone 'Asia/Tokyo'
      ) as scheduled_for
    from profiles
    left join lateral (
      select notification_preferences.daily_digest_enabled
      from notification_preferences
      where notification_preferences.user_id = profiles.id
      order by notification_preferences.updated_at desc
      limit 1
    ) preferences on true
    where (
        nullif(trim(profiles.email), '') is not null
        or exists (
          select 1
          from push_tokens
          where push_tokens.user_id = profiles.id
            and push_tokens.is_active = true
        )
      )
      and coalesce(preferences.daily_digest_enabled, true) = true
      and not exists (
        select 1
        from scheduled_notifications
        where scheduled_notifications.user_id = profiles.id
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
