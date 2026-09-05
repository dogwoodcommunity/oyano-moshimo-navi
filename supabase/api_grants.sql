-- API role grants for Supabase/PostgREST.
-- Run after schema.sql and before production verification.
-- RLS still controls anon/authenticated access; these grants only allow the API roles
-- to reach the tables/functions that policies then restrict.

begin;

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select, update on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Family ownership and membership are changed only through the atomic,
-- explicit-family RPCs. Keep a later re-run of this broad bootstrap file from
-- restoring direct DML around those checks.
revoke update, delete on table families from authenticated;
revoke insert, update, delete on table family_members, family_invites from authenticated;

-- Per-person AI memory mutations are server-only. RLS still limits direct reads,
-- while revoking client writes protects the server-derived fact/source boundary.
revoke all
  on table person_ai_memories, ai_consult_threads, ai_consult_turns, ai_memory_consents
  from authenticated;

grant select
  on table person_ai_memories, ai_consult_threads, ai_consult_turns, ai_memory_consents
  to authenticated;

revoke all
  on table person_ai_memories, ai_consult_threads, ai_consult_turns, ai_memory_consents
  from service_role;

grant select, insert, update, delete
  on table person_ai_memories, ai_consult_threads, ai_consult_turns, ai_memory_consents
  to service_role;

revoke all
  on table person_ai_memories, ai_consult_threads, ai_consult_turns, ai_memory_consents
  from anon;

grant select, insert, update on cases to anon;
grant select, insert, update on case_results to anon;
grant select, insert on consent_logs to anon;
grant usage, select, update on all sequences in schema public to anon;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select, update on sequences to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;

-- SECURITY DEFINER RPCs below are server-only. Keep these explicit revokes after
-- the broad authenticated function grant above so fresh installs cannot expose
-- either RPC through PostgREST. The existence checks keep this shared grant file
-- compatible with partial schemas that have not installed the RPCs yet.
do $server_only_rpc_acl$
begin
  if to_regprocedure('public.consume_case_handoff(uuid,text,uuid,text,text)') is not null then
    execute 'revoke all on function public.consume_case_handoff(uuid, text, uuid, text, text) from public, anon, authenticated';
    execute 'grant execute on function public.consume_case_handoff(uuid, text, uuid, text, text) to service_role';
  end if;

  if to_regprocedure('public.submit_anonymous_case_diagnosis(uuid,text,text,jsonb,text,text,boolean,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)') is not null then
    execute 'revoke all on function public.submit_anonymous_case_diagnosis(uuid, text, text, jsonb, text, text, boolean, text, text, text, text, text, text, jsonb, jsonb, jsonb, text) from public, anon, authenticated';
    execute 'grant execute on function public.submit_anonymous_case_diagnosis(uuid, text, text, jsonb, text, text, boolean, text, text, text, text, text, text, jsonb, jsonb, jsonb, text) to service_role';
  end if;

  if to_regprocedure('public.promote_family_member_to_owner(uuid)') is not null then
    execute 'revoke all on function public.promote_family_member_to_owner(uuid) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.promote_family_member_to_owner(uuid) to service_role';
  end if;

  if to_regprocedure('public.sync_notebook_v2(uuid,text,uuid,boolean,jsonb,jsonb,uuid)') is not null then
    execute 'revoke all on function public.sync_notebook_v2(uuid, text, uuid, boolean, jsonb, jsonb, uuid) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.sync_notebook_v2(uuid, text, uuid, boolean, jsonb, jsonb, uuid) to service_role';
  end if;

  if to_regclass('public.ai_consult_daily_claims') is not null then
    execute 'revoke all on table public.ai_consult_daily_claims from public, anon, authenticated, service_role';
  end if;

  if to_regclass('public.notebook_storage_deletion_jobs') is not null then
    execute 'revoke all on table public.notebook_storage_deletion_jobs from public, anon, authenticated, service_role';
    execute 'grant select, insert, update, delete on table public.notebook_storage_deletion_jobs to service_role';
  end if;

  if to_regclass('public.notebook_diary_deletion_receipts') is not null then
    execute 'revoke all on table public.notebook_diary_deletion_receipts from public, anon, authenticated, service_role';
    execute 'grant select, insert, delete on table public.notebook_diary_deletion_receipts to service_role';
  end if;

  if to_regclass('public.person_notebook_deletion_receipts') is not null then
    execute 'revoke all on table public.person_notebook_deletion_receipts from public, anon, authenticated, service_role';
  end if;

  if to_regclass('public.person_notebook_storage_deletion_jobs') is not null then
    execute 'revoke all on table public.person_notebook_storage_deletion_jobs from public, anon, authenticated, service_role';
    execute 'grant select, insert, update, delete on table public.person_notebook_storage_deletion_jobs to service_role';
  end if;

  if to_regprocedure('public.guard_notebook_storage_deletion_paths()') is not null then
    execute 'revoke all on function public.guard_notebook_storage_deletion_paths() from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.delete_notebook_diary_v1(uuid,uuid,uuid,text,text,bigint,text)') is not null then
    execute 'revoke all on function public.delete_notebook_diary_v1(uuid, uuid, uuid, text, text, bigint, text) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.delete_notebook_diary_v1(uuid, uuid, uuid, text, text, bigint, text) to service_role';
  end if;

  if to_regprocedure('public.guard_deleted_person_notebook_identity()') is not null then
    execute 'revoke all on function public.guard_deleted_person_notebook_identity() from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.guard_person_notebook_storage_deletion_path()') is not null then
    execute 'revoke all on function public.guard_person_notebook_storage_deletion_path() from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.person_notebook_storage_path_is_referenced(text,text)') is not null then
    execute 'revoke all on function public.person_notebook_storage_path_is_referenced(text, text) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.person_notebook_storage_path_is_referenced(text, text) to service_role';
  end if;

  if to_regprocedure('public.delete_person_notebook_v1(uuid,uuid,uuid,text,bigint,text)') is not null then
    execute 'revoke all on function public.delete_person_notebook_v1(uuid, uuid, uuid, text, bigint, text) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.delete_person_notebook_v1(uuid, uuid, uuid, text, bigint, text) to service_role';
  end if;

  if to_regprocedure('public.claim_daily_free_consult(uuid,uuid,uuid,uuid)') is not null then
    execute 'revoke all on function public.claim_daily_free_consult(uuid, uuid, uuid, uuid) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.claim_daily_free_consult(uuid, uuid, uuid, uuid) to service_role';
  end if;

  if to_regprocedure('public.persist_and_finalize_daily_free_consult(uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid[],integer,text)') is not null then
    execute 'revoke all on function public.persist_and_finalize_daily_free_consult(uuid, uuid, uuid, uuid, uuid, text, jsonb, uuid[], integer, text) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.persist_and_finalize_daily_free_consult(uuid, uuid, uuid, uuid, uuid, text, jsonb, uuid[], integer, text) to service_role';
  end if;

  if to_regprocedure('public.release_daily_free_consult(uuid,uuid,uuid)') is not null then
    execute 'revoke all on function public.release_daily_free_consult(uuid, uuid, uuid) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.release_daily_free_consult(uuid, uuid, uuid) to service_role';
  end if;

  if to_regclass('public.account_delete_executors') is not null then
    execute 'revoke all on table public.account_delete_executors from public, anon, authenticated, service_role';
  end if;

  if to_regclass('public.account_erasure_jobs') is not null then
    execute 'revoke all on table public.account_erasure_jobs from public, anon, authenticated, service_role';
    execute 'grant select on table public.account_erasure_jobs to service_role';
  end if;

  if to_regprocedure('public.account_erasure_operator_method(uuid)') is not null then
    execute 'revoke all on function public.account_erasure_operator_method(uuid) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.verify_account_delete_operator_v2(uuid)') is not null then
    execute 'revoke all on function public.verify_account_delete_operator_v2(uuid) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.verify_account_delete_operator_v2(uuid) to service_role';
  end if;

  if to_regprocedure('public.update_account_delete_request_status_v1(uuid,text,text,uuid)') is not null then
    execute 'revoke all on function public.update_account_delete_request_status_v1(uuid, text, text, uuid) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.update_account_delete_request_status_v2(uuid,text,text,uuid)') is not null then
    execute 'revoke all on function public.update_account_delete_request_status_v2(uuid, text, text, uuid) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.update_account_delete_request_status_v2(uuid, text, text, uuid) to service_role';
  end if;

  if to_regprocedure('public.guard_erased_profile_recreation()') is not null then
    execute 'revoke all on function public.guard_erased_profile_recreation() from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.guard_erased_notebook_storage_write()') is not null then
    execute 'revoke all on function public.guard_erased_notebook_storage_write() from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.guard_erased_notebook_attachment_reference()') is not null then
    execute 'revoke all on function public.guard_erased_notebook_attachment_reference() from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.collect_account_erasure_storage_objects(uuid,uuid[])') is not null then
    execute 'revoke all on function public.collect_account_erasure_storage_objects(uuid, uuid[]) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.collect_account_erasure_storage_prefixes(uuid[])') is not null then
    execute 'revoke all on function public.collect_account_erasure_storage_prefixes(uuid[]) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.hash_account_erasure_storage_prefixes(jsonb)') is not null then
    execute 'revoke all on function public.hash_account_erasure_storage_prefixes(jsonb) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.collect_account_erasure_storage_manifest_blockers(jsonb,jsonb)') is not null then
    execute 'revoke all on function public.collect_account_erasure_storage_manifest_blockers(jsonb, jsonb) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.collect_account_erasure_pending_cleanup_objects(uuid,uuid[])') is not null then
    execute 'revoke all on function public.collect_account_erasure_pending_cleanup_objects(uuid, uuid[]) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.collect_account_erasure_pending_person_cleanup_objects(uuid,uuid[])') is not null then
    execute 'revoke all on function public.collect_account_erasure_pending_person_cleanup_objects(uuid, uuid[]) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.collect_account_erasure_shared_photo_blockers(uuid,uuid[])') is not null then
    execute 'revoke all on function public.collect_account_erasure_shared_photo_blockers(uuid, uuid[]) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.merge_account_erasure_storage_objects(jsonb,jsonb)') is not null then
    execute 'revoke all on function public.merge_account_erasure_storage_objects(jsonb, jsonb) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.prepare_account_erasure_v1(uuid,uuid,uuid)') is not null then
    execute 'revoke all on function public.prepare_account_erasure_v1(uuid, uuid, uuid) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.inspect_account_erasure_v1(uuid,uuid,uuid)') is not null then
    execute 'revoke all on function public.inspect_account_erasure_v1(uuid, uuid, uuid) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.prepare_account_erasure_v2(uuid,uuid,uuid)') is not null then
    execute 'revoke all on function public.prepare_account_erasure_v2(uuid, uuid, uuid) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.prepare_account_erasure_v2(uuid, uuid, uuid) to service_role';
  end if;

  if to_regprocedure('public.inspect_account_erasure_v2(uuid,uuid,uuid)') is not null then
    execute 'revoke all on function public.inspect_account_erasure_v2(uuid, uuid, uuid) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.inspect_account_erasure_v2(uuid, uuid, uuid) to service_role';
  end if;

  if to_regprocedure('public.execute_account_erasure_database_v1(uuid,uuid,uuid)') is not null then
    execute 'revoke all on function public.execute_account_erasure_database_v1(uuid, uuid, uuid) from public, anon, authenticated, service_role';
  end if;

  if to_regprocedure('public.issue_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,text,integer)') is not null then
    execute 'revoke all on function public.issue_account_erasure_execution_grant_v1(uuid, uuid, uuid, uuid, text, integer) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.issue_account_erasure_execution_grant_v1(uuid, uuid, uuid, uuid, text, integer) to service_role';
  end if;

  if to_regprocedure('public.inspect_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,text)') is not null then
    execute 'revoke all on function public.inspect_account_erasure_execution_grant_v1(uuid, uuid, uuid, uuid, text) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.inspect_account_erasure_execution_grant_v1(uuid, uuid, uuid, uuid, text) to service_role';
  end if;

  if to_regprocedure('public.execute_account_erasure_database_v2(uuid,uuid,uuid,uuid,text)') is not null then
    execute 'revoke all on function public.execute_account_erasure_database_v2(uuid, uuid, uuid, uuid, text) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.execute_account_erasure_database_v2(uuid, uuid, uuid, uuid, text) to service_role';
  end if;

  if to_regprocedure('public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)') is not null then
    execute 'revoke all on function public.finalize_account_erasure_v1(uuid, uuid, uuid, boolean, boolean, integer) from public, anon, authenticated, service_role';
    execute 'grant execute on function public.finalize_account_erasure_v1(uuid, uuid, uuid, boolean, boolean, integer) to service_role';
  end if;
end;
$server_only_rpc_acl$;

-- A later broad grant bootstrap must never expose the owner-only deletion
-- identity ledger. It is intentionally unavailable even to service_role.
do $private_operator_ledger_acl$
begin
  if to_regnamespace('account_delete_private') is not null then
    execute 'revoke all on schema account_delete_private from public, anon, authenticated, service_role';
    execute 'revoke all on all tables in schema account_delete_private from public, anon, authenticated, service_role';
    execute 'revoke all on all sequences in schema account_delete_private from public, anon, authenticated, service_role';
    execute 'revoke all on all functions in schema account_delete_private from public, anon, authenticated, service_role';
  end if;
end;
$private_operator_ledger_acl$;

commit;
