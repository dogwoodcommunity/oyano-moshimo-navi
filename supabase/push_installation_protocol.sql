-- Apply only after the legacy-token inventory/release review. Never rewrites
-- existing tokens. Duplicate active physical tokens abort the whole migration.
begin;

create schema if not exists push_private authorization postgres;
revoke all on schema push_private from public, anon, authenticated, service_role;

create table if not exists push_private.installations (
  id uuid primary key,
  secret_hash text,
  revision bigint not null check (revision between 1 and 9007199254740991),
  active_revision bigint,
  owner_id uuid references public.profiles(id) on delete set null,
  state text not null check (state in ('active', 'revoked', 'erased')),
  request_id uuid,
  request_hash text,
  last_error text,
  check (state = 'erased' or (owner_id is not null and secret_hash is not null))
);
alter table push_private.installations enable row level security;
alter table push_private.installations force row level security;
revoke all on all tables in schema push_private from public, anon, authenticated, service_role;

alter table public.push_tokens add column if not exists installation_id uuid references push_private.installations(id);
alter table public.push_tokens add column if not exists installation_revision bigint;
create unique index if not exists push_tokens_active_physical_unique
  on public.push_tokens(expo_push_token) where is_active = true;
create unique index if not exists push_tokens_active_installation_unique
  on public.push_tokens(installation_id) where is_active = true and installation_id is not null;

-- FK SET NULL invokes this on account erasure. No owner, token, secret or
-- request fingerprint remains in the irreversible installation tombstone.
create or replace function push_private.retire_erased_installation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.owner_id is not null and new.owner_id is null then
    new.state := 'erased';
    new.active_revision := null;
    new.secret_hash := null;
    new.request_id := null;
    new.request_hash := null;
    new.last_error := null;
  end if;
  return new;
end;
$$;
drop trigger if exists retire_erased_push_installation on push_private.installations;
create trigger retire_erased_push_installation before update of owner_id on push_private.installations
  for each row execute function push_private.retire_erased_installation();

create or replace function public.apply_push_installation_operation_v2(
  p_user_id uuid, p_installation_id uuid, p_secret text, p_revision bigint,
  p_request_id uuid, p_action text, p_token text default null, p_platform text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row push_private.installations%rowtype;
  v_hash text;
  v_initial boolean;
begin
  if p_user_id is null or p_installation_id is null or p_request_id is null
    or p_secret is null or p_secret !~ '^[a-f0-9]{64}$'
    or p_revision is null or p_revision not between 1 and 9007199254740991
    or p_action is null or p_action not in ('register', 'revoke')
    or (p_action = 'register' and (p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{1,255}[A-Za-z0-9_-]?\]$' or p_platform is null or p_platform not in ('ios', 'android')))
    or (p_action = 'revoke' and (p_token is not null or p_platform is not null)) then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;
  -- Same lock order as profile deletion: profile first, installation second.
  -- A bearer verified before deletion cannot recreate a deleted profile here.
  perform pg_advisory_xact_lock(hashtextextended('account-erasure-target:' || p_user_id::text, 0));
  perform 1 from public.profiles where id = p_user_id for key share;
  if not found then return jsonb_build_object('ok', false, 'error', 'profile_unavailable'); end if;
  v_hash := encode(sha256(convert_to(jsonb_build_array(p_user_id, p_action, p_token, p_platform)::text, 'UTF8')), 'hex');
  -- Insert a revoked tombstone even when revoke arrives before the first
  -- register. The secret and owner are checked again under the row lock.
  insert into push_private.installations(id, secret_hash, revision, owner_id, state, request_id, request_hash)
    values (p_installation_id, encode(sha256(convert_to(p_secret, 'UTF8')), 'hex'), p_revision, p_user_id, 'revoked', p_request_id, v_hash)
    on conflict (id) do nothing;
  v_initial := found;
  select * into v_row from push_private.installations where id = p_installation_id for update;
  if v_row.state = 'erased' then return jsonb_build_object('ok', false, 'error', 'installation_retired'); end if;
  if v_row.secret_hash <> encode(sha256(convert_to(p_secret, 'UTF8')), 'hex') then
    return jsonb_build_object('ok', false, 'error', 'installation_conflict');
  end if;
  if v_row.owner_id <> p_user_id and v_row.state <> 'revoked' then
    return jsonb_build_object('ok', false, 'error', 'installation_conflict');
  end if;
  if not v_initial and p_revision < v_row.revision then
    return jsonb_build_object('ok', false, 'error', 'stale_revision');
  end if;
  if not v_initial and p_revision = v_row.revision then
    if v_row.request_id <> p_request_id or v_row.request_hash <> v_hash or v_row.owner_id <> p_user_id then
      return jsonb_build_object('ok', false, 'error', 'revision_conflict');
    end if;
    if v_row.last_error is not null then return jsonb_build_object('ok', false, 'error', v_row.last_error); end if;
    return jsonb_build_object('ok', true, 'installationId', v_row.id, 'revision', v_row.revision,
      'requestId', v_row.request_id, 'state', v_row.state);
  end if;
  if p_action = 'register' then
    -- Serialize different installations trying to claim the same token.
    perform pg_advisory_xact_lock(hashtextextended('push-token:' || p_token, 0));
    if exists (select 1 from public.push_tokens where expo_push_token = p_token
      and installation_id is distinct from p_installation_id) then
      -- Even an inactive legacy/foreign token is never silently adopted.
      -- Remember every attempted revision without disabling an older active
      -- delivery generation. Retrying a rejected revision cannot change body.
      update push_private.installations set owner_id = p_user_id, revision = p_revision,
        request_id = p_request_id, request_hash = v_hash, last_error = 'token_conflict' where id = p_installation_id;
      return jsonb_build_object('ok', false, 'error', 'token_conflict');
    end if;
  end if;
  -- Managed registration rows are not an identity history. Remove only this
  -- actor's v2 rows on revoke/rotation; never touch a legacy or other-owner row.
  -- The private revision tombstone, not a retained raw token, blocks replay.
  delete from public.push_tokens where installation_id = p_installation_id and user_id = p_user_id;
  if p_action = 'register' then
    insert into public.push_tokens(user_id, expo_push_token, platform, device_name, is_active, installation_id, installation_revision, updated_at)
      values (p_user_id, p_token, p_platform, p_platform, true, p_installation_id, p_revision, now())
      on conflict (user_id, expo_push_token) do update set
        platform = excluded.platform, is_active = true, installation_id = excluded.installation_id,
        installation_revision = excluded.installation_revision, updated_at = excluded.updated_at;
  end if;
  update push_private.installations set owner_id = p_user_id, revision = p_revision,
    active_revision = case when p_action = 'register' then p_revision else null end,
    state = case when p_action = 'register' then 'active' else 'revoked' end,
    request_id = p_request_id, request_hash = v_hash, last_error = null where id = p_installation_id
    returning * into v_row;
  return jsonb_build_object('ok', true, 'installationId', v_row.id, 'revision', v_row.revision,
    'requestId', v_row.request_id, 'state', v_row.state);
end;
$$;

create or replace function public.list_deliverable_push_tokens_v2(p_user_ids uuid[])
returns table(id uuid, user_id uuid, expo_push_token text, installation_id uuid, installation_revision bigint)
language sql stable security definer set search_path = '' as $$
  select t.id, t.user_id, t.expo_push_token, t.installation_id, t.installation_revision
  from public.push_tokens t left join push_private.installations i on i.id = t.installation_id
  where t.user_id = any(p_user_ids) and t.is_active = true
    and (t.installation_id is null or (i.owner_id = t.user_id and i.state = 'active' and i.active_revision = t.installation_revision));
$$;

create or replace function public.invalidate_push_delivery_v2(p_id uuid, p_revision bigint, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_installation uuid; v_user uuid;
begin
  select installation_id, user_id into v_installation, v_user from public.push_tokens where id = p_id;
  if not found then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('account-erasure-target:' || v_user::text, 0));
  if v_installation is not null then
    perform 1 from push_private.installations where id = v_installation for update;
  end if;
  if v_installation is null then
    update public.push_tokens set is_active = false, updated_at = now()
      where id = p_id and expo_push_token = p_token and installation_id is null and p_revision is null;
  else
    delete from public.push_tokens where id = p_id and expo_push_token = p_token and installation_revision = p_revision;
    if found then
      update push_private.installations set state = 'revoked', active_revision = null where id = v_installation and active_revision = p_revision;
    end if;
  end if;
end;
$$;

drop policy if exists "push_tokens own" on public.push_tokens;
drop policy if exists "push_tokens own read" on public.push_tokens;
create policy "push_tokens own read" on public.push_tokens for select using (user_id = auth.uid());
revoke insert, update, delete, truncate, references, trigger on public.push_tokens from public, anon, authenticated, service_role;
revoke all on function public.apply_push_installation_operation_v2(uuid,uuid,text,bigint,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.list_deliverable_push_tokens_v2(uuid[]) from public, anon, authenticated;
revoke all on function public.invalidate_push_delivery_v2(uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.apply_push_installation_operation_v2(uuid,uuid,text,bigint,uuid,text,text,text) to service_role;
grant execute on function public.list_deliverable_push_tokens_v2(uuid[]) to service_role;
grant execute on function public.invalidate_push_delivery_v2(uuid,bigint,text) to service_role;
revoke all on all functions in schema push_private from public, anon, authenticated, service_role;
alter table push_private.installations owner to postgres;
alter function push_private.retire_erased_installation() owner to postgres;
alter function public.apply_push_installation_operation_v2(uuid,uuid,text,bigint,uuid,text,text,text) owner to postgres;
alter function public.list_deliverable_push_tokens_v2(uuid[]) owner to postgres;
alter function public.invalidate_push_delivery_v2(uuid,bigint,text) owner to postgres;
commit;
