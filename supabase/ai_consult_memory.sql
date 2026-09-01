-- Durable per-person AI consultation memory.
-- Existing production projects: legacy is_family_member/RLS must already exist;
-- run this migration before rerunning the current api_grants.sql/production_rls.sql.
-- Safe to run repeatedly. Existing people, notebook events, and consultations are not changed.

-- Existing projects may contain an unexpected legacy role. NOT VALID leaves those
-- rows untouched while rejecting every new or updated role outside the supported
-- owner/admin/member/viewer set. The server separately treats unknown legacy roles
-- as viewer until operators clean and validate the constraint.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.family_members'::regclass
      and conname = 'family_members_role_allowed'
  ) then
    alter table public.family_members
      add constraint family_members_role_allowed
      check (role in ('owner', 'admin', 'member', 'viewer')) not valid;
  end if;
end;
$$;

create table if not exists public.person_ai_memories (
  person_id uuid primary key references public.people(id) on delete cascade,
  long_term_summary text not null default '',
  user_summary text not null default '',
  important_changes jsonb not null default '[]'::jsonb,
  excluded_event_ids uuid[] not null default '{}'::uuid[],
  source_event_ids uuid[] not null default '{}'::uuid[],
  record_count integer not null default 0,
  first_record_date date,
  last_record_date date,
  memory_version integer not null default 1,
  memory_reset_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_ai_memories_important_changes_array
    check (jsonb_typeof(important_changes) = 'array'),
  constraint person_ai_memories_record_count_nonnegative
    check (record_count >= 0),
  constraint person_ai_memories_memory_version_positive
    check (memory_version >= 1),
  constraint person_ai_memories_record_dates_ordered
    check (
      first_record_date is null
      or last_record_date is null
      or first_record_date <= last_record_date
  )
);

-- Keep the migration forward-compatible if an earlier draft of this table already exists.
alter table public.person_ai_memories
  add column if not exists memory_reset_at timestamptz;

create table if not exists public.ai_consult_threads (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid not null references public.people(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_consult_threads_person_owner_unique
    unique (person_id, owner_user_id)
);

create table if not exists public.ai_consult_turns (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid not null references public.ai_consult_threads(id) on delete cascade,
  question text not null,
  answer jsonb not null,
  source_event_ids uuid[] not null default '{}'::uuid[],
  memory_version integer not null default 1,
  saved_to_notebook_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ai_consult_turns_question_not_blank
    check (length(btrim(question)) > 0),
  constraint ai_consult_turns_answer_object
    check (jsonb_typeof(answer) = 'object'),
  constraint ai_consult_turns_memory_version_positive
    check (memory_version >= 1)
);

create table if not exists public.ai_memory_consents (
  person_id uuid not null references public.people(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_version text not null,
  revision integer not null default 1,
  accepted_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (person_id, user_id),
  constraint ai_memory_consents_version_not_blank check (length(btrim(consent_version)) > 0),
  constraint ai_memory_consents_revision_positive check (revision >= 1),
  constraint ai_memory_consents_revoked_after_acceptance
    check (revoked_at is null or revoked_at >= accepted_at)
);

-- Keep the migration forward-compatible if an earlier draft of this table already exists.
alter table public.ai_memory_consents
  add column if not exists revision integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ai_memory_consents'::regclass
      and conname = 'ai_memory_consents_revision_positive'
  ) then
    alter table public.ai_memory_consents
      add constraint ai_memory_consents_revision_positive check (revision >= 1);
  end if;
end;
$$;

comment on table public.person_ai_memories is
  'Family-visible, server-maintained durable AI memory for one person. AI summaries and user corrections are stored separately.';
comment on column public.person_ai_memories.long_term_summary is
  'Server-derived, source-linked long-term fact summary. Never replaces the underlying notebook events.';
comment on column public.person_ai_memories.user_summary is
  'Family-confirmed facts and corrections supplied by a user.';
comment on column public.person_ai_memories.important_changes is
  'Ordered JSON array of important changes; each item should distinguish source facts from AI interpretation.';
comment on column public.person_ai_memories.excluded_event_ids is
  'Notebook timeline event IDs that users removed from AI memory and retrieval.';
comment on column public.person_ai_memories.source_event_ids is
  'Notebook timeline event IDs currently represented in the long-term summary.';
comment on column public.person_ai_memories.memory_reset_at is
  'User-requested memory reset boundary. Rebuilds must ignore events created at or before this timestamp.';
comment on table public.ai_consult_threads is
  'One private AI consultation thread per person and consulting user.';
comment on table public.ai_consult_turns is
  'Durable consultation questions and structured answers. Access requires both thread ownership and current family membership.';
comment on table public.ai_memory_consents is
  'Current per-user, per-person durable-memory consent. Revocation applies across devices.';
comment on column public.ai_memory_consents.revision is
  'Optimistic-lock revision. Consent changes must compare and increment this value.';

create index if not exists idx_person_ai_memories_updated_at
  on public.person_ai_memories(updated_at desc);
create index if not exists idx_person_ai_memories_source_event_ids
  on public.person_ai_memories using gin(source_event_ids);
create index if not exists idx_person_ai_memories_excluded_event_ids
  on public.person_ai_memories using gin(excluded_event_ids);
create index if not exists idx_ai_consult_threads_owner_updated
  on public.ai_consult_threads(owner_user_id, updated_at desc);
create index if not exists idx_ai_consult_turns_thread_created
  on public.ai_consult_turns(thread_id, created_at desc);
create index if not exists idx_ai_consult_turns_source_event_ids
  on public.ai_consult_turns using gin(source_event_ids);
create index if not exists idx_ai_memory_consents_user_updated
  on public.ai_memory_consents(user_id, updated_at desc);

create or replace function public.touch_ai_consult_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists person_ai_memories_touch_updated_at
  on public.person_ai_memories;
create trigger person_ai_memories_touch_updated_at
before update on public.person_ai_memories
for each row execute function public.touch_ai_consult_updated_at();

drop trigger if exists ai_consult_threads_touch_updated_at
  on public.ai_consult_threads;
create trigger ai_consult_threads_touch_updated_at
before update on public.ai_consult_threads
for each row execute function public.touch_ai_consult_updated_at();

drop trigger if exists ai_memory_consents_touch_updated_at
  on public.ai_memory_consents;
create trigger ai_memory_consents_touch_updated_at
before update on public.ai_memory_consents
for each row execute function public.touch_ai_consult_updated_at();

alter table public.person_ai_memories enable row level security;
alter table public.ai_consult_threads enable row level security;
alter table public.ai_consult_turns enable row level security;
alter table public.ai_memory_consents enable row level security;

drop policy if exists "ai_memory_consents own family read" on public.ai_memory_consents;
create policy "ai_memory_consents own family read"
on public.ai_memory_consents for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.people
    where people.id = ai_memory_consents.person_id
      and public.is_family_member(people.family_id)
  )
);

drop policy if exists "person_ai_memories read family" on public.person_ai_memories;
create policy "person_ai_memories read family"
on public.person_ai_memories for select
to authenticated
using (
  exists (
    select 1
    from public.people
    where people.id = person_ai_memories.person_id
      and public.is_family_member(people.family_id)
  )
);

drop policy if exists "person_ai_memories update family" on public.person_ai_memories;
drop policy if exists "person_ai_memories insert family" on public.person_ai_memories;
drop policy if exists "person_ai_memories delete family" on public.person_ai_memories;

drop policy if exists "ai_consult_threads owner family access" on public.ai_consult_threads;
drop policy if exists "ai_consult_threads owner family read" on public.ai_consult_threads;
create policy "ai_consult_threads owner family read"
on public.ai_consult_threads for select
to authenticated
using (
  owner_user_id = auth.uid()
  and exists (
    select 1
    from public.people
    where people.id = ai_consult_threads.person_id
      and public.is_family_member(people.family_id)
  )
);

drop policy if exists "ai_consult_turns owner family access" on public.ai_consult_turns;
drop policy if exists "ai_consult_turns owner family read" on public.ai_consult_turns;
create policy "ai_consult_turns owner family read"
on public.ai_consult_turns for select
to authenticated
using (
  exists (
    select 1
    from public.ai_consult_threads
    join public.people on people.id = ai_consult_threads.person_id
    where ai_consult_threads.id = ai_consult_turns.thread_id
      and ai_consult_threads.owner_user_id = auth.uid()
      and public.is_family_member(people.family_id)
  )
);

-- Browser/mobile clients may read only through RLS. All mutations go through the
-- server API after it has re-checked the exact person and family. This prevents a
-- family member from forging server-derived summaries, source IDs, or AI turns
-- through a direct PostgREST request.
revoke all
  on table public.person_ai_memories, public.ai_consult_threads, public.ai_consult_turns, public.ai_memory_consents
  from authenticated;

grant select
  on table public.person_ai_memories, public.ai_consult_threads, public.ai_consult_turns, public.ai_memory_consents
  to authenticated;

revoke all
  on table public.person_ai_memories, public.ai_consult_threads, public.ai_consult_turns, public.ai_memory_consents
  from service_role;

grant select, insert, update, delete
  on table public.person_ai_memories, public.ai_consult_threads, public.ai_consult_turns, public.ai_memory_consents
  to service_role;

revoke all
  on table public.person_ai_memories, public.ai_consult_threads, public.ai_consult_turns, public.ai_memory_consents
  from anon;
