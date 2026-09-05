-- Append-only resolution of two independently created notebooks for one person.
-- Apply AFTER schema.sql, production_rls.sql, notebook_atomic_sync_v2.sql,
-- notebook_diary_delete.sql and notebook_person_delete.sql.
-- This forward migration adds one service-role-only wrapper. It does not alter
-- sync_notebook_v2, existing people, diary contents, ACLs or deletion receipts.
-- The Web API must first verify the user's access token and confirmed email.

begin;

do $$
begin
  if to_regprocedure('public.sync_notebook_v2(uuid,text,uuid,boolean,jsonb,jsonb,uuid)') is null
     or to_regclass('public.notebook_diary_deletion_receipts') is null
     or to_regclass('public.person_notebook_deletion_receipts') is null
     or to_regclass('public.ux_people_family_local_case_id') is null then
    raise exception 'notebook_reconciliation_required_migrations_missing';
  end if;
end;
$$;

create or replace function public.reconcile_notebook_diaries_v1(
  p_actor_user_id uuid,
  p_actor_email text,
  p_family_id uuid,
  p_person_id uuid,
  p_target_case_id text,
  p_diary_entries jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, public, pg_temp
as $$
declare
  v_claim_role text;
  v_verified_email text;
  v_role text;
  v_person_id uuid;
  v_entry jsonb;
  v_entry_id text;
  v_seen jsonb := '{}'::jsonb;
  v_result jsonb;
begin
  -- Follow v2's service-role boundary; never elevate or rewrite JWT claims.
  -- No caller-supplied identity is trusted from an authenticated/anon session.
  v_claim_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}'::text)::jsonb)->>'role',
    ''
  );
  if v_claim_role <> 'service_role' then
    raise exception using errcode = '42501', message = 'notebook_reconciliation_service_role_required';
  end if;
  if p_actor_user_id is null or p_family_id is null or p_person_id is null or p_request_id is null
     or p_target_case_id is null or p_target_case_id <> btrim(p_target_case_id)
     or length(p_target_case_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'notebook_reconciliation_invalid_identity';
  end if;

  -- The API has verified the token. Recheck that this actor still exists and
  -- that the currently confirmed Auth email is the one supplied by that API.
  select lower(btrim(u.email)) into v_verified_email
  from auth.users u
  where u.id = p_actor_user_id
    and u.email_confirmed_at is not null
    and nullif(btrim(u.email), '') is not null;
  if not found or v_verified_email is distinct from lower(nullif(btrim(p_actor_email), '')) then
    raise exception using errcode = '42501', message = 'notebook_reconciliation_actor_verification_required';
  end if;

  if jsonb_typeof(p_diary_entries) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'notebook_reconciliation_invalid_entries';
  end if;
  if jsonb_array_length(p_diary_entries) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'notebook_reconciliation_invalid_entries';
  end if;
  for v_entry in select item.value from jsonb_array_elements(p_diary_entries) item(value)
  loop
    if jsonb_typeof(v_entry) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'notebook_reconciliation_invalid_entry';
    end if;
    -- Accept only the API's normalized, text-only, unbound diary copies. In
    -- particular, no person/task/profile mutations or client CAS token enter v2.
    if exists (
      select 1 from jsonb_object_keys(v_entry) entry_key(name)
      where name not in ('localCaseId', 'localDiaryId', 'cloudRevision', 'cloudHash',
        'date', 'title', 'body', 'mood', 'attachments', 'metadata', 'createdAt', 'updatedAt')
    ) or jsonb_typeof(v_entry->'localCaseId') is distinct from 'string'
      or v_entry->>'localCaseId' is distinct from p_target_case_id
      or jsonb_typeof(v_entry->'localDiaryId') is distinct from 'string'
      or coalesce(v_entry->>'localDiaryId', '') !~ '^reconciled_[0-9a-f]{64}$'
      or v_entry->'cloudRevision' is distinct from 'null'::jsonb
      or v_entry->'cloudHash' is distinct from 'null'::jsonb
      or v_entry->'attachments' is distinct from '[]'::jsonb
      or v_entry->'metadata' is distinct from '{"source":"pwa-notebook"}'::jsonb
      or jsonb_typeof(v_entry->'body') is distinct from 'string'
      or length(btrim(v_entry->>'body')) < 1 or length(v_entry->>'body') > 10000
      or jsonb_typeof(v_entry->'date') is distinct from 'string'
      or coalesce(v_entry->>'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or jsonb_typeof(v_entry->'mood') is distinct from 'string'
      or coalesce(v_entry->>'mood', '') not in ('stable', 'changed', 'urgent')
      or jsonb_typeof(v_entry->'title') is distinct from 'string'
      or v_entry->>'title' is distinct from (case v_entry->>'mood'
        when 'urgent' then '急ぎの記録' when 'changed' then '変化の記録' else '日々の記録' end)
      or jsonb_typeof(v_entry->'createdAt') is distinct from 'string'
      or jsonb_typeof(v_entry->'updatedAt') is distinct from 'string'
      or coalesce(v_entry->>'createdAt', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$'
      or coalesce(v_entry->>'updatedAt', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]([.][0-9]{1,3})?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$' then
      raise exception using errcode = '22023', message = 'notebook_reconciliation_invalid_entry';
    end if;
    -- Casts reject impossible dates/timestamps before any writes. Keep the
    -- caller's original strings; v2's hashes use these exact preserved values.
    perform (v_entry->>'date')::date;
    perform (v_entry->>'createdAt')::timestamptz;
    perform (v_entry->>'updatedAt')::timestamptz;
    v_entry_id := v_entry->>'localDiaryId';
    if v_seen ? v_entry_id then
      raise exception using errcode = '22023', message = 'notebook_reconciliation_duplicate_entry';
    end if;
    v_seen := v_seen || jsonb_build_object(v_entry_id, true);
  end loop;

  -- Match v2's lock order exactly. In particular, do not take a person/family
  -- lock before profiles: another ordinary sync can already hold that row.
  -- Reentrant advisory/row locks remain held throughout the nested v2 call.
  perform pg_advisory_xact_lock(
    hashtextextended('notebook-sync-request:' || p_actor_user_id::text || ':' || p_request_id::text, 0)
  );
  insert into public.profiles (id, email, display_name, updated_at)
  values (p_actor_user_id, v_verified_email, coalesce(split_part(v_verified_email, '@', 1), '利用者'), now())
  on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email), updated_at = excluded.updated_at;

  perform pg_advisory_xact_lock(hashtextextended('notebook-family:' || p_family_id::text, 0));
  select fm.role into v_role
  from public.family_members fm
  join public.families f on f.id = fm.family_id
  where fm.family_id = p_family_id and fm.user_id = p_actor_user_id
  for update of fm, f;
  if not found then
    raise exception using errcode = '42501', message = 'notebook_reconciliation_family_membership_required';
  end if;
  if v_role not in ('owner', 'admin', 'member') then
    raise exception using errcode = '42501', message = 'notebook_reconciliation_viewer_cannot_mutate';
  end if;

  -- This is the TOCTOU boundary: identity is checked AND locked in the same
  -- transaction that appends. Direct deletes/rebindings cannot replace this
  -- UUID between the check and v2's localCaseId lookup, even outside its lock.
  select p.id into v_person_id
  from public.people p
  where p.id = p_person_id and p.family_id = p_family_id
    and p.profile->>'localCaseId' = p_target_case_id
  for update;
  if not found then
    raise exception using errcode = '40001', message = 'notebook_reconciliation_person_not_found';
  end if;
  if exists (
    select 1 from public.person_notebook_deletion_receipts receipt
    where receipt.family_id = p_family_id and receipt.local_case_id = p_target_case_id
  ) then
    raise exception using errcode = '40001', message = 'notebook_reconciliation_person_deleted';
  end if;

  v_result := public.sync_notebook_v2(
    p_actor_user_id, v_verified_email, p_family_id, false,
    '[]'::jsonb, p_diary_entries, p_request_id
  );
  -- Also refuse an old request receipt for a physically replaced UUID. v2's
  -- payload identity is family/localCaseId, while this endpoint binds the UUID.
  if (select count(*) from public.timeline_events event
      where event.person_id = p_person_id
        and event.metadata->>'localCaseId' = p_target_case_id
        and v_seen ? (event.metadata->>'localDiaryId')) <> jsonb_array_length(p_diary_entries) then
    raise exception using errcode = '40001', message = 'notebook_reconciliation_person_binding_conflict';
  end if;
  return v_result || jsonb_build_object('personId', v_person_id, 'targetCaseId', p_target_case_id);
end;
$$;

comment on function public.reconcile_notebook_diaries_v1(uuid, text, uuid, uuid, text, jsonb, uuid) is
  'Service role only. Append text-only diary copies after verified actor/editor and exact person identity checks under transaction locks; never changes target profiles/tasks.';

revoke all on function public.reconcile_notebook_diaries_v1(uuid, text, uuid, uuid, text, jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reconcile_notebook_diaries_v1(uuid, text, uuid, uuid, text, jsonb, uuid)
  to service_role;

commit;
