-- Behavioral and ACL regression for consult_daily_claim.sql.
-- Run only in a disposable PostgreSQL database. Everything is rolled back.

begin;

insert into auth.users (id, email)
values
  ('fa000000-0000-4000-8000-000000000001', 'daily-owner-a@example.test'),
  ('fa000000-0000-4000-8000-000000000002', 'daily-outsider@example.test'),
  ('fa000000-0000-4000-8000-000000000003', 'daily-owner-b@example.test'),
  ('fa000000-0000-4000-8000-000000000004', 'daily-owner-c@example.test'),
  ('fa000000-0000-4000-8000-000000000005', 'daily-viewer@example.test');

insert into public.profiles (id, email, display_name)
values
  ('fa000000-0000-4000-8000-000000000001', 'daily-owner-a@example.test', 'Daily owner A'),
  ('fa000000-0000-4000-8000-000000000002', 'daily-outsider@example.test', 'Daily outsider'),
  ('fa000000-0000-4000-8000-000000000003', 'daily-owner-b@example.test', 'Daily owner B'),
  ('fa000000-0000-4000-8000-000000000004', 'daily-owner-c@example.test', 'Daily owner C'),
  ('fa000000-0000-4000-8000-000000000005', 'daily-viewer@example.test', 'Daily viewer');

insert into public.families (id, name, owner_user_id, plan, consult_trial_used_at)
values
  ('fa000000-0000-4000-8000-000000000010', 'Daily free A', 'fa000000-0000-4000-8000-000000000001', 'free', null),
  ('fa000000-0000-4000-8000-000000000011', 'Daily free B', 'fa000000-0000-4000-8000-000000000003', 'free', null),
  ('fa000000-0000-4000-8000-000000000012', 'Daily plus C', 'fa000000-0000-4000-8000-000000000004', 'plus', null),
  (
    'fa000000-0000-4000-8000-000000000013',
    'Legacy used today',
    'fa000000-0000-4000-8000-000000000004',
    'free',
    now()
  );

insert into public.family_members (family_id, user_id, role)
values
  ('fa000000-0000-4000-8000-000000000010', 'fa000000-0000-4000-8000-000000000001', 'owner'),
  ('fa000000-0000-4000-8000-000000000010', 'fa000000-0000-4000-8000-000000000005', 'viewer'),
  ('fa000000-0000-4000-8000-000000000011', 'fa000000-0000-4000-8000-000000000003', 'owner'),
  ('fa000000-0000-4000-8000-000000000012', 'fa000000-0000-4000-8000-000000000004', 'owner'),
  ('fa000000-0000-4000-8000-000000000013', 'fa000000-0000-4000-8000-000000000004', 'owner');

insert into public.people (id, family_id, display_name)
values
  ('fa000000-0000-4000-8000-000000000020', 'fa000000-0000-4000-8000-000000000010', 'Parent A'),
  ('fa000000-0000-4000-8000-000000000021', 'fa000000-0000-4000-8000-000000000011', 'Parent B'),
  ('fa000000-0000-4000-8000-000000000022', 'fa000000-0000-4000-8000-000000000012', 'Parent C'),
  ('fa000000-0000-4000-8000-000000000023', 'fa000000-0000-4000-8000-000000000013', 'Parent legacy');

insert into public.ai_consult_threads (id, person_id, owner_user_id)
values
  ('fa000000-0000-4000-8000-000000000030', 'fa000000-0000-4000-8000-000000000020', 'fa000000-0000-4000-8000-000000000001'),
  ('fa000000-0000-4000-8000-000000000031', 'fa000000-0000-4000-8000-000000000021', 'fa000000-0000-4000-8000-000000000003'),
  ('fa000000-0000-4000-8000-000000000032', 'fa000000-0000-4000-8000-000000000022', 'fa000000-0000-4000-8000-000000000004');

insert into public.ai_memory_consents (person_id, user_id, consent_version)
values
  ('fa000000-0000-4000-8000-000000000020', 'fa000000-0000-4000-8000-000000000001', 'consult-memory-v02-2026-09-01'),
  ('fa000000-0000-4000-8000-000000000021', 'fa000000-0000-4000-8000-000000000003', 'consult-memory-v02-2026-09-01'),
  ('fa000000-0000-4000-8000-000000000022', 'fa000000-0000-4000-8000-000000000004', 'consult-memory-v02-2026-09-01');

do $regression$
declare
  v_result jsonb;
  v_turn_id uuid;
begin
  if has_table_privilege('anon', 'public.ai_consult_daily_claims', 'SELECT')
     or has_table_privilege('authenticated', 'public.ai_consult_daily_claims', 'SELECT')
     or has_table_privilege('service_role', 'public.ai_consult_daily_claims', 'SELECT') then
    raise exception 'claim ledger must not be directly readable by API roles';
  end if;

  if has_function_privilege('anon', 'public.claim_daily_free_consult(uuid,uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.claim_daily_free_consult(uuid,uuid,uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.claim_daily_free_consult(uuid,uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'claim RPC ACL is incorrect';
  end if;

  if has_function_privilege('anon', 'public.persist_and_finalize_daily_free_consult(uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid[],integer,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.persist_and_finalize_daily_free_consult(uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid[],integer,text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.persist_and_finalize_daily_free_consult(uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid[],integer,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.release_daily_free_consult(uuid,uuid,uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.release_daily_free_consult(uuid,uuid,uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.release_daily_free_consult(uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'atomic persist/release RPC ACL is incorrect';
  end if;

  if to_regprocedure('public.finalize_daily_free_consult(uuid,uuid,uuid)') is not null then
    raise exception 'unsafe two-step finalizer must be removed';
  end if;

  if not coalesce((
    select relrowsecurity and relforcerowsecurity
    from pg_class
    where oid = 'public.ai_consult_daily_claims'::regclass
  ), false) then
    raise exception 'claim ledger must have forced RLS';
  end if;

  v_result := public.claim_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000020',
    'fa000000-0000-4000-8000-000000000005',
    'fa000000-0000-4000-8000-000000000100'
  );
  if v_result->>'result' <> 'forbidden' then
    raise exception 'viewer must not consume or write a family consultation: %', v_result;
  end if;

  v_result := public.claim_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000020',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000101'
  );
  if v_result->>'result' <> 'claimed' then
    raise exception 'first claim should succeed: %', v_result;
  end if;

  v_result := public.claim_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000020',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000102'
  );
  if v_result->>'result' <> 'in_progress'
     or coalesce((v_result->>'retryAfterSeconds')::integer, 0) <= 0 then
    raise exception 'parallel claim should be blocked: %', v_result;
  end if;

  if public.release_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000102'
  ) then
    raise exception 'another request token must not release the reservation';
  end if;

  if not public.release_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000101'
  ) then
    raise exception 'own failed reservation should be releasable';
  end if;

  v_result := public.claim_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000020',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000102'
  );
  if v_result->>'result' <> 'claimed' then
    raise exception 'released reservation should be retryable: %', v_result;
  end if;

  v_result := public.persist_and_finalize_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000020',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000031',
    'fa000000-0000-4000-8000-000000000102',
    '伏字済みの相談文',
    '{"situation":"整理しました"}'::jsonb,
    '{}'::uuid[],
    1,
    'consult-memory-v02-2026-09-01'
  );
  if v_result->>'result' <> 'forbidden' then
    raise exception 'thread from another person/family must be rejected: %', v_result;
  end if;
  if (select status from public.ai_consult_daily_claims where family_id = 'fa000000-0000-4000-8000-000000000010') <> 'reserved'
     or (select count(*) from public.ai_consult_turns where thread_id = 'fa000000-0000-4000-8000-000000000030') <> 0 then
    raise exception 'failed atomic validation must leave both claim and turns unchanged';
  end if;

  v_result := public.persist_and_finalize_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000020',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000030',
    'fa000000-0000-4000-8000-000000000102',
    '伏字済みの相談文',
    '{"situation":"整理しました"}'::jsonb,
    '{}'::uuid[],
    1,
    'consult-memory-v02-2026-09-01'
  );
  if v_result->>'result' <> 'persisted' or coalesce((v_result->>'idempotent')::boolean, true) then
    raise exception 'atomic first persistence must succeed: %', v_result;
  end if;
  v_turn_id := (v_result->>'turnId')::uuid;

  if (select count(*) from public.ai_consult_turns where id = v_turn_id and question = '伏字済みの相談文') <> 1
     or (select count(*) from public.ai_consult_daily_claims where family_id = 'fa000000-0000-4000-8000-000000000010' and status = 'succeeded' and turn_id = v_turn_id) <> 1
     or (select consult_trial_used_at is null from public.families where id = 'fa000000-0000-4000-8000-000000000010') then
    raise exception 'turn insert, claim finalization, and legacy timestamp must commit together';
  end if;

  v_result := public.persist_and_finalize_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000020',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000030',
    'fa000000-0000-4000-8000-000000000102',
    '伏字済みの相談文',
    '{"situation":"整理しました"}'::jsonb,
    '{}'::uuid[],
    1,
    'consult-memory-v02-2026-09-01'
  );
  if v_result->>'result' <> 'persisted'
     or coalesce((v_result->>'idempotent')::boolean, false) is not true
     or (v_result->>'turnId')::uuid <> v_turn_id
     or (select count(*) from public.ai_consult_turns where thread_id = 'fa000000-0000-4000-8000-000000000030') <> 1 then
    raise exception 'same claim token must return the same single turn: %', v_result;
  end if;

  if public.release_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000102'
  ) then
    raise exception 'a committed claim must never be reopened by release';
  end if;

  v_result := public.claim_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000020',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000103'
  );
  if v_result->>'result' <> 'already_used' then
    raise exception 'successful family/day must not be claimable twice: %', v_result;
  end if;

  v_result := public.claim_daily_free_consult(
    'fa000000-0000-4000-8000-000000000013',
    'fa000000-0000-4000-8000-000000000023',
    'fa000000-0000-4000-8000-000000000004',
    'fa000000-0000-4000-8000-000000000104'
  );
  if v_result->>'result' <> 'already_used' then
    raise exception 'legacy same-day use must remain consumed: %', v_result;
  end if;

  v_result := public.claim_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000020',
    'fa000000-0000-4000-8000-000000000002',
    'fa000000-0000-4000-8000-000000000105'
  );
  if v_result->>'result' <> 'forbidden' then
    raise exception 'non-member must not reserve a family allowance: %', v_result;
  end if;

  v_result := public.claim_daily_free_consult(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000021',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000106'
  );
  if v_result->>'result' <> 'forbidden' then
    raise exception 'person from another family must not reserve allowance: %', v_result;
  end if;

  v_result := public.claim_daily_free_consult(
    'fa000000-0000-4000-8000-000000000012',
    'fa000000-0000-4000-8000-000000000022',
    'fa000000-0000-4000-8000-000000000004',
    'fa000000-0000-4000-8000-000000000107'
  );
  if v_result->>'result' <> 'not_applicable' then
    raise exception 'plus family must not consume the free ledger: %', v_result;
  end if;

  v_result := public.claim_daily_free_consult(
    'fa000000-0000-4000-8000-000000000011',
    'fa000000-0000-4000-8000-000000000021',
    'fa000000-0000-4000-8000-000000000003',
    'fa000000-0000-4000-8000-000000000108'
  );
  if v_result->>'result' <> 'claimed' then
    raise exception 'stale test initial claim failed: %', v_result;
  end if;

  update public.family_members
  set role = 'viewer'
  where family_id = 'fa000000-0000-4000-8000-000000000011'
    and user_id = 'fa000000-0000-4000-8000-000000000003';
  v_result := public.persist_and_finalize_daily_free_consult(
    'fa000000-0000-4000-8000-000000000011',
    'fa000000-0000-4000-8000-000000000021',
    'fa000000-0000-4000-8000-000000000003',
    'fa000000-0000-4000-8000-000000000031',
    'fa000000-0000-4000-8000-000000000108',
    '閲覧者になった後の相談',
    '{"situation":"保存してはいけない"}'::jsonb,
    '{}'::uuid[],
    1,
    'consult-memory-v02-2026-09-01'
  );
  if v_result->>'result' <> 'forbidden'
     or (select count(*) from public.ai_consult_turns where thread_id = 'fa000000-0000-4000-8000-000000000031') <> 0
     or (select status from public.ai_consult_daily_claims where family_id = 'fa000000-0000-4000-8000-000000000011') <> 'reserved' then
    raise exception 'viewer downgrade must atomically block persistence and consumption: %', v_result;
  end if;
  update public.family_members
  set role = 'owner'
  where family_id = 'fa000000-0000-4000-8000-000000000011'
    and user_id = 'fa000000-0000-4000-8000-000000000003';

  update public.ai_memory_consents
  set revoked_at = now()
  where person_id = 'fa000000-0000-4000-8000-000000000021'
    and user_id = 'fa000000-0000-4000-8000-000000000003';
  v_result := public.persist_and_finalize_daily_free_consult(
    'fa000000-0000-4000-8000-000000000011',
    'fa000000-0000-4000-8000-000000000021',
    'fa000000-0000-4000-8000-000000000003',
    'fa000000-0000-4000-8000-000000000031',
    'fa000000-0000-4000-8000-000000000108',
    '同意取消後の相談',
    '{"situation":"保存してはいけない"}'::jsonb,
    '{}'::uuid[],
    1,
    'consult-memory-v02-2026-09-01'
  );
  if v_result->>'result' <> 'memory_consent_required'
     or (select count(*) from public.ai_consult_turns where thread_id = 'fa000000-0000-4000-8000-000000000031') <> 0
     or (select status from public.ai_consult_daily_claims where family_id = 'fa000000-0000-4000-8000-000000000011') <> 'reserved' then
    raise exception 'consent revocation must atomically block persistence and consumption: %', v_result;
  end if;
  update public.ai_memory_consents
  set revoked_at = null
  where person_id = 'fa000000-0000-4000-8000-000000000021'
    and user_id = 'fa000000-0000-4000-8000-000000000003';

  update public.ai_consult_daily_claims
  set reserved_at = now() - interval '4 minutes'
  where family_id = 'fa000000-0000-4000-8000-000000000011';

  v_result := public.claim_daily_free_consult(
    'fa000000-0000-4000-8000-000000000011',
    'fa000000-0000-4000-8000-000000000021',
    'fa000000-0000-4000-8000-000000000003',
    'fa000000-0000-4000-8000-000000000109'
  );
  if v_result->>'result' <> 'claimed' then
    raise exception 'stale reservation should be reclaimed: %', v_result;
  end if;

  v_result := public.persist_and_finalize_daily_free_consult(
    'fa000000-0000-4000-8000-000000000011',
    'fa000000-0000-4000-8000-000000000021',
    'fa000000-0000-4000-8000-000000000003',
    'fa000000-0000-4000-8000-000000000031',
    'fa000000-0000-4000-8000-000000000108',
    '古い相談',
    '{"situation":"古い回答"}'::jsonb,
    '{}'::uuid[],
    1,
    'consult-memory-v02-2026-09-01'
  );
  if v_result->>'result' <> 'claim_missing' or public.release_daily_free_consult(
    'fa000000-0000-4000-8000-000000000011',
    'fa000000-0000-4000-8000-000000000003',
    'fa000000-0000-4000-8000-000000000108'
  ) then
    raise exception 'replaced stale token must lose persist/release authority: %', v_result;
  end if;

  v_result := public.persist_and_finalize_daily_free_consult(
    'fa000000-0000-4000-8000-000000000011',
    'fa000000-0000-4000-8000-000000000021',
    'fa000000-0000-4000-8000-000000000003',
    'fa000000-0000-4000-8000-000000000031',
    'fa000000-0000-4000-8000-000000000109',
    '新しい相談',
    '{"situation":"新しい回答"}'::jsonb,
    '{}'::uuid[],
    1,
    'consult-memory-v02-2026-09-01'
  );
  if v_result->>'result' <> 'persisted' then
    raise exception 'replacement token should persist and finalize: %', v_result;
  end if;
end;
$regression$;

rollback;
