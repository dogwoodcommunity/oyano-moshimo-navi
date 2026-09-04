-- Compact Supabase setup verification.
-- This returns one result table so the SQL Editor can show every check at once.

with checks as (
  select 'table_exists' as check_type, 'profiles' as target, to_regclass('public.profiles') is not null as ok
  union all select 'table_exists', 'app_admins', to_regclass('public.app_admins') is not null
  union all select 'table_exists', 'account_delete_executors', to_regclass('public.account_delete_executors') is not null
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
  union all select 'table_exists', 'account_erasure_jobs', to_regclass('public.account_erasure_jobs') is not null
  union all select 'table_exists', 'public_api_rate_limits', to_regclass('public.public_api_rate_limits') is not null
  union all select 'rls_enabled', 'profiles', coalesce((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), false)
  union all select 'rls_enabled', 'app_admins', coalesce((select relrowsecurity from pg_class where oid = 'public.app_admins'::regclass), false)
  union all select 'rls_enabled', 'account_delete_executors', coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('public.account_delete_executors')), false)
  union all select 'rls_enabled', 'families', coalesce((select relrowsecurity from pg_class where oid = 'public.families'::regclass), false)
  union all select 'rls_enabled', 'family_members', coalesce((select relrowsecurity from pg_class where oid = 'public.family_members'::regclass), false)
  union all select 'rls_enabled', 'people', coalesce((select relrowsecurity from pg_class where oid = 'public.people'::regclass), false)
  union all select 'rls_enabled', 'person_ai_memories', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.person_ai_memories')), false)
  union all select 'rls_enabled', 'ai_consult_threads', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.ai_consult_threads')), false)
  union all select 'rls_enabled', 'ai_consult_turns', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.ai_consult_turns')), false)
  union all select 'rls_enabled', 'ai_memory_consents', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.ai_memory_consents')), false)
  union all select 'rls_enabled', 'ai_consult_daily_claims', coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('public.ai_consult_daily_claims')), false)
  union all select 'rls_enabled', 'notebook_sync_receipts', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.notebook_sync_receipts')), false)
  union all select 'rls_enabled', 'tasks', coalesce((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), false)
  union all select 'rls_enabled', 'scheduled_notifications', coalesce((select relrowsecurity from pg_class where oid = 'public.scheduled_notifications'::regclass), false)
  union all select 'rls_enabled', 'account_delete_requests', coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.account_delete_requests')), false)
  union all select 'rls_enabled', 'account_erasure_jobs', coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('public.account_erasure_jobs')), false)
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
  union all select 'column_exists', 'account_delete_executors.active_default_false', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'account_delete_executors' and column_name = 'active' and data_type = 'boolean' and is_nullable = 'NO' and column_default in ('false', 'false::boolean'))
  union all select 'column_exists', 'account_delete_executors.activated_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'account_delete_executors' and column_name = 'activated_at' and data_type = 'timestamp with time zone')
  union all select 'column_exists', 'account_delete_executors.revoked_at', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'account_delete_executors' and column_name = 'revoked_at' and data_type = 'timestamp with time zone')
  union all select 'column_exists', 'account_erasure_jobs.operator_method', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'account_erasure_jobs' and column_name = 'operator_method' and data_type = 'text')
  union all select 'constraint_exists', 'ai_memory_consents_revision_positive', exists(select 1 from pg_constraint where conrelid = to_regclass('public.ai_memory_consents') and conname = 'ai_memory_consents_revision_positive' and contype = 'c')
  union all select 'constraint_exists', 'account_delete_executors_activation_state', exists(select 1 from pg_constraint where conrelid = to_regclass('public.account_delete_executors') and conname = 'account_delete_executors_activation_state' and contype = 'c')
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
  union all select 'index_exists', 'ux_ai_consult_daily_claims_turn_id', to_regclass('public.ux_ai_consult_daily_claims_turn_id') is not null
  union all select 'table_exists', 'prefecture_usage_snapshots', to_regclass('public.prefecture_usage_snapshots') is not null
  union all select 'table_exists', 'ai_consult_daily_claims', to_regclass('public.ai_consult_daily_claims') is not null
  union all select 'column_exists', 'ai_consult_daily_claims.turn_id', exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ai_consult_daily_claims' and column_name = 'turn_id')
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
  union all select 'function_exists', 'submit_anonymous_case_diagnosis', to_regproc('public.submit_anonymous_case_diagnosis') is not null
  union all select 'function_exists', 'consume_case_handoff', to_regproc('public.consume_case_handoff') is not null
  union all select 'function_exists', 'create_initial_family_person', to_regproc('public.create_initial_family_person') is not null
  union all select 'function_exists', 'create_family_invite', to_regproc('public.create_family_invite') is not null
  union all select 'function_exists', 'accept_family_invite', to_regproc('public.accept_family_invite') is not null
  union all select 'function_exists', 'check_public_api_rate_limit', to_regproc('public.check_public_api_rate_limit') is not null
  union all select 'function_exists', 'purge_stale_anonymous_cases', to_regproc('public.purge_stale_anonymous_cases') is not null
  union all select 'function_exists', 'promote_family_member_to_owner', to_regproc('public.promote_family_member_to_owner') is not null
  union all select 'function_exists', 'transfer_family_ownership', to_regprocedure('public.transfer_family_ownership(uuid,uuid)') is not null
  union all select 'function_exists', 'remove_family_member', to_regprocedure('public.remove_family_member(uuid,uuid)') is not null
  union all select 'function_exists', 'leave_family', to_regprocedure('public.leave_family(uuid)') is not null
  union all select 'function_exists', 'cancel_family_invite', to_regprocedure('public.cancel_family_invite(uuid,uuid)') is not null
  union all select 'function_exists', 'get_family_management_summary', to_regprocedure('public.get_family_management_summary(uuid)') is not null
  union all select 'function_exists', 'claim_daily_free_consult', to_regprocedure('public.claim_daily_free_consult(uuid,uuid,uuid,uuid)') is not null
  union all select 'function_exists', 'persist_and_finalize_daily_free_consult', to_regprocedure('public.persist_and_finalize_daily_free_consult(uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid[],integer,text)') is not null
  union all select 'function_exists', 'release_daily_free_consult', to_regprocedure('public.release_daily_free_consult(uuid,uuid,uuid)') is not null
  union all select 'function_exists', 'capture_prefecture_usage_snapshot', to_regprocedure('public.capture_prefecture_usage_snapshot(date)') is not null
  union all select 'function_exists', 'touch_ai_consult_updated_at', to_regproc('public.touch_ai_consult_updated_at') is not null
  union all select 'function_exists', 'sync_notebook_v2', to_regprocedure('public.sync_notebook_v2(uuid,text,uuid,boolean,jsonb,jsonb,uuid)') is not null
  union all select 'function_exists', 'is_family_editor', to_regprocedure('public.is_family_editor(uuid)') is not null
  union all select 'function_exists', 'account_erasure_operator_method', to_regprocedure('public.account_erasure_operator_method(uuid)') is not null
  union all select 'function_exists', 'update_account_delete_request_status_v1', to_regprocedure('public.update_account_delete_request_status_v1(uuid,text,text,uuid)') is not null
  union all select 'trigger_exists', 'people_notebook_cloud_version', exists(select 1 from pg_trigger where tgrelid = to_regclass('public.people') and tgname = 'people_notebook_cloud_version' and not tgisinternal)
  union all select 'trigger_exists', 'tasks_notebook_cloud_version', exists(select 1 from pg_trigger where tgrelid = to_regclass('public.tasks') and tgname = 'tasks_notebook_cloud_version' and not tgisinternal)
  union all select 'trigger_exists', 'timeline_events_notebook_cloud_version', exists(select 1 from pg_trigger where tgrelid = to_regclass('public.timeline_events') and tgname = 'timeline_events_notebook_cloud_version' and not tgisinternal)
  union all select 'trigger_exists', 'timeline_events_notebook_storage_delete_guard', exists(
    select 1
    from pg_trigger
    where tgrelid = to_regclass('public.timeline_events')
      and tgname = 'timeline_events_notebook_storage_delete_guard'
      and not tgisinternal
      and tgenabled in ('O', 'A')
  )
  union all select 'security_check', 'notebook_sync_rpc_service_only',
    has_function_privilege('service_role', 'public.sync_notebook_v2(uuid,text,uuid,boolean,jsonb,jsonb,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.sync_notebook_v2(uuid,text,uuid,boolean,jsonb,jsonb,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.sync_notebook_v2(uuid,text,uuid,boolean,jsonb,jsonb,uuid)', 'EXECUTE')
  union all select 'security_check', 'account_delete_executor_acl',
    has_table_privilege('service_role', 'public.account_delete_executors', 'SELECT')
    and not has_table_privilege('service_role', 'public.account_delete_executors', 'INSERT,UPDATE,DELETE')
    and not has_table_privilege('authenticated', 'public.account_delete_executors', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('anon', 'public.account_delete_executors', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_function_privilege('service_role', 'public.account_erasure_operator_method(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.account_erasure_operator_method(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.account_erasure_operator_method(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.update_account_delete_request_status_v1(uuid,text,text,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.update_account_delete_request_status_v1(uuid,text,text,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.update_account_delete_request_status_v1(uuid,text,text,uuid)', 'EXECUTE')
  union all select 'security_check', 'consult_daily_claim_service_only',
    has_function_privilege('service_role', 'public.claim_daily_free_consult(uuid,uuid,uuid,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.persist_and_finalize_daily_free_consult(uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid[],integer,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.release_daily_free_consult(uuid,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.claim_daily_free_consult(uuid,uuid,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.persist_and_finalize_daily_free_consult(uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid[],integer,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.release_daily_free_consult(uuid,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.claim_daily_free_consult(uuid,uuid,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.persist_and_finalize_daily_free_consult(uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid[],integer,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.release_daily_free_consult(uuid,uuid,uuid)', 'EXECUTE')
    and not has_table_privilege('service_role', 'public.ai_consult_daily_claims', 'SELECT')
    and not has_table_privilege('authenticated', 'public.ai_consult_daily_claims', 'SELECT')
    and not has_table_privilege('anon', 'public.ai_consult_daily_claims', 'SELECT')
  union all select 'security_check', 'family_editor_helper_acl',
    has_function_privilege('authenticated', 'public.is_family_editor(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.is_family_editor(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.is_family_editor(uuid)', 'EXECUTE')
  union all select 'security_check', 'family_management_rpc_acl',
    has_function_privilege('authenticated', 'public.transfer_family_ownership(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.remove_family_member(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.leave_family(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.cancel_family_invite(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.transfer_family_ownership(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.remove_family_member(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.leave_family(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.cancel_family_invite(uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.transfer_family_ownership(uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.remove_family_member(uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.leave_family(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.cancel_family_invite(uuid,uuid)', 'EXECUTE')
    and not exists (
      select 1
      from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
      where p.oid in (
        to_regprocedure('public.transfer_family_ownership(uuid,uuid)'),
        to_regprocedure('public.remove_family_member(uuid,uuid)'),
        to_regprocedure('public.leave_family(uuid)'),
        to_regprocedure('public.cancel_family_invite(uuid,uuid)')
      )
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    )
  union all select 'security_check', 'family_management_rpc_security_definer',
    (
      select count(*) = 4 and bool_and(p.prosecdef)
      from pg_proc p
      where p.oid in (
        to_regprocedure('public.transfer_family_ownership(uuid,uuid)'),
        to_regprocedure('public.remove_family_member(uuid,uuid)'),
        to_regprocedure('public.leave_family(uuid)'),
        to_regprocedure('public.cancel_family_invite(uuid,uuid)')
      )
    )
  union all select 'security_check', 'family_management_summary_acl',
    has_function_privilege('authenticated', 'public.get_family_management_summary(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.get_family_management_summary(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.get_family_management_summary(uuid)', 'EXECUTE')
    and (
      select p.prosecdef
      from pg_proc p
      where p.oid = to_regprocedure('public.get_family_management_summary(uuid)')
    )
    and not exists (
      select 1
      from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
      where p.oid = to_regprocedure('public.get_family_management_summary(uuid)')
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    )
  union all select 'security_check', 'legacy_owner_promotion_client_closed',
    has_function_privilege('service_role', 'public.promote_family_member_to_owner(uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.promote_family_member_to_owner(uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.promote_family_member_to_owner(uuid)', 'EXECUTE')
    and not exists (
      select 1
      from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) privilege
      where p.oid = to_regprocedure('public.promote_family_member_to_owner(uuid)')
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    )
  union all select 'security_check', 'family_management_direct_dml_closed',
    not has_table_privilege('authenticated', 'public.families', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.families', 'DELETE')
    and not has_table_privilege('authenticated', 'public.family_members', 'INSERT')
    and not has_table_privilege('authenticated', 'public.family_members', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.family_members', 'DELETE')
    and not has_table_privilege('authenticated', 'public.family_invites', 'INSERT')
    and not has_table_privilege('authenticated', 'public.family_invites', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.family_invites', 'DELETE')
  union all select 'security_check', 'family_management_dangerous_policies_absent',
    not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and (
          (tablename = 'families' and cmd in ('ALL', 'UPDATE', 'DELETE'))
          or (tablename in ('family_members', 'family_invites') and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE'))
        )
    )
  union all select 'security_check', 'anonymous_diagnosis_rpc_service_only',
    has_function_privilege('service_role', 'public.submit_anonymous_case_diagnosis(uuid,text,text,jsonb,text,text,boolean,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.submit_anonymous_case_diagnosis(uuid,text,text,jsonb,text,text,boolean,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.submit_anonymous_case_diagnosis(uuid,text,text,jsonb,text,text,boolean,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)', 'EXECUTE')
  union all select 'security_check', 'handoff_consume_rpc_service_only',
    has_function_privilege('service_role', 'public.consume_case_handoff(uuid,text,uuid,text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.consume_case_handoff(uuid,text,uuid,text,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.consume_case_handoff(uuid,text,uuid,text,text)', 'EXECUTE')
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
  union all select 'security_check', 'asset_items_writer_policy_excludes_viewer',
    (
      select count(*) = 1 and bool_and(
        cmd = 'ALL'
        and roles = array['authenticated']::name[]
        and position('is_family_editor' in coalesce(qual, '')) > 0
        and position('is_family_editor' in coalesce(with_check, '')) > 0
      )
      from pg_policies
      where schemaname = 'public'
        and tablename = 'asset_items'
        and policyname = 'asset_items manage family'
    )
  union all select 'security_check', 'homes_writer_policy_excludes_viewer',
    (
      select count(*) = 1 and bool_and(
        cmd = 'ALL'
        and roles = array['authenticated']::name[]
        and position('is_family_editor' in coalesce(qual, '')) > 0
        and position('is_family_editor' in coalesce(with_check, '')) > 0
      )
      from pg_policies
      where schemaname = 'public'
        and tablename = 'homes'
        and policyname = 'homes manage family'
    )
  union all select 'security_check', 'home_photos_writer_policy_excludes_viewer',
    (
      select count(*) = 1 and bool_and(
        cmd = 'ALL'
        and roles = array['authenticated']::name[]
        and position('is_family_editor' in coalesce(qual, '')) > 0
        and position('is_family_editor' in coalesce(with_check, '')) > 0
      )
      from pg_policies
      where schemaname = 'public'
        and tablename = 'home_photos'
        and policyname = 'home_photos manage family'
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
  union all select 'security_check', 'account_erasure_service_only',
    has_table_privilege('service_role', 'public.account_erasure_jobs', 'SELECT')
    and not has_table_privilege('service_role', 'public.account_erasure_jobs', 'INSERT')
    and not has_table_privilege('service_role', 'public.account_erasure_jobs', 'UPDATE')
    and not has_table_privilege('service_role', 'public.account_erasure_jobs', 'DELETE')
    and not has_table_privilege('authenticated', 'public.account_erasure_jobs', 'SELECT')
    and not has_table_privilege('anon', 'public.account_erasure_jobs', 'SELECT')
    and has_function_privilege('service_role', 'public.inspect_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.prepare_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.execute_account_erasure_database_v1(uuid,uuid,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.inspect_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.prepare_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.execute_account_erasure_database_v1(uuid,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.inspect_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.prepare_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.execute_account_erasure_database_v1(uuid,uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)', 'EXECUTE')
  union all select 'security_check', 'account_erasure_profile_recreation_guard',
    exists (
      select 1 from pg_trigger
      where tgrelid = 'public.profiles'::regclass
        and tgname = 'profiles_erasure_recreation_guard'
        and not tgisinternal
    )
  union all select 'security_check', 'account_erasure_storage_race_guards',
    exists (
      select 1 from pg_trigger
      where tgrelid = 'storage.objects'::regclass
        and tgname = 'objects_account_erasure_write_guard'
        and not tgisinternal
    )
    and exists (
      select 1 from pg_trigger
      where tgrelid = 'public.timeline_events'::regclass
        and tgname = 'timeline_events_account_erasure_reference_guard'
        and not tgisinternal
    )
  union all select 'security_check', 'account_erasure_internal_helpers_private',
    not has_function_privilege('service_role', 'public.guard_erased_profile_recreation()', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.guard_erased_notebook_storage_write()', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.guard_erased_notebook_attachment_reference()', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.collect_account_erasure_storage_objects(uuid,uuid[])', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.collect_account_erasure_storage_prefixes(uuid[])', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.hash_account_erasure_storage_prefixes(jsonb)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.collect_account_erasure_storage_manifest_blockers(jsonb,jsonb)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.collect_account_erasure_pending_cleanup_objects(uuid,uuid[])', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.collect_account_erasure_pending_person_cleanup_objects(uuid,uuid[])', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.collect_account_erasure_shared_photo_blockers(uuid,uuid[])', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.merge_account_erasure_storage_objects(jsonb,jsonb)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.collect_account_erasure_storage_objects(uuid,uuid[])', 'EXECUTE')
    and not has_function_privilege('anon', 'public.collect_account_erasure_storage_objects(uuid,uuid[])', 'EXECUTE')
  union all select 'security_check', 'account_erasure_completed_receipt_minimized',
    not exists (
      select 1 from public.account_erasure_jobs job
      where job.status = 'completed'
        and (
          job.target_user_id is not null
          or job.target_email_hash is not null
          or job.owned_family_ids <> '{}'::uuid[]
          or job.storage_objects <> '[]'::jsonb
          or job.storage_prefixes <> '[]'::jsonb
          or exists (
            select 1 from unnest(job.storage_prefix_hashes) prefix_hash
            where prefix_hash !~ '^[0-9a-f]{64}$'
          )
        )
    )
  union all select 'security_check', 'account_erasure_person_deletion_identity_minimized',
    not exists (
      select 1
      from public.account_erasure_jobs erasure
      join public.person_notebook_deletion_receipts receipt
        on receipt.deleted_by is not null
       and encode(digest(receipt.deleted_by::text, 'sha256'), 'hex') = erasure.target_user_hash
      where erasure.status = 'completed'
    )
    and not exists (
      select 1
      from public.account_erasure_jobs erasure
      join public.person_notebook_storage_deletion_jobs job
        on (
          job.created_by is not null
          and encode(digest(job.created_by::text, 'sha256'), 'hex') = erasure.target_user_hash
        ) or (
          job.storage_bucket = 'home-photos'
          and job.storage_path ~* '^notebook/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/]+$'
          and encode(digest(split_part(job.storage_path, '/', 2), 'sha256'), 'hex') = erasure.target_user_hash
        )
      where erasure.status = 'completed'
    )
  union all select 'security_check', 'notebook_deletion_durable_state_service_only',
    not has_table_privilege('authenticated', 'public.notebook_storage_deletion_jobs', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('authenticated', 'public.notebook_diary_deletion_receipts', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('authenticated', 'public.person_notebook_deletion_receipts', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('authenticated', 'public.person_notebook_storage_deletion_jobs', 'SELECT,INSERT,UPDATE,DELETE')
    and has_table_privilege('service_role', 'public.notebook_storage_deletion_jobs', 'SELECT')
    and has_table_privilege('service_role', 'public.notebook_diary_deletion_receipts', 'SELECT')
    and not has_table_privilege('service_role', 'public.person_notebook_deletion_receipts', 'SELECT,INSERT,UPDATE,DELETE')
    and has_table_privilege('service_role', 'public.person_notebook_storage_deletion_jobs', 'SELECT')
    and not has_function_privilege('authenticated', 'public.delete_notebook_diary_v1(uuid,uuid,uuid,text,text,bigint,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.delete_person_notebook_v1(uuid,uuid,uuid,text,bigint,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.delete_notebook_diary_v1(uuid,uuid,uuid,text,text,bigint,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.delete_person_notebook_v1(uuid,uuid,uuid,text,bigint,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.person_notebook_storage_path_is_referenced(text,text)', 'EXECUTE')
  union all select 'security_check', 'legacy_family_app_admin_absent', not exists(select 1 from public.family_members where role = 'admin' and relationship = 'app_admin')
  union all select 'seed_count', 'task_templates', (select count(*) > 0 from public.task_templates)
  union all select 'seed_count', 'products', (select count(*) > 0 from public.products)
)
select *
from checks
order by check_type, target;
