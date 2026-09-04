-- Behavioral regression for the verified account-erasure pipeline.
-- Disposable PostgreSQL only. Every fixture is rolled back.

begin;

insert into auth.users (id, email) values
  ('ac000000-0000-4000-8000-000000000001', 'operator@example.test'),
  ('ac000000-0000-4000-8000-000000000002', 'target@example.test'),
  ('ac000000-0000-4000-8000-000000000003', 'shared-owner@example.test'),
  ('ac000000-0000-4000-8000-000000000004', 'other-member@example.test'),
  ('ac000000-0000-4000-8000-000000000005', 'blocked-target@example.test'),
  ('ac000000-0000-4000-8000-000000000006', 'oversized-target@example.test'),
  ('ac000000-0000-4000-8000-000000000007', 'executor@example.test'),
  ('ac000000-0000-4000-8000-000000000008', 'pending-executor@example.test'),
  ('ac000000-0000-4000-8000-000000000009', 'revoked-executor@example.test'),
  ('ac000000-0000-4000-8000-00000000000a', 'unauthorized@example.test');

insert into public.profiles (id, email) select id, email from auth.users;
insert into public.app_admins (user_id, note)
values ('ac000000-0000-4000-8000-000000000001', 'erasure test operator');

insert into public.account_delete_executors (
  user_id, created_by, note, active, activated_at, revoked_at
) values
  (
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000001',
    'second active executor erased by the main regression',
    true, now(), null
  ),
  (
    'ac000000-0000-4000-8000-000000000007',
    'ac000000-0000-4000-8000-000000000002',
    'active deletion-only test operator',
    true, now(), null
  ),
  (
    'ac000000-0000-4000-8000-000000000008',
    'ac000000-0000-4000-8000-000000000001',
    'pending capability must stay inactive',
    false, null, null
  ),
  (
    'ac000000-0000-4000-8000-000000000009',
    'ac000000-0000-4000-8000-000000000001',
    'revoked capability must stay inactive',
    false, now() - interval '2 minutes', now() - interval '1 minute'
  );

insert into public.families (id, name, owner_user_id, plan) values
  ('ac000000-0000-4000-8000-000000000010', 'target sole family', 'ac000000-0000-4000-8000-000000000002', 'free'),
  ('ac000000-0000-4000-8000-000000000011', 'preserved shared family', 'ac000000-0000-4000-8000-000000000003', 'free'),
  ('ac000000-0000-4000-8000-000000000012', 'blocked owned family', 'ac000000-0000-4000-8000-000000000005', 'free'),
  ('ac000000-0000-4000-8000-000000000013', 'oversized sole family', 'ac000000-0000-4000-8000-000000000006', 'free');

insert into public.family_members (id, family_id, user_id, role) values
  ('ac000000-0000-4000-8000-000000000101', 'ac000000-0000-4000-8000-000000000010', 'ac000000-0000-4000-8000-000000000002', 'owner'),
  ('ac000000-0000-4000-8000-000000000102', 'ac000000-0000-4000-8000-000000000011', 'ac000000-0000-4000-8000-000000000003', 'owner'),
  ('ac000000-0000-4000-8000-000000000103', 'ac000000-0000-4000-8000-000000000011', 'ac000000-0000-4000-8000-000000000002', 'member'),
  ('ac000000-0000-4000-8000-000000000104', 'ac000000-0000-4000-8000-000000000012', 'ac000000-0000-4000-8000-000000000005', 'owner'),
  ('ac000000-0000-4000-8000-000000000105', 'ac000000-0000-4000-8000-000000000012', 'ac000000-0000-4000-8000-000000000004', 'member'),
  ('ac000000-0000-4000-8000-000000000106', 'ac000000-0000-4000-8000-000000000013', 'ac000000-0000-4000-8000-000000000006', 'owner');

insert into public.people (id, family_id, display_name) values
  ('ac000000-0000-4000-8000-000000000020', 'ac000000-0000-4000-8000-000000000010', 'deleted person'),
  ('ac000000-0000-4000-8000-000000000021', 'ac000000-0000-4000-8000-000000000011', 'preserved person'),
  ('ac000000-0000-4000-8000-000000000028', 'ac000000-0000-4000-8000-000000000013', 'oversized person');

insert into public.timeline_events (id, person_id, event_type, title, body, attachments, created_by) values
  (
    'ac000000-0000-4000-8000-000000000030',
    'ac000000-0000-4000-8000-000000000020',
    'diary', 'deleted diary', 'private',
    '[{"storageBucket":"home-photos","storagePath":"notebook/ac000000-0000-4000-8000-000000000002/deleted.jpg"}]'::jsonb,
    'ac000000-0000-4000-8000-000000000002'
  ),
  (
    'ac000000-0000-4000-8000-000000000031',
    'ac000000-0000-4000-8000-000000000021',
    'diary', 'shared diary', 'must remain',
    '[{"storageBucket":"home-photos","storagePath":"notebook/ac000000-0000-4000-8000-000000000003/shared.jpg"}]'::jsonb,
    'ac000000-0000-4000-8000-000000000002'
  );

insert into storage.objects (id, bucket_id, name) values
  ('ac000000-0000-4000-8000-000000000035', 'home-photos', 'notebook/ac000000-0000-4000-8000-000000000002/deleted.jpg'),
  ('ac000000-0000-4000-8000-000000000036', 'home-photos', 'notebook/ac000000-0000-4000-8000-000000000002/orphan.jpg'),
  ('ac000000-0000-4000-8000-000000000037', 'home-photos', 'notebook/ac000000-0000-4000-8000-000000000003/shared.jpg'),
  ('ac000000-0000-4000-8000-000000000038', 'home-photos', 'notebook/ac000000-0000-4000-8000-000000000004/pending-by-target.jpg'),
  ('ac000000-0000-4000-8000-000000000039', 'home-photos', 'notebook/ac000000-0000-4000-8000-000000000004/owned-family-pending.jpg'),
  ('ac000000-0000-4000-8000-00000000003d', 'home-photos', 'notebook/ac000000-0000-4000-8000-000000000004/person-shared-pending.jpg'),
  ('ac000000-0000-4000-8000-00000000003e', 'home-photos', 'notebook/ac000000-0000-4000-8000-000000000004/person-owned-pending.jpg'),
  ('ac000000-0000-4000-8000-00000000003f', 'home-photos', 'notebook/ac000000-0000-4000-8000-000000000002/person-target-path-pending.jpg');

insert into public.homes (id, person_id) values
  ('ac000000-0000-4000-8000-000000000040', 'ac000000-0000-4000-8000-000000000020');
insert into public.home_photos (id, home_id, storage_path, uploaded_by) values
  ('ac000000-0000-4000-8000-000000000041', 'ac000000-0000-4000-8000-000000000040', 'ac-home/deleted-home.jpg', 'ac000000-0000-4000-8000-000000000002');

insert into public.cases (id, user_id, status) values
  ('ac000000-0000-4000-8000-000000000050', 'ac000000-0000-4000-8000-000000000002', 'draft');
insert into public.case_photos (id, case_id, storage_path) values
  ('ac000000-0000-4000-8000-000000000051', 'ac000000-0000-4000-8000-000000000050', 'cases/deleted-case.jpg');

insert into public.person_ai_memories (person_id, long_term_summary, updated_by) values
  ('ac000000-0000-4000-8000-000000000021', 'shared memory remains', 'ac000000-0000-4000-8000-000000000002');
insert into public.ai_consult_threads (id, person_id, owner_user_id) values
  ('ac000000-0000-4000-8000-000000000060', 'ac000000-0000-4000-8000-000000000021', 'ac000000-0000-4000-8000-000000000002');
insert into public.ai_consult_turns (thread_id, question, answer) values
  ('ac000000-0000-4000-8000-000000000060', 'private question', '{"summary":"private answer"}'::jsonb);
insert into public.ai_memory_consents (person_id, user_id, consent_version) values
  ('ac000000-0000-4000-8000-000000000021', 'ac000000-0000-4000-8000-000000000002', 'test-v1');

insert into public.consent_logs (id, user_id, consent_type, consent_text) values
  ('ac000000-0000-4000-8000-000000000070', 'ac000000-0000-4000-8000-000000000002', 'terms', 'retained evidence');
insert into public.products (id, key, name, product_type) values
  ('ac000000-0000-4000-8000-000000000071', 'erasure-test-product', 'test', 'support_pack');
insert into public.purchases (id, user_id, product_id, provider, status) values
  ('ac000000-0000-4000-8000-000000000072', 'ac000000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-000000000071', 'manual', 'paid');
insert into public.audit_logs (id, actor_user_id, action) values
  ('ac000000-0000-4000-8000-000000000073', 'ac000000-0000-4000-8000-000000000002', 'retained_action');

insert into public.account_delete_requests (id, user_id, contact_email, reason, status) values
  ('ac000000-0000-4000-8000-000000000080', 'ac000000-0000-4000-8000-000000000002', 'target@example.test', 'please erase', 'requested'),
  ('ac000000-0000-4000-8000-000000000081', 'ac000000-0000-4000-8000-000000000005', 'blocked-target@example.test', 'please erase', 'requested'),
  ('ac000000-0000-4000-8000-000000000082', 'ac000000-0000-4000-8000-000000000006', 'oversized-target@example.test', 'please erase', 'requested'),
  ('ac000000-0000-4000-8000-000000000083', 'ac000000-0000-4000-8000-000000000007', 'executor@example.test', 'last executor guard', 'requested'),
  ('ac000000-0000-4000-8000-000000000084', 'ac000000-0000-4000-8000-000000000001', 'operator@example.test', 'last admin guard', 'requested'),
  ('ac000000-0000-4000-8000-000000000085', 'ac000000-0000-4000-8000-000000000004', 'other-member@example.test', 'status transition', 'requested');

create or replace function public.account_erasure_regression_fail_status_audit()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.action = 'account_delete_status_updated'
     and new.target_id = 'ac000000-0000-4000-8000-000000000085'::uuid
     and new.metadata->>'status' = 'needs_followup' then
    raise exception 'forced_status_audit_failure';
  end if;
  return new;
end;
$$;

create trigger account_erasure_regression_status_audit_failure
before insert on public.audit_logs
for each row execute function public.account_erasure_regression_fail_status_audit();

create or replace function public.account_erasure_regression_fail_status_request_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.id = 'ac000000-0000-4000-8000-000000000085'::uuid
     and new.status = 'needs_followup'
     and new.handled_note = 'must roll back after audit insert' then
    raise exception 'forced_status_request_update_failure';
  end if;
  return new;
end;
$$;

insert into public.notebook_storage_deletion_jobs (
  id, family_id, person_id, event_id, local_case_id, local_diary_id,
  storage_bucket, storage_path, status, created_by
) values
  (
    'ac000000-0000-4000-8000-000000000090',
    'ac000000-0000-4000-8000-000000000011',
    'ac000000-0000-4000-8000-000000000021',
    'ac000000-0000-4000-8000-000000000031',
    'shared-case', 'already-deleted-diary',
    'home-photos',
    'notebook/ac000000-0000-4000-8000-000000000004/pending-by-target.jpg',
    'pending',
    'ac000000-0000-4000-8000-000000000002'
  ),
  (
    'ac000000-0000-4000-8000-000000000091',
    'ac000000-0000-4000-8000-000000000010',
    'ac000000-0000-4000-8000-000000000020',
    'ac000000-0000-4000-8000-000000000030',
    'owned-case', 'owned-diary',
    'home-photos',
    'notebook/ac000000-0000-4000-8000-000000000004/owned-family-pending.jpg',
    'pending',
    'ac000000-0000-4000-8000-000000000004'
  ),
  (
    'ac000000-0000-4000-8000-000000000092',
    'ac000000-0000-4000-8000-000000000011',
    'ac000000-0000-4000-8000-000000000021',
    'ac000000-0000-4000-8000-000000000031',
    'old-case', 'old-diary',
    'home-photos',
    'notebook/ac000000-0000-4000-8000-000000000002/already-removed.jpg',
    'completed',
    'ac000000-0000-4000-8000-000000000002'
  ),
  (
    'ac000000-0000-4000-8000-00000000009b',
    'ac000000-0000-4000-8000-000000000010',
    'ac000000-0000-4000-8000-000000000020',
    'ac000000-0000-4000-8000-000000000030',
    'owned-case', 'owned-completed-diary',
    'home-photos',
    'notebook/ac000000-0000-4000-8000-000000000004/owned-already-removed.jpg',
    'completed',
    'ac000000-0000-4000-8000-000000000004'
  );

insert into public.notebook_diary_deletion_receipts (
  family_id, person_id, local_case_id, local_diary_id
) values
  (
    'ac000000-0000-4000-8000-000000000011',
    'ac000000-0000-4000-8000-000000000021',
    'shared-case', 'shared-deleted-diary'
  ),
  (
    'ac000000-0000-4000-8000-000000000010',
    'ac000000-0000-4000-8000-000000000020',
    'owned-case', 'owned-deleted-diary'
  );

-- Whole-person notebook deletion has its own durable receipt and Storage
-- tombstones. Account erasure must inventory its detached pending objects,
-- clear the erased actor from shared-family evidence, and remove identities
-- that belonged only to a sole-owned family.
insert into public.person_notebook_deletion_receipts (
  id, family_id, person_id, local_case_id, expected_cloud_revision,
  expected_cloud_hash, deleted_by, deleted_counts
) values
  (
    'ac000000-0000-4000-8000-000000000093',
    'ac000000-0000-4000-8000-000000000011',
    'ac000000-0000-4000-8000-000000000022',
    'shared-deleted-case', 1, repeat('a', 64),
    'ac000000-0000-4000-8000-000000000002',
    '{"storageObjects":2}'::jsonb
  ),
  (
    'ac000000-0000-4000-8000-000000000094',
    'ac000000-0000-4000-8000-000000000010',
    'ac000000-0000-4000-8000-000000000023',
    'owned-deleted-case', 1, repeat('b', 64),
    'ac000000-0000-4000-8000-000000000004',
    '{"storageObjects":2}'::jsonb
  );

insert into public.person_notebook_storage_deletion_jobs (
  id, family_id, person_id, local_case_id, storage_bucket, storage_path,
  status, created_by, completed_at
) values
  (
    'ac000000-0000-4000-8000-000000000095',
    'ac000000-0000-4000-8000-000000000011',
    'ac000000-0000-4000-8000-000000000022',
    'shared-deleted-case', 'home-photos',
    'notebook/ac000000-0000-4000-8000-000000000004/person-shared-pending.jpg',
    'pending', 'ac000000-0000-4000-8000-000000000002', null
  ),
  (
    'ac000000-0000-4000-8000-000000000096',
    'ac000000-0000-4000-8000-000000000010',
    'ac000000-0000-4000-8000-000000000023',
    'owned-deleted-case', 'home-photos',
    'notebook/ac000000-0000-4000-8000-000000000004/person-owned-pending.jpg',
    'pending', 'ac000000-0000-4000-8000-000000000004', null
  ),
  (
    'ac000000-0000-4000-8000-000000000097',
    'ac000000-0000-4000-8000-000000000011',
    'ac000000-0000-4000-8000-000000000024',
    'shared-target-path', 'home-photos',
    'notebook/ac000000-0000-4000-8000-000000000002/person-completed.jpg',
    'completed', 'ac000000-0000-4000-8000-000000000004', now()
  ),
  (
    'ac000000-0000-4000-8000-000000000098',
    'ac000000-0000-4000-8000-000000000011',
    'ac000000-0000-4000-8000-000000000025',
    'shared-other-path', 'home-photos',
    'notebook/ac000000-0000-4000-8000-000000000004/person-completed-other.jpg',
    'completed', 'ac000000-0000-4000-8000-000000000002', now()
  ),
  (
    'ac000000-0000-4000-8000-000000000099',
    'ac000000-0000-4000-8000-000000000010',
    'ac000000-0000-4000-8000-000000000026',
    'owned-completed', 'home-photos',
    'notebook/ac000000-0000-4000-8000-000000000004/person-owned-completed.jpg',
    'completed', 'ac000000-0000-4000-8000-000000000004', now()
  ),
  (
    'ac000000-0000-4000-8000-00000000009a',
    'ac000000-0000-4000-8000-000000000011',
    'ac000000-0000-4000-8000-000000000027',
    'shared-target-path-pending', 'home-photos',
    'notebook/ac000000-0000-4000-8000-000000000002/person-target-path-pending.jpg',
    'pending', 'ac000000-0000-4000-8000-000000000004', null
  );

insert into public.person_notebook_storage_deletion_jobs (
  id, family_id, person_id, local_case_id, storage_bucket, storage_path,
  status, created_by, completed_at
)
select
  gen_random_uuid(),
  'ac000000-0000-4000-8000-000000000013'::uuid,
  'ac000000-0000-4000-8000-000000000028'::uuid,
  'oversized-case',
  'home-photos',
  'notebook/ac000000-0000-4000-8000-000000000006/' || value::text || '.jpg',
  'pending',
  'ac000000-0000-4000-8000-000000000006'::uuid,
  null
from generate_series(1, 5001) value;

do $test$
declare
  v_result jsonb;
  v_method text;
  v_count integer;
  v_audit_count_before integer;
  v_recreation_blocked boolean := false;
  v_forced_failure boolean := false;
  v_constraint_blocked boolean := false;
begin
  select public.account_erasure_operator_method(
    'ac000000-0000-4000-8000-000000000001'
  ) into v_method;
  if v_method <> 'supabase_app_admin' then
    raise exception 'app_admin compatibility was lost: %', v_method;
  end if;

  select public.account_erasure_operator_method(
    'ac000000-0000-4000-8000-000000000007'
  ) into v_method;
  if v_method <> 'supabase_account_delete_executor' then
    raise exception 'active deletion-only executor was not authorized: %', v_method;
  end if;

  if public.account_erasure_operator_method('ac000000-0000-4000-8000-000000000008') is not null
     or public.account_erasure_operator_method('ac000000-0000-4000-8000-000000000009') is not null
     or public.account_erasure_operator_method('ac000000-0000-4000-8000-00000000000a') is not null then
    raise exception 'pending, revoked, or absent executor capability was authorized';
  end if;

  begin
    insert into public.account_delete_executors (user_id, active)
    values ('ac000000-0000-4000-8000-00000000000a', true);
  exception when check_violation then
    v_constraint_blocked := true;
  end;
  if not v_constraint_blocked then
    raise exception 'executor row activated without activated_at';
  end if;

  select public.inspect_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-00000000000a'
  ) into v_result;
  if v_result->>'result' <> 'operator_forbidden' then
    raise exception 'unauthorized inspection was allowed: %', v_result;
  end if;
  select public.prepare_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-00000000000a'
  ) into v_result;
  if v_result->>'result' <> 'operator_forbidden' then
    raise exception 'unauthorized preparation was allowed: %', v_result;
  end if;
  select public.execute_account_erasure_database_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-00000000000a'
  ) into v_result;
  if v_result->>'result' <> 'operator_forbidden' then
    raise exception 'unauthorized database erasure was allowed: %', v_result;
  end if;
  select public.finalize_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-00000000000a',
    true, true, 0
  ) into v_result;
  if v_result->>'result' <> 'operator_forbidden' then
    raise exception 'unauthorized finalization was allowed: %', v_result;
  end if;

  select public.update_account_delete_request_status_v1(
    'ac000000-0000-4000-8000-000000000085',
    'reviewing',
    'identity checked',
    'ac000000-0000-4000-8000-00000000000a'
  ) into v_result;
  if v_result->>'result' <> 'operator_forbidden' then
    raise exception 'unauthorized status update was allowed: %', v_result;
  end if;

  select public.update_account_delete_request_status_v1(
    'ac000000-0000-4000-8000-000000000085',
    'requested',
    null,
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'invalid_status' then
    raise exception 'requested status transition was allowed: %', v_result;
  end if;
  select public.update_account_delete_request_status_v1(
    'ac000000-0000-4000-8000-000000000085',
    'completed',
    null,
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'invalid_status' then
    raise exception 'status RPC bypassed verified completion: %', v_result;
  end if;

  select public.update_account_delete_request_status_v1(
    'ac000000-0000-4000-8000-000000000085',
    'reviewing',
    'identity checked',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'updated'
     or v_result->>'operatorMethod' <> 'supabase_account_delete_executor'
     or not exists (
       select 1
       from public.account_delete_requests request
       join public.audit_logs audit on audit.id = request.audit_log_id
       where request.id = 'ac000000-0000-4000-8000-000000000085'
         and request.status = 'reviewing'
         and request.handled_by = 'ac000000-0000-4000-8000-000000000007'
         and request.handled_by_email = 'executor@example.test'
         and request.handled_by_method = 'supabase_account_delete_executor'
         and audit.actor_user_id = 'ac000000-0000-4000-8000-000000000007'
         and audit.action = 'account_delete_status_updated'
         and audit.metadata->>'handled_by_email' = 'executor@example.test'
         and audit.metadata->>'handled_by_method' = 'supabase_account_delete_executor'
     ) then
    raise exception 'status and audit were not committed atomically: %', v_result;
  end if;

  select count(*) into v_audit_count_before
  from public.audit_logs
  where target_id = 'ac000000-0000-4000-8000-000000000085'
    and action = 'account_delete_status_updated';
  begin
    perform public.update_account_delete_request_status_v1(
      'ac000000-0000-4000-8000-000000000085',
      'needs_followup',
      'must roll back with audit failure',
      'ac000000-0000-4000-8000-000000000007'
    );
  exception when others then
    if sqlerrm = 'forced_status_audit_failure' then
      v_forced_failure := true;
    else
      raise;
    end if;
  end;
  select count(*) into v_count
  from public.audit_logs
  where target_id = 'ac000000-0000-4000-8000-000000000085'
    and action = 'account_delete_status_updated';
  if not v_forced_failure
     or v_count <> v_audit_count_before
     or not exists (
       select 1 from public.account_delete_requests
       where id = 'ac000000-0000-4000-8000-000000000085'
         and status = 'reviewing'
         and handled_note = 'identity checked'
     ) then
    raise exception 'audit failure did not roll back the status transition';
  end if;

  execute 'drop trigger account_erasure_regression_status_audit_failure on public.audit_logs';

  execute 'create trigger account_erasure_regression_status_request_update_failure before update on public.account_delete_requests for each row execute function public.account_erasure_regression_fail_status_request_update()';
  v_forced_failure := false;
  select count(*) into v_audit_count_before
  from public.audit_logs
  where target_id = 'ac000000-0000-4000-8000-000000000085'
    and action = 'account_delete_status_updated';
  begin
    perform public.update_account_delete_request_status_v1(
      'ac000000-0000-4000-8000-000000000085',
      'needs_followup',
      'must roll back after audit insert',
      'ac000000-0000-4000-8000-000000000007'
    );
  exception when others then
    if sqlerrm = 'forced_status_request_update_failure' then
      v_forced_failure := true;
    else
      raise;
    end if;
  end;
  select count(*) into v_count
  from public.audit_logs
  where target_id = 'ac000000-0000-4000-8000-000000000085'
    and action = 'account_delete_status_updated';
  if not v_forced_failure
     or v_count <> v_audit_count_before
     or not exists (
       select 1 from public.account_delete_requests
       where id = 'ac000000-0000-4000-8000-000000000085'
         and status = 'reviewing'
         and handled_note = 'identity checked'
     ) then
    raise exception 'request update failure did not roll back the inserted audit row';
  end if;
  execute 'drop trigger account_erasure_regression_status_request_update_failure on public.account_delete_requests';

  select public.update_account_delete_request_status_v1(
    'ac000000-0000-4000-8000-000000000085',
    'needs_followup',
    'follow up safely',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'updated' then
    raise exception 'allowed needs_followup transition failed: %', v_result;
  end if;

  select public.collect_account_erasure_storage_manifest_blockers(
    '[{"bucket":"home-photos","path":"../unsafe.jpg"}]'::jsonb,
    '[]'::jsonb
  ) into v_result;
  if not (v_result @> '[{"code":"unsafe_storage_manifest"}]'::jsonb) then
    raise exception 'unsafe Storage manifest validation was not fail-closed: %', v_result;
  end if;

  select public.inspect_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000082',
    'ac000000-0000-4000-8000-000000000006',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or not (v_result->'blockedDetails' @> '[{"code":"storage_manifest_too_large"}]'::jsonb) then
    raise exception 'oversized read-only inspection was not blocked: %', v_result;
  end if;
  if exists (
    select 1 from public.account_erasure_jobs
    where request_id = 'ac000000-0000-4000-8000-000000000082'
  ) then
    raise exception 'oversized read-only inspection created a reservation';
  end if;

  select public.prepare_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000082',
    'ac000000-0000-4000-8000-000000000006',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or not (v_result->'blockedDetails' @> '[{"code":"storage_manifest_too_large"}]'::jsonb) then
    raise exception 'oversized destructive preparation was not blocked: %', v_result;
  end if;

  select public.execute_account_erasure_database_v1(
    'ac000000-0000-4000-8000-000000000082',
    'ac000000-0000-4000-8000-000000000006',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or v_result->>'code' <> 'storage_manifest_too_large'
     or not exists (
       select 1 from public.profiles
       where id = 'ac000000-0000-4000-8000-000000000006'
     )
     or not exists (
       select 1 from public.families
       where id = 'ac000000-0000-4000-8000-000000000013'
     )
     or not exists (
       select 1
       from public.account_erasure_jobs job
       join public.account_delete_requests request on request.id = job.request_id
       where job.request_id = 'ac000000-0000-4000-8000-000000000082'
         and job.operator_user_id = 'ac000000-0000-4000-8000-000000000007'
         and job.operator_method = 'supabase_account_delete_executor'
         and request.handled_by = 'ac000000-0000-4000-8000-000000000007'
         and request.handled_by_email = 'executor@example.test'
         and request.handled_by_method = 'supabase_account_delete_executor'
     ) then
    raise exception 'oversized manifest reached irreversible DB deletion: %', v_result;
  end if;

  select count(*) into v_audit_count_before
  from public.audit_logs
  where target_id = 'ac000000-0000-4000-8000-000000000082'
    and action = 'account_delete_status_updated';
  select public.update_account_delete_request_status_v1(
    'ac000000-0000-4000-8000-000000000082',
    'reviewing',
    'must not diverge from the erasure job',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'account_erasure_in_progress'
     or not exists (
       select 1 from public.account_delete_requests
       where id = 'ac000000-0000-4000-8000-000000000082'
         and status = 'needs_followup'
     )
     or v_audit_count_before <> (
       select count(*) from public.audit_logs
       where target_id = 'ac000000-0000-4000-8000-000000000082'
         and action = 'account_delete_status_updated'
     ) then
    raise exception 'manual status update diverged from a durable erasure job: %', v_result;
  end if;

  select public.inspect_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'ready'
     or (v_result->>'storageObjectCount')::integer <> 9
     or (v_result->>'storagePrefixCount')::integer <> 1
     or (v_result->>'reservationCreated')::boolean then
    raise exception 'unexpected read-only inspection: %', v_result;
  end if;
  if exists (
    select 1 from public.account_erasure_jobs
    where request_id = 'ac000000-0000-4000-8000-000000000080'
  ) then
    raise exception 'read-only inspection created an erasure reservation';
  end if;
  insert into storage.objects (id, bucket_id, name) values (
    'ac000000-0000-4000-8000-00000000003c',
    'home-photos',
    'notebook/ac000000-0000-4000-8000-000000000002/allowed-after-inspection.jpg'
  );
  if not exists (
    select 1 from storage.objects
    where id = 'ac000000-0000-4000-8000-00000000003c'
  ) then
    raise exception 'read-only inspection unexpectedly froze notebook uploads';
  end if;
  delete from storage.objects
  where id = 'ac000000-0000-4000-8000-00000000003c';

  select public.prepare_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'ready'
     or (v_result->>'storageObjectCount')::integer <> 9
     or (v_result->>'storagePrefixCount')::integer <> 1 then
    raise exception 'unexpected ready preflight: %', v_result;
  end if;

  -- A signed upload issued before preflight must be refused after the durable
  -- prepared receipt exists, so the frozen manifest cannot widen unnoticed.
  begin
    insert into storage.objects (id, bucket_id, name) values (
      'ac000000-0000-4000-8000-00000000003a',
      'home-photos',
      'notebook/ac000000-0000-4000-8000-000000000002/late-after-preflight.jpg'
    );
  exception when insufficient_privilege then
    v_recreation_blocked := true;
  end;
  if not v_recreation_blocked then
    raise exception 'post-preflight delayed signed upload was not blocked';
  end if;
  select jsonb_array_length(storage_objects) into v_count
  from public.account_erasure_jobs
  where request_id = 'ac000000-0000-4000-8000-000000000080';
  if v_count <> 9 then
    raise exception 'prepared storage manifest widened after blocked upload';
  end if;
  select count(*) into v_count
  from public.account_erasure_jobs
  where request_id = 'ac000000-0000-4000-8000-000000000080'
    and storage_prefixes = '[{"bucket":"home-photos","prefix":"ac000000-0000-4000-8000-000000000040/"}]'::jsonb
    and array_length(storage_prefix_hashes, 1) = 1;
  if v_count <> 1 then
    raise exception 'legacy home prefix/hash was not frozen in the prepared manifest';
  end if;

  v_recreation_blocked := false;
  begin
    insert into storage.objects (id, bucket_id, name) values (
      'ac000000-0000-4000-8000-00000000003c',
      'home-photos',
      'ac000000-0000-4000-8000-000000000040/late-home-signed-upload.jpg'
    );
  exception when insufficient_privilege then
    v_recreation_blocked := true;
  end;
  if not v_recreation_blocked then
    raise exception 'post-preflight legacy home signed upload was not blocked';
  end if;
  v_recreation_blocked := false;

  -- Preflight alone is not authoritative. Simulate a new shared reference and
  -- first prove normal writes are blocked after the prepared receipt.
  begin
    update public.timeline_events
    set attachments = '[{"storageBucket":"home-photos","storagePath":"notebook/ac000000-0000-4000-8000-000000000002/shared.jpg"}]'::jsonb
    where id = 'ac000000-0000-4000-8000-000000000031';
  exception when insufficient_privilege then
    v_recreation_blocked := true;
  end;
  if not v_recreation_blocked then
    raise exception 'post-preflight shared photo reference was not blocked';
  end if;
  v_recreation_blocked := false;

  -- Simulate a privileged/out-of-band legacy write that bypassed the guard,
  -- and prove the destructive transaction independently rechecks and stops.
  execute 'alter table public.timeline_events disable trigger timeline_events_account_erasure_reference_guard';
  update public.timeline_events
  set attachments = '[{"storageBucket":"home-photos","storagePath":"notebook/ac000000-0000-4000-8000-000000000002/shared.jpg"}]'::jsonb
  where id = 'ac000000-0000-4000-8000-000000000031';
  execute 'alter table public.timeline_events enable trigger timeline_events_account_erasure_reference_guard';
  select public.execute_account_erasure_database_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or v_result->>'code' <> 'shared_photo_transfer_required'
     or not exists (select 1 from public.profiles where id = 'ac000000-0000-4000-8000-000000000002') then
    raise exception 'shared target-owned photo did not fail closed: %', v_result;
  end if;
  select public.prepare_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or not exists (
       select 1 from jsonb_array_elements(v_result->'blockedDetails') detail
       where detail->>'code' = 'shared_photo_transfer_required'
     ) then
    raise exception 'preflight omitted shared photo transfer blocker: %', v_result;
  end if;
  update public.timeline_events
  set attachments = '[{"storageBucket":"home-photos","storagePath":"notebook/ac000000-0000-4000-8000-000000000003/shared.jpg"}]'::jsonb
  where id = 'ac000000-0000-4000-8000-000000000031';
  select public.prepare_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'ready' then
    raise exception 'preflight did not recover after shared photo transfer: %', v_result;
  end if;

  select public.prepare_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000081',
    'ac000000-0000-4000-8000-000000000005',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or v_result->'blockedDetails'->0->>'code' <> 'ownership_transfer_required' then
    raise exception 'shared-owned family was not blocked: %', v_result;
  end if;

  select public.execute_account_erasure_database_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'database_erased'
     or jsonb_array_length(v_result->'storageObjects') <> 9 then
    raise exception 'database erasure failed: %', v_result;
  end if;

  if exists (select 1 from public.profiles where id = 'ac000000-0000-4000-8000-000000000002')
     or exists (select 1 from public.account_delete_executors where user_id = 'ac000000-0000-4000-8000-000000000002')
     or exists (select 1 from public.families where id = 'ac000000-0000-4000-8000-000000000010')
     or exists (select 1 from public.family_members where user_id = 'ac000000-0000-4000-8000-000000000002')
     or exists (select 1 from public.ai_consult_threads where owner_user_id = 'ac000000-0000-4000-8000-000000000002')
     or exists (select 1 from public.ai_memory_consents where user_id = 'ac000000-0000-4000-8000-000000000002') then
    raise exception 'private or membership rows remain';
  end if;
  if not exists (
    select 1 from public.account_delete_executors
    where user_id = 'ac000000-0000-4000-8000-000000000007'
      and created_by is null
  ) then
    raise exception 'retained executor capability kept the erased creator identity';
  end if;
  if not exists (select 1 from public.families where id = 'ac000000-0000-4000-8000-000000000011')
     or not exists (select 1 from public.timeline_events where id = 'ac000000-0000-4000-8000-000000000031' and created_by is null)
     or not exists (select 1 from public.person_ai_memories where person_id = 'ac000000-0000-4000-8000-000000000021' and updated_by is null) then
    raise exception 'shared family records were removed or retained actor was not nulled';
  end if;
  if not exists (select 1 from public.consent_logs where id = 'ac000000-0000-4000-8000-000000000070' and user_id is null)
     or not exists (select 1 from public.purchases where id = 'ac000000-0000-4000-8000-000000000072' and user_id is null)
     or not exists (select 1 from public.audit_logs where id = 'ac000000-0000-4000-8000-000000000073' and actor_user_id is null) then
    raise exception 'retained evidence or nulled evidence references are wrong';
  end if;
  if not exists (
    select 1 from public.notebook_storage_deletion_jobs
    where id = 'ac000000-0000-4000-8000-000000000090'
      and created_by is null
      and status = 'pending'
  ) then
    raise exception 'pending cleanup receipt was removed or kept the target UUID';
  end if;
  if exists (
    select 1 from public.notebook_storage_deletion_jobs
    where id in (
      'ac000000-0000-4000-8000-000000000092',
      'ac000000-0000-4000-8000-00000000009b'
    )
  ) then
    raise exception 'completed target/owned-family cleanup receipt retained personal metadata';
  end if;
  if not exists (
    select 1 from public.notebook_diary_deletion_receipts
    where family_id = 'ac000000-0000-4000-8000-000000000011'
      and local_diary_id = 'shared-deleted-diary'
  ) or exists (
    select 1 from public.notebook_diary_deletion_receipts
    where family_id = 'ac000000-0000-4000-8000-000000000010'
  ) then
    raise exception 'diary deletion receipts were not retained/removed by family scope';
  end if;
  if not exists (
    select 1 from public.person_notebook_deletion_receipts
    where id = 'ac000000-0000-4000-8000-000000000093'
      and deleted_by is null
  ) or exists (
    select 1 from public.person_notebook_deletion_receipts
    where id = 'ac000000-0000-4000-8000-000000000094'
  ) then
    raise exception 'person deletion receipts were not retained/minimized by family scope';
  end if;
  if not exists (
    select 1 from public.person_notebook_storage_deletion_jobs
    where id = 'ac000000-0000-4000-8000-000000000095'
      and status = 'pending' and created_by is null
  ) or not exists (
    select 1 from public.person_notebook_storage_deletion_jobs
    where id = 'ac000000-0000-4000-8000-000000000096'
      and status = 'pending'
  ) or not exists (
    select 1 from public.person_notebook_storage_deletion_jobs
    where id = 'ac000000-0000-4000-8000-00000000009a'
      and status = 'pending'
      and created_by = 'ac000000-0000-4000-8000-000000000004'
  ) or not exists (
    select 1 from public.person_notebook_storage_deletion_jobs
    where id = 'ac000000-0000-4000-8000-000000000098'
      and status = 'completed' and created_by is null
  ) or exists (
    select 1 from public.person_notebook_storage_deletion_jobs
    where id in (
      'ac000000-0000-4000-8000-000000000097',
      'ac000000-0000-4000-8000-000000000099'
    )
  ) then
    raise exception 'person Storage jobs were not retained/minimized by status and family scope';
  end if;

  begin
    insert into storage.objects (id, bucket_id, name) values (
      'ac000000-0000-4000-8000-00000000003b',
      'home-photos',
      'notebook/ac000000-0000-4000-8000-000000000002/late-upload.jpg'
    );
  exception when insufficient_privilege then
    v_recreation_blocked := true;
  end;
  if not v_recreation_blocked then
    raise exception 'late signed notebook upload was not blocked';
  end if;
  v_recreation_blocked := false;

  begin
    insert into public.profiles (id, email)
    values ('ac000000-0000-4000-8000-000000000002', 'target@example.test');
  exception when insufficient_privilege then
    v_recreation_blocked := true;
  end;
  if not v_recreation_blocked then
    raise exception 'erased profile recreation was not blocked';
  end if;

  select public.finalize_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000007',
    false, true, 10
  ) into v_result;
  if v_result->>'result' <> 'auth_verification_required' then
    raise exception 'unverified auth deletion was allowed: %', v_result;
  end if;

  select public.finalize_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000007',
    true, true, 10
  ) into v_result;
  if v_result->>'result' <> 'completed' then
    raise exception 'verified finalization failed: %', v_result;
  end if;

  select count(*) into v_count
  from public.account_delete_requests request
  join public.account_erasure_jobs job on job.request_id = request.id
  where request.id = 'ac000000-0000-4000-8000-000000000080'
    and request.status = 'completed'
    and request.user_id is null
    and request.contact_email is null
    and request.reason is null
    and request.handled_by = 'ac000000-0000-4000-8000-000000000007'
    and request.handled_by_email = 'executor@example.test'
    and request.handled_by_method = 'supabase_account_delete_executor'
    and job.status = 'completed'
    and job.operator_user_id = 'ac000000-0000-4000-8000-000000000007'
    and job.operator_method = 'supabase_account_delete_executor'
    and job.target_user_id is null
    and job.target_email_hash is null
    and job.owned_family_ids = '{}'::uuid[]
    and job.storage_objects = '[]'::jsonb
    and job.storage_prefixes = '[]'::jsonb
    and array_length(job.storage_prefix_hashes, 1) = 1
    and job.storage_manifest_hash ~ '^[0-9a-f]{64}$'
    and job.auth_verified_erased_at is not null
    and job.storage_verified_erased_at is not null
    and job.verification_summary->>'completedByMethod' = 'supabase_account_delete_executor';
  if v_count <> 1 then
    raise exception 'minimal completed receipt is incomplete';
  end if;
  select count(*) into v_count
  from public.audit_logs
  where actor_user_id = 'ac000000-0000-4000-8000-000000000007'
    and action in (
      'account_erasure_database_completed',
      'account_erasure_verified_completed'
    )
    and metadata->>'operatorMethod' = 'supabase_account_delete_executor';
  if v_count <> 2 then
    raise exception 'erasure audit did not retain the dedicated operator method';
  end if;
  if exists (
    select 1 from public.notebook_storage_deletion_jobs
    where id in (
      'ac000000-0000-4000-8000-000000000090',
      'ac000000-0000-4000-8000-000000000091'
    )
       or created_by = 'ac000000-0000-4000-8000-000000000002'
       or storage_path like 'notebook/ac000000-0000-4000-8000-000000000002/%'
  ) then
    raise exception 'verified account storage cleanup retained raw diary cleanup identities';
  end if;
  if not exists (
    select 1 from public.person_notebook_storage_deletion_jobs
    where id = 'ac000000-0000-4000-8000-000000000095'
      and status = 'completed'
      and created_by is null
      and completed_at is not null
  ) or not exists (
    select 1 from public.person_notebook_storage_deletion_jobs
    where id = 'ac000000-0000-4000-8000-000000000098'
      and status = 'completed'
      and created_by is null
  ) or exists (
    select 1 from public.person_notebook_storage_deletion_jobs
    where id in (
         'ac000000-0000-4000-8000-000000000096',
         'ac000000-0000-4000-8000-00000000009a'
       )
       or created_by = 'ac000000-0000-4000-8000-000000000002'
       or storage_path like 'notebook/ac000000-0000-4000-8000-000000000002/%'
       or family_id = 'ac000000-0000-4000-8000-000000000010'
  ) then
    raise exception 'verified person cleanup retained erased account/family identities';
  end if;
  if not exists (
    select 1 from public.notebook_diary_deletion_receipts
    where family_id = 'ac000000-0000-4000-8000-000000000011'
      and local_diary_id = 'shared-deleted-diary'
  ) or exists (
    select 1 from public.notebook_diary_deletion_receipts
    where family_id = 'ac000000-0000-4000-8000-000000000010'
  ) then
    raise exception 'completed erasure retained owned diary deletion receipt identity';
  end if;

  v_recreation_blocked := false;
  begin
    insert into public.profiles (id, email)
    values ('ac000000-0000-4000-8000-000000000002', 'target@example.test');
  exception when insufficient_privilege then
    v_recreation_blocked := true;
  end;
  if not v_recreation_blocked then
    raise exception 'completed erasure allowed profile recreation';
  end if;

  v_recreation_blocked := false;
  begin
    insert into storage.objects (id, bucket_id, name) values (
      'ac000000-0000-4000-8000-00000000003c',
      'home-photos',
      'ac000000-0000-4000-8000-000000000040/post-completion-signed-upload.jpg'
    );
  exception when insufficient_privilege then
    v_recreation_blocked := true;
  end;
  if not v_recreation_blocked then
    raise exception 'completed erasure prefix hash allowed a legacy signed upload';
  end if;

  v_recreation_blocked := false;
  begin
    update public.timeline_events
    set attachments = '[{"storageBucket":"home-photos","storagePath":"notebook/ac000000-0000-4000-8000-000000000002/reintroduced.jpg"}]'::jsonb
    where id = 'ac000000-0000-4000-8000-000000000031';
  exception when insufficient_privilege then
    v_recreation_blocked := true;
  end;
  if not v_recreation_blocked then
    raise exception 'completed erasure allowed a target-owned shared photo reference';
  end if;

  select public.finalize_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000080',
    'ac000000-0000-4000-8000-000000000002',
    'ac000000-0000-4000-8000-000000000007',
    true, true, 10
  ) into v_result;
  if v_result->>'result' <> 'already_completed' then
    raise exception 'finalization is not idempotent: %', v_result;
  end if;

  select count(*) into v_audit_count_before
  from public.audit_logs
  where target_id = 'ac000000-0000-4000-8000-000000000080'
    and action = 'account_delete_status_updated';
  select public.update_account_delete_request_status_v1(
    'ac000000-0000-4000-8000-000000000080',
    'reviewing',
    'must stay terminal',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'verified_account_erasure_required'
     or not exists (
       select 1 from public.account_delete_requests
       where id = 'ac000000-0000-4000-8000-000000000080'
         and status = 'completed'
     )
     or v_audit_count_before <> (
       select count(*) from public.audit_logs
       where target_id = 'ac000000-0000-4000-8000-000000000080'
         and action = 'account_delete_status_updated'
     ) then
    raise exception 'completed account deletion was not terminal: %', v_result;
  end if;

  select public.inspect_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000083',
    'ac000000-0000-4000-8000-000000000007',
    'ac000000-0000-4000-8000-000000000001'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or not (v_result->'blockedDetails' @> '[{"code":"last_account_delete_executor"}]'::jsonb) then
    raise exception 'sole dedicated executor inspection was not blocked: %', v_result;
  end if;
  select public.prepare_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000083',
    'ac000000-0000-4000-8000-000000000007',
    'ac000000-0000-4000-8000-000000000001'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or not (v_result->'blockedDetails' @> '[{"code":"last_account_delete_executor"}]'::jsonb) then
    raise exception 'sole dedicated executor preparation was not blocked: %', v_result;
  end if;
  select public.execute_account_erasure_database_v1(
    'ac000000-0000-4000-8000-000000000083',
    'ac000000-0000-4000-8000-000000000007',
    'ac000000-0000-4000-8000-000000000001'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or v_result->>'code' <> 'last_account_delete_executor'
     or not exists (
       select 1
       from public.account_erasure_jobs job
       join public.account_delete_requests request on request.id = job.request_id
       where job.request_id = 'ac000000-0000-4000-8000-000000000083'
         and job.status = 'blocked'
         and job.last_error_code = 'last_account_delete_executor'
         and job.operator_user_id = 'ac000000-0000-4000-8000-000000000001'
         and job.operator_method = 'supabase_app_admin'
         and request.status = 'needs_followup'
         and request.handled_by = 'ac000000-0000-4000-8000-000000000001'
         and request.handled_by_email = 'operator@example.test'
         and request.handled_by_method = 'supabase_app_admin'
     ) then
    raise exception 'last_account_delete_executor was not durably persisted: %', v_result;
  end if;
  select public.finalize_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000083',
    'ac000000-0000-4000-8000-000000000007',
    'ac000000-0000-4000-8000-000000000001',
    true, true, 0
  ) into v_result;
  if v_result->>'result' <> 'database_erasure_required' then
    raise exception 'app_admin compatibility was lost in finalization: %', v_result;
  end if;

  select public.inspect_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000084',
    'ac000000-0000-4000-8000-000000000001',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or not (v_result->'blockedDetails' @> '[{"code":"last_app_admin"}]'::jsonb) then
    raise exception 'last app_admin inspection compatibility failed: %', v_result;
  end if;
  select public.prepare_account_erasure_v1(
    'ac000000-0000-4000-8000-000000000084',
    'ac000000-0000-4000-8000-000000000001',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or not (v_result->'blockedDetails' @> '[{"code":"last_app_admin"}]'::jsonb) then
    raise exception 'last app_admin preparation compatibility failed: %', v_result;
  end if;
  select public.execute_account_erasure_database_v1(
    'ac000000-0000-4000-8000-000000000084',
    'ac000000-0000-4000-8000-000000000001',
    'ac000000-0000-4000-8000-000000000007'
  ) into v_result;
  if v_result->>'result' <> 'blocked'
     or v_result->>'code' <> 'last_app_admin'
     or not exists (
       select 1
       from public.account_erasure_jobs job
       join public.account_delete_requests request on request.id = job.request_id
       where job.request_id = 'ac000000-0000-4000-8000-000000000084'
         and job.status = 'blocked'
         and job.last_error_code = 'last_app_admin'
         and job.operator_user_id = 'ac000000-0000-4000-8000-000000000007'
         and job.operator_method = 'supabase_account_delete_executor'
         and request.status = 'needs_followup'
         and request.handled_by_email = 'executor@example.test'
         and request.handled_by_method = 'supabase_account_delete_executor'
     ) then
    raise exception 'last_app_admin compatibility state was not durably persisted: %', v_result;
  end if;

  update public.account_delete_requests
  set handled_by_email = 'stale-handler@example.test'
  where id = 'ac000000-0000-4000-8000-000000000085';
  select public.update_account_delete_request_status_v1(
    'ac000000-0000-4000-8000-000000000085',
    'reviewing',
    'app admin compatibility',
    'ac000000-0000-4000-8000-000000000001'
  ) into v_result;
  if v_result->>'result' <> 'updated'
     or not exists (
       select 1 from public.account_delete_requests
       where id = 'ac000000-0000-4000-8000-000000000085'
         and handled_by_email = 'operator@example.test'
         and handled_by_method = 'supabase_app_admin'
     ) then
    raise exception 'app_admin status compatibility or handler email refresh failed: %', v_result;
  end if;

  update public.account_delete_executors
  set active = false,
      revoked_at = now()
  where user_id = 'ac000000-0000-4000-8000-000000000007';
  if public.account_erasure_operator_method('ac000000-0000-4000-8000-000000000007') is not null
     or exists (
       select 1 from pg_trigger
       where tgrelid = 'public.account_delete_executors'::regclass
         and tgname = 'account_delete_executors_last_operator_guard'
         and not tgisinternal
     ) then
    raise exception 'emergency revocation of the sole executor is not available';
  end if;
end;
$test$;

do $acl$
begin
  if not has_table_privilege('service_role', 'public.account_delete_executors', 'SELECT')
     or has_table_privilege('service_role', 'public.account_delete_executors', 'INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.account_delete_executors', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('anon', 'public.account_delete_executors', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'account-delete executor table grants are unsafe';
  end if;
  if has_function_privilege('service_role', 'public.account_erasure_operator_method(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.account_erasure_operator_method(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.account_erasure_operator_method(uuid)', 'EXECUTE') then
    raise exception 'account-erasure operator helper is externally executable';
  end if;
  if not has_function_privilege('service_role', 'public.update_account_delete_request_status_v1(uuid,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.update_account_delete_request_status_v1(uuid,text,text,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.update_account_delete_request_status_v1(uuid,text,text,uuid)', 'EXECUTE') then
    raise exception 'account-delete request status RPC ACL is unsafe';
  end if;
  if has_table_privilege('anon', 'public.account_erasure_jobs', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.account_erasure_jobs', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role', 'public.account_erasure_jobs', 'INSERT,UPDATE,DELETE') then
    raise exception 'account erasure job table grants are too broad';
  end if;
  if not has_table_privilege('service_role', 'public.account_erasure_jobs', 'SELECT') then
    raise exception 'service role cannot inspect erasure receipts';
  end if;
  if has_function_privilege('anon', 'public.prepare_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.prepare_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.execute_account_erasure_database_v1(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.execute_account_erasure_database_v1(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.execute_account_erasure_database_v1(uuid,uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.prepare_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'account erasure RPC ACL is unsafe';
  end if;
  if has_function_privilege('anon', 'public.inspect_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.inspect_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.inspect_account_erasure_v1(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'read-only account erasure inspection ACL is unsafe';
  end if;
  if has_function_privilege('service_role', 'public.guard_erased_profile_recreation()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.guard_erased_notebook_storage_write()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.guard_erased_notebook_attachment_reference()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.collect_account_erasure_storage_objects(uuid,uuid[])', 'EXECUTE')
     or has_function_privilege('service_role', 'public.collect_account_erasure_storage_prefixes(uuid[])', 'EXECUTE')
     or has_function_privilege('service_role', 'public.hash_account_erasure_storage_prefixes(jsonb)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.collect_account_erasure_storage_manifest_blockers(jsonb,jsonb)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.collect_account_erasure_pending_cleanup_objects(uuid,uuid[])', 'EXECUTE')
     or has_function_privilege('service_role', 'public.collect_account_erasure_pending_person_cleanup_objects(uuid,uuid[])', 'EXECUTE')
     or has_function_privilege('service_role', 'public.collect_account_erasure_shared_photo_blockers(uuid,uuid[])', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.collect_account_erasure_storage_objects(uuid,uuid[])', 'EXECUTE')
     or has_function_privilege('anon', 'public.collect_account_erasure_storage_objects(uuid,uuid[])', 'EXECUTE') then
    raise exception 'account erasure internal helper ACL is unsafe';
  end if;
  if has_table_privilege('authenticated', 'public.notebook_storage_deletion_jobs', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.notebook_diary_deletion_receipts', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.person_notebook_deletion_receipts', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.person_notebook_storage_deletion_jobs', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role', 'public.person_notebook_deletion_receipts', 'SELECT,INSERT,UPDATE,DELETE')
     or not has_table_privilege('service_role', 'public.notebook_storage_deletion_jobs', 'SELECT,INSERT,UPDATE,DELETE')
     or not has_table_privilege('service_role', 'public.notebook_diary_deletion_receipts', 'SELECT,INSERT,DELETE')
     or not has_table_privilege('service_role', 'public.person_notebook_storage_deletion_jobs', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'notebook deletion durable table ACL was reopened by api grants';
  end if;
  if has_function_privilege('authenticated', 'public.delete_notebook_diary_v1(uuid,uuid,uuid,text,text,bigint,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.delete_person_notebook_v1(uuid,uuid,uuid,text,bigint,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'public.guard_notebook_storage_deletion_paths()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.guard_deleted_person_notebook_identity()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.guard_person_notebook_storage_deletion_path()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.delete_notebook_diary_v1(uuid,uuid,uuid,text,text,bigint,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.delete_person_notebook_v1(uuid,uuid,uuid,text,bigint,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.person_notebook_storage_path_is_referenced(text,text)', 'EXECUTE') then
    raise exception 'notebook deletion function ACL was reopened by api grants';
  end if;
end;
$acl$;

rollback;
