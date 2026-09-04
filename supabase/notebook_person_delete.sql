-- Transactional whole-person notebook deletion.
-- Apply after schema.sql, ai_consult_memory.sql, notebook_atomic_sync_v2.sql,
-- notebook_diary_delete.sql, and consult_daily_claim.sql.
-- Safe to apply repeatedly. The receipt and Storage jobs intentionally have no
-- foreign keys so deletion can finish after the person or account is gone.

begin;

create table if not exists public.person_notebook_deletion_receipts (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null,
  person_id uuid not null,
  local_case_id text not null,
  expected_cloud_revision bigint not null,
  expected_cloud_hash text not null,
  deleted_by uuid,
  deleted_at timestamptz not null default now(),
  deleted_counts jsonb not null default '{}'::jsonb,
  constraint person_notebook_deletion_receipts_identity_unique
    unique (family_id, person_id, local_case_id),
  constraint person_notebook_deletion_receipts_local_case_not_blank
    check (length(btrim(local_case_id)) between 1 and 200),
  constraint person_notebook_deletion_receipts_revision_positive
    check (expected_cloud_revision >= 1),
  constraint person_notebook_deletion_receipts_hash_sha256
    check (expected_cloud_hash ~ '^[0-9a-f]{64}$'),
  constraint person_notebook_deletion_receipts_counts_object
    check (jsonb_typeof(deleted_counts) = 'object')
);

-- Repair an early draft if this migration is reapplied over it. Receipts must
-- survive deletion of every identity they describe.
alter table public.person_notebook_deletion_receipts
  drop constraint if exists person_notebook_deletion_receipts_family_id_fkey,
  drop constraint if exists person_notebook_deletion_receipts_person_id_fkey,
  drop constraint if exists person_notebook_deletion_receipts_deleted_by_fkey;

create index if not exists idx_person_notebook_deletion_receipts_lookup
  on public.person_notebook_deletion_receipts (family_id, local_case_id, deleted_at desc);

alter table public.person_notebook_deletion_receipts enable row level security;
alter table public.person_notebook_deletion_receipts force row level security;
revoke all on table public.person_notebook_deletion_receipts from public, anon, authenticated, service_role;

create table if not exists public.person_notebook_storage_deletion_jobs (
  id uuid primary key default uuid_generate_v4(),
  family_id uuid not null,
  person_id uuid not null,
  local_case_id text not null,
  storage_bucket text not null,
  storage_path text not null,
  status text not null default 'pending',
  created_by uuid,
  created_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  completed_at timestamptz,
  constraint person_notebook_storage_deletion_jobs_path_unique
    unique (storage_bucket, storage_path),
  constraint person_notebook_storage_deletion_jobs_status
    check (status in ('pending', 'completed')),
  constraint person_notebook_storage_deletion_jobs_attempt_nonnegative
    check (attempt_count >= 0),
  constraint person_notebook_storage_deletion_jobs_local_case_not_blank
    check (length(btrim(local_case_id)) between 1 and 200)
);

alter table public.person_notebook_storage_deletion_jobs
  drop constraint if exists person_notebook_storage_deletion_jobs_family_id_fkey,
  drop constraint if exists person_notebook_storage_deletion_jobs_person_id_fkey,
  drop constraint if exists person_notebook_storage_deletion_jobs_created_by_fkey;

alter table public.person_notebook_storage_deletion_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text,
  add column if not exists completed_at timestamptz;

create index if not exists idx_person_notebook_storage_deletion_jobs_pending
  on public.person_notebook_storage_deletion_jobs (created_at, id)
  where status = 'pending';
create index if not exists idx_person_notebook_storage_deletion_jobs_person
  on public.person_notebook_storage_deletion_jobs (family_id, person_id, local_case_id, status);

alter table public.person_notebook_storage_deletion_jobs enable row level security;
alter table public.person_notebook_storage_deletion_jobs force row level security;
revoke all on table public.person_notebook_storage_deletion_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.person_notebook_storage_deletion_jobs to service_role;

-- Once a whole notebook was deleted, a stale browser must not recreate its
-- person row by sending an old localCaseId through notebook sync.
create or replace function public.guard_deleted_person_notebook_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_local_case_id text;
begin
  v_local_case_id := coalesce(
    nullif(btrim(new.profile->>'localCaseId'), ''),
    new.id::text
  );
  if exists (
    select 1
    from public.person_notebook_deletion_receipts receipt
    where receipt.family_id = new.family_id
      and receipt.local_case_id = v_local_case_id
  ) then
    raise exception using
      errcode = '40001',
      message = 'person_notebook_deleted_identity';
  end if;
  return new;
end;
$$;

drop trigger if exists zz_people_deleted_notebook_guard on public.people;
create trigger zz_people_deleted_notebook_guard
before insert or update of family_id, profile on public.people
for each row execute function public.guard_deleted_person_notebook_identity();

revoke all on function public.guard_deleted_person_notebook_identity()
  from public, anon, authenticated, service_role;

-- A queued path is immutable deletion intent. All three current reference
-- sources reject inserting or rebinding that path after it has been queued.
create or replace function public.guard_person_notebook_storage_deletion_path()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attachment jsonb;
  v_bucket text;
  v_path text;
begin
  if tg_table_name = 'timeline_events' then
    if jsonb_typeof(coalesce(new.attachments, '[]'::jsonb)) <> 'array' then
      return new;
    end if;
    for v_attachment in
      select value from jsonb_array_elements(coalesce(new.attachments, '[]'::jsonb))
    loop
      v_bucket := coalesce(nullif(btrim(v_attachment->>'storageBucket'), ''), 'home-photos');
      v_path := nullif(btrim(v_attachment->>'storagePath'), '');
      if v_path is null then continue; end if;
      perform pg_advisory_xact_lock(hashtextextended('notebook-storage:' || v_bucket || ':' || v_path, 0));
      if exists (
        select 1 from public.person_notebook_storage_deletion_jobs job
        where job.storage_bucket = v_bucket and job.storage_path = v_path
      ) then
        raise exception using errcode = '40001', message = 'person_notebook_storage_path_pending_deletion';
      end if;
    end loop;
    return new;
  end if;

  v_bucket := 'home-photos';
  v_path := nullif(btrim(new.storage_path), '');
  if v_path is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('notebook-storage:' || v_bucket || ':' || v_path, 0));
  if exists (
    select 1 from public.person_notebook_storage_deletion_jobs job
    where job.storage_bucket = v_bucket and job.storage_path = v_path
  ) then
    raise exception using errcode = '40001', message = 'person_notebook_storage_path_pending_deletion';
  end if;
  return new;
end;
$$;

drop trigger if exists timeline_events_person_notebook_storage_delete_guard on public.timeline_events;
create trigger timeline_events_person_notebook_storage_delete_guard
before insert or update of attachments on public.timeline_events
for each row execute function public.guard_person_notebook_storage_deletion_path();

drop trigger if exists home_photos_person_notebook_storage_delete_guard on public.home_photos;
create trigger home_photos_person_notebook_storage_delete_guard
before insert or update of storage_path on public.home_photos
for each row execute function public.guard_person_notebook_storage_deletion_path();

drop trigger if exists case_photos_person_notebook_storage_delete_guard on public.case_photos;
create trigger case_photos_person_notebook_storage_delete_guard
before insert or update of storage_path on public.case_photos
for each row execute function public.guard_person_notebook_storage_deletion_path();

revoke all on function public.guard_person_notebook_storage_deletion_path()
  from public, anon, authenticated, service_role;

create or replace function public.person_notebook_storage_path_is_referenced(
  p_storage_bucket text,
  p_storage_path text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_storage_bucket <> 'home-photos' or nullif(btrim(p_storage_path), '') is null then
    return true;
  end if;
  return exists (
    select 1
    from public.timeline_events event
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
        then coalesce(event.attachments, '[]'::jsonb) else '[]'::jsonb end
    ) attachment(value)
    where coalesce(nullif(btrim(attachment.value->>'storageBucket'), ''), 'home-photos') = p_storage_bucket
      and nullif(btrim(attachment.value->>'storagePath'), '') = p_storage_path
  ) or exists (
    select 1 from public.home_photos where storage_path = p_storage_path
  ) or exists (
    select 1 from public.case_photos where storage_path = p_storage_path
  );
end;
$$;

revoke all on function public.person_notebook_storage_path_is_referenced(text, text)
  from public, anon, authenticated;
grant execute on function public.person_notebook_storage_path_is_referenced(text, text)
  to service_role;

create or replace function public.delete_person_notebook_v1(
  p_actor_user_id uuid,
  p_family_id uuid,
  p_person_id uuid,
  p_local_case_id text,
  p_expected_cloud_revision bigint,
  p_expected_cloud_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_claim_role text;
  v_role text;
  v_person public.people%rowtype;
  v_receipt public.person_notebook_deletion_receipts%rowtype;
  v_object jsonb;
  v_path text;
  v_owner_text text;
  v_home_id_text text;
  v_case_id_text text;
  v_storage jsonb := '[]'::jsonb;
  v_counts jsonb;
  v_deleted_id uuid;
  v_unknown_reference text;
  v_job_count integer := 0;
begin
  -- Function ACL is the primary boundary. The claim check is defense in depth:
  -- an accidental future GRANT must not make p_actor_user_id impersonable.
  v_claim_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}'::text)::jsonb)->>'role',
    ''
  );
  if v_claim_role <> 'service_role' then
    raise exception using errcode = '42501', message = 'person_notebook_delete_service_role_required';
  end if;

  if p_actor_user_id is null or p_family_id is null or p_person_id is null
     or nullif(btrim(p_local_case_id), '') is null
     or length(p_local_case_id) > 200
     or p_expected_cloud_revision is null or p_expected_cloud_revision < 1
     or p_expected_cloud_hash is null
     or p_expected_cloud_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'person_notebook_delete_invalid_identity';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('notebook-family:' || p_family_id::text, 0));

  -- Family role changes use the same lock. Authorize only after acquiring it,
  -- so a concurrent demotion/removal cannot leave this transaction acting on
  -- a role snapshot that is no longer current.
  select fm.role into v_role
  from public.family_members fm
  where fm.family_id = p_family_id and fm.user_id = p_actor_user_id;
  if v_role is null then
    raise exception using errcode = '42501', message = 'person_notebook_delete_family_access_denied';
  end if;
  if v_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'person_notebook_delete_owner_admin_required';
  end if;

  select receipt.* into v_receipt
  from public.person_notebook_deletion_receipts receipt
  where receipt.family_id = p_family_id
    and receipt.person_id = p_person_id
    and receipt.local_case_id = p_local_case_id
  for update;
  if found then
    if v_receipt.expected_cloud_revision <> p_expected_cloud_revision
       or v_receipt.expected_cloud_hash <> p_expected_cloud_hash then
      raise exception using errcode = '40001', message = 'person_notebook_delete_receipt_conflict';
    end if;
    select count(*) into v_job_count
    from public.person_notebook_storage_deletion_jobs job
    where job.family_id = p_family_id
      and job.person_id = p_person_id
      and job.local_case_id = p_local_case_id
      and job.status = 'pending';
    return jsonb_build_object(
      'ok', true,
      'deleted', false,
      'alreadyDeleted', true,
      'deletedAt', v_receipt.deleted_at,
      'deletedCounts', v_receipt.deleted_counts,
      'pendingStorageJobs', v_job_count
    );
  end if;

  select p.* into v_person
  from public.people p
  where p.id = p_person_id and p.family_id = p_family_id
  for update;
  if not found
     or coalesce(nullif(btrim(v_person.profile->>'localCaseId'), ''), v_person.id::text) <> p_local_case_id then
    raise exception using errcode = 'P0002', message = 'person_notebook_delete_person_not_found';
  end if;
  if v_person.cloud_revision is distinct from p_expected_cloud_revision
     or v_person.cloud_hash is distinct from p_expected_cloud_hash then
    raise exception using errcode = '40001', message = 'person_notebook_delete_conflict';
  end if;

  -- Fail closed if a future migration adds a direct people FK whose delete
  -- behavior has not been reviewed here.
  select format('%I.%I:%s', source_ns.nspname, source.relname, constraint_row.conname)
  into v_unknown_reference
  from pg_constraint constraint_row
  join pg_class source on source.oid = constraint_row.conrelid
  join pg_namespace source_ns on source_ns.oid = source.relnamespace
  where constraint_row.contype = 'f'
    and constraint_row.confrelid = 'public.people'::regclass
    and not (
      source_ns.nspname = 'public'
      and (select array_agg(attribute.attname order by key_column.ordinality)
           from unnest(constraint_row.conkey) with ordinality key_column(attnum, ordinality)
           join pg_attribute attribute
             on attribute.attrelid = constraint_row.conrelid and attribute.attnum = key_column.attnum)
          = array['person_id']::name[]
      and (
        (source.relname in (
          'person_status_events', 'tasks', 'asset_items', 'timeline_events',
          'person_ai_memories', 'ai_consult_threads', 'ai_memory_consents',
          'homes', 'share_links'
        ) and constraint_row.confdeltype = 'c')
        or (source.relname in ('cases', 'support_packs') and constraint_row.confdeltype = 'n')
      )
    )
  limit 1;
  if v_unknown_reference is not null then
    raise exception using
      errcode = '55000',
      message = 'person_notebook_delete_unsupported_reference',
      detail = v_unknown_reference;
  end if;

  if exists (
    select 1
    from public.timeline_events event
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
        then coalesce(event.attachments, '[]'::jsonb) else '[]'::jsonb end
    ) attachment(value)
    where event.person_id = p_person_id
      and nullif(btrim(attachment.value->>'storagePath'), '') is not null
      and (
        coalesce(nullif(btrim(attachment.value->>'storageBucket'), ''), 'home-photos') <> 'home-photos'
        or nullif(btrim(attachment.value->>'storagePath'), '')
          !~* '^notebook/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/]+$'
      )
  ) then
    raise exception using errcode = '22023', message = 'person_notebook_delete_unsupported_storage';
  end if;

  if exists (
    select 1
    from public.home_photos photo
    join public.homes home on home.id = photo.home_id
    where home.person_id = p_person_id
      and (photo.storage_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/]+$'
           or split_part(photo.storage_path, '/', 1) <> home.id::text)
  ) or exists (
    select 1
    from public.case_photos photo
    join public.cases case_row on case_row.id = photo.case_id
    where case_row.person_id = p_person_id
      and (photo.storage_path !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[^/]+$'
           or split_part(photo.storage_path, '/', 1) <> case_row.id::text)
  ) then
    raise exception using errcode = '22023', message = 'person_notebook_delete_unsupported_storage';
  end if;

  -- A notebook upload path embeds its uploader. Legacy rows that cannot prove
  -- the uploader still belongs to this family are not safe to erase.
  if exists (
    select 1
    from public.timeline_events event
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
        then coalesce(event.attachments, '[]'::jsonb) else '[]'::jsonb end
    ) attachment(value)
    where event.person_id = p_person_id
      and nullif(btrim(attachment.value->>'storagePath'), '') is not null
      and not exists (
        select 1 from public.family_members member
        where member.family_id = p_family_id
          and member.user_id = split_part(attachment.value->>'storagePath', '/', 2)::uuid
      )
  ) then
    raise exception using errcode = '42501', message = 'person_notebook_delete_storage_owner_denied';
  end if;

  with target_objects as (
    select
      'home-photos'::text as bucket,
      nullif(btrim(attachment.value->>'storagePath'), '') as path
    from public.timeline_events event
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
        then coalesce(event.attachments, '[]'::jsonb) else '[]'::jsonb end
    ) attachment(value)
    where event.person_id = p_person_id
    union
    select 'home-photos', photo.storage_path
    from public.home_photos photo
    join public.homes home on home.id = photo.home_id
    where home.person_id = p_person_id
    union
    select 'home-photos', photo.storage_path
    from public.case_photos photo
    join public.cases case_row on case_row.id = photo.case_id
    where case_row.person_id = p_person_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'path', path) order by path), '[]'::jsonb)
  into v_storage
  from target_objects
  where path is not null;

  for v_object in select value from jsonb_array_elements(v_storage) order by value->>'path'
  loop
    v_path := v_object->>'path';
    perform pg_advisory_xact_lock(hashtextextended('notebook-storage:home-photos:' || v_path, 0));

    if exists (
      select 1
      from public.timeline_events event
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
          then coalesce(event.attachments, '[]'::jsonb) else '[]'::jsonb end
      ) attachment(value)
      where event.person_id is distinct from p_person_id
        and coalesce(nullif(btrim(attachment.value->>'storageBucket'), ''), 'home-photos') = 'home-photos'
        and nullif(btrim(attachment.value->>'storagePath'), '') = v_path
    ) or exists (
      select 1
      from public.home_photos photo
      join public.homes home on home.id = photo.home_id
      where home.person_id is distinct from p_person_id and photo.storage_path = v_path
    ) or exists (
      select 1
      from public.case_photos photo
      join public.cases case_row on case_row.id = photo.case_id
      where case_row.person_id is distinct from p_person_id and photo.storage_path = v_path
    ) then
      raise exception using errcode = '40001', message = 'person_notebook_delete_shared_storage_reference';
    end if;

    if exists (
      select 1 from public.notebook_storage_deletion_jobs old_job
      where old_job.storage_bucket = 'home-photos'
        and old_job.storage_path = v_path
        and (old_job.family_id <> p_family_id or old_job.person_id <> p_person_id or old_job.local_case_id <> p_local_case_id)
    ) or exists (
      select 1 from public.person_notebook_storage_deletion_jobs job
      where job.storage_bucket = 'home-photos'
        and job.storage_path = v_path
        and (job.family_id <> p_family_id or job.person_id <> p_person_id or job.local_case_id <> p_local_case_id)
    ) then
      raise exception using errcode = '40001', message = 'person_notebook_delete_storage_job_conflict';
    end if;

    if not exists (
      select 1 from public.notebook_storage_deletion_jobs old_job
      where old_job.storage_bucket = 'home-photos' and old_job.storage_path = v_path
    ) then
      insert into public.person_notebook_storage_deletion_jobs (
        family_id, person_id, local_case_id, storage_bucket, storage_path, status, created_by
      ) values (
        p_family_id, p_person_id, p_local_case_id, 'home-photos', v_path, 'pending', p_actor_user_id
      ) on conflict (storage_bucket, storage_path) do nothing;
    end if;
  end loop;

  select jsonb_build_object(
    'statusEvents', (select count(*) from public.person_status_events where person_id = p_person_id),
    'tasks', (select count(*) from public.tasks where person_id = p_person_id),
    'assets', (select count(*) from public.asset_items where person_id = p_person_id),
    'timelineEvents', (select count(*) from public.timeline_events where person_id = p_person_id),
    'homes', (select count(*) from public.homes where person_id = p_person_id),
    'cases', (select count(*) from public.cases where person_id = p_person_id),
    'consultThreads', (select count(*) from public.ai_consult_threads where person_id = p_person_id),
    'storageObjects', jsonb_array_length(v_storage)
  ) into v_counts;

  insert into public.person_notebook_deletion_receipts (
    family_id, person_id, local_case_id, expected_cloud_revision,
    expected_cloud_hash, deleted_by, deleted_counts
  ) values (
    p_family_id, p_person_id, p_local_case_id, p_expected_cloud_revision,
    p_expected_cloud_hash, p_actor_user_id, v_counts
  );

  -- cases contains the original questionnaire/profile snapshot and therefore
  -- is deleted rather than merely detached by its ON DELETE SET NULL FK.
  delete from public.cases where person_id = p_person_id;

  if to_regclass('public.ai_consult_daily_claims') is not null then
    execute 'delete from public.ai_consult_daily_claims where person_id = $1'
      using p_person_id;
  end if;

  delete from public.people person
  where person.id = p_person_id
    and person.family_id = p_family_id
    and coalesce(nullif(btrim(person.profile->>'localCaseId'), ''), person.id::text) = p_local_case_id
    and person.cloud_revision = p_expected_cloud_revision
    and person.cloud_hash = p_expected_cloud_hash
  returning person.id into v_deleted_id;
  if v_deleted_id is null then
    raise exception using errcode = '40001', message = 'person_notebook_delete_conflict';
  end if;

  select count(*) into v_job_count
  from public.person_notebook_storage_deletion_jobs job
  where job.family_id = p_family_id
    and job.person_id = p_person_id
    and job.local_case_id = p_local_case_id
    and job.status = 'pending';

  return jsonb_build_object(
    'ok', true,
    'deleted', true,
    'alreadyDeleted', false,
    'deletedCounts', v_counts,
    'pendingStorageJobs', v_job_count
  );
end;
$$;

revoke all on function public.delete_person_notebook_v1(uuid, uuid, uuid, text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.delete_person_notebook_v1(uuid, uuid, uuid, text, bigint, text)
  to service_role;

commit;
