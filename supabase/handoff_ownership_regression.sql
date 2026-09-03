-- Behavioral regression for anonymous diagnosis ownership and one-time handoff.
-- Run only in a disposable/local database. Every fixture is rolled back.

begin;

insert into auth.users (id, email)
values
  ('f4000000-0000-4000-8000-000000000001', 'handoff-owner@example.test'),
  ('f4000000-0000-4000-8000-000000000002', 'handoff-attacker@example.test'),
  ('f4000000-0000-4000-8000-000000000003', 'handoff-outsider@example.test');

do $test$
declare
  v_case_id uuid := 'f4000000-0000-4000-8000-000000000010';
  v_case_token text := 'anon_' || repeat('a', 64);
  v_handoff_token text := 'handoff_' || repeat('1', 48);
  v_result jsonb;
  v_count int;
  v_email text;
  v_display_name text;
  v_role text;
  v_relationship text;
begin
  v_result := public.submit_anonymous_case_diagnosis(
    v_case_id,
    v_case_token,
    'preparing',
    '{"selectedStatus":"preparing","familyStructure":"テスト"}'::jsonb,
    null,
    null,
    false,
    'regression-v1',
    'regression-v1: consent',
    '127.0.0.1',
    'regression',
    'preparing',
    'summary',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    v_handoff_token
  );

  if v_result ->> 'handoffToken' <> v_handoff_token
     or (v_result ->> 'idempotentReplay')::boolean then
    raise exception 'fresh anonymous diagnosis did not return its first handoff';
  end if;

  if not exists (
    select 1 from public.cases
    where id = v_case_id
      and anonymous_token = v_case_token
      and status = 'result_ready'
      and family_id is null
      and person_id is null
  ) then
    raise exception 'fresh anonymous diagnosis did not persist an unconverted case';
  end if;

  -- Exact retries are idempotent and must return the original token rather
  -- than creating a second handoff or consent row.
  v_result := public.submit_anonymous_case_diagnosis(
    v_case_id,
    v_case_token,
    'preparing',
    '{"selectedStatus":"preparing","familyStructure":"テスト"}'::jsonb,
    null,
    null,
    false,
    'regression-v1',
    'regression-v1: consent',
    '127.0.0.1',
    'regression',
    'preparing',
    'summary',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    'handoff_' || repeat('2', 48)
  );

  if v_result ->> 'handoffToken' <> v_handoff_token
     or not (v_result ->> 'idempotentReplay')::boolean then
    raise exception 'retry did not reuse the original handoff';
  end if;

  select count(*) into v_count from public.case_results where case_id = v_case_id;
  if v_count <> 1 then
    raise exception 'retry created % handoff rows instead of one', v_count;
  end if;

  select count(*) into v_count from public.consent_logs where case_id = v_case_id;
  if v_count <> 1 then
    raise exception 'retry created % consent rows instead of one', v_count;
  end if;

  begin
    perform public.submit_anonymous_case_diagnosis(
      v_case_id,
      'anon_' || repeat('b', 64),
      'preparing',
      '{"selectedStatus":"preparing","familyStructure":"テスト"}'::jsonb,
      null, null, false,
      'regression-v1', 'regression-v1: consent', null, null,
      'preparing', 'summary', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      'handoff_' || repeat('3', 48)
    );
    raise exception 'wrong ownership token unexpectedly resubmitted a case';
  exception
    when others then
      if sqlerrm not like '%invalid_case_token%' then
        raise;
      end if;
  end;

  begin
    perform public.submit_anonymous_case_diagnosis(
      v_case_id,
      v_case_token,
      'hospitalized',
      '{"selectedStatus":"hospitalized","familyStructure":"変更"}'::jsonb,
      null, null, false,
      'regression-v1', 'regression-v1: consent', null, null,
      'hospitalized', 'changed', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      'handoff_' || repeat('4', 48)
    );
    raise exception 'changed retry unexpectedly replaced an existing diagnosis';
  exception
    when others then
      if sqlerrm not like '%case_already_submitted%' then
        raise;
      end if;
  end;

  -- The first valid consume still creates a new family and owner.
  v_result := public.consume_case_handoff(
    v_case_id,
    v_handoff_token,
    'f4000000-0000-4000-8000-000000000001',
    'handoff-owner@example.test',
    'Owner'
  );

  if (v_result ->> 'reusedExistingCase')::boolean
     or (v_result ->> 'idempotentReplay')::boolean
     or not exists (
       select 1
       from public.cases c
       join public.family_members fm on fm.family_id = c.family_id
       where c.id = v_case_id
         and c.status = 'converted'
         and fm.user_id = 'f4000000-0000-4000-8000-000000000001'
         and fm.role = 'owner'
     ) then
    raise exception 'first handoff no longer creates the initial owner';
  end if;

  -- If the database commit succeeded but the HTTP response was lost, the
  -- same owner can safely repeat the request. The replay must be read-only:
  -- caller-supplied profile data must not overwrite the committed identity
  -- and no family/member/person rows may be duplicated.
  v_result := public.consume_case_handoff(
    v_case_id,
    v_handoff_token,
    'f4000000-0000-4000-8000-000000000001',
    'changed-email@example.test',
    'Changed owner'
  );

  if not (v_result ->> 'reusedExistingCase')::boolean
     or not (v_result ->> 'idempotentReplay')::boolean then
    raise exception 'same-owner retry was not returned as an idempotent replay';
  end if;

  select email, display_name
  into v_email, v_display_name
  from public.profiles
  where id = 'f4000000-0000-4000-8000-000000000001';

  if v_email <> 'handoff-owner@example.test' or v_display_name <> 'Owner' then
    raise exception 'same-owner retry changed profile data to % / %', v_email, v_display_name;
  end if;

  select fm.role, fm.relationship
  into v_role, v_relationship
  from public.cases c
  join public.family_members fm on fm.family_id = c.family_id
  where c.id = v_case_id
    and fm.user_id = 'f4000000-0000-4000-8000-000000000001';

  if v_role <> 'owner' or v_relationship <> '家族代表' then
    raise exception 'same-owner retry changed membership to % / %', v_role, v_relationship;
  end if;

  select count(*) into v_count
  from public.family_members fm
  join public.cases c on c.family_id = fm.family_id
  where c.id = v_case_id;

  if v_count <> 1 then
    raise exception 'same-owner retry left % family members instead of one', v_count;
  end if;

  select count(*) into v_count
  from public.people p
  join public.cases c on c.family_id = p.family_id
  where c.id = v_case_id;

  if v_count <> 1 then
    raise exception 'same-owner retry left % people instead of one', v_count;
  end if;

  begin
    perform public.consume_case_handoff(
      v_case_id,
      v_handoff_token,
      'f4000000-0000-4000-8000-000000000002',
      'handoff-attacker@example.test',
      'Attacker'
    );
    raise exception 'consumed token unexpectedly admitted an outsider';
  exception
    when others then
      if sqlerrm not like '%case_already_converted%' then
        raise;
      end if;
  end;

  begin
    perform public.submit_anonymous_case_diagnosis(
      v_case_id,
      'anon_' || repeat('f', 64),
      'preparing',
      '{"selectedStatus":"preparing","familyStructure":"テスト"}'::jsonb,
      null, null, false,
      'regression-v1', 'regression-v1: consent', null, null,
      'preparing', 'summary', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      'handoff_' || repeat('5', 48)
    );
    raise exception 'wrong token unexpectedly revealed or changed a converted case';
  exception
    when others then
      if sqlerrm not like '%invalid_case_token%' then
        raise;
      end if;
  end;

  begin
    perform public.submit_anonymous_case_diagnosis(
      v_case_id,
      v_case_token,
      'preparing',
      '{"selectedStatus":"preparing","familyStructure":"テスト"}'::jsonb,
      null, null, false,
      'regression-v1', 'regression-v1: consent', null, null,
      'preparing', 'summary', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      'handoff_' || repeat('5', 48)
    );
    raise exception 'converted case unexpectedly issued a new handoff';
  exception
    when others then
      if sqlerrm not like '%case_already_converted%' then
        raise;
      end if;
  end;
end;
$test$;

-- A draft created by POST /api/cases remains compatible when its returned
-- ownership token is supplied to the diagnosis endpoint.
insert into public.cases (id, anonymous_token, selected_status, answers, status)
values (
  'f4000000-0000-4000-8000-000000000011',
  'anon_' || repeat('d', 64),
  'preparing',
  '{"selectedStatus":"preparing"}'::jsonb,
  'draft'
);

do $draft$
declare
  v_result jsonb;
begin
  v_result := public.submit_anonymous_case_diagnosis(
    'f4000000-0000-4000-8000-000000000011',
    'anon_' || repeat('d', 64),
    'preparing',
    '{"selectedStatus":"preparing","familyStructure":"draft"}'::jsonb,
    null, null, false,
    'regression-v1', 'regression-v1: consent', null, null,
    'preparing', 'draft summary', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    'handoff_' || repeat('7', 48)
  );

  if v_result ->> 'handoffToken' <> ('handoff_' || repeat('7', 48))
     or not exists (
       select 1 from public.cases
       where id = 'f4000000-0000-4000-8000-000000000011'
         and status = 'result_ready'
         and answers ->> 'familyStructure' = 'draft'
     ) then
    raise exception 'owned draft did not complete its first diagnosis';
  end if;
end;
$draft$;

-- A late failure (the result token unique constraint) must roll back the case
-- and consent rows, so the same owned request can be retried cleanly.
do $retry_after_failure$
declare
  v_count int;
  v_result jsonb;
begin
  begin
    perform public.submit_anonymous_case_diagnosis(
      'f4000000-0000-4000-8000-000000000012',
      'anon_' || repeat('e', 64),
      'preparing',
      '{"selectedStatus":"preparing","familyStructure":"retry"}'::jsonb,
      null, null, false,
      'regression-v1', 'regression-v1: consent', null, null,
      'preparing', 'retry summary', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      'handoff_' || repeat('7', 48)
    );
    raise exception 'duplicate handoff token unexpectedly succeeded';
  exception
    when unique_violation then
      null;
  end;

  select count(*) into v_count
  from public.cases
  where id = 'f4000000-0000-4000-8000-000000000012';
  if v_count <> 0 then
    raise exception 'failed atomic submission left a case row behind';
  end if;

  select count(*) into v_count
  from public.consent_logs
  where case_id = 'f4000000-0000-4000-8000-000000000012';
  if v_count <> 0 then
    raise exception 'failed atomic submission left a consent row behind';
  end if;

  v_result := public.submit_anonymous_case_diagnosis(
    'f4000000-0000-4000-8000-000000000012',
    'anon_' || repeat('e', 64),
    'preparing',
    '{"selectedStatus":"preparing","familyStructure":"retry"}'::jsonb,
    null, null, false,
    'regression-v1', 'regression-v1: consent', null, null,
    'preparing', 'retry summary', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    'handoff_' || repeat('8', 48)
  );

  if v_result ->> 'handoffToken' <> ('handoff_' || repeat('8', 48)) then
    raise exception 'clean retry after rollback did not succeed';
  end if;
end;
$retry_after_failure$;

-- Reproduce the former takeover shape: a converted case plus a fresh,
-- unconsumed token. It must not add or promote the caller in that family.
insert into public.profiles (id, email, display_name)
values ('f4000000-0000-4000-8000-000000000002', 'handoff-attacker@example.test', 'Attacker');

insert into public.families (id, name, owner_user_id, plan)
values (
  'f4000000-0000-4000-8000-000000000020',
  'Existing family',
  'f4000000-0000-4000-8000-000000000001',
  'free'
);

insert into public.family_members (family_id, user_id, role, relationship)
values (
  'f4000000-0000-4000-8000-000000000020',
  'f4000000-0000-4000-8000-000000000002',
  'viewer',
  'Viewer'
);

insert into public.people (id, family_id, display_name, relationship_to_family)
values (
  'f4000000-0000-4000-8000-000000000021',
  'f4000000-0000-4000-8000-000000000020',
  'Existing person',
  'mother'
);

insert into public.cases (
  id,
  anonymous_token,
  family_id,
  person_id,
  selected_status,
  answers,
  status
)
values (
  'f4000000-0000-4000-8000-000000000022',
  'anon_' || repeat('c', 64),
  'f4000000-0000-4000-8000-000000000020',
  'f4000000-0000-4000-8000-000000000021',
  'preparing',
  '{"selectedStatus":"preparing"}'::jsonb,
  'converted'
);

insert into public.case_results (case_id, app_handoff_token)
values (
  'f4000000-0000-4000-8000-000000000022',
  'handoff_' || repeat('6', 48)
);

do $takeover$
declare
  v_role text;
  v_consumed_at timestamptz;
  v_count int;
begin
  begin
    perform public.consume_case_handoff(
      'f4000000-0000-4000-8000-000000000022',
      'handoff_' || repeat('6', 48),
      'f4000000-0000-4000-8000-000000000002',
      'handoff-attacker@example.test',
      'Attacker'
    );
    raise exception 'converted case unexpectedly granted family access';
  exception
    when others then
      if sqlerrm not like '%case_already_converted%' then
        raise;
      end if;
  end;

  select role into v_role
  from public.family_members
  where family_id = 'f4000000-0000-4000-8000-000000000020'
    and user_id = 'f4000000-0000-4000-8000-000000000002';

  if v_role <> 'viewer' then
    raise exception 'blocked consume changed existing viewer role to %', v_role;
  end if;

  begin
    perform public.consume_case_handoff(
      'f4000000-0000-4000-8000-000000000022',
      'handoff_' || repeat('6', 48),
      'f4000000-0000-4000-8000-000000000003',
      'handoff-outsider@example.test',
      'Outsider'
    );
    raise exception 'converted case unexpectedly inserted an outsider';
  exception
    when others then
      if sqlerrm not like '%case_already_converted%' then
        raise;
      end if;
  end;

  select count(*) into v_count
  from public.family_members
  where family_id = 'f4000000-0000-4000-8000-000000000020'
    and user_id = 'f4000000-0000-4000-8000-000000000003';

  if v_count <> 0 then
    raise exception 'blocked consume inserted an outsider family membership';
  end if;

  select count(*) into v_count
  from public.profiles
  where id = 'f4000000-0000-4000-8000-000000000003';

  if v_count <> 0 then
    raise exception 'blocked consume mutated outsider profile state';
  end if;

  select app_handoff_consumed_at into v_consumed_at
  from public.case_results
  where case_id = 'f4000000-0000-4000-8000-000000000022';

  if v_consumed_at is not null then
    raise exception 'blocked consume marked the attack token as consumed';
  end if;
end;
$takeover$;

-- Even an otherwise valid, fresh handoff token cannot convert an unlinked
-- case unless diagnosis completed with the exact result_ready state.
insert into public.cases (
  id,
  anonymous_token,
  selected_status,
  answers,
  status
)
values (
  'f4000000-0000-4000-8000-000000000030',
  'anon_' || repeat('9', 64),
  'preparing',
  '{"selectedStatus":"preparing"}'::jsonb,
  'closed'
);

insert into public.case_results (case_id, app_handoff_token)
values (
  'f4000000-0000-4000-8000-000000000030',
  'handoff_' || repeat('9', 48)
);

do $not_ready$
declare
  v_count int;
  v_consumed_at timestamptz;
begin
  begin
    perform public.consume_case_handoff(
      'f4000000-0000-4000-8000-000000000030',
      'handoff_' || repeat('9', 48),
      'f4000000-0000-4000-8000-000000000003',
      'handoff-outsider@example.test',
      'Outsider'
    );
    raise exception 'closed case unexpectedly converted';
  exception
    when others then
      if sqlerrm not like '%case_not_ready%' then
        raise;
      end if;
  end;

  if not exists (
    select 1
    from public.cases
    where id = 'f4000000-0000-4000-8000-000000000030'
      and status = 'closed'
      and family_id is null
      and person_id is null
      and user_id is null
  ) then
    raise exception 'blocked closed-case consume mutated the case';
  end if;

  select app_handoff_consumed_at into v_consumed_at
  from public.case_results
  where case_id = 'f4000000-0000-4000-8000-000000000030';

  if v_consumed_at is not null then
    raise exception 'blocked closed-case consume consumed its token';
  end if;

  select count(*) into v_count
  from public.profiles
  where id = 'f4000000-0000-4000-8000-000000000003';

  if v_count <> 0 then
    raise exception 'blocked closed-case consume created an outsider profile';
  end if;
end;
$not_ready$;

do $privileges$
begin
  if has_function_privilege(
    'anon',
    'public.submit_anonymous_case_diagnosis(uuid,text,text,jsonb,text,text,boolean,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.submit_anonymous_case_diagnosis(uuid,text,text,jsonb,text,text,boolean,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'client roles unexpectedly execute anonymous diagnosis RPC';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.submit_anonymous_case_diagnosis(uuid,text,text,jsonb,text,text,boolean,text,text,text,text,text,text,jsonb,jsonb,jsonb,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role cannot execute anonymous diagnosis RPC';
  end if;
end;
$privileges$;

rollback;
