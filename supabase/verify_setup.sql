-- Supabase setup verification for 親のもしもナビ v0.3.
-- Run this after schema/seed/RLS/storage SQL files.

with required_tables(name) as (
  values
    ('cases'),
    ('app_admins'),
    ('account_delete_executors'),
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
    ('account_erasure_jobs'),
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
  'table_exists' as check_type,
  'account_delete_private.account_erasure_execution_grants' as target,
  (to_regclass('account_delete_private.account_erasure_execution_grants') is not null) as ok
union all
select
  'table_exists',
  'account_delete_private.account_erasure_execution_control',
  (to_regclass('account_delete_private.account_erasure_execution_control') is not null)
union all
select
  'column_exists',
  'account_delete_private.account_erasure_execution_grants.control_epoch',
  exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'account_delete_private'
      and column_info.table_name = 'account_erasure_execution_grants'
      and column_info.column_name = 'control_epoch'
      and column_info.data_type = 'uuid'
      and column_info.is_nullable = 'NO'
  )
union all
select
  'index_exists',
  'account_delete_private.account_erasure_execution_grants_one_open_per_epoch',
  (to_regclass('account_delete_private.account_erasure_execution_grants_one_open_per_epoch') is not null)
union all
select
  'function_exists',
  'account_delete_private.sanitize_account_erasure_operator_response_v1',
  (to_regprocedure('account_delete_private.sanitize_account_erasure_operator_response_v1(jsonb)') is not null)
union all
select
  'security_check',
  'prepare_account_erasure_v2_role_lock',
  coalesce(
    pg_get_functiondef(to_regprocedure('public.prepare_account_erasure_v2(uuid,uuid,uuid)'))
      ~ 'lock table public\.app_admins,[[:space:]]*public\.account_delete_executors[[:space:]]+in share row exclusive mode',
    false
  )
union all
select
  'security_check',
  'prepare_account_erasure_v2_lock_order',
  coalesce((
    select
      strpos(definition, 'account-erasure-target:') > 0
      and strpos(definition, 'account-erasure-target:') < strpos(definition, 'account-erasure:')
      and strpos(definition, 'account-erasure:') < strpos(definition, 'lock table public.app_admins')
    from (
      select lower(pg_get_functiondef(
        to_regprocedure('public.prepare_account_erasure_v2(uuid,uuid,uuid)')
      )) as definition
    ) function_source
  ), false);

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
    'account_delete_executors',
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
    'account_erasure_jobs',
    'products',
    'partners',
    'purchases',
    'subscriptions'
  )
order by c.relname;

select
  'security_check' as check_type,
  'account_delete_executor_forced_rls' as target,
  exists (
    select 1
    from pg_class relation
    where relation.oid = to_regclass('public.account_delete_executors')
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) as ok
union all
select
  'security_check',
  'account_delete_executor_activation_state',
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'account_delete_executors'
      and column_name = 'active'
      and data_type = 'boolean'
      and is_nullable = 'NO'
      and column_default in ('false', 'false::boolean')
  )
  and exists (
    select 1
    from pg_constraint
    where conrelid = to_regclass('public.account_delete_executors')
      and conname = 'account_delete_executors_activation_state'
      and contype = 'c'
  )
union all
select
  'security_check',
  'account_delete_executor_acl',
  not has_table_privilege('service_role', 'public.account_delete_executors', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'public.account_delete_executors', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'public.account_delete_executors', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_function_privilege('service_role', 'public.account_erasure_operator_method(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.account_erasure_operator_method(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.account_erasure_operator_method(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.verify_account_delete_operator_v2(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.verify_account_delete_operator_v2(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.verify_account_delete_operator_v2(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.update_account_delete_request_status_v1(uuid,text,text,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.update_account_delete_request_status_v1(uuid,text,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_account_delete_request_status_v1(uuid,text,text,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.update_account_delete_request_status_v2(uuid,text,text,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.update_account_delete_request_status_v2(uuid,text,text,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_account_delete_request_status_v2(uuid,text,text,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.inspect_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.prepare_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.inspect_account_erasure_v2(uuid,uuid,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.prepare_account_erasure_v2(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.execute_account_erasure_database_v1(uuid,uuid,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.issue_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.inspect_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.execute_account_erasure_database_v2(uuid,uuid,uuid,uuid,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.inspect_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.prepare_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.inspect_account_erasure_v2(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.prepare_account_erasure_v2(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.execute_account_erasure_database_v1(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.issue_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.inspect_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.execute_account_erasure_database_v2(uuid,uuid,uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.inspect_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.prepare_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.inspect_account_erasure_v2(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.prepare_account_erasure_v2(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.execute_account_erasure_database_v1(uuid,uuid,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.issue_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.inspect_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.execute_account_erasure_database_v2(uuid,uuid,uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)', 'EXECUTE')
union all
select
  'security_check',
  'account_erasure_execution_grant_private',
  coalesce((
    select
      relation.relrowsecurity
      and relation.relforcerowsecurity
      and to_regclass('account_delete_private.account_erasure_execution_control') is not null
      and coalesce((
        select control.relrowsecurity and control.relforcerowsecurity
        from pg_class control
        where control.oid = to_regclass('account_delete_private.account_erasure_execution_control')
      ), false)
      and pg_get_userbyid((
        select control.relowner
        from pg_class control
        where control.oid = to_regclass('account_delete_private.account_erasure_execution_control')
      )) = 'postgres'
      and exists (
        select 1
        from information_schema.columns column_info
        where column_info.table_schema = 'account_delete_private'
          and column_info.table_name = 'account_erasure_execution_grants'
          and column_info.column_name = 'control_epoch'
          and column_info.data_type = 'uuid'
          and column_info.is_nullable = 'NO'
      )
      and not has_schema_privilege('service_role', namespace.oid, 'USAGE,CREATE')
      and not has_schema_privilege('authenticated', namespace.oid, 'USAGE,CREATE')
      and not has_schema_privilege('anon', namespace.oid, 'USAGE,CREATE')
      and not has_table_privilege('service_role', relation.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_table_privilege('authenticated', relation.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_table_privilege('anon', relation.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_table_privilege('service_role', 'account_delete_private.account_erasure_execution_control', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_table_privilege('authenticated', 'account_delete_private.account_erasure_execution_control', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_table_privilege('anon', 'account_delete_private.account_erasure_execution_control', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      and not has_function_privilege('service_role', 'account_delete_private.open_account_erasure_execution_control_v1(integer)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'account_delete_private.open_account_erasure_execution_control_v1(integer)', 'EXECUTE')
      and not has_function_privilege('anon', 'account_delete_private.open_account_erasure_execution_control_v1(integer)', 'EXECUTE')
      and not has_function_privilege('service_role', 'account_delete_private.close_account_erasure_execution_control_v1()', 'EXECUTE')
      and not has_function_privilege('authenticated', 'account_delete_private.close_account_erasure_execution_control_v1()', 'EXECUTE')
      and not has_function_privilege('anon', 'account_delete_private.close_account_erasure_execution_control_v1()', 'EXECUTE')
      and not has_function_privilege('service_role', 'account_delete_private.fail_close_account_erasure_execution_control_v1(uuid,text)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'account_delete_private.fail_close_account_erasure_execution_control_v1(uuid,text)', 'EXECUTE')
      and not has_function_privilege('anon', 'account_delete_private.fail_close_account_erasure_execution_control_v1(uuid,text)', 'EXECUTE')
      and not has_function_privilege('service_role', 'account_delete_private.create_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'account_delete_private.create_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE')
      and not has_function_privilege('anon', 'account_delete_private.create_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,uuid,text,integer)', 'EXECUTE')
      and not has_function_privilege('service_role', 'account_delete_private.stamp_account_erasure_prepared_window()', 'EXECUTE')
      and not has_function_privilege('authenticated', 'account_delete_private.stamp_account_erasure_prepared_window()', 'EXECUTE')
      and not has_function_privilege('anon', 'account_delete_private.stamp_account_erasure_prepared_window()', 'EXECUTE')
      and not has_function_privilege('service_role', 'account_delete_private.revoke_grant_after_reprepare()', 'EXECUTE')
      and not has_function_privilege('authenticated', 'account_delete_private.revoke_grant_after_reprepare()', 'EXECUTE')
      and not has_function_privilege('anon', 'account_delete_private.revoke_grant_after_reprepare()', 'EXECUTE')
      and not has_function_privilege('service_role', 'account_delete_private.sanitize_account_erasure_operator_response_v1(jsonb)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'account_delete_private.sanitize_account_erasure_operator_response_v1(jsonb)', 'EXECUTE')
      and not has_function_privilege('anon', 'account_delete_private.sanitize_account_erasure_operator_response_v1(jsonb)', 'EXECUTE')
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where relation.oid = to_regclass('account_delete_private.account_erasure_execution_grants')
  ), false);

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
    ('cases', 'sensitive_info_consented_at'),
    ('scheduled_notifications', 'push_sent_at'),
    ('scheduled_notifications', 'email_sent_at'),
    ('account_delete_executors', 'active'),
    ('account_delete_executors', 'activated_at'),
    ('account_delete_executors', 'revoked_at'),
    ('account_erasure_jobs', 'operator_method'),
    ('account_erasure_jobs', 'prepared_at'),
    ('account_erasure_jobs', 'prepared_expires_at')
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
    ('submit_anonymous_case_diagnosis'),
    ('consume_case_handoff'),
    ('create_initial_family_person'),
    ('create_family_invite'),
    ('accept_family_invite'),
    ('promote_family_member_to_owner'),
    ('transfer_family_ownership'),
    ('remove_family_member'),
    ('leave_family'),
    ('cancel_family_invite'),
    ('get_family_management_summary'),
    ('account_erasure_operator_method'),
    ('verify_account_delete_operator_v2'),
    ('update_account_delete_request_status_v1'),
    ('update_account_delete_request_status_v2'),
    ('guard_erased_profile_recreation'),
    ('guard_erased_notebook_storage_write'),
    ('guard_erased_notebook_attachment_reference'),
    ('collect_account_erasure_shared_photo_blockers'),
    ('inspect_account_erasure_v1'),
    ('prepare_account_erasure_v1'),
    ('inspect_account_erasure_v2'),
    ('prepare_account_erasure_v2'),
    ('execute_account_erasure_database_v1'),
    ('issue_account_erasure_execution_grant_v1'),
    ('inspect_account_erasure_execution_grant_v1'),
    ('execute_account_erasure_database_v2'),
    ('finalize_account_erasure_v1')
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
