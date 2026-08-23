-- Supabase setup verification for 親のもしもナビ v0.3.
-- Run this after schema/seed/RLS/storage SQL files.

with required_tables(name) as (
  values
    ('cases'),
    ('app_admins'),
    ('case_photos'),
    ('case_results'),
    ('families'),
    ('family_members'),
    ('family_invites'),
    ('people'),
    ('person_status_events'),
    ('profiles'),
    ('tasks'),
    ('task_comments'),
    ('task_templates'),
    ('asset_categories'),
    ('asset_items'),
    ('timeline_events'),
    ('scheduled_notifications'),
    ('push_tokens'),
    ('notification_preferences'),
    ('homes'),
    ('home_photos'),
    ('home_diagnoses'),
    ('provider_categories'),
    ('providers'),
    ('provider_recommendations'),
    ('referrals'),
    ('consent_logs'),
    ('share_links'),
    ('support_packs'),
    ('support_reviews'),
    ('admin_notes'),
    ('audit_logs'),
    ('account_delete_requests'),
    ('products'),
    ('partners'),
    ('purchases'),
    ('subscriptions')
)
select
  'table_exists' as check_type,
  name as target,
  (to_regclass('public.' || name) is not null) as ok
from required_tables
order by name;

select
  'rls_enabled' as check_type,
  c.relname as target,
  c.relrowsecurity as ok
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'profiles',
    'app_admins',
    'families',
    'family_members',
    'family_invites',
    'people',
    'person_status_events',
    'tasks',
    'task_comments',
    'task_templates',
    'asset_categories',
    'asset_items',
    'timeline_events',
    'scheduled_notifications',
    'push_tokens',
    'notification_preferences',
    'homes',
    'home_photos',
    'home_diagnoses',
    'provider_categories',
    'providers',
    'provider_recommendations',
    'referrals',
    'consent_logs',
    'cases',
    'case_photos',
    'case_results',
    'share_links',
    'support_packs',
    'support_reviews',
    'admin_notes',
    'audit_logs',
    'account_delete_requests',
    'products',
    'partners',
    'purchases',
    'subscriptions'
  )
order by c.relname;

with policy_tables(name) as (
  values
    ('profiles'),
    ('families'),
    ('family_members'),
    ('people'),
    ('person_status_events'),
    ('tasks'),
    ('task_comments'),
    ('asset_items'),
    ('timeline_events'),
    ('homes'),
    ('home_photos'),
    ('push_tokens'),
    ('notification_preferences'),
    ('scheduled_notifications'),
    ('task_templates'),
    ('asset_categories'),
    ('provider_categories'),
    ('providers'),
    ('products'),
    ('partners'),
    ('cases'),
    ('case_results'),
    ('support_packs'),
    ('purchases'),
    ('audit_logs'),
    ('account_delete_requests')
    ,('app_admins')
),
policy_counts as (
  select tablename, count(*) as policies
  from pg_policies
  where schemaname = 'public'
  group by tablename
)
select
  'policy_count' as check_type,
  policy_tables.name as target,
  coalesce(policy_counts.policies, 0) > 0 as ok,
  coalesce(policy_counts.policies, 0) as policies
from policy_tables
left join policy_counts on policy_counts.tablename = policy_tables.name
order by policy_tables.name;

select
  'storage_bucket' as check_type,
  'home-photos' as target,
  exists(select 1 from storage.buckets where id = 'home-photos') as ok;

with required_columns(table_name, column_name) as (
  values
    ('case_results', 'app_handoff_consumed_at'),
    ('people', 'profile'),
    ('people', 'profile_updated_at'),
    ('people', 'prefecture'),
    ('people', 'city'),
    ('timeline_events', 'mood'),
    ('timeline_events', 'attachments'),
    ('timeline_events', 'metadata'),
    ('cases', 'consent_to_sensitive_info'),
    ('cases', 'sensitive_info_consent_version'),
    ('cases', 'sensitive_info_consented_at')
)
select
  'column_exists' as check_type,
  table_name || '.' || column_name as target,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = required_columns.table_name
      and column_name = required_columns.column_name
  ) as ok
from required_columns
order by target;

with required_indexes(name) as (
  values
    ('idx_case_results_handoff_valid'),
    ('idx_consent_logs_case_type'),
    ('idx_people_profile_updated_at'),
    ('idx_people_prefecture'),
    ('idx_partners_region_category_status'),
    ('idx_timeline_events_person_date')
)
select
  'index_exists' as check_type,
  name as target,
  (to_regclass('public.' || name) is not null) as ok
from required_indexes
order by name;

with required_functions(name) as (
  values
    ('schedule_notifications_for_task'),
    ('claim_due_scheduled_notifications'),
    ('reset_stale_sending_notifications'),
    ('ensure_monthly_checkin_notifications'),
    ('consume_case_handoff'),
    ('create_initial_family_person'),
    ('create_family_invite'),
    ('accept_family_invite'),
    ('promote_family_member_to_owner')
)
select
  'function_exists' as check_type,
  name as target,
  (to_regproc('public.' || name) is not null) as ok
from required_functions
order by name;

select
  'seed_count' as check_type,
  'task_templates' as target,
  count(*) > 0 as ok,
  count(*) as rows
from public.task_templates
union all
select
  'seed_count' as check_type,
  'products' as target,
  count(*) > 0 as ok,
  count(*) as rows
from public.products;

select
  'view_exists' as check_type,
  'prefecture_active_family_current_counts' as target,
  (to_regclass('public.prefecture_active_family_current_counts') is not null) as ok
union all
select
  'view_exists' as check_type,
  'prefecture_active_family_counts' as target,
  (to_regclass('public.prefecture_active_family_counts') is not null) as ok;

select
  'table_exists' as check_type,
  'prefecture_usage_snapshots' as target,
  (to_regclass('public.prefecture_usage_snapshots') is not null) as ok
union all
select
  'index_exists' as check_type,
  'idx_prefecture_usage_snapshots_month' as target,
  (to_regclass('public.idx_prefecture_usage_snapshots_month') is not null) as ok
union all
select
  'function_exists' as check_type,
  'capture_prefecture_usage_snapshot' as target,
  (to_regprocedure('public.capture_prefecture_usage_snapshot(date)') is not null) as ok;

select
  'view_column_exists' as check_type,
  'prefecture_active_family_counts.active_users' as target,
  exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prefecture_active_family_counts'
      and column_name = 'active_users'
  ) as ok
union all
select
  'view_column_exists' as check_type,
  'prefecture_active_family_counts.previous_month_users' as target,
  exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prefecture_active_family_counts'
      and column_name = 'previous_month_users'
  ) as ok
union all
select
  'view_column_exists' as check_type,
  'prefecture_active_family_counts.month_over_month_users' as target,
  exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'prefecture_active_family_counts'
      and column_name = 'month_over_month_users'
  ) as ok;

select
  'security_check' as check_type,
  'legacy_family_app_admin_absent' as target,
  not exists(
    select 1
    from public.family_members
    where role = 'admin'
      and relationship = 'app_admin'
  ) as ok;
