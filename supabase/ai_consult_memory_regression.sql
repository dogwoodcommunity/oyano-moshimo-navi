-- PostgreSQL behavioral regression for ai_consult_memory.sql.
-- Run only in a disposable/local database after schema.sql, production_rls.sql,
-- and ai_consult_memory.sql. Every fixture and mutation is rolled back.

begin;

insert into auth.users (id, email)
values
  ('f3000000-0000-4000-8000-000000000001', 'ai-owner-a@example.test'),
  ('f3000000-0000-4000-8000-000000000002', 'ai-member-a@example.test'),
  ('f3000000-0000-4000-8000-000000000003', 'ai-viewer-a@example.test'),
  ('f3000000-0000-4000-8000-000000000004', 'ai-owner-b@example.test');

insert into public.profiles (id, email, display_name)
values
  ('f3000000-0000-4000-8000-000000000001', 'ai-owner-a@example.test', 'AI owner A'),
  ('f3000000-0000-4000-8000-000000000002', 'ai-member-a@example.test', 'AI member A'),
  ('f3000000-0000-4000-8000-000000000003', 'ai-viewer-a@example.test', 'AI viewer A'),
  ('f3000000-0000-4000-8000-000000000004', 'ai-owner-b@example.test', 'AI owner B');

insert into public.families (id, name, owner_user_id, plan)
values
  (
    'f3000000-0000-4000-8000-000000000010',
    'AI memory regression family A',
    'f3000000-0000-4000-8000-000000000001',
    'plus'
  ),
  (
    'f3000000-0000-4000-8000-000000000011',
    'AI memory regression family B',
    'f3000000-0000-4000-8000-000000000004',
    'plus'
  );

insert into public.family_members (family_id, user_id, role, relationship)
values
  (
    'f3000000-0000-4000-8000-000000000010',
    'f3000000-0000-4000-8000-000000000001',
    'owner',
    '本人'
  ),
  (
    'f3000000-0000-4000-8000-000000000010',
    'f3000000-0000-4000-8000-000000000002',
    'member',
    '家族'
  ),
  (
    'f3000000-0000-4000-8000-000000000010',
    'f3000000-0000-4000-8000-000000000003',
    'viewer',
    '閲覧者'
  ),
  (
    'f3000000-0000-4000-8000-000000000011',
    'f3000000-0000-4000-8000-000000000004',
    'owner',
    '本人'
  );

insert into public.people (id, family_id, display_name, relationship_to_family)
values
  (
    'f3000000-0000-4000-8000-000000000020',
    'f3000000-0000-4000-8000-000000000010',
    '母A',
    '母'
  ),
  (
    'f3000000-0000-4000-8000-000000000021',
    'f3000000-0000-4000-8000-000000000011',
    '母B',
    '母'
  );

insert into public.person_ai_memories (
  person_id,
  long_term_summary,
  user_summary,
  important_changes,
  record_count,
  first_record_date,
  last_record_date,
  memory_version,
  updated_by
)
values
  (
    'f3000000-0000-4000-8000-000000000020',
    'family A server summary',
    'family A confirmed fact',
    '[{"kind":"fact","text":"family A change"}]'::jsonb,
    3,
    '2026-08-25',
    '2026-08-27',
    2,
    'f3000000-0000-4000-8000-000000000001'
  ),
  (
    'f3000000-0000-4000-8000-000000000021',
    'family B server summary',
    'family B confirmed fact',
    '[]'::jsonb,
    1,
    '2026-08-25',
    '2026-08-25',
    1,
    'f3000000-0000-4000-8000-000000000004'
  );

insert into public.ai_consult_threads (id, person_id, owner_user_id)
values
  (
    'f3000000-0000-4000-8000-000000000030',
    'f3000000-0000-4000-8000-000000000020',
    'f3000000-0000-4000-8000-000000000001'
  ),
  (
    'f3000000-0000-4000-8000-000000000031',
    'f3000000-0000-4000-8000-000000000020',
    'f3000000-0000-4000-8000-000000000002'
  ),
  (
    'f3000000-0000-4000-8000-000000000032',
    'f3000000-0000-4000-8000-000000000021',
    'f3000000-0000-4000-8000-000000000004'
  );

insert into public.ai_consult_turns (id, thread_id, question, answer, memory_version)
values
  (
    'f3000000-0000-4000-8000-000000000040',
    'f3000000-0000-4000-8000-000000000030',
    'owner A private question',
    '{"summary":"owner A private answer"}'::jsonb,
    2
  ),
  (
    'f3000000-0000-4000-8000-000000000041',
    'f3000000-0000-4000-8000-000000000031',
    'member A private question',
    '{"summary":"member A private answer"}'::jsonb,
    2
  ),
  (
    'f3000000-0000-4000-8000-000000000042',
    'f3000000-0000-4000-8000-000000000032',
    'owner B private question',
    '{"summary":"owner B private answer"}'::jsonb,
    1
  );

insert into public.ai_memory_consents (
  person_id,
  user_id,
  consent_version,
  revision
)
values
  (
    'f3000000-0000-4000-8000-000000000020',
    'f3000000-0000-4000-8000-000000000001',
    'regression-v1',
    1
  ),
  (
    'f3000000-0000-4000-8000-000000000020',
    'f3000000-0000-4000-8000-000000000002',
    'regression-v1',
    1
  ),
  (
    'f3000000-0000-4000-8000-000000000021',
    'f3000000-0000-4000-8000-000000000004',
    'regression-v1',
    1
  );

do $grant_test$
begin
  if not (
    has_table_privilege('authenticated', 'public.person_ai_memories', 'SELECT')
    and has_table_privilege('authenticated', 'public.ai_consult_threads', 'SELECT')
    and has_table_privilege('authenticated', 'public.ai_consult_turns', 'SELECT')
    and has_table_privilege('authenticated', 'public.ai_memory_consents', 'SELECT')
  ) then
    raise exception 'authenticated role is missing AI-memory SELECT grants';
  end if;

  if has_table_privilege('authenticated', 'public.person_ai_memories', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated', 'public.ai_consult_threads', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated', 'public.ai_consult_turns', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated', 'public.ai_memory_consents', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'authenticated role unexpectedly has AI-memory mutation grants';
  end if;

  if not (
    has_table_privilege('service_role', 'public.person_ai_memories', 'SELECT')
    and has_table_privilege('service_role', 'public.person_ai_memories', 'INSERT')
    and has_table_privilege('service_role', 'public.person_ai_memories', 'UPDATE')
    and has_table_privilege('service_role', 'public.person_ai_memories', 'DELETE')
    and has_table_privilege('service_role', 'public.ai_consult_threads', 'SELECT')
    and has_table_privilege('service_role', 'public.ai_consult_threads', 'INSERT')
    and has_table_privilege('service_role', 'public.ai_consult_threads', 'UPDATE')
    and has_table_privilege('service_role', 'public.ai_consult_threads', 'DELETE')
    and has_table_privilege('service_role', 'public.ai_consult_turns', 'SELECT')
    and has_table_privilege('service_role', 'public.ai_consult_turns', 'INSERT')
    and has_table_privilege('service_role', 'public.ai_consult_turns', 'UPDATE')
    and has_table_privilege('service_role', 'public.ai_consult_turns', 'DELETE')
    and has_table_privilege('service_role', 'public.ai_memory_consents', 'SELECT')
    and has_table_privilege('service_role', 'public.ai_memory_consents', 'INSERT')
    and has_table_privilege('service_role', 'public.ai_memory_consents', 'UPDATE')
    and has_table_privilege('service_role', 'public.ai_memory_consents', 'DELETE')
  ) then
    raise exception 'service_role is missing AI-memory CRUD grants';
  end if;

  if has_table_privilege('service_role', 'public.person_ai_memories', 'TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('service_role', 'public.ai_consult_threads', 'TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('service_role', 'public.ai_consult_turns', 'TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('service_role', 'public.ai_memory_consents', 'TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'service_role AI-memory grants are broader than CRUD';
  end if;

  if has_table_privilege('anon', 'public.person_ai_memories', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('anon', 'public.ai_consult_threads', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('anon', 'public.ai_consult_turns', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('anon', 'public.ai_memory_consents', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'anon unexpectedly has AI-memory access';
  end if;
end;
$grant_test$;

set local role authenticated;

do $owner_a_rls$
declare
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000001', true);

  select count(*) into v_count from public.person_ai_memories;
  if v_count <> 1 then
    raise exception 'family A owner should see one shared memory, saw %', v_count;
  end if;
  select count(*) into v_count from public.ai_consult_threads;
  if v_count <> 1 then
    raise exception 'family A owner should see only their own thread, saw %', v_count;
  end if;
  select count(*) into v_count from public.ai_consult_turns;
  if v_count <> 1 then
    raise exception 'family A owner should see only their own turn, saw %', v_count;
  end if;
  select count(*) into v_count from public.ai_memory_consents;
  if v_count <> 1 then
    raise exception 'family A owner should see only their own consent, saw %', v_count;
  end if;

  begin
    update public.person_ai_memories
    set user_summary = 'direct client mutation must fail'
    where person_id = 'f3000000-0000-4000-8000-000000000020';
    raise exception 'authenticated direct AI-memory UPDATE unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.ai_consult_turns
    where id = 'f3000000-0000-4000-8000-000000000040';
    raise exception 'authenticated direct AI-turn DELETE unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$owner_a_rls$;

do $member_a_rls$
declare
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000002', true);

  select count(*) into v_count from public.person_ai_memories;
  if v_count <> 1 then
    raise exception 'family A member should see one shared memory, saw %', v_count;
  end if;
  select count(*) into v_count from public.ai_consult_threads;
  if v_count <> 1 then
    raise exception 'family A member should see only their own thread, saw %', v_count;
  end if;
  select count(*) into v_count from public.ai_consult_turns;
  if v_count <> 1 then
    raise exception 'family A member should see only their own turn, saw %', v_count;
  end if;
  select count(*) into v_count from public.ai_memory_consents;
  if v_count <> 1 then
    raise exception 'family A member should see only their own consent, saw %', v_count;
  end if;
end;
$member_a_rls$;

do $viewer_a_rls$
declare
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000003', true);

  select count(*) into v_count from public.person_ai_memories;
  if v_count <> 1 then
    raise exception 'family A viewer should see shared memory, saw %', v_count;
  end if;
  select count(*) into v_count from public.ai_consult_threads;
  if v_count <> 0 then
    raise exception 'family A viewer saw another user thread';
  end if;
  select count(*) into v_count from public.ai_consult_turns;
  if v_count <> 0 then
    raise exception 'family A viewer saw another user turn';
  end if;
  select count(*) into v_count from public.ai_memory_consents;
  if v_count <> 0 then
    raise exception 'family A viewer saw another user consent';
  end if;
end;
$viewer_a_rls$;

do $owner_b_rls$
declare
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000004', true);

  select count(*) into v_count
  from public.person_ai_memories
  where person_id = 'f3000000-0000-4000-8000-000000000020';
  if v_count <> 0 then
    raise exception 'family B owner saw family A shared memory';
  end if;
  select count(*) into v_count from public.person_ai_memories;
  if v_count <> 1 then
    raise exception 'family B owner should see only family B memory, saw %', v_count;
  end if;
  select count(*) into v_count from public.ai_consult_threads;
  if v_count <> 1 then
    raise exception 'family B owner should see only their own thread, saw %', v_count;
  end if;
  select count(*) into v_count from public.ai_consult_turns;
  if v_count <> 1 then
    raise exception 'family B owner should see only their own turn, saw %', v_count;
  end if;
  select count(*) into v_count from public.ai_memory_consents;
  if v_count <> 1 then
    raise exception 'family B owner should see only their own consent, saw %', v_count;
  end if;
end;
$owner_b_rls$;

reset role;

-- Current family membership is required at read time. Removing it must hide the
-- shared summary, the user's private thread/turn, and their consent immediately.
delete from public.family_members
where family_id = 'f3000000-0000-4000-8000-000000000010'
  and user_id = 'f3000000-0000-4000-8000-000000000002';

set local role authenticated;

do $revoked_member_rls$
declare
  v_count integer;
begin
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000002', true);

  select count(*) into v_count from public.person_ai_memories;
  if v_count <> 0 then
    raise exception 'removed member still sees shared memory';
  end if;
  select count(*) into v_count from public.ai_consult_threads;
  if v_count <> 0 then
    raise exception 'removed member still sees private thread';
  end if;
  select count(*) into v_count from public.ai_consult_turns;
  if v_count <> 0 then
    raise exception 'removed member still sees private turn';
  end if;
  select count(*) into v_count from public.ai_memory_consents;
  if v_count <> 0 then
    raise exception 'removed member still sees consent';
  end if;
end;
$revoked_member_rls$;

reset role;
set local role anon;

do $anon_test$
begin
  begin
    perform count(*) from public.person_ai_memories;
    raise exception 'anon AI-memory SELECT unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;
end;
$anon_test$;

reset role;
set local role service_role;

do $service_role_test$
declare
  v_count integer;
begin
  update public.person_ai_memories
  set user_summary = 'service role corrected fact'
  where person_id = 'f3000000-0000-4000-8000-000000000020';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'service_role AI-memory UPDATE affected % rows', v_count;
  end if;

  insert into public.ai_consult_turns (id, thread_id, question, answer, memory_version)
  values (
    'f3000000-0000-4000-8000-000000000043',
    'f3000000-0000-4000-8000-000000000030',
    'service role inserted question',
    '{"summary":"service role inserted answer"}'::jsonb,
    2
  );
  delete from public.ai_consult_turns
  where id = 'f3000000-0000-4000-8000-000000000043';
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception 'service_role AI-turn DELETE affected % rows', v_count;
  end if;
end;
$service_role_test$;

reset role;

-- Verify the constraints that keep derived facts and source-linked history sane.
do $constraint_test$
begin
  begin
    insert into public.ai_consult_turns (thread_id, question, answer)
    values (
      'f3000000-0000-4000-8000-000000000030',
      '   ',
      '{"summary":"blank question must fail"}'::jsonb
    );
    raise exception 'blank AI consultation question unexpectedly succeeded';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.ai_consult_turns (thread_id, question, answer)
    values (
      'f3000000-0000-4000-8000-000000000030',
      'non-object answer must fail',
      '[]'::jsonb
    );
    raise exception 'non-object AI consultation answer unexpectedly succeeded';
  exception when check_violation then
    null;
  end;

  begin
    update public.person_ai_memories
    set first_record_date = '2026-09-02', last_record_date = '2026-09-01'
    where person_id = 'f3000000-0000-4000-8000-000000000020';
    raise exception 'reversed AI-memory record dates unexpectedly succeeded';
  exception when check_violation then
    null;
  end;

  begin
    update public.ai_memory_consents
    set revision = 0
    where person_id = 'f3000000-0000-4000-8000-000000000020'
      and user_id = 'f3000000-0000-4000-8000-000000000001';
    raise exception 'non-positive AI-memory consent revision unexpectedly succeeded';
  exception when check_violation then
    null;
  end;
end;
$constraint_test$;

rollback;
