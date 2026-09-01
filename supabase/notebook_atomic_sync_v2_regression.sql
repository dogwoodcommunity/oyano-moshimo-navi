-- PostgreSQL 16 regression checks for notebook_atomic_sync_v2.sql.
-- Run only in a disposable/local database after schema.sql,
-- production_rls.sql, and the migration.
-- Every seed and mutation is rolled back.

begin;
set local request.jwt.claim.role = 'service_role';

insert into auth.users (id, email)
values
  ('f2000000-0000-4000-8000-000000000001', 'notebook-v2-owner@example.test'),
  ('f2000000-0000-4000-8000-000000000002', 'notebook-v2-member@example.test'),
  ('f2000000-0000-4000-8000-000000000003', 'notebook-v2-viewer@example.test');

insert into public.profiles (id, email, display_name)
values
  (
    'f2000000-0000-4000-8000-000000000001',
    'notebook-v2-owner@example.test',
    'Notebook v2 test owner'
  ),
  (
    'f2000000-0000-4000-8000-000000000002',
    'notebook-v2-member@example.test',
    'Notebook v2 test member'
  ),
  (
    'f2000000-0000-4000-8000-000000000003',
    'notebook-v2-viewer@example.test',
    'Notebook v2 test viewer'
  );

insert into public.families (id, name, owner_user_id, plan)
values (
  'f2000000-0000-4000-8000-000000000010',
  'Notebook v2 regression family',
  'f2000000-0000-4000-8000-000000000001',
  'plus'
);

insert into public.family_members (family_id, user_id, role, relationship)
values
  (
    'f2000000-0000-4000-8000-000000000010',
    'f2000000-0000-4000-8000-000000000001',
    'owner',
    '本人'
  ),
  (
    'f2000000-0000-4000-8000-000000000010',
    'f2000000-0000-4000-8000-000000000002',
    'member',
    '家族'
  ),
  (
    'f2000000-0000-4000-8000-000000000010',
    'f2000000-0000-4000-8000-000000000003',
    'viewer',
    '閲覧者'
  );

do $test$
declare
  v_person public.people%rowtype;
  v_task public.tasks%rowtype;
  v_event public.timeline_events%rowtype;
  v_response jsonb;
  v_member_response jsonb;
  v_retry_response jsonb;
  v_profile_before_member jsonb;
  v_case_id text;
begin
  -- A direct/mobile flat insert receives a stable case id and canonical nested profile.
  insert into public.people (
    id, family_id, display_name, relationship_to_family, current_status, profile
  ) values (
    'f2000000-0000-4000-8000-000000000020',
    'f2000000-0000-4000-8000-000000000010',
    '母',
    '母',
    'preparing',
    jsonb_build_object(
      'displayName', '母',
      'birthDate', '1948-04-12',
      'careStatus', 'mobile insert',
      'firstSituation', 'mobile first'
    )
  ) returning * into v_person;

  if v_person.profile->>'localCaseId' is distinct from v_person.id::text then
    raise exception 'people INSERT did not materialize localCaseId';
  end if;
  if v_person.profile->'personProfile'->>'birthDate' is distinct from '1948-04-12'
     or v_person.profile->'personProfile'->>'firstSituation' is distinct from 'mobile first' then
    raise exception 'people INSERT did not canonicalize mobile flat fields: %', v_person.profile;
  end if;
  if v_person.cloud_revision <> 1 or length(v_person.cloud_hash) <> 64 then
    raise exception 'people INSERT cloud identity is invalid';
  end if;
  v_case_id := v_person.profile->>'localCaseId';

  -- Seed PWA-owned envelope facts, then emulate mobile replacing the full profile.
  update public.people
  set profile = profile || jsonb_build_object(
    'source', 'pwa-notebook',
    'localAnswers', jsonb_build_object('targetName', '母'),
    'localResultSummary', 'PWA summary',
    'personProfile', profile->'personProfile' || jsonb_build_object('documentKnowledge', 'PWA document fact')
  )
  where id = v_person.id;

  update public.people
  set profile = jsonb_build_object(
    'displayName', '母',
    'birthDate', '1949-05-13',
    'careStatus', 'mobile fresh',
    'keyContact', 'ケアマネ',
    'hospitalOrFacility', 'テスト病院',
    'medicationNote', '朝の薬',
    'documentLocationNote', '青い棚',
    'familyStructure', '母、長女',
    'firstSituation', 'mobile updated first',
    'documentKnowledge', 'mobile document fact',
    'updatedAt', '2026-09-01T00:00:00.000Z'
  )
  where id = v_person.id
  returning * into v_person;

  if v_person.profile->>'localCaseId' is distinct from v_case_id
     or v_person.profile->>'source' is distinct from 'pwa-notebook'
     or v_person.profile->'localAnswers'->>'targetName' is distinct from '母'
     or v_person.profile->>'localResultSummary' is distinct from 'PWA summary' then
    raise exception 'mobile replacement lost PWA reserved keys: %', v_person.profile;
  end if;
  if v_person.profile->'personProfile'->>'birthDate' is distinct from '1949-05-13'
     or v_person.profile->'personProfile'->>'familyStructureNote' is distinct from '母、長女'
     or v_person.profile->'personProfile'->>'firstSituation' is distinct from 'mobile updated first' then
    raise exception 'mobile replacement did not refresh canonical personProfile: %', v_person.profile;
  end if;

  -- Incoming nested PWA values win over stale flat compatibility values.
  update public.people
  set profile = profile || jsonb_build_object(
    'careStatus', 'stale flat value',
    'personProfile', profile->'personProfile' || jsonb_build_object('careStatus', 'fresh nested PWA value')
  )
  where id = v_person.id
  returning * into v_person;

  if v_person.profile->'personProfile'->>'careStatus' is distinct from 'fresh nested PWA value' then
    raise exception 'stale flat value overrode incoming PWA personProfile';
  end if;

  -- Direct/mobile inserts materialize task and diary identities before hashing.
  insert into public.tasks (id, person_id, title, status)
  values (
    'f2000000-0000-4000-8000-000000000030',
    v_person.id,
    '直接作成の確認事項',
    'todo'
  ) returning * into v_task;
  if v_task.local_task_id is distinct from v_task.id::text
     or v_task.cloud_revision <> 1 or length(v_task.cloud_hash) <> 64 then
    raise exception 'task INSERT fallback/cloud identity is invalid';
  end if;

  insert into public.timeline_events (
    id, person_id, event_type, event_date, title, body, metadata
  ) values (
    'f2000000-0000-4000-8000-000000000040',
    v_person.id,
    'diary',
    '2026-09-01',
    '日々の記録',
    'mobile direct diary',
    '{}'::jsonb
  ) returning * into v_event;
  if v_event.metadata->>'localDiaryId' is distinct from v_event.id::text
     or v_event.metadata->>'localCaseId' is distinct from v_case_id
     or v_event.cloud_revision <> 1 or length(v_event.cloud_hash) <> 64 then
    raise exception 'diary INSERT fallback/cloud identity is invalid: %', v_event.metadata;
  end if;

  -- RPC merges a partial nested profile with all existing PWA/mobile facts.
  select public.sync_notebook_v2(
    'f2000000-0000-4000-8000-000000000001',
    'notebook-v2-owner@example.test',
    'f2000000-0000-4000-8000-000000000010',
    false,
    jsonb_build_array(jsonb_build_object(
      'localCaseId', v_case_id,
      'personId', v_person.id,
      'cloudRevision', v_person.cloud_revision,
      'cloudHash', v_person.cloud_hash,
      'displayName', v_person.display_name,
      'relationshipToFamily', v_person.relationship_to_family,
      'currentStatus', v_person.current_status,
      'profile', jsonb_build_object(
        'source', 'pwa-notebook',
        'personProfile', jsonb_build_object('birthDate', '1950-06-14')
      ),
      'localTasks', '[]'::jsonb
    )),
    '[]'::jsonb,
    'f2000000-0000-4000-8000-000000000050'
  ) into v_response;

  select p.* into v_person from public.people p where p.id = v_person.id;
  if v_person.profile->'personProfile'->>'birthDate' is distinct from '1950-06-14'
     or v_person.profile->'personProfile'->>'firstSituation' is distinct from 'mobile updated first'
     or v_person.profile->'localAnswers'->>'targetName' is distinct from '母'
     or v_person.profile->>'localResultSummary' is distinct from 'PWA summary' then
    raise exception 'RPC profile merge lost cross-client facts: %', v_person.profile;
  end if;
  if (v_response->'caseRevisions'->0->>'cloudRevision')::bigint <> v_person.cloud_revision then
    raise exception 'RPC response revision does not match stored person revision';
  end if;
  if v_response->>'memberRole' is distinct from 'owner'
     or (v_response->'caseRevisions'->0->>'profileApplied')::boolean is distinct from true then
    raise exception 'owner RPC did not return its role/profile application marker: %', v_response;
  end if;

  -- A member's differing profile is ignored, explicitly marked, and the exact
  -- marker survives an idempotent receipt replay.
  v_profile_before_member := v_person.profile;
  select public.sync_notebook_v2(
    'f2000000-0000-4000-8000-000000000002',
    'notebook-v2-member@example.test',
    'f2000000-0000-4000-8000-000000000010',
    false,
    jsonb_build_array(jsonb_build_object(
      'localCaseId', v_case_id,
      'personId', v_person.id,
      'cloudRevision', v_person.cloud_revision,
      'cloudHash', v_person.cloud_hash,
      'displayName', 'member must not rename',
      'relationshipToFamily', v_person.relationship_to_family,
      'currentStatus', v_person.current_status,
      'profile', jsonb_build_object(
        'source', 'pwa-notebook',
        'personProfile', jsonb_build_object('birthDate', '1900-01-01')
      ),
      'localTasks', '[]'::jsonb
    )),
    '[]'::jsonb,
    'f2000000-0000-4000-8000-000000000051'
  ) into v_member_response;

  select public.sync_notebook_v2(
    'f2000000-0000-4000-8000-000000000002',
    'notebook-v2-member@example.test',
    'f2000000-0000-4000-8000-000000000010',
    false,
    jsonb_build_array(jsonb_build_object(
      'localCaseId', v_case_id,
      'personId', v_person.id,
      'cloudRevision', v_person.cloud_revision,
      'cloudHash', v_person.cloud_hash,
      'displayName', 'member must not rename',
      'relationshipToFamily', v_person.relationship_to_family,
      'currentStatus', v_person.current_status,
      'profile', jsonb_build_object(
        'source', 'pwa-notebook',
        'personProfile', jsonb_build_object('birthDate', '1900-01-01')
      ),
      'localTasks', '[]'::jsonb
    )),
    '[]'::jsonb,
    'f2000000-0000-4000-8000-000000000051'
  ) into v_retry_response;

  select p.* into v_person from public.people p where p.id = v_person.id;
  if v_person.profile is distinct from v_profile_before_member
     or v_person.display_name is distinct from '母' then
    raise exception 'member profile payload mutated owner-managed person data';
  end if;
  if v_member_response->>'memberRole' is distinct from 'member'
     or (v_member_response->'caseRevisions'->0->>'profileApplied')::boolean is distinct from false
     or v_retry_response is distinct from v_member_response then
    raise exception 'member role/profile marker or receipt replay is invalid: %, %', v_member_response, v_retry_response;
  end if;
end;
$test$;

-- Exercise the direct/mobile path as an authenticated caller rather than as
-- the migration owner (which would bypass RLS). These grants are local to this
-- transaction and are rolled back with all test data.
grant usage on schema public to authenticated;
grant select on public.people, public.family_members to authenticated;
grant select, insert, update, delete on public.tasks, public.timeline_events to authenticated;
grant select, insert on public.person_status_events to authenticated;
grant execute on function public.is_family_member(uuid) to authenticated;

set local role authenticated;

do $rls_test$
declare
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub', 'f2000000-0000-4000-8000-000000000003', true);

  select count(*) into v_count
  from public.tasks
  where id = 'f2000000-0000-4000-8000-000000000030';
  if v_count <> 1 then
    raise exception 'viewer lost the existing task SELECT policy';
  end if;

  begin
    insert into public.tasks (id, person_id, title, status)
    values (
      'f2000000-0000-4000-8000-000000000060',
      'f2000000-0000-4000-8000-000000000020',
      'viewer must not insert task',
      'todo'
    );
    raise exception 'viewer task INSERT unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  update public.tasks set title = 'viewer must not update'
  where id = 'f2000000-0000-4000-8000-000000000030';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'viewer task UPDATE unexpectedly affected % row(s)', v_count;
  end if;

  delete from public.tasks
  where id = 'f2000000-0000-4000-8000-000000000030';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'viewer task DELETE unexpectedly affected % row(s)', v_count;
  end if;

  select count(*) into v_count
  from public.timeline_events
  where id = 'f2000000-0000-4000-8000-000000000040';
  if v_count <> 1 then
    raise exception 'viewer lost the existing timeline SELECT policy';
  end if;

  begin
    insert into public.timeline_events (
      id, person_id, event_type, event_date, title, body, metadata
    ) values (
      'f2000000-0000-4000-8000-000000000061',
      'f2000000-0000-4000-8000-000000000020',
      'diary', '2026-09-01', 'viewer denied', 'viewer must not insert diary', '{}'::jsonb
    );
    raise exception 'viewer timeline INSERT unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  update public.timeline_events set body = 'viewer must not update'
  where id = 'f2000000-0000-4000-8000-000000000040';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'viewer timeline UPDATE unexpectedly affected % row(s)', v_count;
  end if;

  delete from public.timeline_events
  where id = 'f2000000-0000-4000-8000-000000000040';
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'viewer timeline DELETE unexpectedly affected % row(s)', v_count;
  end if;

  begin
    insert into public.person_status_events (person_id, new_status, created_by)
    values (
      'f2000000-0000-4000-8000-000000000020',
      'viewer denied',
      'f2000000-0000-4000-8000-000000000003'
    );
    raise exception 'viewer status-event INSERT unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  perform set_config('request.jwt.claim.sub', 'f2000000-0000-4000-8000-000000000002', true);

  insert into public.tasks (id, person_id, title, status, created_by)
  values (
    'f2000000-0000-4000-8000-000000000070',
    'f2000000-0000-4000-8000-000000000020',
    'member task',
    'todo',
    'f2000000-0000-4000-8000-000000000002'
  );
  update public.tasks set title = 'member task updated'
  where id = 'f2000000-0000-4000-8000-000000000070';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'member task UPDATE affected % row(s)', v_count;
  end if;
  delete from public.tasks
  where id = 'f2000000-0000-4000-8000-000000000070';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'member task DELETE affected % row(s)', v_count;
  end if;

  insert into public.timeline_events (
    id, person_id, event_type, event_date, title, body, metadata, created_by
  ) values (
    'f2000000-0000-4000-8000-000000000071',
    'f2000000-0000-4000-8000-000000000020',
    'diary', '2026-09-01', 'member diary', 'member inserted diary', '{}'::jsonb,
    'f2000000-0000-4000-8000-000000000002'
  );
  update public.timeline_events set body = 'member updated diary'
  where id = 'f2000000-0000-4000-8000-000000000071';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'member timeline UPDATE affected % row(s)', v_count;
  end if;
  delete from public.timeline_events
  where id = 'f2000000-0000-4000-8000-000000000071';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'member timeline DELETE affected % row(s)', v_count;
  end if;

  insert into public.person_status_events (person_id, new_status, created_by)
  values (
    'f2000000-0000-4000-8000-000000000020',
    'member allowed',
    'f2000000-0000-4000-8000-000000000002'
  );
end;
$rls_test$;

reset role;

rollback;
