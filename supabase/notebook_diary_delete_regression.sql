-- Run only in a fresh disposable PostgreSQL database after notebook_diary_delete.sql.
begin;

insert into auth.users (id, email) values
  ('da000000-0000-4000-8000-000000000001', 'delete-owner@example.test'),
  ('da000000-0000-4000-8000-000000000002', 'delete-uploader@example.test'),
  ('da000000-0000-4000-8000-000000000003', 'delete-viewer@example.test');
insert into public.profiles (id, email) select id, email from auth.users;
insert into public.families (id, name, owner_user_id, plan) values
  ('da000000-0000-4000-8000-000000000010', 'Delete family', 'da000000-0000-4000-8000-000000000001', 'plus');
insert into public.family_members (family_id, user_id, role) values
  ('da000000-0000-4000-8000-000000000010', 'da000000-0000-4000-8000-000000000001', 'owner'),
  ('da000000-0000-4000-8000-000000000010', 'da000000-0000-4000-8000-000000000002', 'member'),
  ('da000000-0000-4000-8000-000000000010', 'da000000-0000-4000-8000-000000000003', 'viewer');
insert into public.people (id, family_id, display_name, profile) values
  ('da000000-0000-4000-8000-000000000020', 'da000000-0000-4000-8000-000000000010', 'Parent', '{"localCaseId":"case-delete"}');

insert into public.timeline_events (
  id, person_id, event_type, event_date, title, body, attachments, metadata, created_by
) values
  (
    'da000000-0000-4000-8000-000000000030',
    'da000000-0000-4000-8000-000000000020',
    'diary', current_date, 'Delete me', 'private body',
    '[{"storageBucket":"home-photos","storagePath":"notebook/da000000-0000-4000-8000-000000000002/photo-delete.jpg"}]',
    '{"localCaseId":"case-delete","localDiaryId":"diary-delete"}',
    'da000000-0000-4000-8000-000000000001'
  ),
  (
    'da000000-0000-4000-8000-000000000031',
    'da000000-0000-4000-8000-000000000020',
    'diary', current_date, 'Shared one', 'one',
    '[{"storageBucket":"home-photos","storagePath":"notebook/da000000-0000-4000-8000-000000000002/photo-shared.jpg"}]',
    '{"localCaseId":"case-delete","localDiaryId":"diary-shared-one"}',
    'da000000-0000-4000-8000-000000000001'
  ),
  (
    'da000000-0000-4000-8000-000000000032',
    'da000000-0000-4000-8000-000000000020',
    'diary', current_date, 'Shared two', 'two',
    '[{"storageBucket":"home-photos","storagePath":"notebook/da000000-0000-4000-8000-000000000002/photo-shared.jpg"}]',
    '{"localCaseId":"case-delete","localDiaryId":"diary-shared-two"}',
    'da000000-0000-4000-8000-000000000001'
  ),
  (
    'da000000-0000-4000-8000-000000000033',
    'da000000-0000-4000-8000-000000000020',
    'diary', current_date, 'Unsupported bucket', 'must remain',
    '[{"storageBucket":"future-photos","storagePath":"notebook/da000000-0000-4000-8000-000000000002/photo-future.jpg"}]',
    '{"localCaseId":"case-delete","localDiaryId":"diary-unsupported-bucket"}',
    'da000000-0000-4000-8000-000000000001'
  );

insert into public.person_ai_memories (
  person_id, long_term_summary, user_summary, important_changes, source_event_ids,
  record_count, first_record_date, last_record_date, memory_version, updated_by
) values (
  'da000000-0000-4000-8000-000000000020', 'derived private body', 'family-authored note',
  '[{"summary":"derived private body"}]', array['da000000-0000-4000-8000-000000000030']::uuid[],
  1, current_date, current_date, 7, 'da000000-0000-4000-8000-000000000001'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

do $test$
declare
  v_revision bigint;
  v_hash text;
  v_result jsonb;
  v_rejected boolean;
  v_memory public.person_ai_memories%rowtype;
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.notebook_storage_deletion_jobs'::regclass and contype = 'f'
  ) then
    raise exception 'cleanup jobs retained a parent foreign key';
  end if;
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.notebook_diary_deletion_receipts'::regclass and contype = 'f'
  ) then
    raise exception 'diary deletion receipt retained a parent foreign key';
  end if;
  if not has_table_privilege('service_role', 'public.notebook_diary_deletion_receipts', 'SELECT,INSERT,DELETE')
     or has_table_privilege('authenticated', 'public.notebook_diary_deletion_receipts', 'SELECT')
     or has_table_privilege('authenticated', 'public.notebook_diary_deletion_receipts', 'INSERT')
     or has_table_privilege('authenticated', 'public.notebook_diary_deletion_receipts', 'UPDATE')
     or has_table_privilege('authenticated', 'public.notebook_diary_deletion_receipts', 'DELETE') then
    raise exception 'diary deletion receipt ACL is not service-only';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  v_rejected := false;
  begin
    perform public.delete_notebook_diary_v1(
      'da000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000010',
      'da000000-0000-4000-8000-000000000020', 'case-delete', 'diary-delete', 1, repeat('a', 64)
    );
  exception when others then
    if position('service_role_required' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'non-service JWT claim executed diary deletion'; end if;
  perform set_config('request.jwt.claim.role', 'service_role', true);

  select cloud_revision, cloud_hash into v_revision, v_hash
  from public.timeline_events where id = 'da000000-0000-4000-8000-000000000030';

  v_rejected := false;
  begin
    perform public.delete_notebook_diary_v1(
      'da000000-0000-4000-8000-000000000003', 'da000000-0000-4000-8000-000000000010',
      'da000000-0000-4000-8000-000000000020', 'case-delete', 'diary-delete', v_revision, v_hash
    );
  exception when others then
    if position('viewer_read_only' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'viewer deletion unexpectedly succeeded'; end if;

  v_rejected := false;
  begin
    perform public.delete_notebook_diary_v1(
      'da000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000010',
      'da000000-0000-4000-8000-000000000020', 'case-delete', 'diary-delete', v_revision, repeat('f', 64)
    );
  exception when others then
    if position('conflict' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'stale hash deletion unexpectedly succeeded'; end if;

  select cloud_revision, cloud_hash into v_revision, v_hash
  from public.timeline_events where id = 'da000000-0000-4000-8000-000000000031';
  v_rejected := false;
  begin
    perform public.delete_notebook_diary_v1(
      'da000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000010',
      'da000000-0000-4000-8000-000000000020', 'case-delete', 'diary-shared-one', v_revision, v_hash
    );
  exception when others then
    if position('shared_storage_reference' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'shared photo deletion unexpectedly succeeded'; end if;

  select cloud_revision, cloud_hash into v_revision, v_hash
  from public.timeline_events where id = 'da000000-0000-4000-8000-000000000033';
  v_rejected := false;
  begin
    perform public.delete_notebook_diary_v1(
      'da000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000010',
      'da000000-0000-4000-8000-000000000020', 'case-delete', 'diary-unsupported-bucket', v_revision, v_hash
    );
  exception when others then
    if position('unsupported_storage_bucket' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected
     or not exists (select 1 from public.timeline_events where id = 'da000000-0000-4000-8000-000000000033')
     or exists (
       select 1 from public.notebook_diary_deletion_receipts
       where local_case_id = 'case-delete' and local_diary_id = 'diary-unsupported-bucket'
     )
     or exists (
       select 1 from public.notebook_storage_deletion_jobs
       where local_case_id = 'case-delete' and local_diary_id = 'diary-unsupported-bucket'
     ) then
    raise exception 'unsupported bucket deletion changed durable state';
  end if;

  select cloud_revision, cloud_hash into v_revision, v_hash
  from public.timeline_events where id = 'da000000-0000-4000-8000-000000000030';
  v_result := public.delete_notebook_diary_v1(
    'da000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000010',
    'da000000-0000-4000-8000-000000000020', 'case-delete', 'diary-delete', v_revision, v_hash
  );
  if coalesce((v_result->>'deleted')::boolean, false) is not true
     or coalesce((v_result->>'receiptRecorded')::boolean, false) is not true
     or jsonb_array_length(v_result->'storageJobs') <> 1
     or exists (select 1 from public.timeline_events where id = 'da000000-0000-4000-8000-000000000030') then
    raise exception 'exact diary deletion did not atomically delete and queue: %', v_result;
  end if;
  if not exists (
    select 1 from public.notebook_diary_deletion_receipts
    where family_id = 'da000000-0000-4000-8000-000000000010'
      and person_id = 'da000000-0000-4000-8000-000000000020'
      and local_case_id = 'case-delete'
      and local_diary_id = 'diary-delete'
  ) then
    raise exception 'delete transaction did not persist its anti-resurrection receipt';
  end if;

  -- Simulate a committed server delete whose HTTP response was lost. Replaying
  -- the exact request must be harmless and must return the durable cleanup job.
  v_result := public.delete_notebook_diary_v1(
    'da000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000010',
    'da000000-0000-4000-8000-000000000020', 'case-delete', 'diary-delete', v_revision, v_hash
  );
  if coalesce((v_result->>'deleted')::boolean, true) is not false
     or coalesce((v_result->>'alreadyDeleted')::boolean, false) is not true
     or coalesce((v_result->>'receiptRecorded')::boolean, false) is not true
     or jsonb_array_length(v_result->'storageJobs') <> 1 then
    raise exception 'lost-response retry was not idempotent: %', v_result;
  end if;

  select * into v_memory from public.person_ai_memories
  where person_id = 'da000000-0000-4000-8000-000000000020';
  if v_memory.long_term_summary <> '' or v_memory.important_changes <> '[]'::jsonb
     or cardinality(v_memory.source_event_ids) <> 0 or v_memory.record_count <> 0
     or v_memory.memory_version <> 8 or v_memory.user_summary <> 'family-authored note' then
    raise exception 'derived AI memory was not safely invalidated';
  end if;

  v_rejected := false;
  begin
    insert into public.timeline_events (
      person_id, event_type, title, attachments, metadata, created_by
    ) values (
      'da000000-0000-4000-8000-000000000020', 'diary', 'Stale replay', '[]'::jsonb,
      '{"localCaseId":"case-delete","localDiaryId":"diary-delete"}',
      'da000000-0000-4000-8000-000000000001'
    );
  exception when others then
    if position('notebook_diary_deleted' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'stale sync resurrected a deleted diary'; end if;

  -- A cloud-linked entry can be deleted locally before its first sync reaches
  -- the server. The delete RPC must still reserve that identity permanently.
  v_result := public.delete_notebook_diary_v1(
    'da000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000010',
    'da000000-0000-4000-8000-000000000020', 'case-delete', 'diary-never-synced', null, null
  );
  if coalesce((v_result->>'deleted')::boolean, true) is not false
     or coalesce((v_result->>'receiptRecorded')::boolean, false) is not true
     or jsonb_array_length(v_result->'storageJobs') <> 0
     or not exists (
       select 1 from public.notebook_diary_deletion_receipts
       where family_id = 'da000000-0000-4000-8000-000000000010'
         and person_id = 'da000000-0000-4000-8000-000000000020'
         and local_case_id = 'case-delete'
         and local_diary_id = 'diary-never-synced'
     ) then
    raise exception 'never-synced diary identity was not durably deleted: %', v_result;
  end if;

  v_rejected := false;
  begin
    insert into public.timeline_events (
      person_id, event_type, title, attachments, metadata, created_by
    ) values (
      'da000000-0000-4000-8000-000000000020', 'diary', 'Delayed first sync', '[]'::jsonb,
      '{"localCaseId":"case-delete","localDiaryId":"diary-never-synced"}',
      'da000000-0000-4000-8000-000000000001'
    );
  exception when others then
    if position('notebook_diary_deleted' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'delayed first sync recreated a locally deleted diary'; end if;

  v_rejected := false;
  begin
    insert into public.timeline_events (
      person_id, event_type, title, attachments, metadata, created_by
    ) values (
      'da000000-0000-4000-8000-000000000020', 'diary', 'Reuse',
      '[{"storageBucket":"home-photos","storagePath":"notebook/da000000-0000-4000-8000-000000000002/photo-delete.jpg"}]',
      '{"localCaseId":"case-delete","localDiaryId":"diary-reuse"}',
      'da000000-0000-4000-8000-000000000001'
    );
  exception when others then
    if position('storage_path_pending_deletion' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'queued object path was reusable'; end if;
end;
$test$;

reset role;
delete from auth.users where id = 'da000000-0000-4000-8000-000000000002';
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

do $uploader_exit_test$
declare
  v_result jsonb;
begin
  v_result := public.delete_notebook_diary_v1(
    'da000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000010',
    'da000000-0000-4000-8000-000000000020', 'case-delete', 'diary-delete', null, null
  );
  if jsonb_array_length(v_result->'storageJobs') <> 1 then
    raise exception 'pending cleanup disappeared after uploader exit: %', v_result;
  end if;
end;
$uploader_exit_test$;

reset role;
delete from public.families where id = 'da000000-0000-4000-8000-000000000010';
do $parent_delete_test$
begin
  if not exists (
    select 1 from public.notebook_storage_deletion_jobs
    where storage_path = 'notebook/da000000-0000-4000-8000-000000000002/photo-delete.jpg'
  ) then
    raise exception 'pending cleanup disappeared with its family/person';
  end if;
end;
$parent_delete_test$;

rollback;
