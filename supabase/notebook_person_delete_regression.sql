-- Behavioral and ACL regression for notebook_person_delete.sql.
-- Run only in a disposable PostgreSQL database. Everything is rolled back.

begin;

select set_config('request.jwt.claim.role', 'service_role', true);

insert into auth.users (id, email) values
  ('bd000000-0000-4000-8000-000000000001', 'book-owner@example.test'),
  ('bd000000-0000-4000-8000-000000000002', 'book-admin@example.test'),
  ('bd000000-0000-4000-8000-000000000003', 'book-member@example.test'),
  ('bd000000-0000-4000-8000-000000000004', 'book-viewer@example.test');

insert into public.profiles (id, email, display_name) values
  ('bd000000-0000-4000-8000-000000000001', 'book-owner@example.test', 'Owner'),
  ('bd000000-0000-4000-8000-000000000002', 'book-admin@example.test', 'Admin'),
  ('bd000000-0000-4000-8000-000000000003', 'book-member@example.test', 'Member'),
  ('bd000000-0000-4000-8000-000000000004', 'book-viewer@example.test', 'Viewer');

insert into public.families (id, name, owner_user_id, plan) values
  ('bd000000-0000-4000-8000-000000000010', 'Deletion family', 'bd000000-0000-4000-8000-000000000001', 'free');
insert into public.family_members (family_id, user_id, role) values
  ('bd000000-0000-4000-8000-000000000010', 'bd000000-0000-4000-8000-000000000001', 'owner'),
  ('bd000000-0000-4000-8000-000000000010', 'bd000000-0000-4000-8000-000000000002', 'admin'),
  ('bd000000-0000-4000-8000-000000000010', 'bd000000-0000-4000-8000-000000000003', 'member'),
  ('bd000000-0000-4000-8000-000000000010', 'bd000000-0000-4000-8000-000000000004', 'viewer');

insert into public.people (id, family_id, display_name, profile) values
  ('bd000000-0000-4000-8000-000000000020', 'bd000000-0000-4000-8000-000000000010', 'Delete me', '{"localCaseId":"case-delete"}'),
  ('bd000000-0000-4000-8000-000000000021', 'bd000000-0000-4000-8000-000000000010', 'Keep me', '{"localCaseId":"case-keep"}');

insert into public.asset_categories (id, key, label)
values ('bd000000-0000-4000-8000-000000000030', 'book-delete-test', 'test');

insert into public.person_status_events (id, person_id, new_status, created_by)
values ('bd000000-0000-4000-8000-000000000031', 'bd000000-0000-4000-8000-000000000020', 'preparing', 'bd000000-0000-4000-8000-000000000001');
insert into public.tasks (id, person_id, title, created_by)
values ('bd000000-0000-4000-8000-000000000032', 'bd000000-0000-4000-8000-000000000020', 'Delete task', 'bd000000-0000-4000-8000-000000000001');
insert into public.asset_items (id, person_id, category_id, title, created_by)
values ('bd000000-0000-4000-8000-000000000033', 'bd000000-0000-4000-8000-000000000020', 'bd000000-0000-4000-8000-000000000030', 'Delete asset', 'bd000000-0000-4000-8000-000000000001');

insert into public.timeline_events (
  id, person_id, event_type, title, body, attachments, metadata, created_by
) values (
  'bd000000-0000-4000-8000-000000000034',
  'bd000000-0000-4000-8000-000000000020',
  'diary', 'Delete diary', 'private body',
  '[{"storageBucket":"home-photos","storagePath":"notebook/bd000000-0000-4000-8000-000000000001/timeline.jpg"}]',
  '{"localCaseId":"case-delete","localDiaryId":"diary-delete"}',
  'bd000000-0000-4000-8000-000000000001'
);

insert into public.homes (id, person_id, city, notes)
values ('bd000000-0000-4000-8000-000000000035', 'bd000000-0000-4000-8000-000000000020', 'Kobe', 'private home');
insert into public.home_photos (id, home_id, storage_path, uploaded_by)
values (
  'bd000000-0000-4000-8000-000000000036',
  'bd000000-0000-4000-8000-000000000035',
  'bd000000-0000-4000-8000-000000000035/home.jpg',
  'bd000000-0000-4000-8000-000000000001'
);

insert into public.cases (id, user_id, family_id, person_id, answers, status)
values (
  'bd000000-0000-4000-8000-000000000037',
  'bd000000-0000-4000-8000-000000000001',
  'bd000000-0000-4000-8000-000000000010',
  'bd000000-0000-4000-8000-000000000020',
  '{"private":"answer"}', 'converted'
);
insert into public.case_photos (id, case_id, storage_path)
values (
  'bd000000-0000-4000-8000-000000000038',
  'bd000000-0000-4000-8000-000000000037',
  'bd000000-0000-4000-8000-000000000037/case.jpg'
);
insert into public.case_results (id, case_id, summary)
values ('bd000000-0000-4000-8000-000000000039', 'bd000000-0000-4000-8000-000000000037', 'private result');

insert into public.person_ai_memories (person_id, long_term_summary, user_summary, updated_by)
values ('bd000000-0000-4000-8000-000000000020', 'private shared memory', 'private correction', 'bd000000-0000-4000-8000-000000000001');
insert into public.ai_consult_threads (id, person_id, owner_user_id)
values ('bd000000-0000-4000-8000-000000000040', 'bd000000-0000-4000-8000-000000000020', 'bd000000-0000-4000-8000-000000000001');
insert into public.ai_consult_turns (id, thread_id, question, answer)
values ('bd000000-0000-4000-8000-000000000041', 'bd000000-0000-4000-8000-000000000040', 'private question', '{"situation":"private answer"}');
insert into public.ai_memory_consents (person_id, user_id, consent_version)
values ('bd000000-0000-4000-8000-000000000020', 'bd000000-0000-4000-8000-000000000001', 'consult-memory-v02-2026-09-01');
insert into public.share_links (id, family_id, person_id, token, purpose)
values ('bd000000-0000-4000-8000-000000000042', 'bd000000-0000-4000-8000-000000000010', 'bd000000-0000-4000-8000-000000000020', 'delete-person-link', 'test');
insert into public.support_packs (id, case_id, family_id, person_id, status)
values (
  'bd000000-0000-4000-8000-000000000043',
  'bd000000-0000-4000-8000-000000000037',
  'bd000000-0000-4000-8000-000000000010',
  'bd000000-0000-4000-8000-000000000020', 'requested'
);

insert into public.ai_consult_daily_claims (
  family_id, claim_day, claim_token, claimed_by, person_id, status, reserved_at
) values (
  'bd000000-0000-4000-8000-000000000010', current_date,
  'bd000000-0000-4000-8000-000000000044', 'bd000000-0000-4000-8000-000000000001',
  'bd000000-0000-4000-8000-000000000020', 'reserved', now()
);

do $regression$
declare
  v_revision bigint;
  v_hash text;
  v_result jsonb;
begin
  select cloud_revision, cloud_hash into v_revision, v_hash
  from public.people where id = 'bd000000-0000-4000-8000-000000000020';

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  begin
    perform public.delete_person_notebook_v1(
      'bd000000-0000-4000-8000-000000000001', 'bd000000-0000-4000-8000-000000000010',
      'bd000000-0000-4000-8000-000000000020', 'case-delete', v_revision, v_hash
    );
    raise exception 'authenticated claim unexpectedly called server-only person deletion';
  exception when insufficient_privilege then
    if sqlerrm <> 'person_notebook_delete_service_role_required' then raise; end if;
  end;
  perform set_config('request.jwt.claim.role', 'service_role', true);

  if has_table_privilege('anon', 'public.person_notebook_deletion_receipts', 'SELECT')
     or has_table_privilege('authenticated', 'public.person_notebook_deletion_receipts', 'SELECT')
     or has_table_privilege('service_role', 'public.person_notebook_deletion_receipts', 'SELECT') then
    raise exception 'deletion receipts must be RPC-only';
  end if;
  if has_table_privilege('anon', 'public.person_notebook_storage_deletion_jobs', 'SELECT')
     or has_table_privilege('authenticated', 'public.person_notebook_storage_deletion_jobs', 'SELECT')
     or not has_table_privilege('service_role', 'public.person_notebook_storage_deletion_jobs', 'SELECT,UPDATE') then
    raise exception 'Storage jobs must be service-only';
  end if;
  if has_function_privilege('anon', 'public.delete_person_notebook_v1(uuid,uuid,uuid,text,bigint,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.delete_person_notebook_v1(uuid,uuid,uuid,text,bigint,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.delete_person_notebook_v1(uuid,uuid,uuid,text,bigint,text)', 'EXECUTE') then
    raise exception 'delete RPC ACL is incorrect';
  end if;

  begin
    perform public.delete_person_notebook_v1(
      'bd000000-0000-4000-8000-000000000003', 'bd000000-0000-4000-8000-000000000010',
      'bd000000-0000-4000-8000-000000000020', 'case-delete', v_revision, v_hash
    );
    raise exception 'member unexpectedly deleted a whole notebook';
  exception when insufficient_privilege then
    if sqlerrm <> 'person_notebook_delete_owner_admin_required' then raise; end if;
  end;

  begin
    perform public.delete_person_notebook_v1(
      'bd000000-0000-4000-8000-000000000004', 'bd000000-0000-4000-8000-000000000010',
      'bd000000-0000-4000-8000-000000000020', 'case-delete', v_revision, v_hash
    );
    raise exception 'viewer unexpectedly deleted a whole notebook';
  exception when insufficient_privilege then
    if sqlerrm <> 'person_notebook_delete_owner_admin_required' then raise; end if;
  end;

  begin
    perform public.delete_person_notebook_v1(
      'bd000000-0000-4000-8000-000000000002', 'bd000000-0000-4000-8000-000000000010',
      'bd000000-0000-4000-8000-000000000020', 'case-delete', v_revision + 1, v_hash
    );
    raise exception 'stale revision unexpectedly deleted a whole notebook';
  exception when serialization_failure then
    if sqlerrm <> 'person_notebook_delete_conflict' then raise; end if;
  end;
  if not exists (select 1 from public.people where id = 'bd000000-0000-4000-8000-000000000020')
     or exists (select 1 from public.person_notebook_deletion_receipts where person_id = 'bd000000-0000-4000-8000-000000000020') then
    raise exception 'CAS failure changed durable state';
  end if;

  -- A reference from any other person/table must stop the entire transaction.
  insert into public.timeline_events (id, person_id, event_type, title, attachments)
  values (
    'bd000000-0000-4000-8000-000000000045',
    'bd000000-0000-4000-8000-000000000021', 'diary', 'shared path',
    '[{"storageBucket":"home-photos","storagePath":"notebook/bd000000-0000-4000-8000-000000000001/timeline.jpg"}]'
  );
  begin
    perform public.delete_person_notebook_v1(
      'bd000000-0000-4000-8000-000000000002', 'bd000000-0000-4000-8000-000000000010',
      'bd000000-0000-4000-8000-000000000020', 'case-delete', v_revision, v_hash
    );
    raise exception 'shared Storage path unexpectedly deleted';
  exception when serialization_failure then
    if sqlerrm <> 'person_notebook_delete_shared_storage_reference' then raise; end if;
  end;
  delete from public.timeline_events where id = 'bd000000-0000-4000-8000-000000000045';

  create table public.unreviewed_person_reference (
    id uuid primary key,
    person_id uuid references public.people(id) on delete cascade
  );
  begin
    perform public.delete_person_notebook_v1(
      'bd000000-0000-4000-8000-000000000002', 'bd000000-0000-4000-8000-000000000010',
      'bd000000-0000-4000-8000-000000000020', 'case-delete', v_revision, v_hash
    );
    raise exception 'an unreviewed people FK unexpectedly passed preflight';
  exception when object_not_in_prerequisite_state then
    if sqlerrm <> 'person_notebook_delete_unsupported_reference' then raise; end if;
  end;
  drop table public.unreviewed_person_reference;

  v_result := public.delete_person_notebook_v1(
    'bd000000-0000-4000-8000-000000000002', 'bd000000-0000-4000-8000-000000000010',
    'bd000000-0000-4000-8000-000000000020', 'case-delete', v_revision, v_hash
  );
  if v_result->>'deleted' <> 'true'
     or (v_result->>'pendingStorageJobs')::integer <> 3
     or (v_result->'deletedCounts'->>'timelineEvents')::integer <> 1
     or (v_result->'deletedCounts'->>'cases')::integer <> 1 then
    raise exception 'whole notebook deletion result is incomplete: %', v_result;
  end if;

  if exists (select 1 from public.people where id = 'bd000000-0000-4000-8000-000000000020')
     or exists (select 1 from public.tasks where person_id = 'bd000000-0000-4000-8000-000000000020')
     or exists (select 1 from public.asset_items where person_id = 'bd000000-0000-4000-8000-000000000020')
     or exists (select 1 from public.timeline_events where person_id = 'bd000000-0000-4000-8000-000000000020')
     or exists (select 1 from public.homes where person_id = 'bd000000-0000-4000-8000-000000000020')
     or exists (select 1 from public.cases where id = 'bd000000-0000-4000-8000-000000000037')
     or exists (select 1 from public.case_photos where id = 'bd000000-0000-4000-8000-000000000038')
     or exists (select 1 from public.person_ai_memories where person_id = 'bd000000-0000-4000-8000-000000000020')
     or exists (select 1 from public.ai_consult_threads where person_id = 'bd000000-0000-4000-8000-000000000020')
     or exists (select 1 from public.ai_consult_turns where id = 'bd000000-0000-4000-8000-000000000041')
     or exists (select 1 from public.ai_memory_consents where person_id = 'bd000000-0000-4000-8000-000000000020')
     or exists (select 1 from public.share_links where person_id = 'bd000000-0000-4000-8000-000000000020')
     or exists (select 1 from public.ai_consult_daily_claims where person_id = 'bd000000-0000-4000-8000-000000000020') then
    raise exception 'a target notebook child row survived';
  end if;

  if (select count(*) from public.person_notebook_deletion_receipts where person_id = 'bd000000-0000-4000-8000-000000000020') <> 1
     or (select count(*) from public.person_notebook_storage_deletion_jobs where person_id = 'bd000000-0000-4000-8000-000000000020') <> 3 then
    raise exception 'durable deletion receipt/jobs did not survive parent deletion';
  end if;
  if not exists (
    select 1 from public.support_packs
    where id = 'bd000000-0000-4000-8000-000000000043'
      and person_id is null and case_id is null
  ) then
    raise exception 'commercial support record should be retained but detached';
  end if;
  if not exists (select 1 from public.people where id = 'bd000000-0000-4000-8000-000000000021') then
    raise exception 'another family notebook was deleted';
  end if;

  if public.person_notebook_storage_path_is_referenced(
    'home-photos', 'notebook/bd000000-0000-4000-8000-000000000001/timeline.jpg'
  ) then
    raise exception 'deleted target path still appears referenced';
  end if;

  v_result := public.delete_person_notebook_v1(
    'bd000000-0000-4000-8000-000000000001', 'bd000000-0000-4000-8000-000000000010',
    'bd000000-0000-4000-8000-000000000020', 'case-delete', v_revision, v_hash
  );
  if v_result->>'alreadyDeleted' <> 'true'
     or (select count(*) from public.person_notebook_storage_deletion_jobs where person_id = 'bd000000-0000-4000-8000-000000000020') <> 3 then
    raise exception 'same CAS deletion must be idempotent: %', v_result;
  end if;

  begin
    insert into public.people (id, family_id, display_name, profile)
    values (
      'bd000000-0000-4000-8000-000000000022',
      'bd000000-0000-4000-8000-000000000010', 'Stale recreation',
      '{"localCaseId":"case-delete"}'
    );
    raise exception 'deleted localCaseId was recreated';
  exception when serialization_failure then
    if sqlerrm <> 'person_notebook_deleted_identity' then raise; end if;
  end;

  begin
    insert into public.timeline_events (person_id, event_type, title, attachments)
    values (
      'bd000000-0000-4000-8000-000000000021', 'diary', 'queued reuse',
      '[{"storageBucket":"home-photos","storagePath":"notebook/bd000000-0000-4000-8000-000000000001/timeline.jpg"}]'
    );
    raise exception 'queued Storage path was referenced again';
  exception when serialization_failure then
    if sqlerrm <> 'person_notebook_storage_path_pending_deletion' then raise; end if;
  end;
end;
$regression$;

rollback;
