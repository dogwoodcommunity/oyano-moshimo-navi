-- Person notebook persistence for the app/PWA-first flow.
-- Run after schema.sql on existing production projects.

alter table public.people
  add column if not exists profile jsonb not null default '{}'::jsonb,
  add column if not exists profile_updated_at timestamptz;

alter table public.timeline_events
  add column if not exists mood text,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'timeline_events_mood_check'
  ) then
    alter table public.timeline_events
      add constraint timeline_events_mood_check
      check (mood is null or mood in ('stable', 'changed', 'urgent'));
  end if;
end;
$$;

create index if not exists idx_people_profile_updated_at
  on public.people(profile_updated_at);

create index if not exists idx_timeline_events_person_date
  on public.timeline_events(person_id, event_date desc, created_at desc);
