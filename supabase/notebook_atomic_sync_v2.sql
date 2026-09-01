-- Atomic, service-only notebook synchronization.
--
-- Apply after the original base tables and production family RLS exist. This
-- file adds the minimum person-notebook and regional person columns required by
-- the sync, so an older production database does not need to rerun the broader
-- person_notebook_hardening.sql or regional_sponsor_data.sql migrations. The API
-- must first verify the bearer token with Supabase Auth, then call
-- sync_notebook_v2 with that verified user's id/email. The function itself is
-- deliberately callable only with the service-role JWT.
--
-- Normalized p_cases item:
-- {
--   "localCaseId": "...", "personId": "server uuid or null",
--   "cloudRevision": 1, "cloudHash": "sha256...",
--   "displayName": "...", "relationshipToFamily": "...",
--   "prefecture": "...", "city": "...", "currentStatus": "preparing",
--   "profile": {...}, "localTasks": [
--     {"localTaskId":"...", "cloudRevision":1, "cloudHash":"sha256...",
--      "title":"...", "description":"...", "dueDate":"2026-09-01",
--      "status":"todo", "priority":2, "category":"notebook"}
--   ]
-- }
--
-- Normalized p_diary_entries item:
-- {
--   "localCaseId":"...", "localDiaryId":"...",
--   "cloudRevision":1, "cloudHash":"sha256...", "date":"2026-09-01",
--   "mood":"stable", "title":"日々の記録", "body":"...",
--   "attachments":[], "metadata":{}, "createdAt":"...", "updatedAt":"..."
-- }
--
-- A changed existing entity must carry the last cloudRevision/cloudHash returned
-- by GET/sync. An identical desired hash is accepted as an idempotent retry even
-- when the supplied revision is old. Absence from the arrays never deletes data.

-- This migration takes write locks while adding columns/backfilling hashes and
-- building non-CONCURRENT unique indexes. Run it in a short announced maintenance
-- window. A busy database fails after 10 seconds instead of waiting indefinitely;
-- every DDL/backfill/audit change rolls back together on any error.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '5min';

create extension if not exists pgcrypto;

-- Old production projects predate the PWA notebook and regional person fields.
-- Add only the columns this atomic migration needs, inside the same transaction
-- and before any hash/backfill statement reads them.
alter table public.people
  add column if not exists profile jsonb not null default '{}'::jsonb,
  add column if not exists profile_updated_at timestamptz,
  add column if not exists prefecture text,
  add column if not exists city text;

alter table public.timeline_events
  add column if not exists mood text,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.people
  add column if not exists cloud_revision bigint not null default 1,
  add column if not exists cloud_hash text;

alter table public.tasks
  add column if not exists local_task_id text,
  add column if not exists notebook_metadata jsonb not null default '{}'::jsonb,
  add column if not exists cloud_revision bigint not null default 1,
  add column if not exists cloud_hash text;

alter table public.timeline_events
  add column if not exists cloud_revision bigint not null default 1,
  add column if not exists cloud_hash text,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  v_bad_id uuid;
begin
  select id into v_bad_id
  from public.people
  where jsonb_typeof(profile) <> 'object'
  order by id
  limit 1;
  if v_bad_id is not null then
    raise exception using
      errcode = '22023',
      message = 'notebook_migration_invalid_people_profile',
      detail = jsonb_build_object('personId', v_bad_id)::text,
      hint = 'Inspect the non-object profile manually; this migration does not replace it.';
  end if;

  v_bad_id := null;
  select id into v_bad_id
  from public.timeline_events
  where jsonb_typeof(metadata) <> 'object'
  order by id
  limit 1;
  if v_bad_id is not null then
    raise exception using
      errcode = '22023',
      message = 'notebook_migration_invalid_timeline_metadata',
      detail = jsonb_build_object('timelineEventId', v_bad_id)::text,
      hint = 'Inspect the non-object metadata manually; this migration does not replace it.';
  end if;
end;
$$;

-- Canonical hashes intentionally omit server timestamps and client-only sync
-- timestamps. A task list is versioned as task rows, not as part of the person
-- profile, so a diary/task edit cannot accidentally acquire profile authority.
create or replace function public.notebook_people_cloud_hash(p_row public.people)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select encode(
    digest(
      convert_to(
        (
          (to_jsonb(p_row)
            - 'created_at'
            - 'updated_at'
            - 'profile_updated_at'
            - 'cloud_revision'
            - 'cloud_hash')
          || jsonb_build_object(
            'profile',
            coalesce(to_jsonb(p_row)->'profile', '{}'::jsonb)
              - 'localTasks'
              - 'localUpdatedAt'
              - 'syncedAt'
          )
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.notebook_task_cloud_hash(p_row public.tasks)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select encode(
    digest(
      convert_to(
        (to_jsonb(p_row)
          - 'created_at'
          - 'updated_at'
          - 'cloud_revision'
          - 'cloud_hash')::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.notebook_timeline_cloud_hash(p_row public.timeline_events)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select encode(
    digest(
      convert_to(
        (
          (to_jsonb(p_row)
            - 'created_at'
            - 'updated_at'
            - 'cloud_revision'
            - 'cloud_hash')
          || jsonb_build_object(
            'metadata',
            coalesce(to_jsonb(p_row)->'metadata', '{}'::jsonb)
              - 'localUpdatedAt'
              - 'syncedAt'
          )
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

-- Materialize the stable UUID fallback that the legacy GET already exposed.
-- Existing nonblank local case IDs are preserved verbatim.
update public.people p
set profile = coalesce(p.profile, '{}'::jsonb)
  || jsonb_build_object('localCaseId', p.id::text)
where nullif(btrim(p.profile->>'localCaseId'), '') is null;

-- Legacy PWA sync mirrored tasks into both people.profile.localTasks and tasks,
-- but the task row had no local identity. Recover it only for a one-to-one
-- title+dueDate match. Ambiguous and unmatched rows are handled separately by
-- their DB UUID fallback; the migration never guesses a profile task identity.
with task_identity_candidates as (
  select
    t.id as task_id,
    coalesce(
      nullif(btrim(local_task.item->>'localTaskId'), ''),
      nullif(btrim(local_task.item->>'id'), '')
    ) as local_task_id,
    count(*) over (partition by t.id) as matches_for_db_task,
    count(*) over (
      partition by
        t.person_id,
        coalesce(
          nullif(btrim(local_task.item->>'localTaskId'), ''),
          nullif(btrim(local_task.item->>'id'), '')
        )
    ) as matches_for_local_task,
    local_task.item
  from public.tasks t
  join public.people p on p.id = t.person_id
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(p.profile->'localTasks') = 'array' then p.profile->'localTasks'
      else '[]'::jsonb
    end
  ) local_task(item)
  where (
      nullif(btrim(t.local_task_id), '') is null
      or nullif(btrim(t.local_task_id), '') = coalesce(
        nullif(btrim(local_task.item->>'localTaskId'), ''),
        nullif(btrim(local_task.item->>'id'), '')
      )
    )
    and coalesce(
      nullif(btrim(local_task.item->>'localTaskId'), ''),
      nullif(btrim(local_task.item->>'id'), '')
    ) is not null
    and btrim(t.title) = btrim(coalesce(local_task.item->>'title', ''))
    and coalesce(to_char(t.due_date, 'YYYY-MM-DD'), '')
      = coalesce(nullif(local_task.item->>'dueDate', ''), '')
), unique_task_identities as (
  select
    task_id,
    local_task_id,
    item
      - 'localTaskId'
      - 'id'
      - 'title'
      - 'description'
      - 'dueDate'
      - 'status'
      - 'progress'
      - 'priority'
      - 'category'
      - 'updatedAt'
      - 'cloudRevision'
      - 'cloudHash' as notebook_metadata
  from task_identity_candidates
  where matches_for_db_task = 1
    and matches_for_local_task = 1
)
update public.tasks t
set local_task_id = case
      when nullif(btrim(t.local_task_id), '') is null then candidate.local_task_id
      else t.local_task_id
    end,
    notebook_metadata = case
      when t.notebook_metadata = '{}'::jsonb then candidate.notebook_metadata
      else t.notebook_metadata
    end
from unique_task_identities candidate
where t.id = candidate.task_id
  and (nullif(btrim(t.local_task_id), '') is null or t.notebook_metadata = '{}'::jsonb);

-- Ambiguous/unmatched profile mirrors are never guessed. Give those DB rows
-- their own UUID fallback so they remain addressable after the first restore.
update public.tasks t
set local_task_id = t.id::text
where nullif(btrim(t.local_task_id), '') is null;

-- Materialize legacy diary/event fallbacks without replacing nonblank IDs.
update public.timeline_events e
set metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object(
  'localDiaryId', coalesce(
    nullif(btrim(e.metadata->>'localDiaryId'), ''),
    e.id::text
  ),
  'localCaseId', coalesce(
    nullif(btrim(e.metadata->>'localCaseId'), ''),
    nullif(btrim(p.profile->>'localCaseId'), ''),
    p.id::text
  )
)
from public.people p
where p.id = e.person_id
  and e.event_type = 'diary'
  and (
    nullif(btrim(e.metadata->>'localDiaryId'), '') is null
    or nullif(btrim(e.metadata->>'localCaseId'), '') is null
  );

-- Backfill hashes without changing application content. This also makes rows
-- created before this migration a valid revision-1 base for the first v2 GET.
update public.people as p
set cloud_hash = public.notebook_people_cloud_hash(p)
where cloud_hash is null
   or cloud_hash is distinct from public.notebook_people_cloud_hash(p);

update public.tasks as t
set cloud_hash = public.notebook_task_cloud_hash(t)
where cloud_hash is null
   or cloud_hash is distinct from public.notebook_task_cloud_hash(t);

update public.timeline_events as e
set cloud_hash = public.notebook_timeline_cloud_hash(e)
where cloud_hash is null
   or cloud_hash is distinct from public.notebook_timeline_cloud_hash(e);

alter table public.people alter column cloud_hash set not null;
alter table public.tasks alter column cloud_hash set not null;
alter table public.timeline_events alter column cloud_hash set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.people'::regclass
      and conname = 'people_cloud_revision_positive'
  ) then
    alter table public.people
      add constraint people_cloud_revision_positive check (cloud_revision >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.people'::regclass
      and conname = 'people_cloud_hash_sha256'
  ) then
    alter table public.people
      add constraint people_cloud_hash_sha256 check (cloud_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_cloud_revision_positive'
  ) then
    alter table public.tasks
      add constraint tasks_cloud_revision_positive check (cloud_revision >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_notebook_metadata_object'
  ) then
    alter table public.tasks
      add constraint tasks_notebook_metadata_object check (jsonb_typeof(notebook_metadata) = 'object');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.tasks'::regclass
      and conname = 'tasks_cloud_hash_sha256'
  ) then
    alter table public.tasks
      add constraint tasks_cloud_hash_sha256 check (cloud_hash ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.timeline_events'::regclass
      and conname = 'timeline_events_cloud_revision_positive'
  ) then
    alter table public.timeline_events
      add constraint timeline_events_cloud_revision_positive check (cloud_revision >= 1);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.timeline_events'::regclass
      and conname = 'timeline_events_cloud_hash_sha256'
  ) then
    alter table public.timeline_events
      add constraint timeline_events_cloud_hash_sha256 check (cloud_hash ~ '^[0-9a-f]{64}$');
  end if;
end;
$$;

-- Do not silently choose a survivor. If legacy data contains duplicate local
-- identities, the migration stops before a unique index is built so an operator
-- can inspect and reconcile the affected rows deliberately.
do $$
declare
  v_duplicate text;
begin
  select format('family_id=%s localCaseId=%s count=%s', family_id, local_case_id, row_count)
  into v_duplicate
  from (
    select
      family_id,
      nullif(btrim(profile->>'localCaseId'), '') as local_case_id,
      count(*) as row_count
    from public.people
    where nullif(btrim(profile->>'localCaseId'), '') is not null
    group by family_id, nullif(btrim(profile->>'localCaseId'), '')
    having count(*) > 1
    order by family_id, nullif(btrim(profile->>'localCaseId'), '')
    limit 1
  ) duplicates;
  if v_duplicate is not null then
    raise exception using
      errcode = '23505',
      message = 'notebook_migration_duplicate_people',
      detail = v_duplicate,
      hint = 'Inspect and reconcile duplicate people manually; this migration never deletes a survivor.';
  end if;

  v_duplicate := null;
  select format('person_id=%s local_task_id=%s count=%s', person_id, local_task_id, row_count)
  into v_duplicate
  from (
    select person_id, nullif(btrim(local_task_id), '') as local_task_id, count(*) as row_count
    from public.tasks
    where nullif(btrim(local_task_id), '') is not null
    group by person_id, nullif(btrim(local_task_id), '')
    having count(*) > 1
    order by person_id, nullif(btrim(local_task_id), '')
    limit 1
  ) duplicates;
  if v_duplicate is not null then
    raise exception using
      errcode = '23505',
      message = 'notebook_migration_duplicate_tasks',
      detail = v_duplicate,
      hint = 'Inspect and reconcile duplicate tasks manually; this migration never deletes a survivor.';
  end if;

  v_duplicate := null;
  select format('person_id=%s localDiaryId=%s count=%s', person_id, local_diary_id, row_count)
  into v_duplicate
  from (
    select person_id, nullif(btrim(metadata->>'localDiaryId'), '') as local_diary_id, count(*) as row_count
    from public.timeline_events
    where nullif(btrim(metadata->>'localDiaryId'), '') is not null
    group by person_id, nullif(btrim(metadata->>'localDiaryId'), '')
    having count(*) > 1
    order by person_id, nullif(btrim(metadata->>'localDiaryId'), '')
    limit 1
  ) duplicates;
  if v_duplicate is not null then
    raise exception using
      errcode = '23505',
      message = 'notebook_migration_duplicate_diary_entries',
      detail = v_duplicate,
      hint = 'Inspect and reconcile duplicate diary events manually; this migration never deletes a survivor.';
  end if;
end;
$$;

create unique index if not exists ux_people_family_local_case_id
  on public.people (family_id, (nullif(btrim(profile->>'localCaseId'), '')))
  where nullif(btrim(profile->>'localCaseId'), '') is not null;

create unique index if not exists ux_tasks_person_local_task_id
  on public.tasks (person_id, (nullif(btrim(local_task_id), '')))
  where nullif(btrim(local_task_id), '') is not null;

create unique index if not exists ux_timeline_events_person_local_diary_id
  on public.timeline_events (person_id, (nullif(btrim(metadata->>'localDiaryId'), '')))
  where nullif(btrim(metadata->>'localDiaryId'), '') is not null;

-- Keep revisions/hashes correct for legacy/direct writers too. The v2 RPC sets
-- old_revision + 1 explicitly; direct content updates receive that increment here.
create or replace function public.notebook_people_cloud_version_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_key text;
  v_person_profile jsonb;
  v_had_incoming_person_profile boolean;
begin
  if jsonb_typeof(new.profile) <> 'object' then
    raise exception using errcode = '22023', message = 'people_profile_must_be_object';
  end if;

  v_had_incoming_person_profile := new.profile ? 'personProfile';

  if tg_op = 'INSERT' then
    if nullif(btrim(new.profile->>'localCaseId'), '') is null then
      new.profile := new.profile || jsonb_build_object('localCaseId', new.id::text);
    end if;
  else
    -- Mobile replaces the whole profile object. Retain PWA-owned envelope keys
    -- whenever that writer did not send them. An established localCaseId is an
    -- immutable cross-client identity and cannot be cleared/rebound.
    foreach v_key in array array[
      'localCaseId', 'localCreatedAt', 'localUpdatedAt', 'localAnswers',
      'personProfile', 'localResultSummary', 'localTasks', 'source', 'syncedAt'
    ] loop
      if not (new.profile ? v_key) and old.profile ? v_key then
        new.profile := new.profile || jsonb_build_object(v_key, old.profile->v_key);
      end if;
    end loop;

    if nullif(btrim(old.profile->>'localCaseId'), '') is not null then
      if nullif(btrim(new.profile->>'localCaseId'), '') is null then
        new.profile := new.profile || jsonb_build_object('localCaseId', old.profile->'localCaseId');
      elsif nullif(btrim(new.profile->>'localCaseId'), '')
        is distinct from nullif(btrim(old.profile->>'localCaseId'), '') then
        raise exception using errcode = '22023', message = 'people_local_case_id_immutable';
      end if;
    end if;
  end if;

  -- Old mobile writes flat fields. Only when personProfile was absent from the
  -- incoming payload do those flat values update the canonical nested object.
  -- Therefore a PWA nested update can never be overwritten by stale flat keys
  -- retained for mobile compatibility.
  if not v_had_incoming_person_profile then
    v_person_profile := case
      when jsonb_typeof(new.profile->'personProfile') = 'object' then new.profile->'personProfile'
      else '{}'::jsonb
    end;
    foreach v_key in array array[
      'fullName', 'displayName', 'relationship', 'birthDate', 'careStatus',
      'keyContact', 'hospitalOrFacility', 'medicationNote',
      'documentLocationNote', 'familyStructure', 'firstSituation',
      'documentKnowledge', 'updatedAt'
    ] loop
      if new.profile ? v_key then
        v_person_profile := v_person_profile || jsonb_build_object(
          case when v_key = 'familyStructure' then 'familyStructureNote' else v_key end,
          new.profile->v_key
        );
      end if;
    end loop;
    new.profile := new.profile || jsonb_build_object('personProfile', v_person_profile);
  end if;

  v_hash := public.notebook_people_cloud_hash(new);
  if tg_op = 'INSERT' then
    new.cloud_revision := 1;
  elsif v_hash is distinct from old.cloud_hash then
    if new.cloud_revision is null or new.cloud_revision <= old.cloud_revision then
      new.cloud_revision := old.cloud_revision + 1;
    elsif new.cloud_revision <> old.cloud_revision + 1 then
      raise exception using errcode = '22023', message = 'invalid_people_cloud_revision_increment';
    end if;
  else
    new.cloud_revision := old.cloud_revision;
  end if;
  new.cloud_hash := v_hash;
  return new;
end;
$$;

create or replace function public.notebook_task_cloud_version_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
begin
  if tg_op = 'INSERT' and nullif(btrim(new.local_task_id), '') is null then
    new.local_task_id := new.id::text;
  end if;
  v_hash := public.notebook_task_cloud_hash(new);
  if tg_op = 'INSERT' then
    new.cloud_revision := 1;
  elsif v_hash is distinct from old.cloud_hash then
    if new.cloud_revision is null or new.cloud_revision <= old.cloud_revision then
      new.cloud_revision := old.cloud_revision + 1;
    elsif new.cloud_revision <> old.cloud_revision + 1 then
      raise exception using errcode = '22023', message = 'invalid_task_cloud_revision_increment';
    end if;
  else
    new.cloud_revision := old.cloud_revision;
  end if;
  new.cloud_hash := v_hash;
  return new;
end;
$$;

create or replace function public.notebook_timeline_cloud_version_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash text;
  v_local_case_id text;
begin
  if tg_op = 'INSERT' and new.event_type = 'diary' then
    select coalesce(
      nullif(btrim(p.profile->>'localCaseId'), ''),
      new.person_id::text
    )
    into v_local_case_id
    from public.people p
    where p.id = new.person_id;

    new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object(
      'localDiaryId', coalesce(
        nullif(btrim(new.metadata->>'localDiaryId'), ''),
        new.id::text
      ),
      'localCaseId', coalesce(
        nullif(btrim(new.metadata->>'localCaseId'), ''),
        v_local_case_id,
        new.person_id::text
      )
    );
  end if;
  v_hash := public.notebook_timeline_cloud_hash(new);
  if tg_op = 'INSERT' then
    new.cloud_revision := 1;
  elsif v_hash is distinct from old.cloud_hash then
    if new.cloud_revision is null or new.cloud_revision <= old.cloud_revision then
      new.cloud_revision := old.cloud_revision + 1;
    elsif new.cloud_revision <> old.cloud_revision + 1 then
      raise exception using errcode = '22023', message = 'invalid_timeline_cloud_revision_increment';
    end if;
  else
    new.cloud_revision := old.cloud_revision;
  end if;
  new.cloud_hash := v_hash;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists people_notebook_cloud_version on public.people;
create trigger people_notebook_cloud_version
before insert or update on public.people
for each row execute function public.notebook_people_cloud_version_trigger();

drop trigger if exists tasks_notebook_cloud_version on public.tasks;
create trigger tasks_notebook_cloud_version
before insert or update on public.tasks
for each row execute function public.notebook_task_cloud_version_trigger();

drop trigger if exists timeline_events_notebook_cloud_version on public.timeline_events;
create trigger timeline_events_notebook_cloud_version
before insert or update on public.timeline_events
for each row execute function public.notebook_timeline_cloud_version_trigger();

-- The legacy production policies treated every family member, including a
-- viewer, as a writer. Keep the existing SELECT policies unchanged, but make
-- every direct/mobile write path use the same writer-role boundary as the RPC.
drop policy if exists "tasks manage family" on public.tasks;
create policy "tasks manage family"
on public.tasks for all
to authenticated
using (
  exists (
    select 1
    from public.people p
    join public.family_members fm on fm.family_id = p.family_id
    where p.id = tasks.person_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin', 'member')
  )
)
with check (
  exists (
    select 1
    from public.people p
    join public.family_members fm on fm.family_id = p.family_id
    where p.id = tasks.person_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin', 'member')
  )
);

drop policy if exists "timeline_events manage family" on public.timeline_events;
create policy "timeline_events manage family"
on public.timeline_events for all
to authenticated
using (
  exists (
    select 1
    from public.people p
    join public.family_members fm on fm.family_id = p.family_id
    where p.id = timeline_events.person_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin', 'member')
  )
)
with check (
  exists (
    select 1
    from public.people p
    join public.family_members fm on fm.family_id = p.family_id
    where p.id = timeline_events.person_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin', 'member')
  )
);

drop policy if exists "status_events insert family" on public.person_status_events;
create policy "status_events insert family"
on public.person_status_events for insert
to authenticated
with check (
  exists (
    select 1
    from public.people p
    join public.family_members fm on fm.family_id = p.family_id
    where p.id = person_status_events.person_id
      and fm.user_id = auth.uid()
      and fm.role in ('owner', 'admin', 'member')
  )
);

create table if not exists public.notebook_sync_receipts (
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  payload_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_user_id, request_id),
  constraint notebook_sync_receipts_payload_hash_sha256
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint notebook_sync_receipts_response_object
    check (jsonb_typeof(response) = 'object')
);

alter table public.notebook_sync_receipts enable row level security;

comment on table public.notebook_sync_receipts is
  'Service-only idempotency receipts for atomic notebook sync requests.';
comment on column public.notebook_sync_receipts.payload_hash is
  'SHA-256 of actor, family selection, create-family flag, normalized cases, and normalized diary entries.';

create index if not exists idx_notebook_sync_receipts_created_at
  on public.notebook_sync_receipts(created_at desc);

create or replace function public.sync_notebook_v2(
  p_actor_user_id uuid,
  p_actor_email text,
  p_family_id uuid,
  p_create_family boolean,
  p_cases jsonb,
  p_diary_entries jsonb,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cases jsonb := coalesce(p_cases, '[]'::jsonb);
  v_entries jsonb := coalesce(p_diary_entries, '[]'::jsonb);
  v_payload_hash text;
  v_receipt public.notebook_sync_receipts%rowtype;
  v_family_id uuid;
  v_membership_count integer;
  v_role text;
  v_plan text;
  v_owner_user_id uuid;
  v_is_owner boolean;
  v_now timestamptz := now();
  v_case jsonb;
  v_task jsonb;
  v_entry jsonb;
  v_local_case_id text;
  v_local_task_id text;
  v_local_diary_id text;
  v_client_person_id uuid;
  v_profile jsonb;
  v_local_tasks jsonb;
  v_task_metadata jsonb;
  v_attachments jsonb;
  v_metadata jsonb;
  v_person public.people%rowtype;
  v_task_row public.tasks%rowtype;
  v_event public.timeline_events%rowtype;
  v_person_exists boolean;
  v_task_exists boolean;
  v_event_exists boolean;
  v_desired_hash text;
  v_client_revision bigint;
  v_client_hash text;
  v_new_people integer := 0;
  v_existing_people integer := 0;
  v_synced_people integer := 0;
  v_synced_tasks integer := 0;
  v_synced_entries integer := 0;
  v_case_revisions jsonb := '[]'::jsonb;
  v_task_revisions jsonb := '[]'::jsonb;
  v_diary_revisions jsonb := '[]'::jsonb;
  v_seen_cases jsonb := '{}'::jsonb;
  v_seen_tasks jsonb := '{}'::jsonb;
  v_seen_entries jsonb := '{}'::jsonb;
  v_response jsonb;
  v_claim_role text;
  v_notice text;
  v_profile_applied boolean;
begin
  -- GRANT is the primary boundary. This claim check prevents an accidental
  -- future grant from turning a user-controlled actor id into an impersonation.
  v_claim_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}'::text)::jsonb)->>'role',
    ''
  );
  if v_claim_role <> 'service_role' then
    raise exception using errcode = '42501', message = 'notebook_sync_service_role_required';
  end if;

  if p_actor_user_id is null or p_request_id is null then
    raise exception using errcode = '22023', message = 'notebook_sync_actor_and_request_required';
  end if;
  if jsonb_typeof(v_cases) <> 'array' or jsonb_typeof(v_entries) <> 'array' then
    raise exception using errcode = '22023', message = 'notebook_sync_payload_must_be_arrays';
  end if;
  if jsonb_array_length(v_cases) > 40 or jsonb_array_length(v_entries) > 500 then
    raise exception using errcode = '22023', message = 'notebook_sync_payload_limit_exceeded';
  end if;
  if (p_family_id is null and not coalesce(p_create_family, false))
     or (p_family_id is not null and coalesce(p_create_family, false)) then
    raise exception using
      errcode = '22023',
      message = 'notebook_sync_choose_family_or_create',
      hint = 'Pass one existing p_family_id, or pass NULL with p_create_family=true, but never both.';
  end if;

  v_payload_hash := encode(
    digest(
      convert_to(
        jsonb_build_object(
          'actorUserId', p_actor_user_id,
          'actorEmail', lower(nullif(btrim(p_actor_email), '')),
          'familyId', p_family_id,
          'createFamily', coalesce(p_create_family, false),
          'cases', v_cases,
          'diaryEntries', v_entries
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('notebook-sync-request:' || p_actor_user_id::text || ':' || p_request_id::text, 0)
  );

  select r.* into v_receipt
  from public.notebook_sync_receipts r
  where r.actor_user_id = p_actor_user_id
    and r.request_id = p_request_id
  for update;

  if found then
    if v_receipt.payload_hash is distinct from v_payload_hash then
      raise exception using
        errcode = '22023',
        message = 'notebook_sync_request_id_reused',
        detail = jsonb_build_object('requestId', p_request_id)::text;
    end if;
    perform 1
    from public.family_members fm
    where fm.family_id = nullif(v_receipt.response->>'familyId', '')::uuid
      and fm.user_id = p_actor_user_id
      and fm.role in ('owner', 'admin', 'member');
    if not found then
      raise exception using
        errcode = '42501',
        message = 'notebook_sync_receipt_membership_no_longer_valid';
    end if;
    return v_receipt.response;
  end if;

  insert into public.profiles (id, email, display_name, updated_at)
  values (
    p_actor_user_id,
    lower(nullif(btrim(p_actor_email), '')),
    coalesce(split_part(nullif(btrim(p_actor_email), ''), '@', 1), '利用者'),
    v_now
  )
  on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email),
      updated_at = excluded.updated_at;

  if p_family_id is null then
    perform pg_advisory_xact_lock(
      hashtextextended('notebook-first-family:' || p_actor_user_id::text, 0)
    );

    select count(*), (array_agg(fm.family_id order by fm.created_at, fm.family_id))[1]
    into v_membership_count, v_family_id
    from public.family_members fm
    where fm.user_id = p_actor_user_id;

    if v_membership_count = 0 then
      insert into public.families (name, owner_user_id, plan, created_at, updated_at)
      values (
        coalesce(split_part(nullif(btrim(p_actor_email), ''), '@', 1), '利用者') || 'さんの家族',
        p_actor_user_id,
        'free',
        v_now,
        v_now
      )
      returning id into v_family_id;

      insert into public.family_members (family_id, user_id, role, relationship, created_at)
      values (v_family_id, p_actor_user_id, 'owner', '本人', v_now);
    elsif v_membership_count > 1 then
      raise exception using
        errcode = '22023',
        message = 'notebook_sync_family_id_required',
        hint = 'The actor belongs to multiple families; retry with an explicit p_family_id.';
    end if;
  else
    v_family_id := p_family_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('notebook-family:' || v_family_id::text, 0));

  select fm.role, f.plan, f.owner_user_id
  into v_role, v_plan, v_owner_user_id
  from public.family_members fm
  join public.families f on f.id = fm.family_id
  where fm.family_id = v_family_id
    and fm.user_id = p_actor_user_id
  for update of fm, f;

  if not found then
    raise exception using errcode = '42501', message = 'notebook_sync_family_membership_required';
  end if;
  if v_role not in ('owner', 'admin', 'member') then
    raise exception using errcode = '42501', message = 'notebook_sync_viewer_cannot_mutate';
  end if;

  v_is_owner := v_owner_user_id = p_actor_user_id;
  select count(*) into v_existing_people
  from public.people p
  where p.family_id = v_family_id;

  for v_case in
    select item.value
    from jsonb_array_elements(v_cases) item(value)
    order by item.value->>'localCaseId'
  loop
    if jsonb_typeof(v_case) <> 'object' then
      raise exception using errcode = '22023', message = 'notebook_sync_case_must_be_object';
    end if;

    v_local_case_id := nullif(btrim(v_case->>'localCaseId'), '');
    if v_local_case_id is null or length(v_local_case_id) > 200 then
      raise exception using errcode = '22023', message = 'notebook_sync_invalid_local_case_id';
    end if;
    if v_seen_cases ? v_local_case_id then
      raise exception using
        errcode = '22023', message = 'notebook_sync_duplicate_case_in_request', detail = v_local_case_id;
    end if;
    v_seen_cases := v_seen_cases || jsonb_build_object(v_local_case_id, true);
    v_profile_applied := true;

    if coalesce(jsonb_typeof(v_case->'profile'), 'object') <> 'object' then
      raise exception using errcode = '22023', message = 'notebook_sync_profile_must_be_object';
    end if;
    v_profile := (coalesce(v_case->'profile', '{}'::jsonb)
      - 'localTasks' - 'localUpdatedAt' - 'syncedAt')
      || jsonb_build_object('localCaseId', v_local_case_id);

    v_local_tasks := case
      when jsonb_typeof(v_case->'localTasks') = 'array' then v_case->'localTasks'
      when jsonb_typeof(v_case->'profile'->'localTasks') = 'array' then v_case->'profile'->'localTasks'
      else '[]'::jsonb
    end;
    if jsonb_array_length(v_local_tasks) > 40 then
      raise exception using errcode = '22023', message = 'notebook_sync_task_limit_exceeded';
    end if;

    select p.* into v_person
    from public.people p
    where p.family_id = v_family_id
      and nullif(btrim(p.profile->>'localCaseId'), '') = v_local_case_id
    for update;
    v_person_exists := found;
    v_client_person_id := nullif(btrim(v_case->>'personId'), '')::uuid;

    if v_person_exists then
      if v_client_person_id is not null and v_client_person_id <> v_person.id then
        raise exception using
          errcode = '42501',
          message = 'notebook_sync_person_binding_mismatch',
          detail = jsonb_build_object(
            'localCaseId', v_local_case_id,
            'expectedPersonId', v_person.id,
            'receivedPersonId', v_client_person_id
          )::text;
      end if;
      v_profile := coalesce(v_person.profile, '{}'::jsonb)
        || v_profile
        || jsonb_build_object(
          'personProfile',
          (case
            when jsonb_typeof(v_person.profile->'personProfile') = 'object'
              then v_person.profile->'personProfile'
            else '{}'::jsonb
          end)
          || (case
            when jsonb_typeof(v_profile->'personProfile') = 'object'
              then v_profile->'personProfile'
            else '{}'::jsonb
          end)
        );
      v_person.display_name := coalesce(nullif(btrim(v_case->>'displayName'), ''), '対象者');
      v_person.relationship_to_family := nullif(btrim(v_case->>'relationshipToFamily'), '');
      v_person.prefecture := nullif(btrim(v_case->>'prefecture'), '');
      v_person.city := nullif(btrim(v_case->>'city'), '');
      v_person.current_status := coalesce(nullif(btrim(v_case->>'currentStatus'), ''), 'preparing');
      v_person.profile := v_profile;
      v_desired_hash := public.notebook_people_cloud_hash(v_person);

      if v_desired_hash is distinct from v_person.cloud_hash then
        if v_role = 'member' then
          -- A member may have a legacy/mobile profile shape that differs from
          -- the canonical owner copy. Ignore that profile payload, but continue
          -- the same transaction for the member-authorized tasks and diary.
          select p.* into v_person from public.people p where p.id = v_person.id;
          v_profile_applied := false;
          v_notice := coalesce(
            v_notice,
            '共有メンバーのため、対象者の基本情報は変更せず、確認事項と記録だけを保存しました。'
          );
        else
          v_client_revision := nullif(v_case->>'cloudRevision', '')::bigint;
          v_client_hash := nullif(btrim(v_case->>'cloudHash'), '');
          if v_client_revision is distinct from v_person.cloud_revision
             or v_client_hash is distinct from v_person.cloud_hash then
            raise exception using
              errcode = '40001',
              message = 'notebook_case_conflict',
              detail = jsonb_build_object(
                'localCaseId', v_local_case_id,
                'cloudRevision', v_person.cloud_revision,
                'cloudHash', v_person.cloud_hash
              )::text;
          end if;

          update public.people
          set display_name = v_person.display_name,
              relationship_to_family = v_person.relationship_to_family,
              prefecture = v_person.prefecture,
              city = v_person.city,
              current_status = v_person.current_status,
              profile = v_person.profile,
              profile_updated_at = v_now,
              updated_at = v_now
          where id = v_person.id
          returning * into v_person;
        end if;
      end if;
    else
      if v_client_person_id is not null then
        raise exception using
          errcode = '42501',
          message = 'notebook_sync_new_person_must_not_have_person_id',
          detail = jsonb_build_object(
            'localCaseId', v_local_case_id,
            'receivedPersonId', v_client_person_id
          )::text;
      end if;
      if v_role not in ('owner', 'admin') then
        raise exception using
          errcode = '42501',
          message = 'notebook_sync_new_person_requires_owner_or_admin',
          detail = jsonb_build_object('localCaseId', v_local_case_id)::text;
      end if;
      v_client_revision := coalesce(nullif(v_case->>'cloudRevision', '')::bigint, 0);
      v_client_hash := nullif(btrim(v_case->>'cloudHash'), '');
      if v_client_revision <> 0 or v_client_hash is not null then
        raise exception using
          errcode = '40001',
          message = 'notebook_new_case_has_cloud_identity',
          detail = jsonb_build_object('localCaseId', v_local_case_id)::text;
      end if;
      if coalesce(v_plan, 'free') <> 'plus' and v_existing_people + v_new_people >= 1 then
        raise exception using errcode = '23514', message = 'notebook_free_plan_person_limit';
      end if;

      insert into public.people (
        family_id, display_name, relationship_to_family, prefecture, city,
        current_status, profile, profile_updated_at, created_at, updated_at
      ) values (
        v_family_id,
        coalesce(nullif(btrim(v_case->>'displayName'), ''), '対象者'),
        nullif(btrim(v_case->>'relationshipToFamily'), ''),
        nullif(btrim(v_case->>'prefecture'), ''),
        nullif(btrim(v_case->>'city'), ''),
        coalesce(nullif(btrim(v_case->>'currentStatus'), ''), 'preparing'),
        v_profile,
        v_now,
        v_now,
        v_now
      ) returning * into v_person;
      v_new_people := v_new_people + 1;
    end if;

    v_synced_people := v_synced_people + 1;
    v_case_revisions := v_case_revisions || jsonb_build_array(jsonb_build_object(
      'localCaseId', v_local_case_id,
      'personId', v_person.id,
      'cloudRevision', v_person.cloud_revision,
      'cloudHash', v_person.cloud_hash,
      'profileApplied', v_profile_applied
    ));

    for v_task in
      select item.value
      from jsonb_array_elements(v_local_tasks) item(value)
      order by coalesce(item.value->>'localTaskId', item.value->>'id')
    loop
      if jsonb_typeof(v_task) <> 'object' then
        raise exception using errcode = '22023', message = 'notebook_sync_task_must_be_object';
      end if;
      if v_task ? 'notebookMetadata' and jsonb_typeof(v_task->'notebookMetadata') <> 'object' then
        raise exception using errcode = '22023', message = 'notebook_sync_task_metadata_must_be_object';
      end if;
      v_task_metadata := coalesce(v_task->'notebookMetadata', '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object(
          'assignee', v_task->'assignee',
          'note', v_task->'note',
          'requiresProfessional', v_task->'requiresProfessional',
          'defaultDueOffsetDays', v_task->'defaultDueOffsetDays'
        ));
      v_local_task_id := coalesce(
        nullif(btrim(v_task->>'localTaskId'), ''),
        nullif(btrim(v_task->>'id'), '')
      );
      if v_local_task_id is null or length(v_local_task_id) > 200 then
        raise exception using errcode = '22023', message = 'notebook_sync_invalid_local_task_id';
      end if;
      if v_seen_tasks ? (v_local_case_id || ':' || v_local_task_id) then
        raise exception using
          errcode = '22023', message = 'notebook_sync_duplicate_task_in_request',
          detail = jsonb_build_object('localCaseId', v_local_case_id, 'localTaskId', v_local_task_id)::text;
      end if;
      v_seen_tasks := v_seen_tasks || jsonb_build_object(v_local_case_id || ':' || v_local_task_id, true);

      select t.* into v_task_row
      from public.tasks t
      where t.person_id = v_person.id
        and nullif(btrim(t.local_task_id), '') = v_local_task_id
      for update;
      v_task_exists := found;

      if v_task_exists then
        v_task_row.title := coalesce(nullif(btrim(v_task->>'title'), ''), '確認すること');
        v_task_row.description := nullif(v_task->>'description', '');
        v_task_row.due_date := nullif(v_task->>'dueDate', '')::date;
        v_task_row.status := case
          when v_task->>'status' in ('todo', 'doing', 'done', 'skipped') then v_task->>'status'
          else 'todo'
        end;
        v_task_row.priority := greatest(1, least(3, coalesce(nullif(v_task->>'priority', '')::integer, 2)));
        v_task_row.category := coalesce(nullif(btrim(v_task->>'category'), ''), 'notebook');
        v_task_row.notebook_metadata := coalesce(v_task_row.notebook_metadata, '{}'::jsonb)
          || v_task_metadata;
        v_desired_hash := public.notebook_task_cloud_hash(v_task_row);

        if v_desired_hash is distinct from v_task_row.cloud_hash then
          v_client_revision := nullif(v_task->>'cloudRevision', '')::bigint;
          v_client_hash := nullif(btrim(v_task->>'cloudHash'), '');
          if v_client_revision is distinct from v_task_row.cloud_revision
             or v_client_hash is distinct from v_task_row.cloud_hash then
            raise exception using
              errcode = '40001',
              message = 'notebook_task_conflict',
              detail = jsonb_build_object(
                'localCaseId', v_local_case_id,
                'localTaskId', v_local_task_id,
                'cloudRevision', v_task_row.cloud_revision,
                'cloudHash', v_task_row.cloud_hash
              )::text;
          end if;

          update public.tasks
          set title = v_task_row.title,
              description = v_task_row.description,
              due_date = v_task_row.due_date,
              status = v_task_row.status,
              priority = v_task_row.priority,
              category = v_task_row.category,
              notebook_metadata = v_task_row.notebook_metadata,
              updated_at = v_now
          where id = v_task_row.id
          returning * into v_task_row;
        end if;
      else
        v_client_revision := coalesce(nullif(v_task->>'cloudRevision', '')::bigint, 0);
        v_client_hash := nullif(btrim(v_task->>'cloudHash'), '');
        if v_client_revision <> 0 or v_client_hash is not null then
          raise exception using
            errcode = '40001',
            message = 'notebook_new_task_has_cloud_identity',
            detail = jsonb_build_object('localCaseId', v_local_case_id, 'localTaskId', v_local_task_id)::text;
        end if;

        insert into public.tasks (
          person_id, local_task_id, title, description, due_date, status,
          priority, category, notebook_metadata, created_by, created_at, updated_at
        ) values (
          v_person.id,
          v_local_task_id,
          coalesce(nullif(btrim(v_task->>'title'), ''), '確認すること'),
          nullif(v_task->>'description', ''),
          nullif(v_task->>'dueDate', '')::date,
          case when v_task->>'status' in ('todo', 'doing', 'done', 'skipped') then v_task->>'status' else 'todo' end,
          greatest(1, least(3, coalesce(nullif(v_task->>'priority', '')::integer, 2))),
          coalesce(nullif(btrim(v_task->>'category'), ''), 'notebook'),
          v_task_metadata,
          p_actor_user_id,
          v_now,
          v_now
        ) returning * into v_task_row;
      end if;

      v_synced_tasks := v_synced_tasks + 1;
      v_task_revisions := v_task_revisions || jsonb_build_array(jsonb_build_object(
        'localCaseId', v_local_case_id,
        'localTaskId', v_local_task_id,
        'cloudRevision', v_task_row.cloud_revision,
        'cloudHash', v_task_row.cloud_hash
      ));
    end loop;
  end loop;

  for v_entry in
    select item.value
    from jsonb_array_elements(v_entries) item(value)
    order by item.value->>'localCaseId', coalesce(item.value->>'localDiaryId', item.value->>'id')
  loop
    if jsonb_typeof(v_entry) <> 'object' then
      raise exception using errcode = '22023', message = 'notebook_sync_diary_must_be_object';
    end if;
    v_local_case_id := nullif(btrim(v_entry->>'localCaseId'), '');
    v_local_diary_id := coalesce(
      nullif(btrim(v_entry->>'localDiaryId'), ''),
      nullif(btrim(v_entry->>'id'), '')
    );
    if v_local_case_id is null or v_local_diary_id is null
       or length(v_local_case_id) > 200 or length(v_local_diary_id) > 200 then
      raise exception using errcode = '22023', message = 'notebook_sync_invalid_diary_identity';
    end if;
    if v_seen_entries ? (v_local_case_id || ':' || v_local_diary_id) then
      raise exception using
        errcode = '22023', message = 'notebook_sync_duplicate_diary_in_request',
        detail = jsonb_build_object('localCaseId', v_local_case_id, 'localDiaryId', v_local_diary_id)::text;
    end if;
    v_seen_entries := v_seen_entries || jsonb_build_object(v_local_case_id || ':' || v_local_diary_id, true);

    select p.* into v_person
    from public.people p
    where p.family_id = v_family_id
      and nullif(btrim(p.profile->>'localCaseId'), '') = v_local_case_id
    for update;
    if not found then
      raise exception using
        errcode = '23503', message = 'notebook_sync_diary_person_not_found',
        detail = jsonb_build_object('localCaseId', v_local_case_id)::text;
    end if;

    v_attachments := coalesce(v_entry->'attachments', '[]'::jsonb);
    v_metadata := coalesce(v_entry->'metadata', '{}'::jsonb);
    if jsonb_typeof(v_attachments) <> 'array' or jsonb_array_length(v_attachments) > 10 then
      raise exception using errcode = '22023', message = 'notebook_sync_invalid_attachments';
    end if;
    if jsonb_typeof(v_metadata) <> 'object' then
      raise exception using errcode = '22023', message = 'notebook_sync_metadata_must_be_object';
    end if;
    v_metadata := (v_metadata - 'syncedAt' - 'localUpdatedAt')
      || jsonb_build_object(
        'localCaseId', v_local_case_id,
        'localDiaryId', v_local_diary_id,
        'syncedAt', v_now
      );

    select e.* into v_event
    from public.timeline_events e
    where e.person_id = v_person.id
      and nullif(btrim(e.metadata->>'localDiaryId'), '') = v_local_diary_id
    for update;
    v_event_exists := found;

    if v_event_exists then
      v_metadata := v_metadata || jsonb_build_object(
        'localCreatedAt', coalesce(
          nullif(v_entry->>'createdAt', ''),
          nullif(v_event.metadata->>'localCreatedAt', ''),
          v_event.created_at::text
        ),
        'localUpdatedAt', coalesce(
          nullif(v_entry->>'updatedAt', ''),
          nullif(v_entry->>'createdAt', ''),
          nullif(v_event.metadata->>'localUpdatedAt', ''),
          v_event.updated_at::text
        )
      );
      v_event.event_type := 'diary';
      v_event.event_date := nullif(v_entry->>'date', '')::date;
      v_event.mood := case when v_entry->>'mood' in ('stable', 'changed', 'urgent') then v_entry->>'mood' else 'stable' end;
      v_event.title := coalesce(
        nullif(btrim(v_entry->>'title'), ''),
        case when v_event.mood = 'urgent' then '急ぎの記録' when v_event.mood = 'changed' then '変化の記録' else '日々の記録' end
      );
      v_event.body := coalesce(v_entry->>'body', '記録');
      v_event.attachments := v_attachments;
      v_event.metadata := coalesce(v_event.metadata, '{}'::jsonb) || v_metadata;
      v_desired_hash := public.notebook_timeline_cloud_hash(v_event);

      if v_desired_hash is distinct from v_event.cloud_hash then
        v_client_revision := nullif(v_entry->>'cloudRevision', '')::bigint;
        v_client_hash := nullif(btrim(v_entry->>'cloudHash'), '');
        if v_client_revision is distinct from v_event.cloud_revision
           or v_client_hash is distinct from v_event.cloud_hash then
          raise exception using
            errcode = '40001',
            message = 'notebook_diary_conflict',
            detail = jsonb_build_object(
              'localCaseId', v_local_case_id,
              'localDiaryId', v_local_diary_id,
              'cloudRevision', v_event.cloud_revision,
              'cloudHash', v_event.cloud_hash
            )::text;
        end if;

        update public.timeline_events
        set event_type = v_event.event_type,
            event_date = v_event.event_date,
            title = v_event.title,
            body = v_event.body,
            mood = v_event.mood,
            attachments = v_event.attachments,
            metadata = v_event.metadata,
            updated_at = v_now
        where id = v_event.id
        returning * into v_event;
      end if;
    else
      v_client_revision := coalesce(nullif(v_entry->>'cloudRevision', '')::bigint, 0);
      v_client_hash := nullif(btrim(v_entry->>'cloudHash'), '');
      if v_client_revision <> 0 or v_client_hash is not null then
        raise exception using
          errcode = '40001',
          message = 'notebook_new_diary_has_cloud_identity',
          detail = jsonb_build_object('localCaseId', v_local_case_id, 'localDiaryId', v_local_diary_id)::text;
      end if;

      v_metadata := v_metadata || jsonb_build_object(
        'localCreatedAt', coalesce(nullif(v_entry->>'createdAt', ''), v_now::text),
        'localUpdatedAt', coalesce(
          nullif(v_entry->>'updatedAt', ''),
          nullif(v_entry->>'createdAt', ''),
          v_now::text
        )
      );

      insert into public.timeline_events (
        person_id, event_type, event_date, title, body, mood, attachments,
        metadata, created_by, created_at, updated_at
      ) values (
        v_person.id,
        'diary',
        nullif(v_entry->>'date', '')::date,
        coalesce(
          nullif(btrim(v_entry->>'title'), ''),
          case when v_entry->>'mood' = 'urgent' then '急ぎの記録' when v_entry->>'mood' = 'changed' then '変化の記録' else '日々の記録' end
        ),
        coalesce(v_entry->>'body', '記録'),
        case when v_entry->>'mood' in ('stable', 'changed', 'urgent') then v_entry->>'mood' else 'stable' end,
        v_attachments,
        v_metadata,
        p_actor_user_id,
        v_now,
        v_now
      ) returning * into v_event;
    end if;

    v_synced_entries := v_synced_entries + 1;
    v_diary_revisions := v_diary_revisions || jsonb_build_array(jsonb_build_object(
      'localCaseId', v_local_case_id,
      'localDiaryId', v_local_diary_id,
      'cloudRevision', v_event.cloud_revision,
      'cloudHash', v_event.cloud_hash
    ));
  end loop;

  v_response := jsonb_build_object(
    'ok', true,
    'familyId', v_family_id,
    'plan', coalesce(v_plan, 'free'),
    'memberRole', v_role,
    'isFamilyOwner', v_is_owner,
    'canManageFamilyBilling', v_is_owner,
    'syncedPeople', v_synced_people,
    'syncedTasks', v_synced_tasks,
    'syncedEntries', v_synced_entries,
    'caseRevisions', v_case_revisions,
    'taskRevisions', v_task_revisions,
    'diaryRevisions', v_diary_revisions,
    'notice', v_notice
  );

  insert into public.notebook_sync_receipts (actor_user_id, request_id, payload_hash, response)
  values (p_actor_user_id, p_request_id, v_payload_hash, v_response);

  return v_response;
end;
$$;

comment on function public.sync_notebook_v2(uuid, text, uuid, boolean, jsonb, jsonb, uuid) is
  'Atomically syncs one verified actor notebook payload. Service role only; family and role are revalidated in the transaction.';

-- Functions are executable by PUBLIC unless explicitly revoked.
revoke all on function public.notebook_people_cloud_hash(public.people) from public, anon, authenticated, service_role;
revoke all on function public.notebook_task_cloud_hash(public.tasks) from public, anon, authenticated, service_role;
revoke all on function public.notebook_timeline_cloud_hash(public.timeline_events) from public, anon, authenticated, service_role;
revoke all on function public.notebook_people_cloud_version_trigger() from public, anon, authenticated, service_role;
revoke all on function public.notebook_task_cloud_version_trigger() from public, anon, authenticated, service_role;
revoke all on function public.notebook_timeline_cloud_version_trigger() from public, anon, authenticated, service_role;
revoke all on function public.sync_notebook_v2(uuid, text, uuid, boolean, jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.sync_notebook_v2(uuid, text, uuid, boolean, jsonb, jsonb, uuid)
  to service_role;

revoke all on table public.notebook_sync_receipts from public, anon, authenticated, service_role;
grant select, insert on table public.notebook_sync_receipts to service_role;

commit;
