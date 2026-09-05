-- One-time, independently approved execution gate for account erasure.
-- Apply after account_delete_identity_ledger.sql and account_deletion_pipeline.sql.
--
-- The legacy three-argument database erasure RPC remains an internal helper,
-- but service_role loses permission to call it directly.  New deployments use
-- the v2 wrapper, which binds an exact prepared job and manifest to a short-
-- lived, one-use approval recorded by a different verified account.

begin;

do $precondition$
begin
  if to_regnamespace('account_delete_private') is null
     or to_regclass('public.account_erasure_jobs') is null
     or to_regclass('public.notebook_storage_deletion_jobs') is null
     or to_regclass('public.person_notebook_storage_deletion_jobs') is null
     or to_regprocedure('public.execute_account_erasure_database_v1(uuid,uuid,uuid)') is null then
    raise exception using
      errcode = '55000',
      message = 'apply account_delete_identity_ledger.sql and account_deletion_pipeline.sql first';
  end if;
end;
$precondition$;

-- A durable preparation temporarily freezes attributable uploads. It must
-- expire automatically if an operator walks away before the second-person
-- approval, otherwise opening the new safer flow could freeze an account
-- indefinitely.
alter table public.account_erasure_jobs
  add column if not exists prepared_at timestamptz,
  add column if not exists prepared_expires_at timestamptz;

update public.account_erasure_jobs
set prepared_at = current_timestamp - interval '1 hour',
    prepared_expires_at = current_timestamp
where status = 'prepared'
  and (
    prepared_at is null
    or prepared_expires_at is null
    or prepared_expires_at <= prepared_at
    or prepared_expires_at > prepared_at + interval '1 hour'
  );

alter table public.account_erasure_jobs
  drop constraint if exists account_erasure_jobs_prepared_window;
alter table public.account_erasure_jobs
  add constraint account_erasure_jobs_prepared_window
  check (
    status <> 'prepared'
    or (
      prepared_at is not null
      and prepared_expires_at is not null
      and prepared_expires_at > prepared_at
      and prepared_expires_at <= prepared_at + interval '1 hour'
    )
  );

-- Vercel environment values are immutable per deployment. A later OFF
-- deployment therefore cannot, by itself, disable an older ON deployment's
-- direct URL. This owner-only one-shot window is the database authority: one
-- opening creates a new epoch, lasts at most 15 minutes, and is consumed by
-- the first successful database erasure.
create table if not exists account_delete_private.account_erasure_execution_control (
  control_key boolean primary key default true,
  epoch uuid,
  opened_at timestamptz,
  enabled_until timestamptz,
  consumed_at timestamptz,
  closed_at timestamptz,
  opened_by name,
  updated_at timestamptz not null default clock_timestamp(),
  constraint account_erasure_execution_control_singleton check (control_key),
  constraint account_erasure_execution_control_state check (
    (
      epoch is null
      and opened_at is null
      and enabled_until is null
      and consumed_at is null
      and closed_at is null
      and opened_by is null
    )
    or (
      epoch is not null
      and opened_at is not null
      and enabled_until > opened_at
      and enabled_until <= opened_at + interval '15 minutes'
      and (consumed_at is null or consumed_at between opened_at and enabled_until)
      and (closed_at is null or closed_at >= opened_at)
      and not (consumed_at is not null and closed_at is not null)
    )
  )
);

insert into account_delete_private.account_erasure_execution_control (control_key)
values (true)
on conflict (control_key) do nothing;

create table if not exists account_delete_private.account_erasure_execution_grants (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.account_delete_requests(id) on delete restrict,
  job_id uuid not null references public.account_erasure_jobs(id) on delete restrict,
  target_user_hash text not null,
  operator_user_hash text not null,
  approver_user_hash text not null,
  storage_manifest_hash text not null,
  control_epoch uuid not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_hash text,
  revoked_at timestamptz,
  created_at timestamptz not null,
  created_by name not null default session_user,
  constraint account_erasure_execution_grants_target_hash
    check (target_user_hash ~ '^[0-9a-f]{64}$'),
  constraint account_erasure_execution_grants_operator_hash
    check (operator_user_hash ~ '^[0-9a-f]{64}$'),
  constraint account_erasure_execution_grants_approver_hash
    check (approver_user_hash ~ '^[0-9a-f]{64}$'),
  constraint account_erasure_execution_grants_manifest_hash
    check (storage_manifest_hash ~ '^[0-9a-f]{64}$'),
  constraint account_erasure_execution_grants_separate_checker
    check (approver_user_hash <> operator_user_hash),
  constraint account_erasure_execution_grants_short_lived
    check (
      expires_at > created_at
      and expires_at <= created_at + interval '10 minutes'
    ),
  constraint account_erasure_execution_grants_terminal_state
    check (
      not (consumed_at is not null and revoked_at is not null)
      and (
        (consumed_at is null and consumed_by_hash is null)
        or (
          consumed_at is not null
          and consumed_by_hash = operator_user_hash
        )
      )
    )
);

-- A prior development revision may have created the grant table before the
-- epoch column existed. Such rows were never production-authoritative: make
-- them permanently unusable before enforcing the final non-null shape.
alter table account_delete_private.account_erasure_execution_grants
  add column if not exists control_epoch uuid;
update account_delete_private.account_erasure_execution_grants
set control_epoch = gen_random_uuid(),
    revoked_at = case
      when consumed_at is null then coalesce(revoked_at, clock_timestamp())
      else revoked_at
    end
where control_epoch is null;
alter table account_delete_private.account_erasure_execution_grants
  alter column control_epoch set not null;

create unique index if not exists account_erasure_execution_grants_one_open
  on account_delete_private.account_erasure_execution_grants(request_id)
  where consumed_at is null and revoked_at is null;

-- A control epoch is deliberately global and one-shot. Earlier development
-- revisions only prevented two open grants for the same request, which still
-- allowed two different requests to race for the same owner-opened window.
-- Preserve the newest historical candidate and revoke every older duplicate
-- before enforcing the final epoch-wide invariant.
with ranked_open_grants as (
  select approval.id,
         row_number() over (
           partition by approval.control_epoch
           order by approval.created_at desc, approval.id desc
         ) as grant_position
  from account_delete_private.account_erasure_execution_grants approval
  where approval.consumed_at is null
    and approval.revoked_at is null
)
update account_delete_private.account_erasure_execution_grants approval
set revoked_at = clock_timestamp()
from ranked_open_grants ranked
where approval.id = ranked.id
  and ranked.grant_position > 1;

create unique index if not exists account_erasure_execution_grants_one_open_per_epoch
  on account_delete_private.account_erasure_execution_grants(control_epoch)
  where consumed_at is null and revoked_at is null;

create index if not exists account_erasure_execution_grants_job_created
  on account_delete_private.account_erasure_execution_grants(job_id, created_at desc);

alter table account_delete_private.account_erasure_execution_grants enable row level security;
alter table account_delete_private.account_erasure_execution_grants force row level security;
alter table account_delete_private.account_erasure_execution_control enable row level security;
alter table account_delete_private.account_erasure_execution_control force row level security;

comment on table account_delete_private.account_erasure_execution_grants is
  'Owner-only exact-job approval; person UUIDs are stored only as hashes and each grant is bound to one database-control epoch, expires within 10 minutes, or is consumed once.';
comment on table account_delete_private.account_erasure_execution_control is
  'Owner-only singleton kill switch; each epoch authorizes at most one database erasure for at most 15 minutes.';

create or replace function account_delete_private.stamp_account_erasure_prepared_window()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if new.status = 'prepared' then
    new.prepared_at := v_now;
    new.prepared_expires_at := v_now + interval '1 hour';
  end if;
  return new;
end;
$$;

create or replace function account_delete_private.revoke_grant_after_reprepare()
returns trigger
language plpgsql
set search_path = pg_catalog, account_delete_private
as $$
begin
  if new.status in ('prepared', 'blocked')
     and new.database_erased_at is null then
    update account_delete_private.account_erasure_execution_grants approval
    set revoked_at = clock_timestamp()
    where approval.request_id = new.request_id
      and approval.consumed_at is null
      and approval.revoked_at is null;
  end if;
  return null;
end;
$$;

drop trigger if exists account_erasure_jobs_prepared_window_stamp
  on public.account_erasure_jobs;
create trigger account_erasure_jobs_prepared_window_stamp
before insert or update on public.account_erasure_jobs
for each row
execute function account_delete_private.stamp_account_erasure_prepared_window();

drop trigger if exists account_erasure_jobs_reprepare_grant_revoke
  on public.account_erasure_jobs;
create trigger account_erasure_jobs_reprepare_grant_revoke
after update on public.account_erasure_jobs
for each row
execute function account_delete_private.revoke_grant_after_reprepare();

-- These two controls are deliberately private and owner-only. Operations open
-- the database window from the SQL Editor immediately before one approved
-- erasure and close it if the attempt is abandoned. No Web/API role can open
-- or extend the window.
create or replace function account_delete_private.open_account_erasure_execution_control_v1(
  p_valid_for_seconds integer
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public, account_delete_private, extensions
as $$
declare
  v_control account_delete_private.account_erasure_execution_control%rowtype;
  v_now timestamptz := clock_timestamp();
  v_epoch uuid := gen_random_uuid();
begin
  if p_valid_for_seconds is null
     or p_valid_for_seconds < 60
     or p_valid_for_seconds > 900 then
    return jsonb_build_object('result', 'invalid_execution_control_window');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure-execution-control', 0)
  );
  select * into v_control
  from account_delete_private.account_erasure_execution_control control
  where control.control_key
  for update;
  if not found then
    raise exception using
      errcode = '55000',
      message = 'account_erasure_execution_control_missing';
  end if;
  if v_control.epoch is not null
     and v_control.consumed_at is null
     and v_control.closed_at is null
     and v_control.enabled_until > v_now then
    return jsonb_build_object(
      'result', 'execution_control_already_open',
      'epoch', v_control.epoch,
      'expiresAt', v_control.enabled_until
    );
  end if;

  update account_delete_private.account_erasure_execution_grants approval
  set revoked_at = v_now
  where approval.consumed_at is null
    and approval.revoked_at is null;

  update account_delete_private.account_erasure_execution_control control
  set epoch = v_epoch,
      opened_at = v_now,
      enabled_until = v_now + make_interval(secs => p_valid_for_seconds),
      consumed_at = null,
      closed_at = null,
      opened_by = session_user,
      updated_at = v_now
  where control.control_key
  returning * into v_control;

  insert into public.audit_logs (
    actor_user_id, action, target_type, target_id, metadata
  ) values (
    null,
    'account_erasure_execution_control_opened',
    'account_erasure_execution_control',
    v_epoch,
    jsonb_build_object('expiresAt', v_control.enabled_until)
  );

  return jsonb_build_object(
    'result', 'execution_control_open',
    'epoch', v_epoch,
    'expiresAt', v_control.enabled_until
  );
end;
$$;

create or replace function account_delete_private.close_account_erasure_execution_control_v1()
returns jsonb
language plpgsql
set search_path = pg_catalog, public, account_delete_private
as $$
declare
  v_control account_delete_private.account_erasure_execution_control%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure-execution-control', 0)
  );
  select * into v_control
  from account_delete_private.account_erasure_execution_control control
  where control.control_key
  for update;
  if not found then
    raise exception using
      errcode = '55000',
      message = 'account_erasure_execution_control_missing';
  end if;
  if v_control.epoch is null or v_control.closed_at is not null then
    return jsonb_build_object('result', 'execution_control_closed');
  end if;
  if v_control.consumed_at is not null then
    return jsonb_build_object(
      'result', 'execution_control_consumed',
      'epoch', v_control.epoch,
      'consumedAt', v_control.consumed_at
    );
  end if;

  update account_delete_private.account_erasure_execution_grants approval
  set revoked_at = v_now
  where approval.control_epoch = v_control.epoch
    and approval.consumed_at is null
    and approval.revoked_at is null;
  update account_delete_private.account_erasure_execution_control control
  set closed_at = v_now,
      updated_at = v_now
  where control.control_key;

  insert into public.audit_logs (
    actor_user_id, action, target_type, target_id, metadata
  ) values (
    null,
    'account_erasure_execution_control_closed',
    'account_erasure_execution_control',
    v_control.epoch,
    jsonb_build_object('closedAt', v_now)
  );

  return jsonb_build_object(
    'result', 'execution_control_closed',
    'epoch', v_control.epoch,
    'closedAt', v_now
  );
end;
$$;

-- Replace the two upload/reference guards so only a live preparation freezes
-- ordinary writes. A database-erased or completed receipt remains permanent.
create or replace function public.guard_erased_notebook_storage_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_path_user_id uuid;
  v_candidate_prefix text;
  v_candidate_prefix_hash text;
  v_is_notebook_path boolean := false;
begin
  if new.bucket_id <> 'home-photos' then
    return new;
  end if;

  if new.name ~* '^notebook/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/.+$' then
    v_is_notebook_path := true;
    v_path_user_id := split_part(new.name, '/', 2)::uuid;
  elsif new.name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/.+$' then
    v_candidate_prefix := split_part(new.name, '/', 1) || '/';
    v_candidate_prefix_hash := encode(
      digest(new.bucket_id || ':' || v_candidate_prefix, 'sha256'),
      'hex'
    );

    select family.owner_user_id into v_path_user_id
    from public.homes home
    join public.people person on person.id = home.person_id
    join public.families family on family.id = person.family_id
    where home.id = split_part(new.name, '/', 1)::uuid;

    if v_path_user_id is null then
      select job.target_user_id into v_path_user_id
      from public.account_erasure_jobs job
      where v_candidate_prefix_hash = any(job.storage_prefix_hashes)
        and (
          job.status = 'database_erased'
          or (
            job.status = 'prepared'
            and job.prepared_expires_at > clock_timestamp()
          )
        )
      limit 1;
    end if;
  else
    return new;
  end if;

  if v_path_user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('account-erasure-target:' || v_path_user_id::text, 0)
    );
  end if;
  if exists (
    select 1
    from public.account_erasure_jobs job
    where (
      job.status in ('database_erased', 'completed')
      or (
        job.status = 'prepared'
        and job.prepared_expires_at > clock_timestamp()
      )
    )
      and (
        (
          v_is_notebook_path
          and job.target_user_hash = encode(digest(v_path_user_id::text, 'sha256'), 'hex')
        )
        or (
          not v_is_notebook_path
          and v_candidate_prefix_hash = any(job.storage_prefix_hashes)
        )
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'account_erasure_storage_write_blocked';
  end if;
  return new;
end;
$$;

create or replace function public.guard_erased_notebook_attachment_reference()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_attachment jsonb;
  v_path text;
  v_path_user_id uuid;
begin
  if jsonb_typeof(coalesce(new.attachments, '[]'::jsonb)) <> 'array' then
    return new;
  end if;

  for v_attachment in
    select value
    from jsonb_array_elements(coalesce(new.attachments, '[]'::jsonb))
  loop
    v_path := nullif(btrim(v_attachment->>'storagePath'), '');
    if v_path is null
       or v_path !~* '^notebook/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/]+$' then
      continue;
    end if;

    v_path_user_id := split_part(v_path, '/', 2)::uuid;
    perform pg_advisory_xact_lock(
      hashtextextended('account-erasure-target:' || v_path_user_id::text, 0)
    );
    if exists (
      select 1
      from public.account_erasure_jobs job
      where job.target_user_hash = encode(digest(v_path_user_id::text, 'sha256'), 'hex')
        and (
          job.status in ('database_erased', 'completed')
          or (
            job.status = 'prepared'
            and job.prepared_expires_at > clock_timestamp()
          )
        )
    ) then
      raise exception using
        errcode = '42501',
        message = 'account_erasure_attachment_reference_blocked';
    end if;
  end loop;
  return new;
end;
$$;

-- This validator is intentionally owner-only. The service-only public wrapper
-- below delegates to it only after the Web route authenticates a separate AAL2
-- app_admin and the validator independently matches the private identity ledger.
create or replace function account_delete_private.create_account_erasure_execution_grant_v1(
  p_request_id uuid,
  p_job_id uuid,
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_approver_user_id uuid,
  p_expected_manifest_hash text,
  p_valid_for_seconds integer
)
returns jsonb
language plpgsql
set search_path = pg_catalog, public, account_delete_private, extensions
as $$
declare
  v_job public.account_erasure_jobs%rowtype;
  v_grant account_delete_private.account_erasure_execution_grants%rowtype;
  v_control account_delete_private.account_erasure_execution_control%rowtype;
  v_operator_method text;
  v_target_hash text;
  v_operator_hash text;
  v_approver_hash text;
  v_now timestamptz;
begin
  if p_request_id is null
     or p_job_id is null
     or p_target_user_id is null
     or p_operator_user_id is null
     or p_approver_user_id is null
     or p_expected_manifest_hash is null
     or p_expected_manifest_hash !~ '^[0-9a-f]{64}$'
     or p_valid_for_seconds is null
     or p_valid_for_seconds < 60
     or p_valid_for_seconds > 600 then
    return jsonb_build_object('result', 'invalid_grant_request');
  end if;
  if p_operator_user_id = p_approver_user_id
     or p_target_user_id = p_approver_user_id then
    return jsonb_build_object('result', 'separate_approver_required');
  end if;
  v_target_hash := encode(digest(p_target_user_id::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure-target:' || p_target_user_id::text, 0)
  );
  perform pg_advisory_xact_lock(hashtextextended('account-erasure:' || p_request_id::text, 0));
  lock table public.app_admins, public.account_delete_executors
    in share row exclusive mode;
  v_operator_method := public.account_erasure_operator_method(p_operator_user_id);
  if v_operator_method is distinct from 'supabase_account_delete_executor' then
    return jsonb_build_object('result', 'operator_forbidden');
  end if;
  if not exists (
    select 1 from public.profiles profile where profile.id = p_approver_user_id
  ) or not exists (
    select 1 from public.app_admins admin where admin.user_id = p_approver_user_id
  ) then
    return jsonb_build_object('result', 'approver_forbidden');
  end if;
  if not exists (
    select 1
    from account_delete_private.operator_identity_events event
    where event.record_kind = 'activation_approved'
      and event.operator_user_id = p_operator_user_id
      and event.approver_user_id = p_approver_user_id
  ) then
    return jsonb_build_object('result', 'registered_separate_approver_required');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure-execution-control', 0)
  );
  select * into v_control
  from account_delete_private.account_erasure_execution_control control
  where control.control_key
  for update;
  v_now := clock_timestamp();
  if not found
     or v_control.epoch is null
     or v_control.consumed_at is not null
     or v_control.closed_at is not null
     or v_control.enabled_until <= v_now then
    return jsonb_build_object('result', 'execution_control_disabled');
  end if;

  select * into v_job
  from public.account_erasure_jobs job
  where job.request_id = p_request_id
  for update;
  if not found then
    return jsonb_build_object('result', 'prepared_job_required');
  end if;

  if v_job.id <> p_job_id
     or v_job.target_user_hash <> v_target_hash
     or v_job.operator_user_id is distinct from p_operator_user_id then
    return jsonb_build_object('result', 'prepared_identity_mismatch');
  end if;
  if v_job.status <> 'prepared' or v_job.database_erased_at is not null then
    return jsonb_build_object('result', 'prepared_job_required');
  end if;
  if v_job.prepared_expires_at <= v_now then
    return jsonb_build_object('result', 'prepared_job_expired');
  end if;
  if v_now + make_interval(secs => p_valid_for_seconds) > v_job.prepared_expires_at then
    return jsonb_build_object('result', 'grant_exceeds_prepared_window');
  end if;
  if v_now + make_interval(secs => p_valid_for_seconds) > v_control.enabled_until then
    return jsonb_build_object('result', 'grant_exceeds_execution_window');
  end if;
  if v_job.storage_manifest_hash <> p_expected_manifest_hash then
    return jsonb_build_object('result', 'manifest_mismatch');
  end if;

  v_operator_hash := encode(digest(p_operator_user_id::text, 'sha256'), 'hex');
  v_approver_hash := encode(digest(p_approver_user_id::text, 'sha256'), 'hex');

  -- Dynamic expiry cannot be represented in a partial-index predicate. Clear
  -- stale rows while holding the global control lock, then reject an active
  -- grant for any other request in this same epoch. The unique index remains
  -- the final race-safe backstop.
  update account_delete_private.account_erasure_execution_grants approval
  set revoked_at = v_now
  where approval.control_epoch = v_control.epoch
    and approval.consumed_at is null
    and approval.revoked_at is null
    and approval.expires_at <= v_now;

  if exists (
    select 1
    from account_delete_private.account_erasure_execution_grants approval
    where approval.control_epoch = v_control.epoch
      and approval.request_id <> p_request_id
      and approval.consumed_at is null
      and approval.revoked_at is null
  ) then
    return jsonb_build_object('result', 'execution_control_already_granted');
  end if;

  -- Closing any older unconsumed row makes re-approval explicit and preserves
  -- its immutable historical identity without leaving two active grants.
  update account_delete_private.account_erasure_execution_grants approval
  set revoked_at = v_now
  where approval.request_id = p_request_id
    and approval.consumed_at is null
    and approval.revoked_at is null;

  insert into account_delete_private.account_erasure_execution_grants (
    request_id,
    job_id,
    target_user_hash,
    operator_user_hash,
    approver_user_hash,
    storage_manifest_hash,
    control_epoch,
    expires_at,
    created_at
  ) values (
    p_request_id,
    p_job_id,
    v_target_hash,
    v_operator_hash,
    v_approver_hash,
    p_expected_manifest_hash,
    v_control.epoch,
    v_now + make_interval(secs => p_valid_for_seconds),
    v_now
  )
  returning * into v_grant;

  insert into public.audit_logs (
    actor_user_id, action, target_type, target_id, metadata
  ) values (
    p_approver_user_id,
    'account_erasure_execution_approved',
    'account_erasure_job',
    p_job_id,
    jsonb_build_object(
      'requestId', p_request_id,
      'grantId', v_grant.id,
      'manifestHash', p_expected_manifest_hash,
      'controlEpoch', v_control.epoch,
      'operatorMethod', v_operator_method,
      'expiresAt', v_grant.expires_at
    )
  );

  return jsonb_build_object(
    'result', 'execution_grant_ready',
    'grantId', v_grant.id,
    'jobId', p_job_id,
    'manifestHash', p_expected_manifest_hash,
    'controlEpoch', v_control.epoch,
    'expiresAt', v_grant.expires_at
  );
end;
$$;

-- API-callable issuer for a separately authenticated AAL2 app_admin. The Web
-- route derives p_approver_user_id from the verified Bearer token; this RPC
-- independently rechecks the narrow database role and then delegates to the
-- owner-only validator above.
create or replace function public.issue_account_erasure_execution_grant_v1(
  p_request_id uuid,
  p_target_user_id uuid,
  p_approver_user_id uuid,
  p_expected_job_id uuid,
  p_expected_manifest_hash text,
  p_valid_for_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, account_delete_private
as $$
declare
  v_job public.account_erasure_jobs%rowtype;
begin
  if p_approver_user_id is null
     or not exists (
       select 1
       from public.app_admins admin
       where admin.user_id = p_approver_user_id
     ) then
    return jsonb_build_object('result', 'approver_forbidden');
  end if;

  select * into v_job
  from public.account_erasure_jobs job
  where job.request_id = p_request_id;
  if not found then
    return jsonb_build_object('result', 'prepared_job_required');
  end if;

  return account_delete_private.create_account_erasure_execution_grant_v1(
    p_request_id,
    p_expected_job_id,
    p_target_user_id,
    v_job.operator_user_id,
    p_approver_user_id,
    p_expected_manifest_hash,
    p_valid_for_seconds
  );
end;
$$;

-- Service-readable status for an exact prepared job. It reveals no raw target
-- identity, approver identity, or Storage path.
create or replace function public.inspect_account_erasure_execution_grant_v1(
  p_request_id uuid,
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_expected_job_id uuid,
  p_expected_manifest_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, account_delete_private, extensions
as $$
declare
  v_job public.account_erasure_jobs%rowtype;
  v_grant account_delete_private.account_erasure_execution_grants%rowtype;
  v_control account_delete_private.account_erasure_execution_control%rowtype;
  v_target_hash text;
  v_operator_hash text;
begin
  if p_request_id is null
     or p_target_user_id is null
     or p_operator_user_id is null
     or p_expected_job_id is null
     or p_expected_manifest_hash is null
     or p_expected_manifest_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('result', 'invalid_grant_status_request');
  end if;
  if public.account_erasure_operator_method(p_operator_user_id)
     is distinct from 'supabase_account_delete_executor' then
    return jsonb_build_object('result', 'operator_forbidden');
  end if;

  select * into v_job
  from public.account_erasure_jobs job
  where job.request_id = p_request_id;
  if not found then
    return jsonb_build_object('result', 'prepared_job_required');
  end if;

  v_target_hash := encode(digest(p_target_user_id::text, 'sha256'), 'hex');
  v_operator_hash := encode(digest(p_operator_user_id::text, 'sha256'), 'hex');
  if v_job.id <> p_expected_job_id
     or v_job.target_user_hash <> v_target_hash
     or v_job.storage_manifest_hash <> p_expected_manifest_hash then
    return jsonb_build_object('result', 'prepared_identity_mismatch');
  end if;
  if v_job.database_erased_at is not null then
    if not exists (
      select 1
      from account_delete_private.account_erasure_execution_grants approval
      where approval.request_id = p_request_id
        and approval.job_id = p_expected_job_id
        and approval.target_user_hash = v_target_hash
        and approval.operator_user_hash = v_operator_hash
        and approval.storage_manifest_hash = p_expected_manifest_hash
        and approval.consumed_at is not null
        and approval.consumed_by_hash = approval.operator_user_hash
        and approval.revoked_at is null
    ) then
      return jsonb_build_object('result', 'consumed_execution_grant_required');
    end if;
    return jsonb_build_object('result', 'database_erased_resume_allowed');
  end if;
  if v_job.operator_user_id is distinct from p_operator_user_id then
    return jsonb_build_object('result', 'prepared_identity_mismatch');
  end if;
  if v_job.status <> 'prepared' then
    return jsonb_build_object('result', 'prepared_job_required');
  end if;
  if v_job.prepared_expires_at <= clock_timestamp() then
    return jsonb_build_object('result', 'prepared_job_expired');
  end if;

  select * into v_control
  from account_delete_private.account_erasure_execution_control control
  where control.control_key;
  if not found
     or v_control.epoch is null
     or v_control.consumed_at is not null
     or v_control.closed_at is not null
     or v_control.enabled_until <= clock_timestamp() then
    return jsonb_build_object('result', 'execution_control_disabled');
  end if;

  select * into v_grant
  from account_delete_private.account_erasure_execution_grants approval
  where approval.request_id = p_request_id
    and approval.job_id = p_expected_job_id
    and approval.target_user_hash = v_target_hash
    and approval.operator_user_hash = v_operator_hash
    and approval.storage_manifest_hash = p_expected_manifest_hash
    and approval.control_epoch = v_control.epoch
    and approval.consumed_at is null
    and approval.revoked_at is null
    and approval.expires_at > clock_timestamp()
    and exists (
      select 1
      from public.app_admins admin
      where encode(digest(admin.user_id::text, 'sha256'), 'hex') = approval.approver_user_hash
    )
  order by approval.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('result', 'execution_grant_required');
  end if;
  return jsonb_build_object(
    'result', 'execution_grant_ready',
    'grantId', v_grant.id,
    'expiresAt', v_grant.expires_at
  );
end;
$$;

-- Internal fail-close used only after v2 has locked the singleton epoch. It
-- invalidates every unused grant from that epoch and retains a non-PII audit
-- reason. The exact request/job failure remains in the erasure job itself.
create or replace function account_delete_private.fail_close_account_erasure_execution_control_v1(
  p_epoch uuid,
  p_reason text
)
returns void
language plpgsql
set search_path = pg_catalog, public, account_delete_private
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_epoch is null
     or p_reason not in (
       'prepared_scope_changed',
       'prepared_job_expired',
       'execution_control_expired',
       'execution_grant_expired',
       'database_erasure_not_completed'
     ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_account_erasure_fail_close';
  end if;

  update account_delete_private.account_erasure_execution_grants approval
  set revoked_at = v_now
  where approval.control_epoch = p_epoch
    and approval.consumed_at is null
    and approval.revoked_at is null;
  update account_delete_private.account_erasure_execution_control control
  set closed_at = v_now,
      updated_at = v_now
  where control.control_key
    and control.epoch = p_epoch
    and control.consumed_at is null
    and control.closed_at is null;

  if found then
    insert into public.audit_logs (
      actor_user_id, action, target_type, target_id, metadata
    ) values (
      null,
      'account_erasure_execution_control_fail_closed',
      'account_erasure_execution_control',
      p_epoch,
      jsonb_build_object('reason', p_reason, 'closedAt', v_now)
    );
  end if;
end;
$$;

-- Atomic gate around the existing destructive transaction. The owner-opened
-- database epoch, exact grant, and current family/Storage scope are locked and
-- compared with the reviewed job. One successful database erasure consumes
-- both the grant and the epoch in the same transaction.
create or replace function public.execute_account_erasure_database_v2(
  p_request_id uuid,
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_expected_job_id uuid,
  p_expected_manifest_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, account_delete_private, extensions
as $$
declare
  v_request public.account_delete_requests%rowtype;
  v_job public.account_erasure_jobs%rowtype;
  v_grant account_delete_private.account_erasure_execution_grants%rowtype;
  v_control account_delete_private.account_erasure_execution_control%rowtype;
  v_owned_family_ids uuid[] := '{}'::uuid[];
  v_storage jsonb := '[]'::jsonb;
  v_storage_prefixes jsonb := '[]'::jsonb;
  v_current_manifest_hash text;
  v_target_hash text;
  v_operator_hash text;
  v_operator_method text;
  v_result jsonb;
  v_now timestamptz;
begin
  if p_request_id is null
     or p_target_user_id is null
     or p_operator_user_id is null
     or p_expected_job_id is null
     or p_expected_manifest_hash is null
     or p_expected_manifest_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('result', 'invalid_request');
  end if;
  v_operator_method := public.account_erasure_operator_method(p_operator_user_id);
  if v_operator_method is distinct from 'supabase_account_delete_executor' then
    return jsonb_build_object('result', 'operator_forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure-target:' || p_target_user_id::text, 0)
  );
  perform pg_advisory_xact_lock(hashtextextended('account-erasure:' || p_request_id::text, 0));
  lock table public.profiles, public.app_admins, public.account_delete_executors
    in share row exclusive mode;
  v_operator_method := public.account_erasure_operator_method(p_operator_user_id);
  if v_operator_method is distinct from 'supabase_account_delete_executor' then
    return jsonb_build_object('result', 'operator_forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure-execution-control', 0)
  );
  select * into v_control
  from account_delete_private.account_erasure_execution_control control
  where control.control_key
  for update;
  if not found then
    return jsonb_build_object('result', 'execution_control_disabled');
  end if;

  select * into v_request
  from public.account_delete_requests request
  where request.id = p_request_id
  for update;
  if not found then
    return jsonb_build_object('result', 'request_not_found');
  end if;

  select * into v_job
  from public.account_erasure_jobs job
  where job.request_id = p_request_id
  for update;
  if not found then
    return jsonb_build_object('result', 'prepared_job_required');
  end if;

  v_target_hash := encode(digest(p_target_user_id::text, 'sha256'), 'hex');
  v_operator_hash := encode(digest(p_operator_user_id::text, 'sha256'), 'hex');
  if v_job.id <> p_expected_job_id
     or v_job.target_user_hash <> v_target_hash then
    return jsonb_build_object('result', 'prepared_identity_mismatch');
  end if;
  if v_job.storage_manifest_hash <> p_expected_manifest_hash then
    return jsonb_build_object('result', 'manifest_mismatch');
  end if;
  if v_job.status = 'completed' then
    return jsonb_build_object('result', 'already_completed', 'jobId', v_job.id);
  end if;
  if v_job.database_erased_at is not null then
    select * into v_grant
      from account_delete_private.account_erasure_execution_grants approval
      where approval.request_id = p_request_id
        and approval.job_id = p_expected_job_id
        and approval.target_user_hash = v_target_hash
        and approval.operator_user_hash = v_operator_hash
        and approval.storage_manifest_hash = p_expected_manifest_hash
        and approval.consumed_at is not null
        and approval.consumed_by_hash = approval.operator_user_hash
        and approval.revoked_at is null
      order by approval.consumed_at desc
      limit 1;
    if not found then
      return jsonb_build_object('result', 'consumed_execution_grant_required');
    end if;
    insert into public.audit_logs (
      actor_user_id, action, target_type, target_id, metadata
    ) values (
      p_operator_user_id,
      'account_erasure_recovery_resumed',
      'account_erasure_job',
      p_expected_job_id,
      jsonb_build_object(
        'requestId', p_request_id,
        'grantId', v_grant.id,
        'controlEpoch', v_grant.control_epoch,
        'operatorMethod', v_operator_method
      )
    );
    return public.execute_account_erasure_database_v1(
      p_request_id, p_target_user_id, p_operator_user_id
    );
  end if;
  if v_job.operator_user_id is distinct from p_operator_user_id then
    return jsonb_build_object('result', 'prepared_identity_mismatch');
  end if;
  if v_request.status = 'completed'
     or v_request.user_id is distinct from p_target_user_id then
    return jsonb_build_object('result', 'prepared_identity_mismatch');
  end if;
  if v_job.status <> 'prepared' then
    return jsonb_build_object('result', 'prepared_job_required');
  end if;
  if v_job.prepared_expires_at <= clock_timestamp() then
    return jsonb_build_object('result', 'prepared_job_expired');
  end if;
  if v_control.epoch is null
     or v_control.consumed_at is not null
     or v_control.closed_at is not null
     or v_control.enabled_until <= clock_timestamp() then
    return jsonb_build_object('result', 'execution_control_disabled');
  end if;

  select * into v_grant
  from account_delete_private.account_erasure_execution_grants approval
  where approval.request_id = p_request_id
    and approval.job_id = p_expected_job_id
    and approval.target_user_hash = v_target_hash
    and approval.operator_user_hash = v_operator_hash
    and approval.storage_manifest_hash = p_expected_manifest_hash
    and approval.control_epoch = v_control.epoch
    and approval.consumed_at is null
    and approval.revoked_at is null
    and approval.expires_at > clock_timestamp()
    and exists (
      select 1
      from public.app_admins admin
      where encode(digest(admin.user_id::text, 'sha256'), 'hex') = approval.approver_user_hash
    )
  order by approval.created_at desc
  limit 1
  for update;
  if not found then
    return jsonb_build_object('result', 'execution_grant_required');
  end if;

  -- Hold the same relation locks used by the destructive helper while the
  -- reviewed scope is recomputed. The helper reacquires them in the same
  -- transaction, so no family or photo reference can change in between.
  lock table public.families, public.family_members,
    public.people, public.timeline_events, public.homes, public.home_photos,
    public.cases, public.case_photos, public.notebook_storage_deletion_jobs,
    public.person_notebook_storage_deletion_jobs
    in share row exclusive mode;

  select coalesce(array_agg(family.id order by family.id), '{}'::uuid[])
  into v_owned_family_ids
  from public.families family
  where family.owner_user_id = p_target_user_id;
  if v_owned_family_ids is distinct from v_job.owned_family_ids then
    perform account_delete_private.fail_close_account_erasure_execution_control_v1(
      v_control.epoch, 'prepared_scope_changed'
    );
    update public.account_erasure_jobs job
    set status = 'blocked',
        blocked_details = jsonb_build_array(jsonb_build_object('code', 'prepared_scope_changed')),
        last_error_code = 'prepared_scope_changed',
        last_error_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where job.id = v_job.id;
    update public.account_delete_requests request
    set status = 'needs_followup',
        last_status_changed_at = clock_timestamp(),
        handled_by = p_operator_user_id,
        handled_by_method = v_operator_method,
        handled_note = '対象確定後に削除範囲が変わったため再確認が必要'
    where request.id = p_request_id;
    return jsonb_build_object('result', 'prepared_scope_changed');
  end if;

  v_storage := public.merge_account_erasure_storage_objects(
    public.merge_account_erasure_storage_objects(
      public.collect_account_erasure_storage_objects(p_target_user_id, v_owned_family_ids),
      public.collect_account_erasure_pending_cleanup_objects(p_target_user_id, v_owned_family_ids)
    ),
    public.collect_account_erasure_pending_person_cleanup_objects(
      p_target_user_id,
      v_owned_family_ids
    )
  );
  v_storage_prefixes := public.collect_account_erasure_storage_prefixes(v_owned_family_ids);
  v_current_manifest_hash := encode(digest(jsonb_build_object(
    'objects', v_storage,
    'prefixes', v_storage_prefixes
  )::text, 'sha256'), 'hex');
  if v_storage is distinct from v_job.storage_objects
     or v_storage_prefixes is distinct from v_job.storage_prefixes
     or v_current_manifest_hash <> p_expected_manifest_hash then
    perform account_delete_private.fail_close_account_erasure_execution_control_v1(
      v_control.epoch, 'prepared_scope_changed'
    );
    update public.account_erasure_jobs job
    set status = 'blocked',
        blocked_details = jsonb_build_array(jsonb_build_object('code', 'prepared_scope_changed')),
        last_error_code = 'prepared_scope_changed',
        last_error_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where job.id = v_job.id;
    update public.account_delete_requests request
    set status = 'needs_followup',
        last_status_changed_at = clock_timestamp(),
        handled_by = p_operator_user_id,
        handled_by_method = v_operator_method,
        handled_note = '対象確定後に削除範囲が変わったため再確認が必要'
    where request.id = p_request_id;
    return jsonb_build_object('result', 'prepared_scope_changed');
  end if;

  -- Locks and a large manifest can take time. Recheck every time boundary at
  -- the last possible point before invoking the destructive helper.
  v_now := clock_timestamp();
  if v_control.enabled_until <= v_now
     or v_control.closed_at is not null
     or v_control.consumed_at is not null then
    perform account_delete_private.fail_close_account_erasure_execution_control_v1(
      v_control.epoch, 'execution_control_expired'
    );
    return jsonb_build_object('result', 'execution_control_disabled');
  end if;
  if v_job.prepared_expires_at <= v_now then
    perform account_delete_private.fail_close_account_erasure_execution_control_v1(
      v_control.epoch, 'prepared_job_expired'
    );
    return jsonb_build_object('result', 'prepared_job_expired');
  end if;
  if v_grant.expires_at <= v_now then
    perform account_delete_private.fail_close_account_erasure_execution_control_v1(
      v_control.epoch, 'execution_grant_expired'
    );
    return jsonb_build_object('result', 'execution_grant_required');
  end if;

  v_result := public.execute_account_erasure_database_v1(
    p_request_id, p_target_user_id, p_operator_user_id
  );
  if v_result->>'result' = 'database_erased' then
    update account_delete_private.account_erasure_execution_grants approval
    set consumed_at = v_now,
        consumed_by_hash = v_operator_hash
    where approval.id = v_grant.id;
    if not found then
      raise exception using
        errcode = '55000',
        message = 'account_erasure_execution_grant_consume_failed';
    end if;
    update account_delete_private.account_erasure_execution_control control
    set consumed_at = v_now,
        updated_at = v_now
    where control.control_key
      and control.epoch = v_control.epoch
      and control.consumed_at is null
      and control.closed_at is null;
    if not found then
      raise exception using
        errcode = '55000',
        message = 'account_erasure_execution_control_consume_failed';
    end if;

    insert into public.audit_logs (
      actor_user_id, action, target_type, target_id, metadata
    ) values (
      p_operator_user_id,
      'account_erasure_execution_grant_consumed',
      'account_erasure_job',
      p_expected_job_id,
      jsonb_build_object(
        'requestId', p_request_id,
        'grantId', v_grant.id,
        'controlEpoch', v_control.epoch,
        'manifestHash', p_expected_manifest_hash,
        'operatorMethod', v_operator_method,
        'consumedAt', v_now
      )
    );
    insert into public.audit_logs (
      actor_user_id, action, target_type, target_id, metadata
    ) values (
      p_operator_user_id,
      'account_erasure_execution_control_consumed',
      'account_erasure_execution_control',
      v_control.epoch,
      jsonb_build_object(
        'requestId', p_request_id,
        'jobId', p_expected_job_id,
        'grantId', v_grant.id,
        'consumedAt', v_now
      )
    );
    return v_result || jsonb_build_object('grantId', v_grant.id, 'grantConsumed', true);
  end if;

  -- A safety blocker invalidates the reviewed approval. A later attempt must
  -- prepare a fresh scope and obtain a new second-person grant.
  perform account_delete_private.fail_close_account_erasure_execution_control_v1(
    v_control.epoch, 'database_erasure_not_completed'
  );
  return v_result;
end;
$$;

-- Service-only role check for the Web authorization boundary. Raw executor
-- rows include provisioning metadata and are no longer readable by
-- service_role; stale deployments that still query the table therefore fail
-- closed before reaching deletion-list or execution handlers.
create or replace function public.verify_account_delete_operator_v2(
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_method text;
begin
  if p_operator_user_id is null then
    return jsonb_build_object('result', 'invalid_request');
  end if;
  v_method := public.account_erasure_operator_method(p_operator_user_id);
  if v_method is null
     or v_method not in ('supabase_app_admin', 'supabase_account_delete_executor') then
    return jsonb_build_object('result', 'operator_forbidden');
  end if;
  return jsonb_build_object('result', 'authorized', 'method', v_method);
end;
$$;

-- Current Web status/note writer. The legacy v1 RPC remains owner-internal so
-- old immutable deployments cannot bypass the Web's AAL2 requirement. This
-- wrapper repeats the exact app_admin role check under the same lock order as
-- v1 before delegating the atomic request+audit transaction.
create or replace function public.update_account_delete_request_status_v2(
  p_request_id uuid,
  p_status text,
  p_note text,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_request_id is null or p_operator_user_id is null then
    return jsonb_build_object('result', 'invalid_request');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure:' || p_request_id::text, 0)
  );
  lock table public.app_admins, public.account_delete_executors
    in share row exclusive mode;
  if public.account_erasure_operator_method(p_operator_user_id)
     is distinct from 'supabase_app_admin' then
    return jsonb_build_object('result', 'operator_forbidden');
  end if;

  return public.update_account_delete_request_status_v1(
    p_request_id, p_status, p_note, p_operator_user_id
  );
end;
$$;

-- Rebuild operator-facing erasure responses from an explicit allowlist. The
-- v1 preflight helpers are also used internally by the destructive pipeline
-- and may contain family identifiers/names or raw Storage paths. Never pass
-- unknown future v1 fields through this boundary.
create or replace function account_delete_private.sanitize_account_erasure_operator_response_v1(
  p_payload jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_safe jsonb := '{}'::jsonb;
  v_blocked jsonb := '[]'::jsonb;
  v_detail jsonb;
  v_detail_safe jsonb;
  v_key text;
  v_value text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('result', 'safety_check_failed');
  end if;

  v_value := p_payload->>'result';
  if v_value = any (array[
    'invalid_request',
    'operator_forbidden',
    'request_not_found',
    'target_mismatch',
    'already_completed',
    'database_erased',
    'request_already_completed',
    'blocked',
    'ready'
  ]::text[]) then
    v_safe := jsonb_build_object('result', v_value);
  else
    v_safe := jsonb_build_object('result', 'safety_check_failed');
  end if;

  v_value := p_payload->>'code';
  if v_value = any (array[
    'self_erasure_requires_other_admin',
    'last_app_admin',
    'last_account_delete_executor',
    'ownership_transfer_required',
    'shared_photo_transfer_required',
    'storage_manifest_too_large',
    'unsafe_storage_manifest',
    'unsupported_storage_bucket',
    'prepared_scope_changed'
  ]::text[]) then
    v_safe := v_safe || jsonb_build_object('code', v_value);
  end if;

  foreach v_key in array array[
    'ownedFamilyCount',
    'storageObjectCount',
    'storagePrefixCount'
  ]::text[] loop
    if jsonb_typeof(p_payload->v_key) = 'number' then
      v_safe := v_safe || jsonb_build_object(v_key, p_payload->v_key);
    end if;
  end loop;

  if jsonb_typeof(p_payload->'reservationCreated') = 'boolean' then
    v_safe := v_safe || jsonb_build_object(
      'reservationCreated', p_payload->'reservationCreated'
    );
  end if;

  v_value := p_payload->>'jobId';
  if v_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_safe := v_safe || jsonb_build_object('jobId', lower(v_value));
  end if;
  v_value := p_payload->>'storageManifestHash';
  if v_value ~ '^[0-9a-f]{64}$' then
    v_safe := v_safe || jsonb_build_object('storageManifestHash', v_value);
  end if;

  foreach v_key in array array[
    'preparedAt',
    'preparedExpiresAt',
    'completedAt'
  ]::text[] loop
    v_value := p_payload->>v_key;
    if length(v_value) between 20 and 64
       and v_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[ T][0-9:.+-]+$' then
      v_safe := v_safe || jsonb_build_object(v_key, v_value);
    end if;
  end loop;

  if p_payload ? 'blockedDetails' then
    if jsonb_typeof(p_payload->'blockedDetails') = 'array' then
      for v_detail in
        select item.value
        from jsonb_array_elements(p_payload->'blockedDetails') item(value)
      loop
        if jsonb_typeof(v_detail) <> 'object' then
          v_blocked := v_blocked || jsonb_build_array(
            jsonb_build_object('code', 'safety_check_failed')
          );
          continue;
        end if;

        v_value := v_detail->>'code';
        if v_value is null or v_value <> all (array[
          'self_erasure_requires_other_admin',
          'last_app_admin',
          'last_account_delete_executor',
          'ownership_transfer_required',
          'shared_photo_transfer_required',
          'storage_manifest_too_large',
          'unsafe_storage_manifest',
          'unsupported_storage_bucket',
          'prepared_scope_changed'
        ]::text[]) then
          v_value := 'safety_check_failed';
        end if;
        v_detail_safe := jsonb_build_object('code', v_value);

        foreach v_key in array array[
          'count',
          'maxEntriesPerKind',
          'objectCount',
          'prefixCount',
          'photoCount',
          'otherMemberCount'
        ]::text[] loop
          if jsonb_typeof(v_detail->v_key) = 'number' then
            v_detail_safe := v_detail_safe || jsonb_build_object(v_key, v_detail->v_key);
          end if;
        end loop;
        v_blocked := v_blocked || jsonb_build_array(v_detail_safe);
      end loop;
    end if;
    v_safe := v_safe || jsonb_build_object('blockedDetails', v_blocked);
  end if;

  return v_safe;
end;
$$;

-- Service-only, privacy-safe read preview. It deliberately delegates all
-- authorization and authoritative scope computation to v1, then rebuilds the
-- JSON response through the private allowlist above.
create or replace function public.inspect_account_erasure_v2(
  p_request_id uuid,
  p_target_user_id uuid,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, account_delete_private
as $$
declare
  v_raw jsonb;
begin
  v_raw := public.inspect_account_erasure_v1(
    p_request_id, p_target_user_id, p_operator_user_id
  );
  return account_delete_private.sanitize_account_erasure_operator_response_v1(v_raw);
end;
$$;

-- Service-only durable preparation. The safe response contains the exact job
-- and manifest the reviewer must approve, plus non-PII counts and deadlines;
-- raw Storage objects/prefixes remain only in the protected job row.
create or replace function public.prepare_account_erasure_v2(
  p_request_id uuid,
  p_target_user_id uuid,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, account_delete_private, extensions
as $$
declare
  v_raw jsonb;
  v_job public.account_erasure_jobs%rowtype;
  v_target_hash text;
begin
  if p_request_id is null
     or p_target_user_id is null
     or p_operator_user_id is null then
    return jsonb_build_object('result', 'invalid_request');
  end if;

  -- Use the same lock order as grant/execute/status: target, request, then
  -- authorization relations. Reacquisition inside v1 is transaction-local and
  -- prevents both a role-swap TOCTOU and cross-path deadlocks.
  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure-target:' || p_target_user_id::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure:' || p_request_id::text, 0)
  );
  lock table public.app_admins, public.account_delete_executors
    in share row exclusive mode;
  if public.account_erasure_operator_method(p_operator_user_id)
     is distinct from 'supabase_account_delete_executor' then
    return jsonb_build_object('result', 'operator_forbidden');
  end if;

  v_raw := public.prepare_account_erasure_v1(
    p_request_id, p_target_user_id, p_operator_user_id
  );

  if v_raw->>'result' in ('ready', 'blocked', 'database_erased', 'already_completed')
     and p_target_user_id is not null then
    v_target_hash := encode(digest(p_target_user_id::text, 'sha256'), 'hex');
    select * into v_job
    from public.account_erasure_jobs job
    where job.request_id = p_request_id
      and job.target_user_hash = v_target_hash;

    if found then
      v_raw := v_raw || jsonb_build_object(
        'jobId', v_job.id,
        'storageObjectCount', case
          when jsonb_typeof(v_job.storage_objects) = 'array'
            then jsonb_array_length(v_job.storage_objects)
          else 0
        end,
        'storagePrefixCount', case
          when jsonb_typeof(v_job.storage_prefixes) = 'array'
            then jsonb_array_length(v_job.storage_prefixes)
          else 0
        end
      );
      if v_raw->>'result' = 'ready' and v_job.status = 'prepared' then
        v_raw := v_raw || jsonb_build_object(
          'storageManifestHash', v_job.storage_manifest_hash,
          'preparedAt', v_job.prepared_at,
          'preparedExpiresAt', v_job.prepared_expires_at
        );
      elsif v_raw->>'result' = 'already_completed' then
        v_raw := v_raw || jsonb_build_object('completedAt', v_job.completed_at);
      end if;
    end if;
  end if;

  return account_delete_private.sanitize_account_erasure_operator_response_v1(v_raw);
end;
$$;

alter table account_delete_private.account_erasure_execution_control owner to postgres;
alter table account_delete_private.account_erasure_execution_grants owner to postgres;
alter function account_delete_private.open_account_erasure_execution_control_v1(integer)
  owner to postgres;
alter function account_delete_private.close_account_erasure_execution_control_v1()
  owner to postgres;
alter function account_delete_private.fail_close_account_erasure_execution_control_v1(uuid, text)
  owner to postgres;
alter function account_delete_private.create_account_erasure_execution_grant_v1(
  uuid, uuid, uuid, uuid, uuid, text, integer
) owner to postgres;
alter function account_delete_private.stamp_account_erasure_prepared_window()
  owner to postgres;
alter function account_delete_private.revoke_grant_after_reprepare()
  owner to postgres;
alter function account_delete_private.sanitize_account_erasure_operator_response_v1(jsonb)
  owner to postgres;
alter function public.inspect_account_erasure_v2(uuid, uuid, uuid)
  owner to postgres;
alter function public.prepare_account_erasure_v2(uuid, uuid, uuid)
  owner to postgres;
alter function public.verify_account_delete_operator_v2(uuid)
  owner to postgres;
alter function public.update_account_delete_request_status_v2(uuid, text, text, uuid)
  owner to postgres;
alter function public.inspect_account_erasure_execution_grant_v1(
  uuid, uuid, uuid, uuid, text
) owner to postgres;
alter function public.issue_account_erasure_execution_grant_v1(
  uuid, uuid, uuid, uuid, text, integer
) owner to postgres;
alter function public.execute_account_erasure_database_v2(
  uuid, uuid, uuid, uuid, text
) owner to postgres;

revoke all on table account_delete_private.account_erasure_execution_control
  from public, anon, authenticated, service_role;
revoke all on table account_delete_private.account_erasure_execution_grants
  from public, anon, authenticated, service_role;
revoke all on table public.account_delete_executors
  from public, anon, authenticated, service_role;
revoke all on function account_delete_private.open_account_erasure_execution_control_v1(integer)
  from public, anon, authenticated, service_role;
revoke all on function account_delete_private.close_account_erasure_execution_control_v1()
  from public, anon, authenticated, service_role;
revoke all on function account_delete_private.fail_close_account_erasure_execution_control_v1(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function account_delete_private.create_account_erasure_execution_grant_v1(
  uuid, uuid, uuid, uuid, uuid, text, integer
) from public, anon, authenticated, service_role;
revoke all on function account_delete_private.stamp_account_erasure_prepared_window()
  from public, anon, authenticated, service_role;
revoke all on function account_delete_private.revoke_grant_after_reprepare()
  from public, anon, authenticated, service_role;
revoke all on function account_delete_private.sanitize_account_erasure_operator_response_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.guard_erased_notebook_storage_write()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_erased_notebook_attachment_reference()
  from public, anon, authenticated, service_role;
revoke all on function public.inspect_account_erasure_execution_grant_v1(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function public.issue_account_erasure_execution_grant_v1(
  uuid, uuid, uuid, uuid, text, integer
) from public, anon, authenticated, service_role;
revoke all on function public.execute_account_erasure_database_v2(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;

-- The legacy operator preflight responses can contain raw identifiers and
-- Storage paths. They remain callable by owner-owned internal SQL only; the
-- service receives only the v2 allowlisted wrappers.
revoke all on function public.inspect_account_erasure_v1(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.prepare_account_erasure_v1(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.inspect_account_erasure_v2(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.prepare_account_erasure_v2(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.verify_account_delete_operator_v2(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.update_account_delete_request_status_v1(uuid, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.update_account_delete_request_status_v2(uuid, text, text, uuid)
  from public, anon, authenticated, service_role;

-- Critical compatibility break: a generated deployment containing the old
-- route may still be reachable, but its direct v1 RPC can no longer erase DB
-- data. Only the exact-job, one-time-grant wrapper is service-executable.
revoke all on function public.execute_account_erasure_database_v1(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.inspect_account_erasure_v2(uuid, uuid, uuid)
  to service_role;
grant execute on function public.prepare_account_erasure_v2(uuid, uuid, uuid)
  to service_role;
grant execute on function public.verify_account_delete_operator_v2(uuid)
  to service_role;
grant execute on function public.update_account_delete_request_status_v2(uuid, text, text, uuid)
  to service_role;
grant execute on function public.inspect_account_erasure_execution_grant_v1(
  uuid, uuid, uuid, uuid, text
) to service_role;
grant execute on function public.issue_account_erasure_execution_grant_v1(
  uuid, uuid, uuid, uuid, text, integer
) to service_role;
grant execute on function public.execute_account_erasure_database_v2(
  uuid, uuid, uuid, uuid, text
) to service_role;

-- Recheck that neither private table nor any private helper inherited an
-- accidental ACL. PostgreSQL grants PUBLIC EXECUTE on new functions by
-- default, so the explicit revokes above and this final assertion are both
-- required.
do $owner_only_acl_guard$
declare
  v_owner_id oid := (select oid from pg_roles where rolname = 'postgres');
begin
  if exists (
    select 1
    from pg_class relation
    cross join lateral aclexplode(
      coalesce(relation.relacl, acldefault('r', relation.relowner))
    ) privilege
    where relation.oid in (
      'account_delete_private.account_erasure_execution_control'::regclass,
      'account_delete_private.account_erasure_execution_grants'::regclass
    )
      and privilege.grantee <> v_owner_id
  ) or exists (
    select 1
    from pg_proc procedure_info
    cross join lateral aclexplode(
      coalesce(procedure_info.proacl, acldefault('f', procedure_info.proowner))
    ) privilege
    where procedure_info.oid in (
      'account_delete_private.open_account_erasure_execution_control_v1(integer)'::regprocedure,
      'account_delete_private.close_account_erasure_execution_control_v1()'::regprocedure,
      'account_delete_private.fail_close_account_erasure_execution_control_v1(uuid,text)'::regprocedure,
      'account_delete_private.create_account_erasure_execution_grant_v1(uuid,uuid,uuid,uuid,uuid,text,integer)'::regprocedure,
      'account_delete_private.stamp_account_erasure_prepared_window()'::regprocedure,
      'account_delete_private.revoke_grant_after_reprepare()'::regprocedure,
      'account_delete_private.sanitize_account_erasure_operator_response_v1(jsonb)'::regprocedure
    )
      and privilege.grantee <> v_owner_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'account-erasure execution control has a non-owner private ACL';
  end if;
end;
$owner_only_acl_guard$;

commit;
