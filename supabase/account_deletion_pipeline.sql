-- Account deletion request pipeline hardening for existing databases.
-- Run after schema.sql, notebook_diary_delete.sql, and
-- notebook_person_delete.sql, then before verify_setup.sql. The cleanup queue
-- collectors remain defensive for databases where either optional notebook
-- deletion migration has not been installed yet.

create table if not exists account_delete_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  contact_email text,
  reason text,
  status text not null default 'requested' check (status in ('requested', 'reviewing', 'needs_followup', 'completed')),
  requested_from text not null default 'mobile_app',
  due_at timestamptz not null default (now() + interval '30 days'),
  last_status_changed_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid references profiles(id) on delete set null,
  handled_by_email text,
  handled_by_method text,
  handled_note text,
  audit_log_id uuid references audit_logs(id) on delete set null,
  created_at timestamptz default now()
);

alter table account_delete_requests
  add column if not exists user_id uuid references profiles(id) on delete set null,
  add column if not exists contact_email text,
  add column if not exists reason text,
  add column if not exists status text not null default 'requested',
  add column if not exists requested_from text not null default 'mobile_app',
  add column if not exists due_at timestamptz not null default (now() + interval '30 days'),
  add column if not exists last_status_changed_at timestamptz not null default now(),
  add column if not exists handled_at timestamptz,
  add column if not exists handled_by uuid references profiles(id) on delete set null,
  add column if not exists handled_by_email text,
  add column if not exists handled_by_method text,
  add column if not exists handled_note text,
  add column if not exists audit_log_id uuid references audit_logs(id) on delete set null,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'account_delete_requests_status_check'
  ) then
    alter table account_delete_requests
      add constraint account_delete_requests_status_check
      check (status in ('requested', 'reviewing', 'needs_followup', 'completed'));
  end if;
end;
$$;

create index if not exists idx_account_delete_requests_status_due
on account_delete_requests(status, due_at);

create index if not exists idx_account_delete_requests_user_status
on account_delete_requests(user_id, status);

create unique index if not exists idx_account_delete_requests_one_open
on account_delete_requests(user_id)
where status in ('requested', 'reviewing', 'needs_followup') and user_id is not null;

alter table account_delete_requests enable row level security;

drop policy if exists "account_delete_requests read own" on account_delete_requests;
create policy "account_delete_requests read own"
on account_delete_requests for select
using (user_id = auth.uid());

drop policy if exists "account_delete_requests admin read" on account_delete_requests;
create policy "account_delete_requests admin read"
on account_delete_requests for select
using (is_app_admin());

-- Verified erasure is deliberately split into a database transaction and two
-- external checks (Supabase Auth and Storage).  The durable job makes retries
-- safe if the operator's browser, Vercel, Auth, or Storage stops halfway.
create table if not exists account_erasure_jobs (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid not null unique references account_delete_requests(id) on delete restrict,
  -- Kept only while work is in progress. Completion replaces this value with
  -- the one-way hash below, so the receipt cannot be used as a user directory.
  target_user_id uuid,
  target_user_hash text not null,
  -- Used only while the operator checks the in-progress request. It is cleared
  -- at completion because a deterministic email hash is still guessable PII.
  target_email_hash text,
  operator_user_id uuid references profiles(id) on delete set null,
  status text not null default 'prepared',
  owned_family_ids uuid[] not null default '{}'::uuid[],
  storage_objects jsonb not null default '[]'::jsonb,
  -- Raw prefixes are retained only while Storage cleanup is in progress.
  -- Their one-way hashes remain after completion so an old signed upload URL
  -- cannot recreate a legacy `<homeId>/...` object after family deletion.
  storage_prefixes jsonb not null default '[]'::jsonb,
  storage_prefix_hashes text[] not null default '{}'::text[],
  storage_manifest_hash text not null default encode(digest('[]', 'sha256'), 'hex'),
  blocked_details jsonb not null default '[]'::jsonb,
  database_summary jsonb not null default '{}'::jsonb,
  verification_summary jsonb not null default '{}'::jsonb,
  database_erased_at timestamptz,
  auth_verified_erased_at timestamptz,
  storage_verified_erased_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_erasure_jobs_status_check
    check (status in ('prepared', 'blocked', 'database_erased', 'completed')),
  constraint account_erasure_jobs_storage_array
    check (jsonb_typeof(storage_objects) = 'array'),
  constraint account_erasure_jobs_storage_prefix_array
    check (jsonb_typeof(storage_prefixes) = 'array'),
  constraint account_erasure_jobs_storage_manifest_sha256
    check (storage_manifest_hash ~ '^[0-9a-f]{64}$'),
  constraint account_erasure_jobs_blocked_array
    check (jsonb_typeof(blocked_details) = 'array'),
  constraint account_erasure_jobs_database_object
    check (jsonb_typeof(database_summary) = 'object'),
  constraint account_erasure_jobs_verification_object
    check (jsonb_typeof(verification_summary) = 'object'),
  constraint account_erasure_jobs_completed_state
    check (
      status <> 'completed'
      or (
        target_user_id is null
        and target_email_hash is null
        and storage_prefixes = '[]'::jsonb
        and database_erased_at is not null
        and auth_verified_erased_at is not null
        and storage_verified_erased_at is not null
        and completed_at is not null
      )
    )
);

-- Repair the earlier draft when this migration is reapplied.
alter table account_erasure_jobs
  alter column target_email_hash drop not null,
  add column if not exists storage_prefixes jsonb not null default '[]'::jsonb,
  add column if not exists storage_prefix_hashes text[] not null default '{}'::text[];

alter table account_erasure_jobs
  drop constraint if exists account_erasure_jobs_storage_prefix_array;
alter table account_erasure_jobs
  add constraint account_erasure_jobs_storage_prefix_array
  check (jsonb_typeof(storage_prefixes) = 'array');

alter table account_erasure_jobs
  drop constraint if exists account_erasure_jobs_completed_state;
alter table account_erasure_jobs
  add constraint account_erasure_jobs_completed_state
  check (
    status <> 'completed'
    or (
      target_user_id is null
      and target_email_hash is null
      and storage_prefixes = '[]'::jsonb
      and database_erased_at is not null
      and auth_verified_erased_at is not null
      and storage_verified_erased_at is not null
      and completed_at is not null
    )
  );

create index if not exists idx_account_erasure_jobs_status_updated
on account_erasure_jobs(status, updated_at);

alter table account_erasure_jobs enable row level security;
alter table account_erasure_jobs force row level security;

comment on table account_erasure_jobs is
  'Service-only, resumable evidence for verified Auth/database/Storage account erasure.';

-- A completed or database-erased account must not be recreated by an old JWT
-- while the external Auth deletion is being retried.
create or replace function guard_erased_profile_recreation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if exists (
    select 1
    from public.account_erasure_jobs job
    where job.target_user_hash = encode(digest(new.id::text, 'sha256'), 'hex')
      and job.status in ('database_erased', 'completed')
  ) then
    raise exception using
      errcode = '42501',
      message = 'account_erasure_profile_recreation_blocked';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_erasure_recreation_guard on profiles;
create trigger profiles_erasure_recreation_guard
before insert on profiles
for each row execute function guard_erased_profile_recreation();

-- A signed upload URL may have been issued immediately before the database
-- erasure. Block both current notebook/user paths and legacy home-id prefixes,
-- including after raw target/prefix values have been removed from the completed
-- receipt. Before preparation, the home row lets the trigger acquire the same
-- target lock; after preparation, the durable prefix hash does.
create or replace function guard_erased_notebook_storage_write()
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

    -- This lookup is available before family deletion and establishes lock
    -- ordering even if the upload transaction starts just before prepare.
    select family.owner_user_id into v_path_user_id
    from public.homes home
    join public.people person on person.id = home.person_id
    join public.families family on family.id = person.family_id
    where home.id = split_part(new.name, '/', 1)::uuid;

    if v_path_user_id is null then
      select job.target_user_id into v_path_user_id
      from public.account_erasure_jobs job
      where v_candidate_prefix_hash = any(job.storage_prefix_hashes)
        and job.status in ('prepared', 'database_erased')
      limit 1;
    end if;
  else
    return new;
  end if;

  -- Serialize a delayed signed upload with preflight/final inventory. If the
  -- upload started first, preflight waits and then inventories it. If
  -- preflight won, this trigger sees the prepared receipt and rejects it.
  if v_path_user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended('account-erasure-target:' || v_path_user_id::text, 0)
    );
  end if;
  if exists (
    select 1
    from public.account_erasure_jobs job
    where job.status in ('prepared', 'database_erased', 'completed')
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

drop trigger if exists objects_account_erasure_write_guard on storage.objects;
create trigger objects_account_erasure_write_guard
before insert or update of bucket_id, name on storage.objects
for each row execute function guard_erased_notebook_storage_write();

-- The object itself is not the only race: another family member could attach
-- an old target-owned path after the inventory was frozen. Share the same
-- per-target lock and reject new references while erasure is underway or done.
create or replace function guard_erased_notebook_attachment_reference()
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
        and job.status in ('prepared', 'database_erased', 'completed')
    ) then
      raise exception using
        errcode = '42501',
        message = 'account_erasure_attachment_reference_blocked';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists timeline_events_account_erasure_reference_guard on timeline_events;
create trigger timeline_events_account_erasure_reference_guard
before insert or update of attachments, person_id on timeline_events
for each row execute function guard_erased_notebook_attachment_reference();

-- Only objects referenced by rows that will be deleted are returned. A
-- target-owned photo in a preserved family is handled as a preflight blocker,
-- not silently retained: after membership removal its owner-based signed URL
-- would no longer work until photo provenance is transferred.
create or replace function collect_account_erasure_storage_objects(
  p_target_user_id uuid,
  p_owned_family_ids uuid[]
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  with object_rows as (
    select 'home-photos'::text as bucket, hp.storage_path as path
    from public.home_photos hp
    join public.homes h on h.id = hp.home_id
    join public.people person on person.id = h.person_id
    where person.family_id = any(coalesce(p_owned_family_ids, '{}'::uuid[]))

    union

    select
      coalesce(nullif(btrim(attachment.value->>'storageBucket'), ''), 'home-photos') as bucket,
      nullif(btrim(attachment.value->>'storagePath'), '') as path
    from public.timeline_events event
    join public.people person on person.id = event.person_id
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
          then coalesce(event.attachments, '[]'::jsonb)
        else '[]'::jsonb
      end
    ) attachment(value)
    where person.family_id = any(coalesce(p_owned_family_ids, '{}'::uuid[]))
      and nullif(btrim(attachment.value->>'storagePath'), '') is not null

    union

    select 'home-photos'::text as bucket, photo.storage_path as path
    from public.case_photos photo
    join public.cases case_row on case_row.id = photo.case_id
    left join public.people person on person.id = case_row.person_id
    where case_row.family_id = any(coalesce(p_owned_family_ids, '{}'::uuid[]))
       or person.family_id = any(coalesce(p_owned_family_ids, '{}'::uuid[]))
       or (
         case_row.family_id is null
         and case_row.person_id is null
         and case_row.user_id = p_target_user_id
       )

    union

    -- Include uploaded-but-never-linked notebook photos. A target-owned path
    -- that is still referenced by a preserved shared-family event is excluded.
    select object.bucket_id as bucket, object.name as path
    from storage.objects object
    where object.bucket_id = 'home-photos'
      and object.name like ('notebook/' || p_target_user_id::text || '/%')
      and not exists (
        select 1
        from public.timeline_events event
        join public.people person on person.id = event.person_id
        cross join lateral jsonb_array_elements(
          case
            when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
              then coalesce(event.attachments, '[]'::jsonb)
            else '[]'::jsonb
          end
        ) attachment(value)
        where person.family_id <> all(coalesce(p_owned_family_ids, '{}'::uuid[]))
          and coalesce(nullif(btrim(attachment.value->>'storageBucket'), ''), 'home-photos') = object.bucket_id
          and nullif(btrim(attachment.value->>'storagePath'), '') = object.name
      )
  ), distinct_objects as (
    select distinct bucket, path
    from object_rows
    where path is not null
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('bucket', bucket, 'path', path)
      order by bucket, path
    ),
    '[]'::jsonb
  )
  from distinct_objects;
$$;

-- Legacy home-photo signed uploads use `<homeId>/<random-file>` and do not
-- create a database reference before upload. Preserve those folder prefixes
-- while erasure runs so a URL issued immediately before preparation cannot
-- create an unmanifested orphan after the home/family rows are removed.
create or replace function collect_account_erasure_storage_prefixes(
  p_owned_family_ids uuid[]
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket', prefix.bucket,
    'prefix', prefix.path_prefix
  ) order by prefix.bucket, prefix.path_prefix), '[]'::jsonb)
  from (
    select distinct
      'home-photos'::text as bucket,
      home.id::text || '/' as path_prefix
    from public.homes home
    join public.people person on person.id = home.person_id
    where person.family_id = any(coalesce(p_owned_family_ids, '{}'::uuid[]))
  ) prefix;
$$;

create or replace function hash_account_erasure_storage_prefixes(
  p_prefixes jsonb
)
returns text[]
language sql
immutable
set search_path = pg_catalog, public, extensions
as $$
  select coalesce(array_agg(
    encode(digest((item->>'bucket') || ':' || (item->>'prefix'), 'sha256'), 'hex')
    order by item->>'bucket', item->>'prefix'
  ), '{}'::text[])
  from jsonb_array_elements(coalesce(p_prefixes, '[]'::jsonb)) item;
$$;

-- Keep route parsing failures from appearing only after irreversible database
-- deletion. Inspect, prepare, and execute all use the same bounded manifest
-- contract before any family/profile row is removed.
create or replace function collect_account_erasure_storage_manifest_blockers(
  p_objects jsonb,
  p_prefixes jsonb
)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public, extensions
as $$
  select
    case
      when jsonb_array_length(coalesce(p_objects, '[]'::jsonb)) > 5000
        or jsonb_array_length(coalesce(p_prefixes, '[]'::jsonb)) > 5000
      then jsonb_build_array(jsonb_build_object(
        'code', 'storage_manifest_too_large',
        'maxEntriesPerKind', 5000,
        'objectCount', jsonb_array_length(coalesce(p_objects, '[]'::jsonb)),
        'prefixCount', jsonb_array_length(coalesce(p_prefixes, '[]'::jsonb))
      ))
      else '[]'::jsonb
    end
    || case
      when exists (
        select 1
        from jsonb_array_elements(coalesce(p_objects, '[]'::jsonb)) item
        where coalesce(item->>'bucket', '') <> 'home-photos'
           or length(coalesce(item->>'path', '')) not between 1 and 1024
           or left(coalesce(item->>'path', ''), 1) = '/'
           or strpos(coalesce(item->>'path', ''), E'\\') > 0
           or coalesce(item->>'path', '') like '%//%'
           or coalesce(item->>'path', '') ~ '(^|/)\.{1,2}(/|$)'
      ) or exists (
        select 1
        from jsonb_array_elements(coalesce(p_prefixes, '[]'::jsonb)) item
        where coalesce(item->>'bucket', '') <> 'home-photos'
           or coalesce(item->>'prefix', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/$'
      )
      then jsonb_build_array(jsonb_build_object('code', 'unsafe_storage_manifest'))
      else '[]'::jsonb
    end;
$$;

create or replace function collect_account_erasure_pending_cleanup_objects(
  p_target_user_id uuid,
  p_owned_family_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_objects jsonb := '[]'::jsonb;
begin
  if to_regclass('public.notebook_storage_deletion_jobs') is null then
    return v_objects;
  end if;
  execute $query$
    select coalesce(jsonb_agg(jsonb_build_object(
      'bucket', storage_bucket,
      'path', storage_path
    ) order by storage_bucket, storage_path), '[]'::jsonb)
    from public.notebook_storage_deletion_jobs
    where (
        created_by = $1
        or family_id = any(coalesce($2, '{}'::uuid[]))
        or (
          storage_bucket = 'home-photos'
          and storage_path like ('notebook/' || $1::text || '/%')
        )
      )
      and status = 'pending'
  $query$ into v_objects using p_target_user_id, p_owned_family_ids;
  return v_objects;
end;
$$;

-- Whole-person notebook deletion keeps a durable Storage queue after the
-- person row itself is gone. Include pending objects when the erased account
-- created the deletion, when a notebook path embeds that account UUID, or when
-- the object belongs to a sole-owned family that this account erasure will
-- remove. Without this inventory, those already-detached photos are no longer
-- discoverable from notebook tables.
create or replace function collect_account_erasure_pending_person_cleanup_objects(
  p_target_user_id uuid,
  p_owned_family_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_objects jsonb := '[]'::jsonb;
begin
  if to_regclass('public.person_notebook_storage_deletion_jobs') is null then
    return v_objects;
  end if;
  execute $query$
    select coalesce(jsonb_agg(jsonb_build_object(
      'bucket', storage_bucket,
      'path', storage_path
    ) order by storage_bucket, storage_path), '[]'::jsonb)
    from public.person_notebook_storage_deletion_jobs
    where (
        created_by = $1
        or family_id = any(coalesce($2, '{}'::uuid[]))
        or (
          storage_bucket = 'home-photos'
          and storage_path like ('notebook/' || $1::text || '/%')
        )
      )
      and status = 'pending'
  $query$ into v_objects using p_target_user_id, p_owned_family_ids;
  return v_objects;
end;
$$;

-- A notebook path embeds the uploader UUID. Once that member leaves a shared
-- family, the current restore authorization cannot sign their old path. Stop
-- before deletion and require an explicit family-bound photo transfer.
create or replace function collect_account_erasure_shared_photo_blockers(
  p_target_user_id uuid,
  p_owned_family_ids uuid[]
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', 'shared_photo_transfer_required',
    'familyId', blocker.family_id,
    'familyName', blocker.family_name,
    'photoCount', blocker.photo_count
  ) order by blocker.family_id), '[]'::jsonb)
  from (
    select person.family_id, family.name as family_name,
           count(distinct (coalesce(nullif(btrim(attachment.value->>'storageBucket'), ''), 'home-photos'),
                           nullif(btrim(attachment.value->>'storagePath'), '')))::integer as photo_count
    from public.timeline_events event
    join public.people person on person.id = event.person_id
    join public.families family on family.id = person.family_id
    join public.family_members membership
      on membership.family_id = person.family_id
     and membership.user_id = p_target_user_id
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(coalesce(event.attachments, '[]'::jsonb)) = 'array'
          then coalesce(event.attachments, '[]'::jsonb)
        else '[]'::jsonb
      end
    ) attachment(value)
    where not (person.family_id = any(coalesce(p_owned_family_ids, '{}'::uuid[])))
      and nullif(btrim(attachment.value->>'storagePath'), '')
            like ('notebook/' || p_target_user_id::text || '/%')
    group by person.family_id, family.name
  ) blocker;
$$;

create or replace function merge_account_erasure_storage_objects(
  p_first jsonb,
  p_second jsonb
)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'bucket', object.bucket,
    'path', object.path
  ) order by object.bucket, object.path), '[]'::jsonb)
  from (
    select distinct
      nullif(btrim(item->>'bucket'), '') as bucket,
      nullif(btrim(item->>'path'), '') as path
    from jsonb_array_elements(
      coalesce(p_first, '[]'::jsonb) || coalesce(p_second, '[]'::jsonb)
    ) item
    where nullif(btrim(item->>'bucket'), '') is not null
      and nullif(btrim(item->>'path'), '') is not null
  ) object;
$$;

-- Read-only operator preview. Unlike prepare_account_erasure_v1 this function
-- does not create/update a durable job and therefore must not freeze ordinary
-- notebook uploads merely because an administrator opened the safety check.
-- The destructive route runs the authoritative prepare + execute checks again.
create or replace function inspect_account_erasure_v1(
  p_request_id uuid,
  p_target_user_id uuid,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_request public.account_delete_requests%rowtype;
  v_job public.account_erasure_jobs%rowtype;
  v_owned_family_ids uuid[] := '{}'::uuid[];
  v_blocked jsonb := '[]'::jsonb;
  v_storage jsonb := '[]'::jsonb;
  v_storage_prefixes jsonb := '[]'::jsonb;
  v_target_hash text;
  v_is_target_admin boolean := false;
  v_admin_count integer := 0;
  v_unsupported_storage integer := 0;
begin
  if p_request_id is null or p_target_user_id is null or p_operator_user_id is null then
    return jsonb_build_object('result', 'invalid_request');
  end if;
  if not exists (select 1 from public.app_admins where user_id = p_operator_user_id) then
    return jsonb_build_object('result', 'operator_forbidden');
  end if;

  select * into v_request
  from public.account_delete_requests
  where id = p_request_id;
  if not found then
    return jsonb_build_object('result', 'request_not_found');
  end if;

  v_target_hash := encode(digest(p_target_user_id::text, 'sha256'), 'hex');
  select * into v_job
  from public.account_erasure_jobs
  where request_id = p_request_id;

  if found and v_job.status = 'completed' then
    if v_job.target_user_hash <> v_target_hash then
      return jsonb_build_object('result', 'target_mismatch');
    end if;
    return jsonb_build_object(
      'result', 'already_completed',
      'jobId', v_job.id,
      'completedAt', v_job.completed_at
    );
  end if;
  if found and v_job.database_erased_at is not null then
    if v_job.target_user_hash <> v_target_hash then
      return jsonb_build_object('result', 'target_mismatch');
    end if;
    return jsonb_build_object(
      'result', 'database_erased',
      'jobId', v_job.id,
      'storageObjectCount', jsonb_array_length(v_job.storage_objects),
      'storagePrefixCount', jsonb_array_length(v_job.storage_prefixes)
    );
  end if;

  if v_request.status = 'completed' then
    return jsonb_build_object('result', 'request_already_completed');
  end if;
  if v_request.user_id is distinct from p_target_user_id then
    return jsonb_build_object('result', 'target_mismatch');
  end if;
  if p_operator_user_id = p_target_user_id then
    v_blocked := jsonb_build_array(jsonb_build_object('code', 'self_erasure_requires_other_admin'));
  end if;

  select exists(select 1 from public.app_admins where user_id = p_target_user_id),
         (select count(*) from public.app_admins)
  into v_is_target_admin, v_admin_count;
  if v_is_target_admin and v_admin_count <= 1 then
    v_blocked := v_blocked || jsonb_build_array(jsonb_build_object('code', 'last_app_admin'));
  end if;

  select coalesce(array_agg(family.id order by family.id), '{}'::uuid[])
  into v_owned_family_ids
  from public.families family
  where family.owner_user_id = p_target_user_id;

  select v_blocked || coalesce(jsonb_agg(jsonb_build_object(
    'code', 'ownership_transfer_required',
    'familyId', family.id,
    'familyName', family.name,
    'otherMemberCount', family.other_member_count
  ) order by family.id), '[]'::jsonb)
  into v_blocked
  from (
    select f.id, f.name, count(fm.id)::integer as other_member_count
    from public.families f
    join public.family_members fm
      on fm.family_id = f.id
     and fm.user_id is not null
     and fm.user_id <> p_target_user_id
    where f.owner_user_id = p_target_user_id
    group by f.id, f.name
  ) family;

  v_blocked := v_blocked || public.collect_account_erasure_shared_photo_blockers(
    p_target_user_id,
    v_owned_family_ids
  );
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
  v_blocked := v_blocked || public.collect_account_erasure_storage_manifest_blockers(
    v_storage,
    v_storage_prefixes
  );
  select count(*) into v_unsupported_storage
  from jsonb_array_elements(v_storage) object
  where object->>'bucket' <> 'home-photos';
  if v_unsupported_storage > 0 then
    v_blocked := v_blocked || jsonb_build_array(jsonb_build_object(
      'code', 'unsupported_storage_bucket',
      'count', v_unsupported_storage
    ));
  end if;

  return jsonb_build_object(
    'result', case when jsonb_array_length(v_blocked) > 0 then 'blocked' else 'ready' end,
    'ownedFamilyCount', coalesce(array_length(v_owned_family_ids, 1), 0),
    'storageObjectCount', jsonb_array_length(v_storage),
    'storagePrefixCount', jsonb_array_length(v_storage_prefixes),
    'blockedDetails', v_blocked,
    'reservationCreated', false
  );
end;
$$;

create or replace function prepare_account_erasure_v1(
  p_request_id uuid,
  p_target_user_id uuid,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_request public.account_delete_requests%rowtype;
  v_job public.account_erasure_jobs%rowtype;
  v_owned_family_ids uuid[] := '{}'::uuid[];
  v_blocked jsonb := '[]'::jsonb;
  v_storage jsonb := '[]'::jsonb;
  v_storage_prefixes jsonb := '[]'::jsonb;
  v_email text := '';
  v_target_hash text;
  v_email_hash text;
  v_is_target_admin boolean := false;
  v_admin_count integer := 0;
  v_unsupported_storage integer := 0;
begin
  if p_request_id is null or p_target_user_id is null or p_operator_user_id is null then
    return jsonb_build_object('result', 'invalid_request');
  end if;
  if not exists (select 1 from public.app_admins where user_id = p_operator_user_id) then
    return jsonb_build_object('result', 'operator_forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure-target:' || p_target_user_id::text, 0)
  );
  perform pg_advisory_xact_lock(hashtextextended('account-erasure:' || p_request_id::text, 0));

  select * into v_request
  from public.account_delete_requests
  where id = p_request_id
  for update;
  if not found then
    return jsonb_build_object('result', 'request_not_found');
  end if;

  v_target_hash := encode(digest(p_target_user_id::text, 'sha256'), 'hex');
  select * into v_job
  from public.account_erasure_jobs
  where request_id = p_request_id
  for update;

  if found and v_job.status = 'completed' then
    if v_job.target_user_hash <> v_target_hash then
      return jsonb_build_object('result', 'target_mismatch');
    end if;
    return jsonb_build_object(
      'result', 'already_completed',
      'jobId', v_job.id,
      'completedAt', v_job.completed_at
    );
  end if;
  if found and v_job.database_erased_at is not null then
    if v_job.target_user_hash <> v_target_hash then
      return jsonb_build_object('result', 'target_mismatch');
    end if;
    return jsonb_build_object(
      'result', 'database_erased',
      'jobId', v_job.id,
      'storageObjects', v_job.storage_objects,
      'storagePrefixes', v_job.storage_prefixes
    );
  end if;

  if v_request.status = 'completed' then
    return jsonb_build_object('result', 'request_already_completed');
  end if;
  if v_request.user_id is distinct from p_target_user_id then
    return jsonb_build_object('result', 'target_mismatch');
  end if;
  if p_operator_user_id = p_target_user_id then
    v_blocked := jsonb_build_array(jsonb_build_object('code', 'self_erasure_requires_other_admin'));
  end if;

  select coalesce(profile.email, v_request.contact_email, '') into v_email
  from public.profiles profile
  where profile.id = p_target_user_id;
  if not found then
    v_email := coalesce(v_request.contact_email, '');
  end if;
  v_email_hash := encode(digest(lower(btrim(v_email)), 'sha256'), 'hex');

  select exists(select 1 from public.app_admins where user_id = p_target_user_id),
         (select count(*) from public.app_admins)
  into v_is_target_admin, v_admin_count;
  if v_is_target_admin and v_admin_count <= 1 then
    v_blocked := v_blocked || jsonb_build_array(jsonb_build_object('code', 'last_app_admin'));
  end if;

  select coalesce(array_agg(family.id order by family.id), '{}'::uuid[])
  into v_owned_family_ids
  from public.families family
  where family.owner_user_id = p_target_user_id;

  select v_blocked || coalesce(jsonb_agg(jsonb_build_object(
    'code', 'ownership_transfer_required',
    'familyId', family.id,
    'familyName', family.name,
    'otherMemberCount', family.other_member_count
  ) order by family.id), '[]'::jsonb)
  into v_blocked
  from (
    select f.id, f.name, count(fm.id)::integer as other_member_count
    from public.families f
    join public.family_members fm
      on fm.family_id = f.id
     and fm.user_id is not null
     and fm.user_id <> p_target_user_id
    where f.owner_user_id = p_target_user_id
    group by f.id, f.name
  ) family;

  v_blocked := v_blocked || public.collect_account_erasure_shared_photo_blockers(
    p_target_user_id,
    v_owned_family_ids
  );

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
  v_blocked := v_blocked || public.collect_account_erasure_storage_manifest_blockers(
    v_storage,
    v_storage_prefixes
  );
  select count(*) into v_unsupported_storage
  from jsonb_array_elements(v_storage) object
  where object->>'bucket' <> 'home-photos';
  if v_unsupported_storage > 0 then
    v_blocked := v_blocked || jsonb_build_array(jsonb_build_object(
      'code', 'unsupported_storage_bucket',
      'count', v_unsupported_storage
    ));
  end if;

  insert into public.account_erasure_jobs (
    request_id,
    target_user_id,
    target_user_hash,
    target_email_hash,
    operator_user_id,
    status,
    owned_family_ids,
    storage_objects,
    storage_prefixes,
    storage_prefix_hashes,
    storage_manifest_hash,
    blocked_details,
    last_error_code,
    last_error_at,
    updated_at
  ) values (
    p_request_id,
    p_target_user_id,
    v_target_hash,
    v_email_hash,
    p_operator_user_id,
    case when jsonb_array_length(v_blocked) > 0 then 'blocked' else 'prepared' end,
    v_owned_family_ids,
    v_storage,
    v_storage_prefixes,
    public.hash_account_erasure_storage_prefixes(v_storage_prefixes),
    encode(digest(jsonb_build_object(
      'objects', v_storage,
      'prefixes', v_storage_prefixes
    )::text, 'sha256'), 'hex'),
    v_blocked,
    case when jsonb_array_length(v_blocked) > 0 then 'preflight_blocked' else null end,
    case when jsonb_array_length(v_blocked) > 0 then now() else null end,
    now()
  )
  on conflict (request_id) do update
  set target_user_id = excluded.target_user_id,
      target_user_hash = excluded.target_user_hash,
      target_email_hash = excluded.target_email_hash,
      operator_user_id = excluded.operator_user_id,
      status = excluded.status,
      owned_family_ids = excluded.owned_family_ids,
      storage_objects = excluded.storage_objects,
      storage_prefixes = excluded.storage_prefixes,
      storage_prefix_hashes = excluded.storage_prefix_hashes,
      storage_manifest_hash = excluded.storage_manifest_hash,
      blocked_details = excluded.blocked_details,
      last_error_code = excluded.last_error_code,
      last_error_at = excluded.last_error_at,
      updated_at = now()
  returning * into v_job;

  update public.account_delete_requests
  set status = case when jsonb_array_length(v_blocked) > 0 then 'needs_followup' else 'reviewing' end,
      last_status_changed_at = now(),
      handled_by = p_operator_user_id,
      handled_by_method = 'supabase_app_admin',
      handled_note = case
        when jsonb_array_length(v_blocked) > 0 then '自動削除前確認で安全上の停止条件を検出'
        else handled_note
      end
  where id = p_request_id;

  return jsonb_build_object(
    'result', case when jsonb_array_length(v_blocked) > 0 then 'blocked' else 'ready' end,
    'jobId', v_job.id,
    'ownedFamilyCount', coalesce(array_length(v_owned_family_ids, 1), 0),
    'storageObjectCount', jsonb_array_length(v_storage),
    'storagePrefixCount', jsonb_array_length(v_storage_prefixes),
    'blockedDetails', v_blocked
  );
end;
$$;

create or replace function execute_account_erasure_database_v1(
  p_request_id uuid,
  p_target_user_id uuid,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_job public.account_erasure_jobs%rowtype;
  v_owned_family_ids uuid[] := '{}'::uuid[];
  v_storage jsonb := '[]'::jsonb;
  v_storage_prefixes jsonb := '[]'::jsonb;
  v_storage_blockers jsonb := '[]'::jsonb;
  v_target_hash text;
  v_other_members integer := 0;
  v_shared_photo_blockers jsonb := '[]'::jsonb;
  v_unsupported_storage integer := 0;
  v_deleted_cases integer := 0;
  v_deleted_families integer := 0;
  v_deleted_profiles integer := 0;
begin
  if p_request_id is null or p_target_user_id is null or p_operator_user_id is null then
    return jsonb_build_object('result', 'invalid_request');
  end if;
  if not exists (select 1 from public.app_admins where user_id = p_operator_user_id) then
    return jsonb_build_object('result', 'operator_forbidden');
  end if;
  if p_operator_user_id = p_target_user_id then
    return jsonb_build_object('result', 'self_erasure_requires_other_admin');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure-target:' || p_target_user_id::text, 0)
  );
  perform pg_advisory_xact_lock(hashtextextended('account-erasure:' || p_request_id::text, 0));
  select * into v_job
  from public.account_erasure_jobs
  where request_id = p_request_id
  for update;
  if not found then
    return jsonb_build_object('result', 'preflight_required');
  end if;

  v_target_hash := encode(digest(p_target_user_id::text, 'sha256'), 'hex');
  if v_job.target_user_hash <> v_target_hash then
    return jsonb_build_object('result', 'target_mismatch');
  end if;
  if v_job.status = 'completed' then
    return jsonb_build_object('result', 'already_completed', 'jobId', v_job.id);
  end if;
  if v_job.database_erased_at is not null then
    return jsonb_build_object(
      'result', 'database_erased',
      'jobId', v_job.id,
      'storageObjects', v_job.storage_objects,
      'storagePrefixes', v_job.storage_prefixes
    );
  end if;

  -- These locks are held only for the short destructive transaction. They
  -- ensure a photo reference cannot appear after the final object inventory
  -- but before its parent family/case is removed.
  lock table public.profiles, public.app_admins, public.families, public.family_members,
    public.people, public.timeline_events, public.homes, public.home_photos,
    public.cases, public.case_photos
    in share row exclusive mode;

  select coalesce(array_agg(family.id order by family.id), '{}'::uuid[])
  into v_owned_family_ids
  from public.families family
  where family.owner_user_id = p_target_user_id;

  select count(*) into v_other_members
  from public.family_members member
  join public.families family on family.id = member.family_id
  where family.owner_user_id = p_target_user_id
    and member.user_id is not null
    and member.user_id <> p_target_user_id;
  if v_other_members > 0 then
    update public.account_erasure_jobs
    set status = 'blocked',
        blocked_details = jsonb_build_array(jsonb_build_object(
          'code', 'ownership_transfer_required',
          'otherMemberCount', v_other_members
        )),
        last_error_code = 'ownership_transfer_required',
        last_error_at = now(),
        updated_at = now()
    where id = v_job.id;
    update public.account_delete_requests
    set status = 'needs_followup', last_status_changed_at = now()
    where id = p_request_id;
    return jsonb_build_object('result', 'blocked', 'code', 'ownership_transfer_required');
  end if;

  if exists (select 1 from public.app_admins where user_id = p_target_user_id)
     and (select count(*) from public.app_admins) <= 1 then
    return jsonb_build_object('result', 'blocked', 'code', 'last_app_admin');
  end if;

  -- Recheck shared-photo ownership inside the same locked destructive
  -- transaction. Preflight is informative; this check is authoritative.
  v_shared_photo_blockers := public.collect_account_erasure_shared_photo_blockers(
    p_target_user_id,
    v_owned_family_ids
  );
  if jsonb_array_length(v_shared_photo_blockers) > 0 then
    update public.account_erasure_jobs
    set status = 'blocked',
        blocked_details = v_shared_photo_blockers,
        last_error_code = 'shared_photo_transfer_required',
        last_error_at = now(),
        updated_at = now()
    where id = v_job.id;
    update public.account_delete_requests
    set status = 'needs_followup', last_status_changed_at = now(),
        handled_note = '共有家族に残る写真の所有者引継ぎが必要'
    where id = p_request_id;
    return jsonb_build_object(
      'result', 'blocked',
      'code', 'shared_photo_transfer_required',
      'blockedDetails', v_shared_photo_blockers
    );
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
  v_storage_blockers := public.collect_account_erasure_storage_manifest_blockers(
    v_storage,
    v_storage_prefixes
  );
  select count(*) into v_unsupported_storage
  from jsonb_array_elements(v_storage) object
  where object->>'bucket' <> 'home-photos';
  if v_unsupported_storage > 0 then
    update public.account_erasure_jobs
    set status = 'blocked',
        blocked_details = jsonb_build_array(jsonb_build_object(
          'code', 'unsupported_storage_bucket',
          'count', v_unsupported_storage
        )),
        last_error_code = 'unsupported_storage_bucket',
        last_error_at = now(),
        updated_at = now()
    where id = v_job.id;
    update public.account_delete_requests
    set status = 'needs_followup', last_status_changed_at = now(),
        handled_note = '自動削除未対応のStorage bucketを検出'
    where id = p_request_id;
    return jsonb_build_object(
      'result', 'blocked',
      'code', 'unsupported_storage_bucket',
      'count', v_unsupported_storage
    );
  end if;
  if jsonb_array_length(v_storage_blockers) > 0 then
    update public.account_erasure_jobs
    set status = 'blocked',
        blocked_details = v_storage_blockers,
        last_error_code = coalesce(v_storage_blockers->0->>'code', 'unsafe_storage_manifest'),
        last_error_at = now(),
        updated_at = now()
    where id = v_job.id;
    update public.account_delete_requests
    set status = 'needs_followup', last_status_changed_at = now(),
        handled_note = 'Storage削除対象の上限または形式を安全に確認できないため停止'
    where id = p_request_id;
    return jsonb_build_object(
      'result', 'blocked',
      'code', coalesce(v_storage_blockers->0->>'code', 'unsafe_storage_manifest'),
      'blockedDetails', v_storage_blockers
    );
  end if;

  -- Cases attached to a sole-owned family are private family data but are not
  -- DB-cascaded by families (the FK is SET NULL), so remove them explicitly.
  delete from public.cases case_row
  where case_row.family_id = any(v_owned_family_ids)
     or exists (
       select 1 from public.people person
       where person.id = case_row.person_id
         and person.family_id = any(v_owned_family_ids)
     )
     or (
       case_row.family_id is null
       and case_row.person_id is null
       and case_row.user_id = p_target_user_id
     );
  get diagnostics v_deleted_cases = row_count;

  delete from public.families
  where id = any(v_owned_family_ids)
    and owner_user_id = p_target_user_id;
  get diagnostics v_deleted_families = row_count;

  -- FK actions now remove private consultation/consent/device rows and family
  -- memberships, while nulling the actor on shared rows and retained evidence.
  delete from public.profiles where id = p_target_user_id;
  get diagnostics v_deleted_profiles = row_count;

  if to_regclass('public.ai_consult_daily_claims') is not null then
    execute 'delete from public.ai_consult_daily_claims where claimed_by = $1'
      using p_target_user_id;
  end if;
  if to_regclass('public.notebook_storage_deletion_jobs') is not null then
    -- A completed diary cleanup row is no longer needed operationally, and it
    -- can retain the erased account UUID inside path/local identity fields.
    -- The account-erasure audit receipt is the durable minimal evidence.
    execute $remove_completed_diary_target_identity$
      delete from public.notebook_storage_deletion_jobs
      where status = 'completed'
        and (
          created_by = $1
          or family_id = any(coalesce($2, '{}'::uuid[]))
          or (
            storage_bucket = 'home-photos'
            and storage_path like ('notebook/' || $1::text || '/%')
          )
        )
    $remove_completed_diary_target_identity$ using p_target_user_id, v_owned_family_ids;
    execute 'update public.notebook_storage_deletion_jobs set created_by = null where created_by = $1'
      using p_target_user_id;
  end if;
  if to_regclass('public.notebook_diary_deletion_receipts') is not null then
    -- A diary receipt in a preserved shared family contains no account actor
    -- identity and remains necessary to reject stale local diary recreation.
    -- Once its sole-owned family is deleted, the receipt has no guard target.
    execute 'delete from public.notebook_diary_deletion_receipts where family_id = any($1)'
      using v_owned_family_ids;
  end if;
  if to_regclass('public.person_notebook_deletion_receipts') is not null then
    -- Receipts in a preserved shared family remain the stale-localCaseId guard,
    -- but the erased operator identity is no longer needed. Receipts for a
    -- family deleted by this erasure have no remaining guard target.
    execute 'delete from public.person_notebook_deletion_receipts where family_id = any($1)'
      using v_owned_family_ids;
    execute 'update public.person_notebook_deletion_receipts set deleted_by = null where deleted_by = $1'
      using p_target_user_id;
  end if;
  if to_regclass('public.person_notebook_storage_deletion_jobs') is not null then
    -- Completed target-owned notebook paths are already absent from Storage.
    -- The account-erasure hash guard supersedes their raw-path tombstone at the
    -- same transaction commit, so keeping the erased UUID in storage_path is
    -- neither necessary nor privacy-minimal.
    execute $remove_completed_target_paths$
      delete from public.person_notebook_storage_deletion_jobs
      where status = 'completed'
        and storage_bucket = 'home-photos'
        and storage_path like ('notebook/' || $1::text || '/%')
    $remove_completed_target_paths$ using p_target_user_id;
    execute 'delete from public.person_notebook_storage_deletion_jobs where family_id = any($1) and status = ''completed'''
      using v_owned_family_ids;
    execute 'update public.person_notebook_storage_deletion_jobs set created_by = null where created_by = $1'
      using p_target_user_id;
  end if;

  update public.account_erasure_jobs
  set status = 'database_erased',
      target_user_id = p_target_user_id,
      operator_user_id = p_operator_user_id,
      owned_family_ids = v_owned_family_ids,
      storage_objects = v_storage,
      storage_prefixes = v_storage_prefixes,
      storage_prefix_hashes = public.hash_account_erasure_storage_prefixes(v_storage_prefixes),
      storage_manifest_hash = encode(digest(jsonb_build_object(
        'objects', v_storage,
        'prefixes', v_storage_prefixes
      )::text, 'sha256'), 'hex'),
      blocked_details = '[]'::jsonb,
      database_summary = jsonb_build_object(
        'deletedCaseCount', v_deleted_cases,
        'deletedFamilyCount', v_deleted_families,
        'deletedProfileCount', v_deleted_profiles,
        'removedMembershipsByProfileCascade', true,
        'privateAiRowsRemovedByProfileCascade', true,
        'retainedEvidenceUserReferencesNulledByFk', true
      ),
      database_erased_at = now(),
      last_error_code = null,
      last_error_at = null,
      updated_at = now()
  where id = v_job.id
  returning * into v_job;

  update public.account_delete_requests
  set status = 'reviewing',
      last_status_changed_at = now(),
      handled_by = p_operator_user_id,
      handled_by_method = 'supabase_app_admin',
      handled_note = 'DB削除済み。Auth・Storageの削除確認待ち'
  where id = p_request_id;

  insert into public.audit_logs (
    actor_user_id, action, target_type, target_id, metadata
  ) values (
    p_operator_user_id,
    'account_erasure_database_completed',
    'account_erasure_job',
    v_job.id,
    jsonb_build_object(
      'requestId', p_request_id,
      'deletedFamilyCount', v_deleted_families,
      'deletedCaseCount', v_deleted_cases,
      'storageObjectCount', jsonb_array_length(v_storage),
      'storagePrefixCount', jsonb_array_length(v_storage_prefixes)
    )
  );

  return jsonb_build_object(
    'result', 'database_erased',
    'jobId', v_job.id,
    'storageObjects', v_storage,
    'storagePrefixes', v_storage_prefixes,
    'databaseSummary', v_job.database_summary
  );
end;
$$;

create or replace function finalize_account_erasure_v1(
  p_request_id uuid,
  p_target_user_id uuid,
  p_operator_user_id uuid,
  p_auth_verified_erased boolean,
  p_storage_verified_erased boolean,
  p_verified_storage_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_job public.account_erasure_jobs%rowtype;
  v_target_hash text;
  v_db_residual_count integer := 0;
  v_expected_storage_count integer := 0;
  v_now timestamptz := now();
begin
  if p_request_id is null or p_target_user_id is null or p_operator_user_id is null then
    return jsonb_build_object('result', 'invalid_request');
  end if;
  if not exists (select 1 from public.app_admins where user_id = p_operator_user_id) then
    return jsonb_build_object('result', 'operator_forbidden');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('account-erasure-target:' || p_target_user_id::text, 0)
  );
  perform pg_advisory_xact_lock(hashtextextended('account-erasure:' || p_request_id::text, 0));
  select * into v_job
  from public.account_erasure_jobs
  where request_id = p_request_id
  for update;
  if not found then
    return jsonb_build_object('result', 'preflight_required');
  end if;

  v_target_hash := encode(digest(p_target_user_id::text, 'sha256'), 'hex');
  if v_job.target_user_hash <> v_target_hash then
    return jsonb_build_object('result', 'target_mismatch');
  end if;
  if v_job.status = 'completed' then
    return jsonb_build_object('result', 'already_completed', 'jobId', v_job.id);
  end if;
  if v_job.database_erased_at is null then
    return jsonb_build_object('result', 'database_erasure_required');
  end if;
  if not coalesce(p_auth_verified_erased, false) then
    return jsonb_build_object('result', 'auth_verification_required');
  end if;
  if not coalesce(p_storage_verified_erased, false) then
    return jsonb_build_object('result', 'storage_verification_required');
  end if;

  v_expected_storage_count := jsonb_array_length(v_job.storage_objects)
    + jsonb_array_length(v_job.storage_prefixes);
  if p_verified_storage_count is distinct from v_expected_storage_count then
    return jsonb_build_object(
      'result', 'storage_count_mismatch',
      'expected', v_expected_storage_count,
      'verified', p_verified_storage_count
    );
  end if;

  select
      (select count(*) from public.profiles where id = p_target_user_id)
    + (select count(*) from public.families where owner_user_id = p_target_user_id)
    + (select count(*) from public.family_members where user_id = p_target_user_id)
    + (select count(*) from public.app_admins where user_id = p_target_user_id)
    + (select count(*) from public.ai_consult_threads where owner_user_id = p_target_user_id)
    + (select count(*) from public.ai_memory_consents where user_id = p_target_user_id)
    + (select count(*) from public.push_tokens where user_id = p_target_user_id)
    + (select count(*) from public.notification_preferences where user_id = p_target_user_id)
    + (select count(*) from public.scheduled_notifications where user_id = p_target_user_id)
  into v_db_residual_count;

  if to_regclass('public.notebook_sync_receipts') is not null then
    execute 'select $1 + count(*) from public.notebook_sync_receipts where actor_user_id = $2'
      into v_db_residual_count using v_db_residual_count, p_target_user_id;
  end if;
  if to_regclass('public.ai_consult_daily_claims') is not null then
    execute 'select $1 + count(*) from public.ai_consult_daily_claims where claimed_by = $2'
      into v_db_residual_count using v_db_residual_count, p_target_user_id;
  end if;
  if to_regclass('public.notebook_storage_deletion_jobs') is not null then
    execute $diary_job_residuals$
      select $1 + count(*)
      from public.notebook_storage_deletion_jobs
      where created_by = $2
         or (
           status = 'completed'
           and (
             family_id = any(coalesce($3, '{}'::uuid[]))
             or (
               storage_bucket = 'home-photos'
               and storage_path like ('notebook/' || $2::text || '/%')
             )
           )
         )
    $diary_job_residuals$
      into v_db_residual_count
      using v_db_residual_count, p_target_user_id, v_job.owned_family_ids;
  end if;
  if to_regclass('public.notebook_diary_deletion_receipts') is not null then
    execute 'select $1 + count(*) from public.notebook_diary_deletion_receipts where family_id = any($2)'
      into v_db_residual_count using v_db_residual_count, v_job.owned_family_ids;
  end if;
  if to_regclass('public.person_notebook_deletion_receipts') is not null then
    execute $person_receipt_residuals$
      select $1 + count(*)
      from public.person_notebook_deletion_receipts
      where deleted_by = $2
         or family_id = any(coalesce($3, '{}'::uuid[]))
    $person_receipt_residuals$
      into v_db_residual_count
      using v_db_residual_count, p_target_user_id, v_job.owned_family_ids;
  end if;
  if to_regclass('public.person_notebook_storage_deletion_jobs') is not null then
    execute $person_job_residuals$
      select $1 + count(*)
      from public.person_notebook_storage_deletion_jobs
      where created_by = $2
         or (
           status = 'completed'
           and (
             family_id = any(coalesce($3, '{}'::uuid[]))
             or (
               storage_bucket = 'home-photos'
               and storage_path like ('notebook/' || $2::text || '/%')
             )
           )
         )
    $person_job_residuals$
      into v_db_residual_count
      using v_db_residual_count, p_target_user_id, v_job.owned_family_ids;
  end if;

  if v_db_residual_count <> 0
     or exists (
       select 1 from public.families family
       where family.id = any(v_job.owned_family_ids)
     ) then
    update public.account_erasure_jobs
    set last_error_code = 'database_residual_detected',
        last_error_at = now(),
        updated_at = now()
    where id = v_job.id;
    return jsonb_build_object(
      'result', 'database_verification_failed',
      'residualCount', v_db_residual_count
    );
  end if;

  if to_regclass('public.notebook_storage_deletion_jobs') is not null then
    -- These queue rows are required until Storage absence is verified. After
    -- that point the hash/count in account_erasure_jobs is sufficient durable
    -- evidence, while retaining raw family/person/path values is unnecessary.
    execute $remove_verified_jobs$
      delete from public.notebook_storage_deletion_jobs job
      where exists (
          select 1
          from jsonb_array_elements($1) object
          where object->>'bucket' = job.storage_bucket
            and object->>'path' = job.storage_path
        )
    $remove_verified_jobs$ using v_job.storage_objects;
  end if;

  if to_regclass('public.person_notebook_storage_deletion_jobs') is not null then
    -- Storage is now independently verified absent. Drop jobs tied to a family
    -- removed by this erasure, and target-owned raw paths whose stale reuse is
    -- covered by the completed account-erasure hash guard. A shared-family job
    -- for another uploader remains as an anonymized completed path tombstone.
    execute $finish_verified_person_jobs$
      delete from public.person_notebook_storage_deletion_jobs job
      where exists (
          select 1
          from jsonb_array_elements($1) object
          where object->>'bucket' = job.storage_bucket
            and object->>'path' = job.storage_path
        )
        and (
          job.family_id = any(coalesce($2, '{}'::uuid[]))
          or (
            job.storage_bucket = 'home-photos'
            and job.storage_path like ('notebook/' || $3::text || '/%')
          )
        )
    $finish_verified_person_jobs$
      using v_job.storage_objects, v_job.owned_family_ids, p_target_user_id;

    execute $complete_shared_person_jobs$
      update public.person_notebook_storage_deletion_jobs job
      set status = 'completed',
          created_by = null,
          completed_at = coalesce(job.completed_at, $2),
          last_error = null
      where exists (
          select 1
          from jsonb_array_elements($1) object
          where object->>'bucket' = job.storage_bucket
            and object->>'path' = job.storage_path
        )
        and job.status = 'pending'
    $complete_shared_person_jobs$ using v_job.storage_objects, v_now;
  end if;

  -- Verify the final durable-state minimization in the same transaction that
  -- would mark the request completed. Pending jobs were intentionally allowed
  -- through the earlier DB check until external Storage absence was proven;
  -- none tied to the erased account or a deleted family may survive now.
  v_db_residual_count := 0;
  if to_regclass('public.notebook_storage_deletion_jobs') is not null then
    execute $final_diary_job_residuals$
      select count(*)
      from public.notebook_storage_deletion_jobs
      where created_by = $1
         or family_id = any(coalesce($2, '{}'::uuid[]))
         or (
           storage_bucket = 'home-photos'
           and storage_path like ('notebook/' || $1::text || '/%')
         )
    $final_diary_job_residuals$
      into v_db_residual_count
      using p_target_user_id, v_job.owned_family_ids;
  end if;
  if to_regclass('public.notebook_diary_deletion_receipts') is not null then
    execute 'select $1 + count(*) from public.notebook_diary_deletion_receipts where family_id = any($2)'
      into v_db_residual_count using v_db_residual_count, v_job.owned_family_ids;
  end if;
  if to_regclass('public.person_notebook_deletion_receipts') is not null then
    execute 'select $1 + count(*) from public.person_notebook_deletion_receipts where deleted_by = $2 or family_id = any($3)'
      into v_db_residual_count
      using v_db_residual_count, p_target_user_id, v_job.owned_family_ids;
  end if;
  if to_regclass('public.person_notebook_storage_deletion_jobs') is not null then
    execute $final_person_job_residuals$
      select $1 + count(*)
      from public.person_notebook_storage_deletion_jobs
      where created_by = $2
         or family_id = any(coalesce($3, '{}'::uuid[]))
         or (
           storage_bucket = 'home-photos'
           and storage_path like ('notebook/' || $2::text || '/%')
         )
    $final_person_job_residuals$
      into v_db_residual_count
      using v_db_residual_count, p_target_user_id, v_job.owned_family_ids;
  end if;
  if v_db_residual_count <> 0 then
    update public.account_erasure_jobs
    set last_error_code = 'cleanup_identity_residual_detected',
        last_error_at = v_now,
        updated_at = v_now
    where id = v_job.id;
    return jsonb_build_object(
      'result', 'database_verification_failed',
      'code', 'cleanup_identity_residual_detected',
      'residualCount', v_db_residual_count
    );
  end if;

  update public.account_erasure_jobs
  set status = 'completed',
      target_user_id = null,
      target_email_hash = null,
      owned_family_ids = '{}'::uuid[],
      storage_objects = '[]'::jsonb,
      storage_prefixes = '[]'::jsonb,
      auth_verified_erased_at = v_now,
      storage_verified_erased_at = v_now,
      completed_at = v_now,
      verification_summary = jsonb_build_object(
        'authUserAbsent', true,
        'databaseReferencesAbsent', true,
        'storageObjectsAbsent', true,
        'verifiedStorageObjectCount', jsonb_array_length(v_job.storage_objects),
        'verifiedStoragePrefixCount', jsonb_array_length(v_job.storage_prefixes),
        'verifiedStorageManifestEntryCount', v_expected_storage_count,
        'completedByAppAdmin', true
      ),
      last_error_code = null,
      last_error_at = null,
      updated_at = v_now
  where id = v_job.id;

  -- Keep the minimum operational/legal receipt, not the person's contact text.
  update public.account_delete_requests
  set user_id = null,
      contact_email = null,
      reason = null,
      status = 'completed',
      last_status_changed_at = v_now,
      handled_at = v_now,
      handled_by = p_operator_user_id,
      handled_by_method = 'supabase_app_admin',
      handled_note = 'Auth・DB・Storageの削除を専用処理で検証済み'
  where id = p_request_id;

  insert into public.audit_logs (
    actor_user_id, action, target_type, target_id, metadata
  ) values (
    p_operator_user_id,
    'account_erasure_verified_completed',
    'account_erasure_job',
    v_job.id,
    jsonb_build_object(
      'requestId', p_request_id,
      'storageObjectCount', v_expected_storage_count,
      'authVerifiedAbsent', true,
      'databaseVerifiedAbsent', true,
      'storageVerifiedAbsent', true
    )
  );

  return jsonb_build_object('result', 'completed', 'jobId', v_job.id, 'completedAt', v_now);
end;
$$;

revoke all on table account_erasure_jobs from public, anon, authenticated, service_role;
grant select on table account_erasure_jobs to service_role;

revoke all on function guard_erased_profile_recreation() from public, anon, authenticated, service_role;
revoke all on function guard_erased_notebook_storage_write() from public, anon, authenticated, service_role;
revoke all on function guard_erased_notebook_attachment_reference() from public, anon, authenticated, service_role;
revoke all on function collect_account_erasure_storage_objects(uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function collect_account_erasure_storage_prefixes(uuid[]) from public, anon, authenticated, service_role;
revoke all on function hash_account_erasure_storage_prefixes(jsonb) from public, anon, authenticated, service_role;
revoke all on function collect_account_erasure_storage_manifest_blockers(jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function collect_account_erasure_pending_cleanup_objects(uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function collect_account_erasure_pending_person_cleanup_objects(uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function collect_account_erasure_shared_photo_blockers(uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function merge_account_erasure_storage_objects(jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function inspect_account_erasure_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function prepare_account_erasure_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function execute_account_erasure_database_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function finalize_account_erasure_v1(uuid, uuid, uuid, boolean, boolean, integer) from public, anon, authenticated;
grant execute on function inspect_account_erasure_v1(uuid, uuid, uuid) to service_role;
grant execute on function prepare_account_erasure_v1(uuid, uuid, uuid) to service_role;
grant execute on function execute_account_erasure_database_v1(uuid, uuid, uuid) to service_role;
grant execute on function finalize_account_erasure_v1(uuid, uuid, uuid, boolean, boolean, integer) to service_role;
