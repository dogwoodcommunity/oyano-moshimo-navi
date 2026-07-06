-- Compact Supabase setup verification.
-- This returns one result table so the SQL Editor can show every check at once.

with checks as (
  select 'table_exists' as check_type, 'profiles' as target, to_regclass('public.profiles') is not null as ok
  union all select 'table_exists', 'families', to_regclass('public.families') is not null
  union all select 'table_exists', 'family_members', to_regclass('public.family_members') is not null
  union all select 'table_exists', 'family_invites', to_regclass('public.family_invites') is not null
  union all select 'table_exists', 'people', to_regclass('public.people') is not null
  union all select 'table_exists', 'tasks', to_regclass('public.tasks') is not null
  union all select 'table_exists', 'scheduled_notifications', to_regclass('public.scheduled_notifications') is not null
  union all select 'table_exists', 'push_tokens', to_regclass('public.push_tokens') is not null
  union all select 'table_exists', 'products', to_regclass('public.products') is not null
  union all select 'table_exists', 'support_packs', to_regclass('public.support_packs') is not null
  union all select 'table_exists', 'homes', to_regclass('public.homes') is not null
  union all select 'rls_enabled', 'profiles', coalesce((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), false)
  union all select 'rls_enabled', 'families', coalesce((select relrowsecurity from pg_class where oid = 'public.families'::regclass), false)
  union all select 'rls_enabled', 'family_members', coalesce((select relrowsecurity from pg_class where oid = 'public.family_members'::regclass), false)
  union all select 'rls_enabled', 'people', coalesce((select relrowsecurity from pg_class where oid = 'public.people'::regclass), false)
  union all select 'rls_enabled', 'tasks', coalesce((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), false)
  union all select 'rls_enabled', 'scheduled_notifications', coalesce((select relrowsecurity from pg_class where oid = 'public.scheduled_notifications'::regclass), false)
  union all select 'storage_bucket', 'home-photos', exists(select 1 from storage.buckets where id = 'home-photos')
  union all select 'function_exists', 'generate_tasks_for_status_event', to_regproc('public.generate_tasks_for_status_event') is not null
  union all select 'function_exists', 'schedule_notifications_for_task', to_regproc('public.schedule_notifications_for_task') is not null
  union all select 'function_exists', 'ensure_monthly_checkin_notifications', to_regproc('public.ensure_monthly_checkin_notifications') is not null
  union all select 'function_exists', 'create_family_invite', to_regproc('public.create_family_invite') is not null
  union all select 'function_exists', 'accept_family_invite', to_regproc('public.accept_family_invite') is not null
  union all select 'seed_count', 'task_templates', (select count(*) > 0 from public.task_templates)
  union all select 'seed_count', 'products', (select count(*) > 0 from public.products)
)
select *
from checks
order by check_type, target;
