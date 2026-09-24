-- TEST ONLY: disposable PostgreSQL, never production. All rows are rolled back.
-- Run after both migration orders and after repairing legacy explicit grants.
begin;

do $rate_acl$
begin
  if has_function_privilege('anon', 'public.check_public_api_rate_limit(text,integer,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.check_public_api_rate_limit(text,integer,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.check_public_api_rate_limit(text,integer,integer)', 'EXECUTE') then
    raise exception 'public rate limiter must be executable only by service_role';
  end if;
end;
$rate_acl$;

-- Both attack keys are deliberately known to clients. A one-second window
-- would reset these exhausted daily counters if direct RPC access were open.
insert into public.public_api_rate_limits (key, window_start, request_count, updated_at)
values
  ('consult-guest:service', now() - interval '1 hour', 50, now() - interval '1 hour'),
  ('consult:service', now() - interval '1 hour', 100, now() - interval '1 hour'),
  ('synthetic-rate:expired', now() - interval '2 days', 99, now() - interval '2 days');

set local role anon;
do $anonymous_denial$
declare
  v_key text;
begin
  foreach v_key in array array['consult-guest:service', 'consult:service'] loop
    begin
      perform public.check_public_api_rate_limit(v_key, 1000000, 1);
      raise exception 'unauthenticated client reset shared rate counter';
    exception when insufficient_privilege then
      null;
    end;
  end loop;
end;
$anonymous_denial$;
reset role;

-- Anonymous Supabase sessions use authenticated, not the anon database role.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","is_anonymous":true}';
do $guest_denial$
declare
  v_key text;
begin
  foreach v_key in array array['consult-guest:service', 'consult:service'] loop
    begin
      perform public.check_public_api_rate_limit(v_key, 1000000, 1);
      raise exception 'guest reset shared rate counter';
    exception when insufficient_privilege then
      null;
    end;
  end loop;
end;
$guest_denial$;
reset role;

do $unchanged_attack_counters$
begin
  if not exists (
    select 1 from public.public_api_rate_limits
    where key = 'consult-guest:service' and request_count = 50
      and window_start = now() - interval '1 hour'
  ) or not exists (
    select 1 from public.public_api_rate_limits
    where key = 'consult:service' and request_count = 100
      and window_start = now() - interval '1 hour'
  ) then
    raise exception 'denied calls changed existing rate counters';
  end if;
end;
$unchanged_attack_counters$;

set local role service_role;
do $service_behavior$
declare
  v_result jsonb;
  v_call integer;
begin
  for v_call in 1..4 loop
    v_result := public.check_public_api_rate_limit('synthetic-rate:fresh', 3, 86400);
    if (v_result->>'allowed')::boolean is distinct from (v_call <= 3)
       or (v_result->>'remaining')::integer is distinct from greatest(3 - v_call, 0)
       or (v_result->>'limit')::integer is distinct from 3
       or (v_result->>'retry_after')::integer is distinct from (case when v_call <= 3 then 0 else 86400 end) then
      raise exception 'service rate counting changed at request %: %', v_call, v_result;
    end if;
  end loop;

  v_result := public.check_public_api_rate_limit('synthetic-rate:expired', 3, 86400);
  if (v_result->>'allowed')::boolean is distinct from true
     or (v_result->>'remaining')::integer is distinct from 2
     or (v_result->>'retry_after')::integer is distinct from 0 then
    raise exception 'expired service rate window did not reset: %', v_result;
  end if;

  v_result := public.check_public_api_rate_limit('consult-guest:service', 50, 86400);
  if (v_result->>'allowed')::boolean is distinct from false
     or (v_result->>'remaining')::integer is distinct from 0
     or (v_result->>'retry_after')::integer is distinct from 82800 then
    raise exception 'existing exhausted guest window changed: %', v_result;
  end if;
end;
$service_behavior$;
reset role;

rollback;
select 'PUBLIC_API_RATE_LIMITS_ACL_AND_BEHAVIOR_PASS' as result;
