-- Run only on a disposable database after the notification RPCs and api_grants.
-- This reads privileges and never calls the mutating RPCs.
do $check_notification_rpc_acl$
declare
  rpc regprocedure;
  reader_role text;
begin
  foreach rpc in array array[
    'public.claim_due_scheduled_notifications(integer)'::regprocedure,
    'public.reset_stale_sending_notifications(interval)'::regprocedure
  ] loop
    foreach reader_role in array array['anon', 'authenticated'] loop
      if has_function_privilege(reader_role, rpc, 'EXECUTE') then
        raise exception 'notification rpc executable by %', reader_role;
      end if;
    end loop;
    if not has_function_privilege('service_role', rpc, 'EXECUTE') then
      raise exception 'notification rpc unavailable to cron role';
    end if;
  end loop;
end;
$check_notification_rpc_acl$;
