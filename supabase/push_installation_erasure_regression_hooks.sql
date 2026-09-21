-- Disposable-only integration instrumentation for the unchanged existing
-- account_erasure_regression.sql fixtures and real v2 -> v1 executor path.
create schema push_regression;
create sequence push_regression.database_erasure_observed;
create sequence push_regression.completed_erasure_observed;

create function push_regression.seed_profile_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if new.id in ('ac000000-0000-4000-8000-000000000002'::uuid,'ac000000-0000-4000-8000-000000000003'::uuid) then
    r := public.apply_push_installation_operation_v2(new.id, new.id, repeat('a',64), 11, new.id,
      'register', 'ExpoPushToken[executor-' || new.id::text || ']', 'ios');
    if not (r @> '{"ok":true,"revision":11,"state":"active"}') then
      raise exception 'executor integration push fixture failed: %', r;
    end if;
  end if;
  return new;
end;
$$;
create trigger push_regression_seed_profile after insert on public.profiles
  for each row execute function push_regression.seed_profile_push();

create function push_regression.verify_executor_push_erasure()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if new.request_id <> 'ac000000-0000-4000-8000-000000000080'::uuid
    or new.status not in ('database_erased','completed') then return new; end if;
  if not exists (select 1 from push_private.installations
    where id = 'ac000000-0000-4000-8000-000000000002'::uuid
      and revision = 11 and state = 'erased' and owner_id is null and active_revision is null
      and secret_hash is null and request_id is null and request_hash is null and last_error is null) then
    raise exception 'real executor path did not retire minimal installation tombstone';
  end if;
  if exists (select 1 from public.push_tokens where user_id = 'ac000000-0000-4000-8000-000000000002'::uuid
    or installation_id = 'ac000000-0000-4000-8000-000000000002'::uuid) then
    raise exception 'real executor path retained raw token linkage';
  end if;
  if not exists (select 1 from public.list_deliverable_push_tokens_v2(array['ac000000-0000-4000-8000-000000000003'::uuid])
    where installation_id = 'ac000000-0000-4000-8000-000000000003'::uuid and installation_revision = 11) then
    raise exception 'real executor path changed unrelated owner delivery';
  end if;
  r := public.apply_push_installation_operation_v2('ac000000-0000-4000-8000-000000000003'::uuid,
    'ac000000-0000-4000-8000-000000000002'::uuid, repeat('a',64), 12,
    'a1300000-0000-4000-8000-000000000199'::uuid, 'revoke');
  if r->>'error' is distinct from 'installation_retired' then
    raise exception 'real executor tombstone permitted installation replay: %', r;
  end if;
  if new.status = 'database_erased' then
    perform nextval('push_regression.database_erasure_observed');
  else
    perform nextval('push_regression.completed_erasure_observed');
  end if;
  return new;
end;
$$;
create trigger push_regression_verify_executor after update on public.account_erasure_jobs
  for each row execute function push_regression.verify_executor_push_erasure();
