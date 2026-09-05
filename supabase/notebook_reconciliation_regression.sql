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
rollback;
