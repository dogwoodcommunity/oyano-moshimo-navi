-- Atomic, family-wide free AI consultation allowance for one JST calendar day.
-- Run after schema.sql/api_grants.sql and before deploying the matching Web API.
--
-- The Web API uses a random token to reserve the allowance before calling the
-- external AI. One transaction inserts the private durable turn and finalizes
-- the token. A failed request releases only its own token. Reservations older than three
-- minutes may be reclaimed; the route itself has a 60 second execution limit,
-- so a live request cannot legitimately overlap that reclaim window.

begin;

create table if not exists public.ai_consult_daily_claims (
  family_id uuid not null references public.families(id) on delete cascade,
  claim_day date not null,
  claim_token uuid not null,
  claimed_by uuid not null,
  person_id uuid not null,
  status text not null default 'reserved',
  reserved_at timestamptz not null default now(),
  completed_at timestamptz,
  turn_id uuid,
  primary key (family_id, claim_day),
  constraint ai_consult_daily_claims_token_unique unique (claim_token),
  constraint ai_consult_daily_claims_status_allowed
    check (status in ('reserved', 'succeeded')),
  constraint ai_consult_daily_claims_completed_state
    check (
      (status = 'reserved' and completed_at is null)
      or (status = 'succeeded' and completed_at is not null)
    )
);

alter table public.ai_consult_daily_claims
  add column if not exists turn_id uuid;

comment on table public.ai_consult_daily_claims is
  'Server-only reservation ledger enforcing one successful free consultation per family and JST calendar day.';

create index if not exists idx_ai_consult_daily_claims_reserved
  on public.ai_consult_daily_claims(status, reserved_at)
  where status = 'reserved';

create unique index if not exists ux_ai_consult_daily_claims_turn_id
  on public.ai_consult_daily_claims(turn_id)
  where turn_id is not null;

alter table public.ai_consult_daily_claims enable row level security;
alter table public.ai_consult_daily_claims force row level security;

create or replace function public.claim_daily_free_consult(
  p_family_id uuid,
  p_person_id uuid,
  p_user_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'Asia/Tokyo')::date;
  v_plan text;
  v_legacy_used_at timestamptz;
  v_existing public.ai_consult_daily_claims%rowtype;
  v_stale_after constant interval := interval '3 minutes';
  v_retry_after integer;
begin
  if p_family_id is null or p_person_id is null or p_user_id is null or p_claim_token is null then
    return jsonb_build_object('result', 'invalid_request');
  end if;

  -- The lock key includes the JST day. The family row lock below also protects
  -- transition from the legacy timestamp-only implementation.
  perform pg_advisory_xact_lock(
    hashtextextended('ai-consult-day:' || p_family_id::text || ':' || v_day::text, 0)
  );

  select plan, consult_trial_used_at
  into v_plan, v_legacy_used_at
  from public.families
  where id = p_family_id
  for update;

  if not found then
    return jsonb_build_object('result', 'not_found');
  end if;

  if not exists (
    select 1
    from public.family_members
    where family_id = p_family_id
      and user_id = p_user_id
      and role in ('owner', 'admin', 'member')
  ) or not exists (
    select 1
    from public.people
    where id = p_person_id
      and family_id = p_family_id
  ) then
    return jsonb_build_object('result', 'forbidden');
  end if;

  if v_plan = 'plus' then
    return jsonb_build_object('result', 'not_applicable');
  end if;

  -- Honor successful uses recorded before this ledger was installed.
  if v_legacy_used_at is not null
     and (v_legacy_used_at at time zone 'Asia/Tokyo')::date = v_day then
    return jsonb_build_object('result', 'already_used', 'claimDay', v_day);
  end if;

  select *
  into v_existing
  from public.ai_consult_daily_claims
  where family_id = p_family_id
    and claim_day = v_day
  for update;

  if found then
    if v_existing.status = 'succeeded' then
      return jsonb_build_object('result', 'already_used', 'claimDay', v_day);
    end if;

    if v_existing.reserved_at > v_now - v_stale_after then
      v_retry_after := greatest(
        1,
        ceil(extract(epoch from (v_existing.reserved_at + v_stale_after - v_now)))::integer
      );
      return jsonb_build_object(
        'result', 'in_progress',
        'claimDay', v_day,
        'retryAfterSeconds', v_retry_after
      );
    end if;

    -- A stale request can be replaced, but its old token can no longer
    -- finalize or release this new reservation.
    update public.ai_consult_daily_claims
    set claim_token = p_claim_token,
        claimed_by = p_user_id,
        person_id = p_person_id,
        status = 'reserved',
        reserved_at = v_now,
        completed_at = null,
        turn_id = null
    where family_id = p_family_id
      and claim_day = v_day;
  else
    insert into public.ai_consult_daily_claims (
      family_id,
      claim_day,
      claim_token,
      claimed_by,
      person_id,
      status,
      reserved_at
    ) values (
      p_family_id,
      v_day,
      p_claim_token,
      p_user_id,
      p_person_id,
      'reserved',
      v_now
    );
  end if;

  return jsonb_build_object('result', 'claimed', 'claimDay', v_day);
end;
$$;

-- Remove the pre-release two-step finalizer if this migration was already
-- tested locally. Leaving it callable would permit a turn insert and allowance
-- finalization to drift apart again.
drop function if exists public.finalize_daily_free_consult(uuid, uuid, uuid);

create or replace function public.persist_and_finalize_daily_free_consult(
  p_family_id uuid,
  p_person_id uuid,
  p_user_id uuid,
  p_thread_id uuid,
  p_claim_token uuid,
  p_redacted_question text,
  p_answer jsonb,
  p_source_event_ids uuid[],
  p_memory_version integer,
  p_consent_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_claim public.ai_consult_daily_claims%rowtype;
  v_now timestamptz := clock_timestamp();
  v_turn_id uuid;
  v_updated integer;
begin
  if p_family_id is null
     or p_person_id is null
     or p_user_id is null
     or p_thread_id is null
     or p_claim_token is null
     or nullif(btrim(p_redacted_question), '') is null
     or length(p_redacted_question) > 600
     or p_answer is null
     or jsonb_typeof(p_answer) <> 'object'
     or p_memory_version is null
     or p_memory_version < 1
     or nullif(btrim(p_consent_version), '') is null then
    return jsonb_build_object('result', 'invalid_request');
  end if;

  select *
  into v_claim
  from public.ai_consult_daily_claims
  where family_id = p_family_id
    and claim_token = p_claim_token
    and claimed_by = p_user_id
  for update;

  if not found then
    return jsonb_build_object('result', 'claim_missing');
  end if;

  if v_claim.person_id <> p_person_id then
    return jsonb_build_object('result', 'forbidden');
  end if;

  -- Recheck all durable privacy boundaries inside the same transaction that
  -- writes the turn. A role downgrade/removal or consent revocation racing the
  -- external response cannot leave private consultation text behind.
  if not exists (
    select 1
    from public.family_members
    where family_id = p_family_id
      and user_id = p_user_id
      and role in ('owner', 'admin', 'member')
  ) or not exists (
    select 1
    from public.people
    where id = p_person_id
      and family_id = p_family_id
  ) or not exists (
    select 1
    from public.ai_consult_threads
    where id = p_thread_id
      and person_id = p_person_id
      and owner_user_id = p_user_id
  ) then
    return jsonb_build_object('result', 'forbidden');
  end if;

  if not exists (
    select 1
    from public.ai_memory_consents
    where person_id = p_person_id
      and user_id = p_user_id
      and consent_version = p_consent_version
      and revoked_at is null
  ) then
    return jsonb_build_object('result', 'memory_consent_required');
  end if;

  -- Idempotent persistence lets the server retry the exact token after an
  -- uncertain network response without inserting another turn.
  if v_claim.status = 'succeeded' then
    if v_claim.turn_id is null then
      return jsonb_build_object('result', 'already_finalized_without_turn');
    end if;
    return jsonb_build_object(
      'result', 'persisted',
      'turnId', v_claim.turn_id,
      'createdAt', v_claim.completed_at,
      'idempotent', true
    );
  end if;

  -- Supabase may install uuid-ossp in extensions, outside this function's
  -- fixed search_path. PostgreSQL's native generator needs no extension.
  v_turn_id := pg_catalog.gen_random_uuid();

  insert into public.ai_consult_turns (
    id,
    thread_id,
    question,
    answer,
    source_event_ids,
    memory_version,
    created_at
  ) values (
    v_turn_id,
    p_thread_id,
    btrim(p_redacted_question),
    p_answer,
    coalesce(p_source_event_ids, '{}'::uuid[]),
    p_memory_version,
    v_now
  );

  update public.ai_consult_threads
  set updated_at = v_now
  where id = p_thread_id
    and person_id = p_person_id
    and owner_user_id = p_user_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'consult_thread_changed_while_persisting';
  end if;

  update public.ai_consult_daily_claims
  set status = 'succeeded',
      completed_at = v_now,
      turn_id = v_turn_id
  where family_id = p_family_id
    and claim_day = v_claim.claim_day
    and claim_token = p_claim_token
    and claimed_by = p_user_id
    and status = 'reserved';

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'consult_claim_changed_while_persisting';
  end if;

  -- Record the reservation time rather than completion time. A request that
  -- begins immediately before midnight belongs to the day it reserved.
  update public.families
  set consult_trial_used_at = v_claim.reserved_at,
      updated_at = v_now
  where id = p_family_id;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'family_missing_while_finalizing';
  end if;

  return jsonb_build_object(
    'result', 'persisted',
    'turnId', v_turn_id,
    'createdAt', v_now,
    'idempotent', false
  );
end;
$$;

create or replace function public.release_daily_free_consult(
  p_family_id uuid,
  p_user_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_deleted integer;
begin
  if p_family_id is null or p_user_id is null or p_claim_token is null then
    return false;
  end if;

  delete from public.ai_consult_daily_claims
  where family_id = p_family_id
    and claim_token = p_claim_token
    and claimed_by = p_user_id
    and status = 'reserved';

  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$$;

revoke all on table public.ai_consult_daily_claims from public, anon, authenticated, service_role;
revoke all on function public.claim_daily_free_consult(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.persist_and_finalize_daily_free_consult(uuid, uuid, uuid, uuid, uuid, text, jsonb, uuid[], integer, text) from public, anon, authenticated;
revoke all on function public.release_daily_free_consult(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_daily_free_consult(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.persist_and_finalize_daily_free_consult(uuid, uuid, uuid, uuid, uuid, text, jsonb, uuid[], integer, text) to service_role;
grant execute on function public.release_daily_free_consult(uuid, uuid, uuid) to service_role;

commit;
