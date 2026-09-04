-- Transactional diary deletion contract for the Web notebook.
-- Apply after schema.sql, ai_consult_memory.sql, and notebook_atomic_sync_v2.sql.

create table if not exists public.notebook_storage_deletion_jobs (
  id uuid primary key default uuid_generate_v4(),
  -- These are immutable audit identities, deliberately not foreign keys. A
  -- queued object must remain recoverable even if the family/person/account is
  -- deleted before a failed Storage operation is retried.
  family_id uuid not null,
  person_id uuid not null,
  event_id uuid not null,
  local_case_id text not null,
  local_diary_id text not null,
  storage_bucket text not null,
  storage_path text not null,
  status text not null default 'pending',
  -- Nullable so a completed account erasure can remove the uploader's raw
  -- account UUID without dropping this retryable Storage cleanup receipt.
  created_by uuid,
  created_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  completed_at timestamptz,
  constraint notebook_storage_deletion_jobs_status
    check (status in ('pending', 'completed')),
  constraint notebook_storage_deletion_jobs_path_unique
    unique (storage_bucket, storage_path)
);

-- Also make a re-application repair an earlier draft of this migration, whose
-- cascading foreign keys could erase the only durable cleanup receipt.
alter table public.notebook_storage_deletion_jobs
  drop constraint if exists notebook_storage_deletion_jobs_family_id_fkey,
  drop constraint if exists notebook_storage_deletion_jobs_person_id_fkey,
  drop constraint if exists notebook_storage_deletion_jobs_created_by_fkey;

alter table public.notebook_storage_deletion_jobs
  alter column created_by drop not null;

alter table public.notebook_storage_deletion_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.notebook_storage_deletion_jobs'::regclass
      and conname = 'notebook_storage_deletion_jobs_attempt_count_nonnegative'
  ) then
    alter table public.notebook_storage_deletion_jobs
      add constraint notebook_storage_deletion_jobs_attempt_count_nonnegative
      check (attempt_count >= 0);
  end if;
end;
$$;

create index if not exists idx_notebook_storage_deletion_jobs_retry
  on public.notebook_storage_deletion_jobs (family_id, person_id, local_case_id, local_diary_id, status);

create index if not exists idx_notebook_storage_deletion_jobs_pending
  on public.notebook_storage_deletion_jobs (created_at, id)
  where status = 'pending';

alter table public.notebook_storage_deletion_jobs enable row level security;
revoke all on table public.notebook_storage_deletion_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.notebook_storage_deletion_jobs to service_role;

-- Terminal anti-resurrection receipt. It deliberately has no actor UUID or
-- parent foreign key: the identity must survive an interrupted response and a
-- later family/member cleanup long enough to reject stale notebook syncs.
create table if not exists public.notebook_diary_deletion_receipts (
  family_id uuid not null,
  person_id uuid not null,
  local_case_id text not null,
  local_diary_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (family_id, person_id, local_case_id, local_diary_id),
  constraint notebook_diary_deletion_receipts_local_case_id_nonempty
    check (length(btrim(local_case_id)) between 1 and 200),
  constraint notebook_diary_deletion_receipts_local_diary_id_nonempty
    check (length(btrim(local_diary_id)) between 1 and 200)
);

create index if not exists idx_notebook_diary_deletion_receipts_person
  on public.notebook_diary_deletion_receipts (person_id, deleted_at);

alter table public.notebook_diary_deletion_receipts enable row level security;
revoke all on table public.notebook_diary_deletion_receipts from public, anon, authenticated;
grant select, insert, delete on table public.notebook_diary_deletion_receipts to service_role;

create or replace function public.guard_notebook_storage_deletion_paths()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family_id uuid;
  v_actor_id uuid := auth.uid();
  v_claim_role text;
  v_local_case_id text;
  v_local_diary_id text;
  v_attachment jsonb;
  v_bucket text;
  v_path text;
begin
  if new.event_type <> 'diary' or jsonb_typeof(coalesce(new.attachments, '[]'::jsonb)) <> 'array' then
    return new;
  end if;

  select p.family_id into v_family_id
  from public.people p
  where p.id = new.person_id;
  if v_family_id is null then
    return new;
  end if;

  -- All Web syncs already use this family lock. Taking it in the trigger also
  -- covers direct authenticated timeline writes, closing the reference race
  -- between the delete transaction and a concurrent insert/update.
  perform pg_advisory_xact_lock(hashtextextended('notebook-family:' || v_family_id::text, 0));

  -- RLS evaluates against the INSERT/UPDATE statement snapshot. If a member
  -- starts a direct write while removal holds the family lock, that snapshot
  -- can still contain the soon-to-be-deleted membership. A locking read after
  -- the advisory wait follows the concurrent DELETE and fails closed. Service
  -- role notebook sync already validates its explicit actor under this lock.
  v_claim_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}'::text)::jsonb)->>'role',
    ''
  );
  if v_actor_id is not null and v_claim_role <> 'service_role' then
    perform 1
    from public.family_members membership
    where membership.family_id = v_family_id
      and membership.user_id = v_actor_id
      and membership.role in ('owner', 'admin', 'member')
    for key share;
    if not found then
      raise exception using
        errcode = '42501',
        message = 'notebook_timeline_membership_no_longer_valid';
    end if;
  end if;

  v_local_case_id := nullif(btrim(new.metadata->>'localCaseId'), '');
  v_local_diary_id := nullif(btrim(new.metadata->>'localDiaryId'), '');
  if v_local_case_id is not null and v_local_diary_id is not null and exists (
    select 1
    from public.notebook_diary_deletion_receipts receipt
    where receipt.family_id = v_family_id
      and receipt.person_id = new.person_id
      and receipt.local_case_id = v_local_case_id
      and receipt.local_diary_id = v_local_diary_id
  ) then
    raise exception using
      errcode = '40001',
      message = 'notebook_diary_deleted';
  end if;

  for v_attachment in
    select value
    from jsonb_array_elements(coalesce(new.attachments, '[]'::jsonb))
    order by value->>'storageBucket', value->>'storagePath'
  loop
    v_bucket := nullif(btrim(v_attachment->>'storageBucket'), '');
    v_path := nullif(btrim(v_attachment->>'storagePath'), '');
    if v_bucket is null or v_path is null then
      continue;
    end if;
    -- A user can belong to multiple families. The object-path lock therefore
    -- complements the family lock and serializes references globally.
    perform pg_advisory_xact_lock(hashtextextended('notebook-storage:' || v_bucket || ':' || v_path, 0));
    if exists (
      select 1 from public.notebook_storage_deletion_jobs job
      where job.storage_bucket = v_bucket and job.storage_path = v_path
    ) then
      raise exception using
        errcode = '40001',
        message = 'notebook_storage_path_pending_deletion';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists timeline_events_notebook_storage_delete_guard on public.timeline_events;
create trigger timeline_events_notebook_storage_delete_guard
before insert or update on public.timeline_events
for each row execute function public.guard_notebook_storage_deletion_paths();

revoke all on function public.guard_notebook_storage_deletion_paths() from public, anon, authenticated, service_role;

create or replace function public.delete_notebook_diary_v1(
  p_actor_user_id uuid,
  p_family_id uuid,
  p_person_id uuid,
  p_local_case_id text,
  p_local_diary_id text,
  p_expected_cloud_revision bigint,
  p_expected_cloud_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_claim_role text;
  v_person public.people%rowtype;
  v_event public.timeline_events%rowtype;
  v_event_count integer;
  v_attachment jsonb;
  v_bucket text;
  v_path text;
  v_owner_id uuid;
  v_existing_job public.notebook_storage_deletion_jobs%rowtype;
  v_deleted_id uuid;
  v_jobs jsonb;
  v_already_deleted boolean := false;
  v_receipt_recorded boolean := false;
begin
  v_claim_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}'::text)::jsonb)->>'role',
    ''
  );
  if v_claim_role <> 'service_role' then
    raise exception using errcode = '42501', message = 'notebook_diary_delete_service_role_required';
  end if;

  if p_actor_user_id is null or p_family_id is null or p_person_id is null
     or nullif(btrim(p_local_case_id), '') is null
     or nullif(btrim(p_local_diary_id), '') is null
     or length(p_local_case_id) > 200
     or length(p_local_diary_id) > 200 then
    raise exception using errcode = '22023', message = 'notebook_diary_delete_invalid_identity';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('notebook-family:' || p_family_id::text, 0));

  select fm.role into v_role
  from public.family_members fm
  where fm.family_id = p_family_id
    and fm.user_id = p_actor_user_id;
  if v_role is null then
    raise exception using errcode = '42501', message = 'notebook_diary_delete_family_access_denied';
  end if;
  if v_role not in ('owner', 'admin', 'member') then
    raise exception using errcode = '42501', message = 'notebook_diary_delete_viewer_read_only';
  end if;

  select p.* into v_person
  from public.people p
  where p.id = p_person_id
    and p.family_id = p_family_id
  for update;
  if not found or coalesce(nullif(btrim(v_person.profile->>'localCaseId'), ''), v_person.id::text) <> p_local_case_id then
    raise exception using errcode = 'P0002', message = 'notebook_diary_delete_person_not_found';
  end if;

  select exists (
    select 1
    from public.notebook_diary_deletion_receipts receipt
    where receipt.family_id = p_family_id
      and receipt.person_id = p_person_id
      and receipt.local_case_id = p_local_case_id
      and receipt.local_diary_id = p_local_diary_id
  ) into v_already_deleted;

  select count(*) into v_event_count
  from public.timeline_events e
  where e.person_id = p_person_id
    and e.event_type = 'diary'
    and coalesce(nullif(btrim(e.metadata->>'localCaseId'), ''), p_local_case_id) = p_local_case_id
    and coalesce(nullif(btrim(e.metadata->>'localDiaryId'), ''), e.id::text) = p_local_diary_id;
  if v_event_count > 1 then
    raise exception using errcode = '21000', message = 'notebook_diary_delete_identity_conflict';
  end if;

  select e.* into v_event
  from public.timeline_events e
  where e.person_id = p_person_id
    and e.event_type = 'diary'
    and coalesce(nullif(btrim(e.metadata->>'localCaseId'), ''), p_local_case_id) = p_local_case_id
    and coalesce(nullif(btrim(e.metadata->>'localDiaryId'), ''), e.id::text) = p_local_diary_id
  for update;

  if found then
    if v_already_deleted then
      raise exception using errcode = '40001', message = 'notebook_diary_deleted_identity_conflict';
    end if;
    if p_expected_cloud_revision is null
       or nullif(btrim(p_expected_cloud_hash), '') is null
       or p_expected_cloud_revision is distinct from v_event.cloud_revision
       or p_expected_cloud_hash is distinct from v_event.cloud_hash then
      raise exception using errcode = '40001', message = 'notebook_diary_delete_conflict';
    end if;

    for v_attachment in
      select value
      from jsonb_array_elements(coalesce(v_event.attachments, '[]'::jsonb))
      order by value->>'storageBucket', value->>'storagePath'
    loop
      v_bucket := nullif(btrim(v_attachment->>'storageBucket'), '');
      v_path := nullif(btrim(v_attachment->>'storagePath'), '');
      if v_bucket is null and v_path is null then
        continue;
      end if;
      if v_bucket is null or v_path is null then
        raise exception using errcode = '22023', message = 'notebook_diary_delete_invalid_storage_identity';
      end if;
      if v_bucket <> 'home-photos' then
        raise exception using errcode = '22023', message = 'notebook_diary_delete_unsupported_storage_bucket';
      end if;
      if v_path !~* '^notebook/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/]+$' then
        raise exception using errcode = '22023', message = 'notebook_diary_delete_invalid_storage_identity';
      end if;
      v_owner_id := split_part(v_path, '/', 2)::uuid;
      if not exists (
        select 1 from public.family_members fm
        where fm.family_id = p_family_id and fm.user_id = v_owner_id
      ) then
        raise exception using errcode = '42501', message = 'notebook_diary_delete_storage_owner_denied';
      end if;
      perform pg_advisory_xact_lock(hashtextextended('notebook-storage:' || v_bucket || ':' || v_path, 0));
      if exists (
        select 1
        from public.timeline_events other_event
        cross join lateral jsonb_array_elements(coalesce(other_event.attachments, '[]'::jsonb)) other_attachment
        where other_event.id <> v_event.id
          and other_attachment->>'storageBucket' = v_bucket
          and other_attachment->>'storagePath' = v_path
      ) then
        raise exception using errcode = '40001', message = 'notebook_diary_delete_shared_storage_reference';
      end if;

      select job.* into v_existing_job
      from public.notebook_storage_deletion_jobs job
      where job.storage_bucket = v_bucket and job.storage_path = v_path
      for update;
      if found and (
        v_existing_job.family_id <> p_family_id
        or v_existing_job.person_id <> p_person_id
        or v_existing_job.local_case_id <> p_local_case_id
        or v_existing_job.local_diary_id <> p_local_diary_id
      ) then
        raise exception using errcode = '40001', message = 'notebook_diary_delete_storage_job_conflict';
      end if;
      if not found then
        insert into public.notebook_storage_deletion_jobs (
          family_id, person_id, event_id, local_case_id, local_diary_id,
          storage_bucket, storage_path, status, created_by
        ) values (
          p_family_id, p_person_id, v_event.id, p_local_case_id, p_local_diary_id,
          v_bucket, v_path, 'pending', p_actor_user_id
        );
      end if;
    end loop;

    insert into public.notebook_diary_deletion_receipts (
      family_id, person_id, local_case_id, local_diary_id, deleted_at
    ) values (
      p_family_id, p_person_id, p_local_case_id, p_local_diary_id, now()
    )
    on conflict (family_id, person_id, local_case_id, local_diary_id) do nothing;

    delete from public.timeline_events e
    where e.id = v_event.id
      and e.person_id = p_person_id
      and e.cloud_revision = p_expected_cloud_revision
      and e.cloud_hash = p_expected_cloud_hash
    returning e.id into v_deleted_id;
    if v_deleted_id is null then
      raise exception using errcode = '40001', message = 'notebook_diary_delete_conflict';
    end if;

    -- Remove all server-derived text and source pointers in the same transaction.
    -- A later memory read rebuilds from the remaining timeline rows. Preserve the
    -- family-authored user_summary and exclusion/reset preferences.
    update public.person_ai_memories
    set long_term_summary = '',
        important_changes = '[]'::jsonb,
        source_event_ids = '{}'::uuid[],
        record_count = 0,
        first_record_date = null,
        last_record_date = null,
        memory_version = memory_version + 1,
        updated_by = p_actor_user_id,
        updated_at = now()
    where person_id = p_person_id;
  else
    -- A local-only row can race with an already-built sync payload. Persist the
    -- terminal identity even when this request finds no cloud event, so that a
    -- delayed/replayed sync cannot recreate it after the delete response.
    insert into public.notebook_diary_deletion_receipts (
      family_id, person_id, local_case_id, local_diary_id, deleted_at
    ) values (
      p_family_id, p_person_id, p_local_case_id, p_local_diary_id, now()
    )
    on conflict (family_id, person_id, local_case_id, local_diary_id) do nothing;
  end if;

  select exists (
    select 1
    from public.notebook_diary_deletion_receipts receipt
    where receipt.family_id = p_family_id
      and receipt.person_id = p_person_id
      and receipt.local_case_id = p_local_case_id
      and receipt.local_diary_id = p_local_diary_id
  ) into v_receipt_recorded;
  if not v_receipt_recorded then
    raise exception using errcode = 'P0001', message = 'notebook_diary_delete_receipt_failed';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', job.id,
    'bucket', job.storage_bucket,
    'storagePath', job.storage_path,
    'attemptCount', job.attempt_count
  ) order by job.storage_path), '[]'::jsonb)
  into v_jobs
  from public.notebook_storage_deletion_jobs job
  where job.family_id = p_family_id
    and job.person_id = p_person_id
    and job.local_case_id = p_local_case_id
    and job.local_diary_id = p_local_diary_id
    and job.status = 'pending';

  return jsonb_build_object(
    'ok', true,
    'deleted', v_deleted_id is not null,
    'alreadyDeleted', v_deleted_id is null and v_already_deleted,
    'receiptRecorded', v_receipt_recorded,
    'storageJobs', v_jobs
  );
end;
$$;

revoke all on function public.delete_notebook_diary_v1(uuid, uuid, uuid, text, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.delete_notebook_diary_v1(uuid, uuid, uuid, text, text, bigint, text)
  to service_role;
