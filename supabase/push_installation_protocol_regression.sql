-- Synthetic-only checks. Run in the disposable database created by the wrapper.
insert into auth.users(id, email) values
  ('a1100000-0000-4000-8000-000000000001', 'push-one@example.test'),
  ('a1100000-0000-4000-8000-000000000002', 'push-two@example.test'),
  ('a1100000-0000-4000-8000-000000000003', 'push-erased@example.test');
insert into public.profiles(id, email) select id, email from auth.users
where id in ('a1100000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000003');

do $test$
declare
  u1 constant uuid := 'a1100000-0000-4000-8000-000000000001';
  u2 constant uuid := 'a1100000-0000-4000-8000-000000000002';
  u3 constant uuid := 'a1100000-0000-4000-8000-000000000003';
  i1 constant uuid := 'a1200000-0000-4000-8000-000000000001';
  i2 constant uuid := 'a1200000-0000-4000-8000-000000000002';
  i3 constant uuid := 'a1200000-0000-4000-8000-000000000003';
  i4 constant uuid := 'a1200000-0000-4000-8000-000000000004';
  i5 constant uuid := 'a1200000-0000-4000-8000-000000000005';
  i6 constant uuid := 'a1200000-0000-4000-8000-000000000006';
  i7 constant uuid := 'a1200000-0000-4000-8000-000000000007';
  q11 constant uuid := 'a1300000-0000-4000-8000-000000000011';
  q12 constant uuid := 'a1300000-0000-4000-8000-000000000012';
  q13 constant uuid := 'a1300000-0000-4000-8000-000000000013';
  q14 constant uuid := 'a1300000-0000-4000-8000-000000000014';
  q15 constant uuid := 'a1300000-0000-4000-8000-000000000015';
  r jsonb;
  original jsonb;
  old_token_id uuid;
  current_token_id uuid;
begin
  if (select count(*) from public.push_tokens where user_id = 'a1100000-0000-4000-8000-000000000004'
      and installation_id is null and installation_revision is null
      and platform = 'ios' and device_name = 'legacy-fixture'
      and created_at = '2026-01-01T00:00:00Z' and updated_at = '2026-01-01T00:00:00Z'
      and ((expo_push_token = 'ExpoPushToken[legacy-active]' and is_active)
        or (expo_push_token = 'ExpoPushToken[legacy-inactive]' and not is_active))) <> 2 then
    raise exception 'migration rewrote existing legacy registrations';
  end if;
  r := public.apply_push_installation_operation_v2(u1, i6, repeat('f',64), 1, q11, 'register', 'ExpoPushToken[legacy-active]', 'ios');
  if r->>'error' is distinct from 'token_conflict' then raise exception 'active legacy token silently adopted: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i6, repeat('f',64), 2, q12, 'register', 'ExpoPushToken[legacy-inactive]', 'ios');
  if r->>'error' is distinct from 'token_conflict' then raise exception 'inactive legacy token silently adopted: %', r; end if;

  r := public.apply_push_installation_operation_v2(u1, i1, repeat('a',64), 11, q11, 'register', 'ExpoPushToken[synthetic-one]', 'ios');
  if not (r @> jsonb_build_object('ok', true, 'installationId', i1, 'revision', 11, 'requestId', q11, 'state', 'active')) then
    raise exception 'initial registration did not return its committed identity: %', r;
  end if;
  original := r;
  r := public.apply_push_installation_operation_v2(u1, i1, repeat('a',64), 11, q11, 'register', 'ExpoPushToken[synthetic-one]', 'ios');
  if r <> original then raise exception 'duplicate registration was not idempotent: %', r; end if;

  r := public.apply_push_installation_operation_v2(u1, i1, repeat('a',64), 11, q11, 'register', 'ExpoPushToken[changed-body]', 'ios');
  if r->>'error' is distinct from 'revision_conflict' then raise exception 'same revision changed body accepted: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i1, repeat('a',64), 11, q12, 'register', 'ExpoPushToken[synthetic-one]', 'ios');
  if r->>'error' is distinct from 'revision_conflict' then raise exception 'same revision changed request accepted: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i1, repeat('b',64), 12, q12, 'revoke');
  if r->>'error' is distinct from 'installation_conflict' then raise exception 'wrong secret accepted: %', r; end if;
  r := public.apply_push_installation_operation_v2(u2, i1, repeat('a',64), 12, q12, 'register', 'ExpoPushToken[takeover]', 'android');
  if r->>'error' is distinct from 'installation_conflict' then raise exception 'active owner takeover accepted: %', r; end if;
  if not exists (select 1 from push_private.installations where id = i1 and owner_id = u1 and revision = 11 and state = 'active') then
    raise exception 'rejected operation changed the live owner or revision';
  end if;

  r := public.apply_push_installation_operation_v2(u1, i1, repeat('a',64), 12, q12, 'revoke');
  if not (r @> '{"ok":true,"revision":12,"state":"revoked"}') then raise exception 'revoke failed: %', r; end if;
  original := r;
  r := public.apply_push_installation_operation_v2(u1, i1, repeat('a',64), 12, q12, 'revoke');
  if r <> original then raise exception 'lost revoke response cannot be retried: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i1, repeat('a',64), 11, q11, 'register', 'ExpoPushToken[synthetic-one]', 'ios');
  if r->>'error' is distinct from 'stale_revision' then raise exception 'delayed register resurrected revocation: %', r; end if;
  if exists (select 1 from public.list_deliverable_push_tokens_v2(array[u1]) where installation_id = i1) then
    raise exception 'revoked installation remained deliverable';
  end if;
  r := public.apply_push_installation_operation_v2(u2, i1, repeat('a',64), 13, q13, 'register', 'ExpoPushToken[synthetic-two]', 'android');
  if not (r @> '{"ok":true,"revision":13,"state":"active"}') then raise exception 'new owner could not rebind revoked installation: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i1, repeat('a',64), 14, q14, 'revoke');
  if r->>'error' is distinct from 'installation_conflict' then raise exception 'old owner revoked rebound installation: %', r; end if;

  r := public.apply_push_installation_operation_v2(u1, i2, repeat('b',64), 12, q12, 'revoke');
  if not (r @> '{"ok":true,"revision":12,"state":"revoked"}') then raise exception 'revoke before first register failed: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i2, repeat('b',64), 11, q11, 'register', 'ExpoPushToken[synthetic-three]', 'ios');
  if r->>'error' is distinct from 'stale_revision' then raise exception 'late first register escaped tombstone: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i2, repeat('b',64), 13, q13, 'register', 'ExpoPushToken[synthetic-three]', 'ios');
  if not (r @> '{"ok":true,"state":"active"}') then raise exception 'newer registration rejected: %', r; end if;
  select id into old_token_id from public.push_tokens where installation_id = i2 and is_active;
  r := public.apply_push_installation_operation_v2(u1, i2, repeat('b',64), 14, q14, 'register', 'ExpoPushToken[synthetic-four]', 'ios');
  if not (r @> '{"ok":true,"revision":14,"state":"active"}') then raise exception 'token rotation failed: %', r; end if;
  perform public.invalidate_push_delivery_v2(old_token_id, 13, 'ExpoPushToken[synthetic-three]');
  if not exists (select 1 from public.list_deliverable_push_tokens_v2(array[u1]) where installation_id = i2 and installation_revision = 14) then
    raise exception 'late old token delivery result invalidated replacement';
  end if;
  select id into current_token_id from public.push_tokens where installation_id = i2 and is_active;
  r := public.apply_push_installation_operation_v2(u1, i2, repeat('b',64), 15, q15, 'register', 'ExpoPushToken[synthetic-four]', 'ios');
  if not (r @> '{"ok":true,"revision":15,"state":"active"}') then raise exception 'same token next revision failed: %', r; end if;
  perform public.invalidate_push_delivery_v2(current_token_id, 14, 'ExpoPushToken[synthetic-four]');
  select id into current_token_id from public.push_tokens where installation_id = i2 and is_active;
  perform public.invalidate_push_delivery_v2(current_token_id, 15, 'ExpoPushToken[wrong-token]');
  if not exists (select 1 from public.list_deliverable_push_tokens_v2(array[u1]) where installation_id = i2 and installation_revision = 15) then
    raise exception 'old generation or mismatched token delivery result invalidated current registration';
  end if;
  perform public.invalidate_push_delivery_v2(current_token_id, 15, 'ExpoPushToken[synthetic-four]');
  if exists (select 1 from public.list_deliverable_push_tokens_v2(array[u1]) where installation_id = i2)
    or not exists (select 1 from push_private.installations where id = i2 and state = 'revoked' and revision = 15) then
    raise exception 'current delivery failure did not revoke precisely its installation';
  end if;

  r := public.apply_push_installation_operation_v2(u1, i3, repeat('c',64), 20, q11, 'register', 'ExpoPushToken[synthetic-two]', 'ios');
  if r->>'error' is distinct from 'token_conflict' then raise exception 'foreign token adopted: %', r; end if;
  original := r;
  r := public.apply_push_installation_operation_v2(u1, i3, repeat('c',64), 20, q11, 'register', 'ExpoPushToken[synthetic-two]', 'ios');
  if r <> original then raise exception 'rejected token claim replay changed result: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i3, repeat('c',64), 19, q12, 'register', 'ExpoPushToken[rejected-older]', 'ios');
  if r->>'error' is distinct from 'stale_revision' then raise exception 'rejected revision did not prevent older replay: %', r; end if;
  if not exists (select 1 from public.list_deliverable_push_tokens_v2(array[u2]) where installation_id = i1 and installation_revision = 13) then
    raise exception 'foreign token conflict damaged original owner';
  end if;

  r := public.apply_push_installation_operation_v2(u1, i7, repeat('7',64), 100, q11, 'register', 'ExpoPushToken[keep-old-generation]', 'ios');
  if not (r @> '{"ok":true,"state":"active"}') then raise exception 'active rejection fixture failed: %', r; end if;
  select id into current_token_id from public.push_tokens where installation_id = i7 and is_active;
  r := public.apply_push_installation_operation_v2(u1, i7, repeat('7',64), 101, q12, 'register', 'ExpoPushToken[synthetic-two]', 'ios');
  if r->>'error' is distinct from 'token_conflict' then raise exception 'existing installation foreign token adopted: %', r; end if;
  original := r;
  r := public.apply_push_installation_operation_v2(u1, i7, repeat('7',64), 101, q12, 'register', 'ExpoPushToken[synthetic-two]', 'ios');
  if r is distinct from original then raise exception 'existing installation rejection replay changed result: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i7, repeat('7',64), 101, q12, 'register', 'ExpoPushToken[changed-rejected-body]', 'ios');
  if r->>'error' is distinct from 'revision_conflict' then raise exception 'rejected revision changed body accepted: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i7, repeat('7',64), 101, q13, 'register', 'ExpoPushToken[synthetic-two]', 'ios');
  if r->>'error' is distinct from 'revision_conflict' then raise exception 'rejected revision changed request accepted: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i7, repeat('7',64), 100, q11, 'register', 'ExpoPushToken[keep-old-generation]', 'ios');
  if r->>'error' is distinct from 'stale_revision' then raise exception 'failed replacement lost attempted revision highwater: %', r; end if;
  if not exists (select 1 from push_private.installations where id = i7 and revision = 101 and active_revision = 100 and state = 'active')
    or not exists (select 1 from public.list_deliverable_push_tokens_v2(array[u1]) where installation_id = i7 and installation_revision = 100) then
    raise exception 'failed replacement removed previously active delivery generation';
  end if;
  perform public.invalidate_push_delivery_v2(current_token_id, 100, 'ExpoPushToken[keep-old-generation]');
  if exists (select 1 from public.list_deliverable_push_tokens_v2(array[u1]) where installation_id = i7)
    or not exists (select 1 from push_private.installations where id = i7 and revision = 101 and active_revision is null and state = 'revoked') then
    raise exception 'actual active delivery failure was ignored after later rejected attempt';
  end if;
  r := public.apply_push_installation_operation_v2(u1, i7, repeat('7',64), 101, q12, 'register', 'ExpoPushToken[synthetic-two]', 'ios');
  if r is distinct from original then raise exception 'delivery failure changed rejection replay result: %', r; end if;
  r := public.apply_push_installation_operation_v2(u1, i7, repeat('7',64), 102, q13, 'register', 'ExpoPushToken[next-valid-generation]', 'ios');
  if not (r @> '{"ok":true,"revision":102,"state":"active"}') then raise exception 'later valid registration could not recover rejected attempt: %', r; end if;

  r := public.apply_push_installation_operation_v2(u3, i4, repeat('d',64), 50, q11, 'register', 'ExpoPushToken[erase-me]', 'ios');
  if not (r @> '{"ok":true}') then raise exception 'erasure registration fixture failed: %', r; end if;
  r := public.apply_push_installation_operation_v2(u3, i5, repeat('e',64), 60, q12, 'revoke');
  if not (r @> '{"ok":true}') then raise exception 'erasure revoke fixture failed: %', r; end if;
  delete from public.profiles where id = u3;
  if exists (select 1 from public.push_tokens where user_id = u3 or expo_push_token = 'ExpoPushToken[erase-me]') then
    raise exception 'profile cascade retained erased raw token';
  end if;
  if (select count(*) from push_private.installations where id in (i4,i5) and state = 'erased'
      and owner_id is null and active_revision is null and secret_hash is null and request_id is null and request_hash is null and last_error is null
      and revision = case when id = i4 then 50 else 60 end) <> 2 then
    raise exception 'erasure did not preserve minimal terminal tombstones';
  end if;
  r := public.apply_push_installation_operation_v2(u2, i4, repeat('d',64), 51, q13, 'register', 'ExpoPushToken[retired-replay]', 'ios');
  if r->>'error' is distinct from 'installation_retired' then raise exception 'erased installation was reusable: %', r; end if;
  r := public.apply_push_installation_operation_v2(u3, i5, repeat('e',64), 61, q13, 'revoke');
  if r->>'error' is distinct from 'profile_unavailable' then raise exception 'deleted profile accepted operation: %', r; end if;
  if not exists (select 1 from public.list_deliverable_push_tokens_v2(array[u2]) where installation_id = i1 and installation_revision = 13) then
    raise exception 'erasure changed another owner registration';
  end if;
end;
$test$;

do $acl$
declare
  role_name text;
  denied boolean;
  r jsonb;
begin
  if not exists (select 1 from pg_class where oid = 'push_private.installations'::regclass and relrowsecurity and relforcerowsecurity) then
    raise exception 'private ledger must enable and force RLS';
  end if;
  foreach role_name in array array['anon','authenticated','service_role'] loop
    if has_schema_privilege(role_name, 'push_private', 'USAGE')
      or has_table_privilege(role_name, 'push_private.installations', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
      or has_function_privilege(role_name, 'push_private.retire_erased_installation()', 'EXECUTE')
      or has_table_privilege(role_name, 'public.push_tokens', 'INSERT,UPDATE,DELETE,TRUNCATE') then
      raise exception 'raw ledger or token mutation capability exposed to %', role_name;
    end if;
    execute format('set local role %I', role_name);
    denied := false;
    begin
      update public.push_tokens set is_active = false where user_id = 'a1100000-0000-4000-8000-000000000002';
    exception when insufficient_privilege then denied := true;
    end;
    execute 'reset role';
    if not denied then raise exception 'direct token DML succeeded for %', role_name; end if;
    execute format('set local role %I', role_name);
    denied := false;
    begin
      perform 1 from push_private.installations;
    exception when insufficient_privilege then denied := true;
    end;
    execute 'reset role';
    if not denied then raise exception 'private ledger read succeeded for %', role_name; end if;
    if role_name <> 'service_role' then
      if has_function_privilege(role_name, 'public.apply_push_installation_operation_v2(uuid,uuid,text,bigint,uuid,text,text,text)', 'EXECUTE')
        or has_function_privilege(role_name, 'public.list_deliverable_push_tokens_v2(uuid[])', 'EXECUTE')
        or has_function_privilege(role_name, 'public.invalidate_push_delivery_v2(uuid,bigint,text)', 'EXECUTE') then
        raise exception 'service RPC capability exposed to %', role_name;
      end if;
      execute format('set local role %I', role_name);
      denied := false;
      begin
        perform public.apply_push_installation_operation_v2('a1100000-0000-4000-8000-000000000001', 'a1200000-0000-4000-8000-000000000099', repeat('f',64), 1, 'a1300000-0000-4000-8000-000000000099', 'revoke');
      exception when insufficient_privilege then denied := true;
      end;
      execute 'reset role';
      if not denied then raise exception 'service RPC invocation succeeded for %', role_name; end if;
    end if;
  end loop;
  set local role service_role;
  r := public.apply_push_installation_operation_v2('a1100000-0000-4000-8000-000000000001', 'a1200000-0000-4000-8000-000000000099', repeat('f',64), 1, 'a1300000-0000-4000-8000-000000000099', 'revoke');
  reset role;
  if not (r @> '{"ok":true,"state":"revoked"}') then raise exception 'authorized service RPC failed: %', r; end if;
end;
$acl$;
