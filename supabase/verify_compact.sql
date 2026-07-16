-- Compact Supabase setup verification.
-- This returns one result table so the SQL Editor can show every check at once.

with checks as (
  select 'table_exists' as check_type, 'profiles' as target, to_regclass('public.profiles') is not null as ok
  union all select 'table_exists', 'app_admins', to_regclass('public.app_admins') is not null
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
  union all select 'table_exists', 'account_delete_requests', to_regclass('public.account_delete_requests') is not null
  union all select 'table_exists', 'public_api_rate_limits', to_regclass('public.public_api_rate_limits') is not null
  union all select 'rls_enabled', 'profiles', coalesce((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), false)
  union all select 'rls_enabled', 'app_admins', coalesce((select relrowsecurity from pg_class where oid = 'public.app_admins'::regclass), false)
  union all select 'rls_enabled', 'families', coalesce((select relrowsecurity from pg_class where oid = 'public.families'::regclass), false)
  union all select 'rls_enabled', 'family_members', coalesce((select relrowsecurity from pg_class where oid = 'public.family_members'::regclass), false)
  union all select 'rls_enabled', 'people', coalesce((select relrowsecurity from pg_class where oid = 'public.people'::regclass), false)
  union all select 'rls_enabled', 'tasks', coalesce((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), false)
  union all select 'rls_enabled', 'scheduled_notifications', coalesce((select relrowsecurity from pg_class where oid = 'public.scheduled_notifications'::regclass), false)
  union all select 'rls_enabled', 'account_delete_requests', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.account_delete_requests')), false)
  union all select 'rls_enabled', 'public_api_rate_limits', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.public_api_rate_limits')), false)
  union all select 'storage_bucket', 'home-photos', exists(select 1 from storage.buckets where id = 'home-photos')
  union all select 'column_exists', 'case_results.app_handoff_consumed_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'case_results' and column_name = 'app_handoff_consumed_at')
  union all select 'column_exists', 'cases.consent_to_sensitive_info', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cases' and column_name = 'consent_to_sensitive_info')
  union all select 'column_exists', 'cases.sensitive_info_consent_version', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cases' and column_name = 'sensitive_info_consent_version')
  union all select 'column_exists', 'cases.sensitive_info_consented_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cases' and column_name = 'sensitive_info_consented_at')
  union all select 'index_exists', 'idx_case_results_handoff_valid', to_regclass('public.idx_case_results_handoff_valid') is not null
  union all select 'index_exists', 'idx_consent_logs_case_type', to_regclass('public.idx_consent_logs_case_type') is not null
  union all select 'function_exists', 'generate_tasks_for_status_event', to_regproc('public.generate_tasks_for_status_event') is not null
  union all select 'function_exists', 'schedule_notifications_for_task', to_regproc('public.schedule_notifications_for_task') is not null
  union all select 'function_exists', 'claim_due_scheduled_notifications', to_regproc('public.claim_due_scheduled_notifications') is not null
  union all select 'function_exists', 'reset_stale_sending_notifications', to_regproc('public.reset_stale_sending_notifications') is not null
  union all select 'function_exists', 'ensure_monthly_checkin_notifications', to_regproc('public.ensure_monthly_checkin_notifications') is not null
  union all select 'function_exists', 'consume_case_handoff', to_regproc('public.consume_case_handoff') is not null
  union all select 'function_exists', 'create_family_invite', to_regproc('public.create_family_invite') is not null
  union all select 'function_exists', 'accept_family_invite', to_regproc('public.accept_family_invite') is not null
  union all select 'function_exists', 'check_public_api_rate_limit', to_regproc('public.check_public_api_rate_limit') is not null
  union all select 'function_exists', 'purge_stale_anonymous_cases', to_regproc('public.purge_stale_anonymous_cases') is not null
  union all select 'function_exists', 'promote_family_member_to_owner', to_regproc('public.promote_family_member_to_owner') is not null
  union all select 'security_check', 'legacy_family_app_admin_absent', not exists(select 1 from public.family_members where role = 'admin' and relationship = 'app_admin')
  union all select 'seed_count', 'task_templates', (select count(*) > 0 from public.task_templates)
  union all select 'seed_count', 'products', (select count(*) > 0 from public.products)
)
select *
from checks
order by check_type, target;
