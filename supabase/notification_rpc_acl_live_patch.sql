-- REVIEW CANDIDATE ONLY. Do not apply without a separate production change approval.
-- The hashes below describe the READ ONLY 2026-09-24 observation. This script
-- changes EXECUTE ACL only; any changed body, owner, signature or inherited
-- grant fails the transaction instead of guessing which caller is safe.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '15s';

do $notification_rpc_acl_patch$
declare
  target record;
  actual record;
begin
  for target in
    select * from (values
      ('public.claim_due_scheduled_notifications(integer)', '169ff1b8efe60179327d36ea999f46f6'),
      ('public.reset_stale_sending_notifications(interval)', '7105328bfc4ddb697b634660666f90b2')
    ) as expected(signature, body_md5)
  loop
    select p.oid, p.prosecdef, p.prokind, pg_get_userbyid(p.proowner) as owner_name,
      md5(pg_get_functiondef(p.oid)) as body_md5
      into actual
      from pg_proc p
      where p.oid = to_regprocedure(target.signature);
    if actual.oid is null or actual.owner_name <> 'postgres'
      or actual.prosecdef is not true or actual.prokind <> 'f'
      or actual.body_md5 <> target.body_md5
      or not has_function_privilege('service_role', actual.oid, 'EXECUTE') then
      raise exception 'notification_rpc_acl_preflight_mismatch:%', target.signature;
    end if;
    execute format('revoke all on function %s from public, anon, authenticated', target.signature);
    execute format('grant execute on function %s to service_role', target.signature);
    if has_function_privilege('anon', actual.oid, 'EXECUTE')
      or has_function_privilege('authenticated', actual.oid, 'EXECUTE')
      or not has_function_privilege('service_role', actual.oid, 'EXECUTE')
      or (select md5(pg_get_functiondef(p.oid)) from pg_proc p where p.oid = actual.oid) <> target.body_md5 then
      raise exception 'notification_rpc_acl_postcheck_mismatch:%', target.signature;
    end if;
  end loop;
end;
$notification_rpc_acl_patch$;
commit;
