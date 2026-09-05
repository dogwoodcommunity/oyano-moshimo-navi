-- Disposable local PostgreSQL only. This is a regression, NOT a migration.
begin;
alter table auth.users add column email_confirmed_at timestamptz;
insert into auth.users(id,email,email_confirmed_at) values
 ('ab000000-0000-4000-8000-000000000001','reconcile-owner@example.test',now()),
 ('ab000000-0000-4000-8000-000000000002','reconcile-viewer@example.test',now()),
 ('ab000000-0000-4000-8000-000000000003','reconcile-other@example.test',now());
insert into public.profiles(id,email) select id,email from auth.users where email like 'reconcile-%@example.test';
insert into public.families(id,name,owner_user_id,plan) values
 ('ab000000-0000-4000-8000-000000000010','Isolated reconciliation test','ab000000-0000-4000-8000-000000000001','free');
insert into public.family_members(family_id,user_id,role) values
 ('ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000001','owner'),
 ('ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000002','viewer');
insert into public.people(id,family_id,display_name,profile) values
 ('ab000000-0000-4000-8000-000000000020','ab000000-0000-4000-8000-000000000010','Cloud parent',
 '{"localCaseId":"cloud-case","legacy":"preserve exactly","localTasks":[{"id":"untouched-task","title":"Keep this"}]}');
insert into public.timeline_events(id,person_id,event_type,event_date,title,body,mood,attachments,metadata,created_by) values
 ('ab000000-0000-4000-8000-000000000030','ab000000-0000-4000-8000-000000000020','diary','2026-09-01','Original','Original cloud diary','stable','[]',
 '{"localCaseId":"cloud-case","localDiaryId":"original"}','ab000000-0000-4000-8000-000000000001');
set local role service_role;
select set_config('request.jwt.claim.role','service_role',true);
do $test$
declare
 original_person jsonb;
 original_diary jsonb;
 entries jsonb := '[{"localCaseId":"cloud-case","localDiaryId":"reconciled_1111111111111111111111111111111111111111111111111111111111111111","cloudRevision":null,"cloudHash":null,"date":"2026-09-02","title":"日々の記録","body":"  Local diary\nKeep whitespace  ","mood":"stable","attachments":[],"metadata":{"source":"pwa-notebook"},"createdAt":"2026-09-02T00:00:00.000Z","updatedAt":"2026-09-02T00:00:00.000Z"}]';
 result jsonb;
 actor uuid;
 role_name text;
 invalid_entries jsonb;
 rpc_signature text := 'public.reconcile_notebook_diaries_v1(uuid,text,uuid,uuid,text,jsonb,uuid)';
 rejected boolean;
 revision bigint;
 hash text;
begin
 foreach role_name in array array['anon', 'authenticated'] loop
   if has_function_privilege(role_name, rpc_signature, 'EXECUTE') then
     raise exception 'untrusted role can execute reconciliation RPC';
   end if;
 end loop;
 if not has_function_privilege('service_role', rpc_signature, 'EXECUTE') then
   raise exception 'service role cannot execute reconciliation RPC';
 end if;
 select to_jsonb(p) into original_person from public.people p where id='ab000000-0000-4000-8000-000000000020';
 select to_jsonb(e) into original_diary from public.timeline_events e where id='ab000000-0000-4000-8000-000000000030';
 for i in 1..2 loop
   result := public.reconcile_notebook_diaries_v1('ab000000-0000-4000-8000-000000000001','reconcile-owner@example.test',
     'ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000020','cloud-case',entries,gen_random_uuid());
   if result->>'syncedEntries' <> '1' or result->>'syncedPeople' <> '0' or result->>'syncedTasks' <> '0' then
     raise exception 'append-only RPC result invalid';
   end if;
 end loop;
 if (select count(*) from public.people where family_id='ab000000-0000-4000-8000-000000000010') <> 1 then
   raise exception 'free person limit bypassed';
 end if;
 if (select count(*) from public.timeline_events where person_id='ab000000-0000-4000-8000-000000000020') <> 2 then
   raise exception 'lost response retry duplicated diary';
 end if;
 if (select to_jsonb(p) from public.people p where id='ab000000-0000-4000-8000-000000000020') is distinct from original_person then
   raise exception 'append changed person, profile, local tasks or revisions';
 end if;
 if (select to_jsonb(e) from public.timeline_events e where id='ab000000-0000-4000-8000-000000000030') is distinct from original_diary then
   raise exception 'append changed existing diary';
 end if;
 if (select body from public.timeline_events where metadata->>'localDiaryId'=entries->0->>'localDiaryId') is distinct from entries->0->>'body' then
   raise exception 'body whitespace was changed';
 end if;
 foreach actor in array array['ab000000-0000-4000-8000-000000000002'::uuid,'ab000000-0000-4000-8000-000000000003'::uuid] loop
   rejected := false;
   begin
     perform public.reconcile_notebook_diaries_v1(actor,
       case actor when 'ab000000-0000-4000-8000-000000000002'::uuid then 'reconcile-viewer@example.test' else 'reconcile-other@example.test' end,
       'ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000020','cloud-case',entries,gen_random_uuid());
   exception when insufficient_privilege then rejected := true;
   end;
   if not rejected then raise exception 'viewer or outsider can append'; end if;
 end loop;
 -- The localCaseId alone is not sufficient: lock and validate the exact UUID.
 rejected := false;
 begin
   perform public.reconcile_notebook_diaries_v1('ab000000-0000-4000-8000-000000000001','reconcile-owner@example.test',
     'ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000099','cloud-case',entries,gen_random_uuid());
 exception when serialization_failure then rejected := true;
 end;
 if not rejected then raise exception 'wrong UUID was accepted through matching localCaseId'; end if;
 rejected := false;
 begin
   perform public.reconcile_notebook_diaries_v1('ab000000-0000-4000-8000-000000000001','reconcile-owner@example.test',
     'ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000020','wrong-case',
     jsonb_set(entries,'{0,localCaseId}','"wrong-case"'),gen_random_uuid());
 exception when serialization_failure then rejected := true;
 end;
 if not rejected then raise exception 'wrong localCaseId accepted through matching UUID'; end if;
 rejected := false;
 begin
   perform public.reconcile_notebook_diaries_v1('ab000000-0000-4000-8000-000000000001','wrong-email@example.test',
     'ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000020','cloud-case',entries,gen_random_uuid());
 exception when insufficient_privilege then rejected := true;
 end;
 if not rejected then raise exception 'actor email mismatch accepted'; end if;
 perform set_config('request.jwt.claim.role','authenticated',true);
 rejected := false;
 begin
   perform public.reconcile_notebook_diaries_v1('ab000000-0000-4000-8000-000000000001','reconcile-owner@example.test',
     'ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000020','cloud-case',entries,gen_random_uuid());
 exception when insufficient_privilege then rejected := true;
 end;
 perform set_config('request.jwt.claim.role','service_role',true);
 if not rejected then raise exception 'non-service JWT actor override accepted'; end if;
 foreach invalid_entries in array array[
   jsonb_set(entries,'{0,cloudRevision}','1'),
   jsonb_set(entries,'{0,cloudHash}','"spoofed-cas"'),
   jsonb_set(entries,'{0,attachments}','[{"id":"photo"}]'),
   jsonb_set(entries,'{0,localCaseId}','"different-case"'),
   jsonb_set(entries,'{0,profile}','{}'),
   jsonb_set(entries,'{0,body}','""'),
   entries || entries
 ] loop
   rejected := false;
   begin
     perform public.reconcile_notebook_diaries_v1('ab000000-0000-4000-8000-000000000001','reconcile-owner@example.test',
       'ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000020','cloud-case',invalid_entries,gen_random_uuid());
   exception when invalid_parameter_value then rejected := true;
   end;
   if not rejected then raise exception 'non-append-only diary payload accepted'; end if;
 end loop;
 rejected := false;
 begin
   perform public.reconcile_notebook_diaries_v1('ab000000-0000-4000-8000-000000000001','reconcile-owner@example.test',
     'ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000020','cloud-case',jsonb_set(entries,'{0,body}','"tamper existing imported diary"'),gen_random_uuid());
 exception when serialization_failure then rejected := true;
 end;
 if not rejected then raise exception 'same ID different content overwrote diary'; end if;
 select cloud_revision,cloud_hash into revision,hash from public.timeline_events where metadata->>'localDiaryId'=entries->0->>'localDiaryId';
 perform public.delete_notebook_diary_v1('ab000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000010',
   'ab000000-0000-4000-8000-000000000020','cloud-case',entries->0->>'localDiaryId',revision,hash);
 rejected := false;
 begin
   perform public.reconcile_notebook_diaries_v1('ab000000-0000-4000-8000-000000000001','reconcile-owner@example.test',
     'ab000000-0000-4000-8000-000000000010','ab000000-0000-4000-8000-000000000020','cloud-case',entries,gen_random_uuid());
 exception when serialization_failure then rejected := true;
 end;
 if not rejected then raise exception 'deleted imported diary resurrected'; end if;
 if (select count(*) from public.timeline_events where person_id='ab000000-0000-4000-8000-000000000020') <> 1 then
   raise exception 'tombstone did not preserve original diary';
 end if;
end;
$test$;

-- Keep the original fixture/counters and deletion regression above unchanged.
-- This second block reuses its isolated owner/family/person before ROLLBACK.
do $text_integrity$
<<text_fixture>>
declare
 actor_id constant uuid := 'ab000000-0000-4000-8000-000000000001';
 family_id constant uuid := 'ab000000-0000-4000-8000-000000000010';
 person_id constant uuid := 'ab000000-0000-4000-8000-000000000020';
 base_entry jsonb := '{"localCaseId":"cloud-case","cloudRevision":null,"cloudHash":null,"date":"2026-09-03","title":"日々の記録","mood":"stable","attachments":[],"metadata":{"source":"pwa-notebook"},"createdAt":"2026-09-03T00:00:00.000Z","updatedAt":"2026-09-03T00:00:00.000Z"}';
 text_body text;
 copied_entry jsonb;
 whitespace_entry jsonb;
 valid_new_entry jsonb;
 invalid_entry jsonb;
 altered_body text;
 saved_row jsonb;
 saved_bytes bytea;
 baseline_person jsonb;
 baseline_original jsonb;
 baseline_tasks jsonb;
 before_failure jsonb;
 after_failure jsonb;
 rejected_cases jsonb := '[]'::jsonb;
 rejected_case jsonb;
 result jsonb;
 request_id uuid;
 observed_state text;
 fixture_number integer := 1000;
 success_count integer := 0;
 rejection_count integer := 0;
begin
 select to_jsonb(p) into baseline_person from public.people p where p.id = person_id;
 select to_jsonb(e) into baseline_original from public.timeline_events e
   where e.id = 'ab000000-0000-4000-8000-000000000030';
 select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) into baseline_tasks
   from public.tasks t where t.person_id = text_fixture.person_id;

 -- PostgreSQL length counts Unicode code points, not UTF-16 code units.
 foreach text_body in array array[
   repeat('あ', 9999), repeat('あ', 10000), repeat('🙂', 10000),
   E'  行頭の空白\r\n二行目🙂\r\n末尾の改行\r\n\n'
 ] loop
   fixture_number := fixture_number + 1;
   copied_entry := base_entry || jsonb_build_object(
     'localDiaryId', 'reconciled_' || lpad(to_hex(fixture_number), 64, '0'),
     'body', text_body
   );
   request_id := gen_random_uuid();
   result := public.reconcile_notebook_diaries_v1(actor_id, 'reconcile-owner@example.test',
     family_id, person_id, 'cloud-case', jsonb_build_array(copied_entry), request_id);
   if result->>'syncedEntries' <> '1' or result->>'syncedPeople' <> '0' or result->>'syncedTasks' <> '0' then
     raise exception 'text fixture append-only result invalid';
   end if;
   select to_jsonb(e), convert_to(e.body, 'UTF8') into saved_row, saved_bytes
     from public.timeline_events e where e.person_id = text_fixture.person_id
       and e.metadata->>'localDiaryId' = copied_entry->>'localDiaryId';
   if saved_row is null or saved_row->>'body' is distinct from text_body
      or saved_bytes is distinct from convert_to(text_body, 'UTF8')
      or length(saved_row->>'body') is distinct from length(text_body) then
     raise exception 'accepted text changed characters, whitespace or UTF8 bytes';
   end if;
   -- Both the same request receipt and a fresh request must preserve every row
   -- field (including revisions, hashes, metadata and timestamps), not just body.
   for retry in 1..2 loop
     if retry = 2 then request_id := gen_random_uuid(); end if;
     perform public.reconcile_notebook_diaries_v1(actor_id, 'reconcile-owner@example.test',
       family_id, person_id, 'cloud-case', jsonb_build_array(copied_entry), request_id);
     if (select count(*) from public.timeline_events e where e.person_id = text_fixture.person_id
         and e.metadata->>'localDiaryId' = copied_entry->>'localDiaryId') <> 1
        or (select to_jsonb(e) from public.timeline_events e where e.person_id = text_fixture.person_id
         and e.metadata->>'localDiaryId' = copied_entry->>'localDiaryId') is distinct from saved_row then
       raise exception 'identical text retry changed or duplicated the saved row';
     end if;
   end loop;
   success_count := success_count + 1;
 end loop;
 whitespace_entry := copied_entry;
 if (select to_jsonb(p) from public.people p where p.id = person_id) is distinct from baseline_person
    or (select to_jsonb(e) from public.timeline_events e
        where e.id = 'ab000000-0000-4000-8000-000000000030') is distinct from baseline_original
    or (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb)
        from public.tasks t where t.person_id = text_fixture.person_id) is distinct from baseline_tasks then
   raise exception 'text append changed original person, profile, tasks or diary';
 end if;

 -- Use a distinct new ID smaller than every saved text fixture. V2 sorts by
 -- localDiaryId, so in a CAS batch it attempts this insert before the conflict.
 valid_new_entry := base_entry || jsonb_build_object(
   'localDiaryId', 'reconciled_' || lpad(to_hex(1), 64, '0'), 'body', 'Valid new batch diary'
 );
 foreach text_body in array array[repeat('あ', 10001), repeat('🙂', 10001)] loop
   invalid_entry := base_entry || jsonb_build_object(
     'localDiaryId', 'reconciled_' || lpad(to_hex(2000), 64, '0'), 'body', text_body
   );
   rejected_cases := rejected_cases || jsonb_build_array(
     jsonb_build_object('label', 'over-limit code points', 'state', '22023', 'entries', jsonb_build_array(invalid_entry)),
     jsonb_build_object('label', 'valid plus over-limit batch', 'state', '22023', 'entries', jsonb_build_array(valid_new_entry, invalid_entry))
   );
 end loop;
 foreach altered_body in array array[
   substring(whitespace_entry->>'body' from 2),
   left(whitespace_entry->>'body', length(whitespace_entry->>'body') - 1),
   replace(whitespace_entry->>'body', E'\r\n', E'\n'),
   (whitespace_entry->>'body') || ' '
 ] loop
   invalid_entry := jsonb_set(whitespace_entry, '{body}', to_jsonb(altered_body));
   rejected_cases := rejected_cases || jsonb_build_array(
     jsonb_build_object('label', 'whitespace-only change', 'state', '40001', 'entries', jsonb_build_array(invalid_entry)),
     -- Put the conflicting entry first in the payload to exercise actual V2 ID
     -- ordering, not a test that assumes it iterates in client array order.
     jsonb_build_object('label', 'valid plus whitespace CAS batch', 'state', '40001', 'entries', jsonb_build_array(invalid_entry, valid_new_entry))
   );
 end loop;

 -- Compare the complete scoped rows after each rejection, including receipts.
 -- The exception block is a subtransaction: even a prior V2 insert must vanish.
 select jsonb_build_object(
   'diaries', (select coalesce(jsonb_agg(to_jsonb(e) order by e.id), '[]'::jsonb) from public.timeline_events e where e.person_id = text_fixture.person_id),
   'person', (select to_jsonb(p) from public.people p where p.id = person_id),
   'tasks', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.tasks t where t.person_id = text_fixture.person_id),
   'profile', (select to_jsonb(p) from public.profiles p where p.id = actor_id),
   'family', (select to_jsonb(f) from public.families f where f.id = family_id),
   'members', (select coalesce(jsonb_agg(to_jsonb(m) order by m.user_id), '[]'::jsonb) from public.family_members m where m.family_id = text_fixture.family_id),
   'receipts', (select coalesce(jsonb_agg(to_jsonb(r) order by r.request_id), '[]'::jsonb) from public.notebook_sync_receipts r where r.actor_user_id = actor_id)
 ) into before_failure;
 for rejected_case in select item.value from jsonb_array_elements(rejected_cases) item(value) loop
   observed_state := null;
   begin
     perform public.reconcile_notebook_diaries_v1(actor_id, 'reconcile-owner@example.test',
       family_id, person_id, 'cloud-case', rejected_case->'entries', gen_random_uuid());
   exception when invalid_parameter_value or serialization_failure then
     get stacked diagnostics observed_state = returned_sqlstate;
   end;
   if observed_state is distinct from rejected_case->>'state' then
     raise exception 'text rejection failed: % (expected %, got %)',
       rejected_case->>'label', rejected_case->>'state', coalesce(observed_state, 'accepted');
   end if;
   select jsonb_build_object(
     'diaries', (select coalesce(jsonb_agg(to_jsonb(e) order by e.id), '[]'::jsonb) from public.timeline_events e where e.person_id = text_fixture.person_id),
     'person', (select to_jsonb(p) from public.people p where p.id = person_id),
     'tasks', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]'::jsonb) from public.tasks t where t.person_id = text_fixture.person_id),
     'profile', (select to_jsonb(p) from public.profiles p where p.id = actor_id),
     'family', (select to_jsonb(f) from public.families f where f.id = family_id),
     'members', (select coalesce(jsonb_agg(to_jsonb(m) order by m.user_id), '[]'::jsonb) from public.family_members m where m.family_id = text_fixture.family_id),
     'receipts', (select coalesce(jsonb_agg(to_jsonb(r) order by r.request_id), '[]'::jsonb) from public.notebook_sync_receipts r where r.actor_user_id = actor_id)
   ) into after_failure;
   if after_failure is distinct from before_failure then
     raise exception 'rejected text batch partially changed rows or receipts: %', rejected_case->>'label';
   end if;
   if exists (select 1 from public.timeline_events e where e.person_id = text_fixture.person_id
       and e.metadata->>'localDiaryId' = valid_new_entry->>'localDiaryId') then
     raise exception 'rejected batch retained its valid new entry';
   end if;
   rejection_count := rejection_count + 1;
 end loop;
 if success_count <> 4 or rejection_count <> 12 then
   raise exception 'text integrity fixture coverage incomplete';
 end if;
 raise notice 'Notebook reconciliation text integrity: 4 exact-body fixtures, same/fresh retries, 12 atomic rejections passed';
end;
$text_integrity$;
rollback;
