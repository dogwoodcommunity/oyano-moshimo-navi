-- Compact Supabase setup verification.
-- This returns one result table so the SQL Editor can show every check at once.

with checks as (
  select 'table_exists' as check_type, 'profiles' as target, to_regclass('public.profiles') is not null as ok
  union all select 'table_exists', 'app_admins', to_regclass('public.app_admins') is not null
  union all select 'table_exists', 'families', to_regclass('public.families') is not null
  union all select 'table_exists', 'family_members', to_regclass('public.family_members') is not null
  union all select 'table_exists', 'family_invites', to_regclass('public.family_invites') is not null
  union all select 'table_exists', 'people', to_regclass('public.people') is not null
  union all select 'table_exists', 'person_ai_memories', to_regclass('public.person_ai_memories') is not null
  union all select 'table_exists', 'ai_consult_threads', to_regclass('public.ai_consult_threads') is not null
  union all select 'table_exists', 'ai_consult_turns', to_regclass('public.ai_consult_turns') is not null
  union all select 'table_exists', 'ai_memory_consents', to_regclass('public.ai_memory_consents') is not null
  union all select 'table_exists', 'notebook_sync_receipts', to_regclass('public.notebook_sync_receipts') is not null
  union all select 'table_exists', 'tasks', to_regclass('public.tasks') is not null
  union all select 'table_exists', 'scheduled_notifications', to_regclass('public.scheduled_notifications') is not null
  union all select 'table_exists', 'push_tokens', to_regclass('public.push_tokens') is not null
  union all select 'table_exists', 'products', to_regclass('public.products') is not null
  union all select 'table_exists', 'partners', to_regclass('public.partners') is not null
  union all select 'table_exists', 'support_packs', to_regclass('public.support_packs') is not null
  union all select 'table_exists', 'homes', to_regclass('public.homes') is not null
  union all select 'table_exists', 'account_delete_requests', to_regclass('public.account_delete_requests') is not null
  union all select 'table_exists', 'public_api_rate_limits', to_regclass('public.public_api_rate_limits') is not null
  union all select 'rls_enabled', 'profiles', coalesce((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), false)
  union all select 'rls_enabled', 'app_admins', coalesce((select relrowsecurity from pg_class where oid = 'public.app_admins'::regclass), false)
  union all select 'rls_enabled', 'families', coalesce((select relrowsecurity from pg_class where oid = 'public.families'::regclass), false)
  union all select 'rls_enabled', 'family_members', coalesce((select relrowsecurity from pg_class where oid = 'public.family_members'::regclass), false)
  union all select 'rls_enabled', 'people', coalesce((select relrowsecurity from pg_class where oid = 'public.people'::regclass), false)
  union all select 'rls_enabled', 'person_ai_memories', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.person_ai_memories')), false)
  union all select 'rls_enabled', 'ai_consult_threads', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.ai_consult_threads')), false)
  union all select 'rls_enabled', 'ai_consult_turns', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.ai_consult_turns')), false)
  union all select 'rls_enabled', 'ai_memory_consents', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.ai_memory_consents')), false)
  union all select 'rls_enabled', 'notebook_sync_receipts', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.notebook_sync_receipts')), false)
  union all select 'rls_enabled', 'tasks', coalesce((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), false)
  union all select 'rls_enabled', 'scheduled_notifications', coalesce((select relrowsecurity from pg_class where oid = 'public.scheduled_notifications'::regclass), false)
  union all select 'rls_enabled', 'account_delete_requests', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.account_delete_requests')), false)
  union all select 'rls_enabled', 'public_api_rate_limits', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.public_api_rate_limits')), false)
  union all select 'rls_enabled', 'partners', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.partners')), false)
  union all select 'storage_bucket', 'home-photos', exists(select 1 from storage.buckets where id = 'home-photos')
  union all select 'column_exists', 'case_results.app_handoff_consumed_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'case_results' and column_name = 'app_handoff_consumed_at')
  union all select 'column_exists', 'people.profile', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'people' and column_name = 'profile')
  union all select 'column_exists', 'people.prefecture', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'people' and column_name = 'prefecture')
  union all select 'column_exists', 'people.city', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'people' and column_name = 'city')
  union all select 'column_exists', 'families.consult_trial_used_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'families' and column_name = 'consult_trial_used_at')
  union all select 'column_exists', 'scheduled_notifications.push_sent_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scheduled_notifications' and column_name = 'push_sent_at')
  union all select 'column_exists', 'scheduled_notifications.email_sent_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'scheduled_notifications' and column_name = 'email_sent_at')
  union all select 'column_exists', 'people.profile_updated_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'people' and column_name = 'profile_updated_at')
  union all select 'column_exists', 'people.cloud_revision', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'people' and column_name = 'cloud_revision' and data_type = 'bigint' and is_nullable = 'NO')
  union all select 'column_exists', 'people.cloud_hash', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'people' and column_name = 'cloud_hash' and data_type = 'text' and is_nullable = 'NO')
  union all select 'column_exists', 'tasks.local_task_id', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'local_task_id' and data_type = 'text')
  union all select 'column_exists', 'tasks.notebook_metadata', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'notebook_metadata' and data_type = 'jsonb' and is_nullable = 'NO')
  union all select 'column_exists', 'tasks.cloud_revision', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'cloud_revision' and data_type = 'bigint' and is_nullable = 'NO')
  union all select 'column_exists', 'tasks.cloud_hash', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tasks' and column_name = 'cloud_hash' and data_type = 'text' and is_nullable = 'NO')
  union all select 'column_exists', 'timeline_events.mood', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'timeline_events' and column_name = 'mood')
  union all select 'column_exists', 'timeline_events.attachments', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'timeline_events' and column_name = 'attachments')
  union all select 'column_exists', 'timeline_events.metadata', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'timeline_events' and column_name = 'metadata')
  union all select 'column_exists', 'timeline_events.cloud_revision', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'timeline_events' and column_name = 'cloud_revision' and data_type = 'bigint' and is_nullable = 'NO')
  union all select 'column_exists', 'timeline_events.cloud_hash', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'timeline_events' and column_name = 'cloud_hash' and data_type = 'text' and is_nullable = 'NO')
  union all select 'column_exists', 'timeline_events.updated_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'timeline_events' and column_name = 'updated_at' and data_type = 'timestamp with time zone' and is_nullable = 'NO')
  union all select 'column_exists', 'person_ai_memories.long_term_summary', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'person_ai_memories' and column_name = 'long_term_summary')
  union all select 'column_exists', 'person_ai_memories.user_summary', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'person_ai_memories' and column_name = 'user_summary')
  union all select 'column_exists', 'person_ai_memories.excluded_event_ids', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'person_ai_memories' and column_name = 'excluded_event_ids')
  union all select 'column_exists', 'person_ai_memories.memory_version', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'person_ai_memories' and column_name = 'memory_version')
  union all select 'column_exists', 'person_ai_memories.memory_reset_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'person_ai_memories' and column_name = 'memory_reset_at')
  union all select 'column_exists', 'ai_consult_turns.saved_to_notebook_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_consult_turns' and column_name = 'saved_to_notebook_at')
  union all select 'column_exists', 'ai_memory_consents.revoked_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_memory_consents' and column_name = 'revoked_at')
  union all select 'column_exists', 'ai_memory_consents.revision', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_memory_consents' and column_name = 'revision' and data_type = 'integer' and is_nullable = 'NO')
  union all select 'constraint_exists', 'ai_memory_consents_revision_positive', exists(select 1 from pg_constraint where conrelid = to_regclass('public.ai_memory_consents') and conname = 'ai_memory_consents_revision_positive' and contype = 'c')
  union all select 'constraint_exists', 'family_members_role_allowed', exists(select 1 from pg_constraint where conrelid = to_regclass('public.family_members') and conname = 'family_members_role_allowed' and contype = 'c')
  union all select 'constraint_exists', 'people_cloud_revision_positive', exists(select 1 from pg_constraint where conrelid = to_regclass('public.people') and conname = 'people_cloud_revision_positive' and contype = 'c')
  union all select 'constraint_exists', 'people_cloud_hash_sha256', exists(select 1 from pg_constraint where conrelid = to_regclass('public.people') and conname = 'people_cloud_hash_sha256' and contype = 'c')
  union all select 'constraint_exists', 'tasks_cloud_revision_positive', exists(select 1 from pg_constraint where conrelid = to_regclass('public.tasks') and conname = 'tasks_cloud_revision_positive' and contype = 'c')
  union all select 'constraint_exists', 'tasks_notebook_metadata_object', exists(select 1 from pg_constraint where conrelid = to_regclass('public.tasks') and conname = 'tasks_notebook_metadata_object' and contype = 'c')
  union all select 'constraint_exists', 'tasks_cloud_hash_sha256', exists(select 1 from pg_constraint where conrelid = to_regclass('public.tasks') and conname = 'tasks_cloud_hash_sha256' and contype = 'c')
  union all select 'constraint_exists', 'timeline_events_cloud_revision_positive', exists(select 1 from pg_constraint where conrelid = to_regclass('public.timeline_events') and conname = 'timeline_events_cloud_revision_positive' and contype = 'c')
  union all select 'constraint_exists', 'timeline_events_cloud_hash_sha256', exists(select 1 from pg_constraint where conrelid = to_regclass('public.timeline_events') and conname = 'timeline_events_cloud_hash_sha256' and contype = 'c')
  union all select 'column_exists', 'cases.consent_to_sensitive_info', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cases' and column_name = 'consent_to_sensitive_info')
  union all select 'column_exists', 'cases.sensitive_info_consent_version', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cases' and column_name = 'sensitive_info_consent_version')
  union all select 'column_exists', 'cases.sensitive_info_consented_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cases' and column_name = 'sensitive_info_consented_at')
  union all select 'index_exists', 'idx_case_results_handoff_valid', to_regclass('public.idx_case_results_handoff_valid') is not null
  union all select 'index_exists', 'idx_consent_logs_case_type', to_regclass('public.idx_consent_logs_case_type') is not null
  union all select 'index_exists', 'idx_people_profile_updated_at', to_regclass('public.idx_people_profile_updated_at') is not null
  union all select 'index_exists', 'idx_people_prefecture', to_regclass('public.idx_people_prefecture') is not null
  union all select 'index_exists', 'idx_partners_region_category_status', to_regclass('public.idx_partners_region_category_status') is not null
  union all select 'index_exists', 'idx_prefecture_usage_snapshots_month', to_regclass('public.idx_prefecture_usage_snapshots_month') is not null
  union all select 'index_exists', 'idx_timeline_events_person_date', to_regclass('public.idx_timeline_events_person_date') is not null
  union all select 'index_exists', 'idx_person_ai_memories_updated_at', to_regclass('public.idx_person_ai_memories_updated_at') is not null
  union all select 'index_exists', 'idx_ai_consult_threads_owner_updated', to_regclass('public.idx_ai_consult_threads_owner_updated') is not null
  union all select 'index_exists', 'idx_ai_consult_turns_thread_created', to_regclass('public.idx_ai_consult_turns_thread_created') is not null
  union all select 'index_exists', 'idx_ai_memory_consents_user_updated', to_regclass('public.idx_ai_memory_consents_user_updated') is not null
  union all select 'index_exists', 'ux_people_family_local_case_id', to_regclass('public.ux_people_family_local_case_id') is not null
  union all select 'index_exists', 'ux_tasks_person_local_task_id', to_regclass('public.ux_tasks_person_local_task_id') is not null
  union all select 'index_exists', 'ux_timeline_events_person_local_diary_id', to_regclass('public.ux_timeline_events_person_local_diary_id') is not null
  union all select 'index_exists', 'idx_notebook_sync_receipts_created_at', to_regclass('public.idx_notebook_sync_receipts_created_at') is not null
  union all select 'table_exists', 'prefecture_usage_snapshots', to_regclass('public.prefecture_usage_snapshots') is not null
  union all select 'view_exists', 'prefecture_active_family_current_counts', to_regclass('public.prefecture_active_family_current_counts') is not null
  union all select 'view_exists', 'prefecture_active_family_counts', to_regclass('public.prefecture_active_family_counts') is not null
  union all select 'view_column_exists', 'prefecture_active_family_counts.active_users', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prefecture_active_family_counts' and column_name = 'active_users')
  union all select 'view_column_exists', 'prefecture_active_family_counts.previous_month_users', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prefecture_active_family_counts' and column_name = 'previous_month_users')
  union all select 'view_column_exists', 'prefecture_active_family_counts.month_over_month_users', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'prefecture_active_family_counts' and column_name = 'month_over_month_users')
  union all select 'function_exists', 'generate_tasks_for_status_event', to_regproc('public.generate_tasks_for_status_event') is not null
  union all select 'function_exists', 'schedule_notifications_for_task', to_regproc('public.schedule_notifications_for_task') is not null
  union all select 'function_exists', 'claim_due_scheduled_notifications', to_regproc('public.claim_due_scheduled_notifications') is not null
  union all select 'function_exists', 'reset_stale_sending_notifications', to_regproc('public.reset_stale_sending_notifications') is not null
  union all select 'function_exists', 'ensure_monthly_checkin_notifications', to_regproc('public.ensure_monthly_checkin_notifications') is not null
  union all select 'function_exists', 'consume_case_handoff', to_regproc('public.consume_case_handoff') is not null
  union all select 'function_exists', 'create_initial_family_person', to_regproc('public.create_initial_family_person') is not null
  union all select 'function_exists', 'create_family_invite', to_regproc('public.create_family_invite') is not null
  union all select 'function_exists', 'accept_family_invite', to_regproc('public.accept_family_invite') is not null
  union all select 'function_exists', 'check_public_api_rate_limit', to_regproc('public.check_public_api_rate_limit') is not null
  union all select 'function_exists', 'purge_stale_anonymous_cases', to_regproc('public.purge_stale_anonymous_cases') is not null
  union all select 'function_exists', 'promote_family_member_to_owner', to_regproc('public.promote_family_member_to_owner') is not null
  union all select 'function_exists', 'capture_prefecture_usage_snapshot', to_regprocedure('public.capture_prefecture_usage_snapshot(date)') is not null
  union all select 'function_exists', 'touch_ai_consult_updated_at', to_regproc('public.touch_ai_consult_updated_at') is not null
  union all select 'function_exists', 'sync_notebook_v2', to_regprocedure('public.sync_notebook_v2(uuid,text,uuid,boolean,jsonb,jsonb,uuid)') is not null
  union all select 'trigger_exists', 'people_notebook_cloud_version', exists(select 1 from pg_trigger where tgrelid = to_regclass('public.people') and tgname = 'people_notebook_cloud_version' and not tgisinternal)
  union all select 'trigger_exists', 'tasks_notebook_cloud_version', exists(select 1 from pg_trigger where tgrelid = to_regclass('public.tasks') and tgname = 'tasks_notebook_cloud_version' and not tgisinternal)
  union all select 'trigger_exists', 'timeline_events_notebook_cloud_version', exists(select 1 from pg_trigger where tgrelid = to_regclass('public.timeline_events') and tgname = 'timeline_events_notebook_cloud_version' and not tgisinternal)
  union all select 'security_check', 'notebook_sync_rpc_service_only',
    has_function_privilege('service_role', 'public.sync_notebook_v2(uuid,text,uuid,boolean,jsonb,jsonb,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.sync_notebook_v2(uuid,text,uuid,boolean,jsonb,jsonb,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.sync_notebook_v2(uuid,text,uuid,boolean,jsonb,jsonb,uuid)', 'EXECUTE')
  union all select 'security_check', 'notebook_sync_receipts_service_only',
    has_table_privilege('service_role', 'public.notebook_sync_receipts', 'SELECT')
    and has_table_privilege('service_role', 'public.notebook_sync_receipts', 'INSERT')
    and not has_table_privilege('service_role', 'public.notebook_sync_receipts', 'UPDATE')
    and not has_table_privilege('service_role', 'public.notebook_sync_receipts', 'DELETE')
    and not has_table_privilege('service_role', 'public.notebook_sync_receipts', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public.notebook_sync_receipts', 'SELECT')
    and not has_table_privilege('authenticated', 'public.notebook_sync_receipts', 'INSERT')
    and not has_table_privilege('authenticated', 'public.notebook_sync_receipts', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.notebook_sync_receipts', 'DELETE')
    and not has_table_privilege('anon', 'public.notebook_sync_receipts', 'SELECT')
    and not has_table_privilege('anon', 'public.notebook_sync_receipts', 'INSERT')
    and not has_table_privilege('anon', 'public.notebook_sync_receipts', 'UPDATE')
    and not has_table_privilege('anon', 'public.notebook_sync_receipts', 'DELETE')
  union all select 'security_check', 'notebook_local_identities_unique',
    not exists(
      select 1 from public.people
      where nullif(btrim(profile->>'localCaseId'), '') is not null
      group by family_id, nullif(btrim(profile->>'localCaseId'), '')
      having count(*) > 1
    )
    and not exists(
      select 1 from public.tasks
      where nullif(btrim(local_task_id), '') is not null
      group by person_id, nullif(btrim(local_task_id), '')
      having count(*) > 1
    )
    and not exists(
      select 1 from public.timeline_events
      where nullif(btrim(metadata->>'localDiaryId'), '') is not null
      group by person_id, nullif(btrim(metadata->>'localDiaryId'), '')
      having count(*) > 1
    )
  union all select 'security_check', 'notebook_local_identity_indexes_unique_partial',
    (
      select count(*) = 3 and bool_and(i.indisunique and i.indisvalid and i.indpred is not null)
      from pg_index i
      where i.indexrelid in (
        to_regclass('public.ux_people_family_local_case_id'),
        to_regclass('public.ux_tasks_person_local_task_id'),
        to_regclass('public.ux_timeline_events_person_local_diary_id')
      )
    )
  union all select 'security_check', 'notebook_version_triggers_security_definer',
    (
      select count(*) = 3 and bool_and(p.prosecdef)
      from pg_proc p
      where p.oid in (
        to_regprocedure('public.notebook_people_cloud_version_trigger()'),
        to_regprocedure('public.notebook_task_cloud_version_trigger()'),
        to_regprocedure('public.notebook_timeline_cloud_version_trigger()')
      )
    )
  union all select 'security_check', 'tasks_writer_policy_excludes_viewer',
    (
      select count(*) = 1 and bool_and(
        cmd = 'ALL'
        and roles = array['authenticated']::name[]
        and position('family_members' in coalesce(qual, '')) > 0
        and position('owner' in coalesce(qual, '')) > 0
        and position('admin' in coalesce(qual, '')) > 0
        and position('member' in coalesce(qual, '')) > 0
        and position('viewer' in coalesce(qual, '')) = 0
        and position('family_members' in coalesce(with_check, '')) > 0
        and position('owner' in coalesce(with_check, '')) > 0
        and position('admin' in coalesce(with_check, '')) > 0
        and position('member' in coalesce(with_check, '')) > 0
        and position('viewer' in coalesce(with_check, '')) = 0
      )
      from pg_policies
      where schemaname = 'public'
        and tablename = 'tasks'
        and policyname = 'tasks manage family'
    )
  union all select 'security_check', 'timeline_writer_policy_excludes_viewer',
    (
      select count(*) = 1 and bool_and(
        cmd = 'ALL'
        and roles = array['authenticated']::name[]
        and position('family_members' in coalesce(qual, '')) > 0
        and position('owner' in coalesce(qual, '')) > 0
        and position('admin' in coalesce(qual, '')) > 0
        and position('member' in coalesce(qual, '')) > 0
        and position('viewer' in coalesce(qual, '')) = 0
        and position('family_members' in coalesce(with_check, '')) > 0
        and position('owner' in coalesce(with_check, '')) > 0
        and position('admin' in coalesce(with_check, '')) > 0
        and position('member' in coalesce(with_check, '')) > 0
        and position('viewer' in coalesce(with_check, '')) = 0
      )
      from pg_policies
      where schemaname = 'public'
        and tablename = 'timeline_events'
        and policyname = 'timeline_events manage family'
    )
  union all select 'security_check', 'status_event_insert_policy_excludes_viewer',
    (
      select count(*) = 1 and bool_and(
        cmd = 'INSERT'
        and roles = array['authenticated']::name[]
        and qual is null
        and position('family_members' in coalesce(with_check, '')) > 0
        and position('owner' in coalesce(with_check, '')) > 0
        and position('admin' in coalesce(with_check, '')) > 0
        and position('member' in coalesce(with_check, '')) > 0
        and position('viewer' in coalesce(with_check, '')) = 0
      )
      from pg_policies
      where schemaname = 'public'
        and tablename = 'person_status_events'
        and policyname = 'status_events insert family'
    )
  union all select 'security_check', 'person_ai_memories_family_read_policy', (select count(*) = 1 and bool_and(policyname = 'person_ai_memories read family' and cmd = 'SELECT' and permissive = 'PERMISSIVE' and roles = array['authenticated']::name[]) from pg_policies where schemaname = 'public' and tablename = 'person_ai_memories')
  union all select 'security_check', 'ai_consult_threads_owner_read_policy', (select count(*) = 1 and bool_and(policyname = 'ai_consult_threads owner family read' and cmd = 'SELECT' and permissive = 'PERMISSIVE' and roles = array['authenticated']::name[]) from pg_policies where schemaname = 'public' and tablename = 'ai_consult_threads')
  union all select 'security_check', 'ai_consult_turns_owner_read_policy', (select count(*) = 1 and bool_and(policyname = 'ai_consult_turns owner family read' and cmd = 'SELECT' and permissive = 'PERMISSIVE' and roles = array['authenticated']::name[]) from pg_policies where schemaname = 'public' and tablename = 'ai_consult_turns')
  union all select 'security_check', 'ai_memory_consents_own_read_policy', (select count(*) = 1 and bool_and(policyname = 'ai_memory_consents own family read' and cmd = 'SELECT' and permissive = 'PERMISSIVE' and roles = array['authenticated']::name[]) from pg_policies where schemaname = 'public' and tablename = 'ai_memory_consents')
  union all select 'security_check', 'ai_memory_authenticated_read_only',
    has_table_privilege('authenticated', 'public.person_ai_memories', 'SELECT')
    and has_table_privilege('authenticated', 'public.ai_consult_threads', 'SELECT')
    and has_table_privilege('authenticated', 'public.ai_consult_turns', 'SELECT')
    and has_table_privilege('authenticated', 'public.ai_memory_consents', 'SELECT')
    and not has_table_privilege('authenticated', 'public.person_ai_memories', 'INSERT')
    and not has_table_privilege('authenticated', 'public.person_ai_memories', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.person_ai_memories', 'DELETE')
    and not has_table_privilege('authenticated', 'public.ai_consult_threads', 'INSERT')
    and not has_table_privilege('authenticated', 'public.ai_consult_threads', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.ai_consult_threads', 'DELETE')
    and not has_table_privilege('authenticated', 'public.ai_consult_turns', 'INSERT')
    and not has_table_privilege('authenticated', 'public.ai_consult_turns', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.ai_consult_turns', 'DELETE')
    and not has_table_privilege('authenticated', 'public.ai_memory_consents', 'INSERT')
    and not has_table_privilege('authenticated', 'public.ai_memory_consents', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.ai_memory_consents', 'DELETE')
    and not has_table_privilege('authenticated', 'public.person_ai_memories', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public.person_ai_memories', 'REFERENCES')
    and not has_table_privilege('authenticated', 'public.person_ai_memories', 'TRIGGER')
    and not has_table_privilege('authenticated', 'public.ai_consult_threads', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public.ai_consult_threads', 'REFERENCES')
    and not has_table_privilege('authenticated', 'public.ai_consult_threads', 'TRIGGER')
    and not has_table_privilege('authenticated', 'public.ai_consult_turns', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public.ai_consult_turns', 'REFERENCES')
    and not has_table_privilege('authenticated', 'public.ai_consult_turns', 'TRIGGER')
    and not has_table_privilege('authenticated', 'public.ai_memory_consents', 'TRUNCATE')
    and not has_table_privilege('authenticated', 'public.ai_memory_consents', 'REFERENCES')
    and not has_table_privilege('authenticated', 'public.ai_memory_consents', 'TRIGGER')
  union all select 'security_check', 'ai_memory_service_role_mutations',
    has_table_privilege('service_role', 'public.person_ai_memories', 'SELECT')
    and has_table_privilege('service_role', 'public.ai_consult_threads', 'SELECT')
    and has_table_privilege('service_role', 'public.ai_consult_turns', 'SELECT')
    and has_table_privilege('service_role', 'public.ai_memory_consents', 'SELECT')
    and
    has_table_privilege('service_role', 'public.person_ai_memories', 'INSERT')
    and has_table_privilege('service_role', 'public.person_ai_memories', 'UPDATE')
    and has_table_privilege('service_role', 'public.person_ai_memories', 'DELETE')
    and has_table_privilege('service_role', 'public.ai_consult_threads', 'INSERT')
    and has_table_privilege('service_role', 'public.ai_consult_threads', 'UPDATE')
    and has_table_privilege('service_role', 'public.ai_consult_threads', 'DELETE')
    and has_table_privilege('service_role', 'public.ai_consult_turns', 'INSERT')
    and has_table_privilege('service_role', 'public.ai_consult_turns', 'UPDATE')
    and has_table_privilege('service_role', 'public.ai_consult_turns', 'DELETE')
    and has_table_privilege('service_role', 'public.ai_memory_consents', 'INSERT')
    and has_table_privilege('service_role', 'public.ai_memory_consents', 'UPDATE')
    and has_table_privilege('service_role', 'public.ai_memory_consents', 'DELETE')
    and not has_table_privilege('service_role', 'public.person_ai_memories', 'TRUNCATE')
    and not has_table_privilege('service_role', 'public.person_ai_memories', 'REFERENCES')
    and not has_table_privilege('service_role', 'public.person_ai_memories', 'TRIGGER')
    and not has_table_privilege('service_role', 'public.ai_consult_threads', 'TRUNCATE')
    and not has_table_privilege('service_role', 'public.ai_consult_threads', 'REFERENCES')
    and not has_table_privilege('service_role', 'public.ai_consult_threads', 'TRIGGER')
    and not has_table_privilege('service_role', 'public.ai_consult_turns', 'TRUNCATE')
    and not has_table_privilege('service_role', 'public.ai_consult_turns', 'REFERENCES')
    and not has_table_privilege('service_role', 'public.ai_consult_turns', 'TRIGGER')
    and not has_table_privilege('service_role', 'public.ai_memory_consents', 'TRUNCATE')
    and not has_table_privilege('service_role', 'public.ai_memory_consents', 'REFERENCES')
    and not has_table_privilege('service_role', 'public.ai_memory_consents', 'TRIGGER')
  union all select 'security_check', 'ai_memory_anon_no_access',
    not has_table_privilege('anon', 'public.person_ai_memories', 'SELECT')
    and not has_table_privilege('anon', 'public.ai_consult_threads', 'SELECT')
    and not has_table_privilege('anon', 'public.ai_consult_turns', 'SELECT')
    and not has_table_privilege('anon', 'public.ai_memory_consents', 'SELECT')
    and not has_table_privilege('anon', 'public.person_ai_memories', 'INSERT')
    and not has_table_privilege('anon', 'public.person_ai_memories', 'UPDATE')
    and not has_table_privilege('anon', 'public.person_ai_memories', 'DELETE')
    and not has_table_privilege('anon', 'public.ai_consult_threads', 'INSERT')
    and not has_table_privilege('anon', 'public.ai_consult_threads', 'UPDATE')
    and not has_table_privilege('anon', 'public.ai_consult_threads', 'DELETE')
    and not has_table_privilege('anon', 'public.ai_consult_turns', 'INSERT')
    and not has_table_privilege('anon', 'public.ai_consult_turns', 'UPDATE')
    and not has_table_privilege('anon', 'public.ai_consult_turns', 'DELETE')
    and not has_table_privilege('anon', 'public.ai_memory_consents', 'INSERT')
    and not has_table_privilege('anon', 'public.ai_memory_consents', 'UPDATE')
    and not has_table_privilege('anon', 'public.ai_memory_consents', 'DELETE')
    and not has_table_privilege('anon', 'public.person_ai_memories', 'TRUNCATE')
    and not has_table_privilege('anon', 'public.person_ai_memories', 'REFERENCES')
    and not has_table_privilege('anon', 'public.person_ai_memories', 'TRIGGER')
    and not has_table_privilege('anon', 'public.ai_consult_threads', 'TRUNCATE')
    and not has_table_privilege('anon', 'public.ai_consult_threads', 'REFERENCES')
    and not has_table_privilege('anon', 'public.ai_consult_threads', 'TRIGGER')
    and not has_table_privilege('anon', 'public.ai_consult_turns', 'TRUNCATE')
    and not has_table_privilege('anon', 'public.ai_consult_turns', 'REFERENCES')
    and not has_table_privilege('anon', 'public.ai_consult_turns', 'TRIGGER')
    and not has_table_privilege('anon', 'public.ai_memory_consents', 'TRUNCATE')
    and not has_table_privilege('anon', 'public.ai_memory_consents', 'REFERENCES')
    and not has_table_privilege('anon', 'public.ai_memory_consents', 'TRIGGER')
  union all select 'security_check', 'legacy_family_app_admin_absent', not exists(select 1 from public.family_members where role = 'admin' and relationship = 'app_admin')
  union all select 'seed_count', 'task_templates', (select count(*) > 0 from public.task_templates)
  union all select 'seed_count', 'products', (select count(*) > 0 from public.products)
)
select *
from checks
order by check_type, target;
