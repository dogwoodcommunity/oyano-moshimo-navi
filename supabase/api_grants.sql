-- API role grants for Supabase/PostgREST.
-- Run after schema.sql and before production verification.
-- RLS still controls anon/authenticated access; these grants only allow the API roles
-- to reach the tables/functions that policies then restrict.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select, update on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

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
end;
$server_only_rpc_acl$;
