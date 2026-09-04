-- Existing-production migration: make viewer a genuinely read-only family role.
-- Safe to run repeatedly. Apply in a short maintenance window after
-- notebook_atomic_sync_v2.sql and ai_consult_memory.sql.

begin;

create or replace function public.is_family_editor(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where family_members.family_id = target_family_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  );
$$;

revoke all on function public.is_family_editor(uuid) from public, anon;
grant execute on function public.is_family_editor(uuid) to authenticated, service_role;

drop policy if exists "status_events insert family" on public.person_status_events;
create policy "status_events insert family"
on public.person_status_events for insert
to authenticated
with check (
  exists (
    select 1
    from public.people
    join public.family_members on family_members.family_id = people.family_id
    where people.id = person_status_events.person_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  )
);

drop policy if exists "tasks manage family" on public.tasks;
create policy "tasks manage family"
on public.tasks for all
to authenticated
using (
  exists (
    select 1
    from public.people
    join public.family_members on family_members.family_id = people.family_id
    where people.id = tasks.person_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  )
)
with check (
  exists (
    select 1
    from public.people
    join public.family_members on family_members.family_id = people.family_id
    where people.id = tasks.person_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  )
);

drop policy if exists "asset_items manage family" on public.asset_items;
create policy "asset_items manage family"
on public.asset_items for all
to authenticated
using (
  exists (
    select 1 from public.people
    where people.id = asset_items.person_id
      and public.is_family_editor(people.family_id)
  )
)
with check (
  exists (
    select 1 from public.people
    where people.id = asset_items.person_id
      and public.is_family_editor(people.family_id)
  )
);

drop policy if exists "timeline_events manage family" on public.timeline_events;
create policy "timeline_events manage family"
on public.timeline_events for all
to authenticated
using (
  exists (
    select 1
    from public.people
    join public.family_members on family_members.family_id = people.family_id
    where people.id = timeline_events.person_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  )
)
with check (
  exists (
    select 1
    from public.people
    join public.family_members on family_members.family_id = people.family_id
    where people.id = timeline_events.person_id
      and family_members.user_id = auth.uid()
      and family_members.role in ('owner', 'admin', 'member')
  )
);

drop policy if exists "homes manage family" on public.homes;
create policy "homes manage family"
on public.homes for all
to authenticated
using (
  exists (
    select 1 from public.people
    where people.id = homes.person_id
      and public.is_family_editor(people.family_id)
  )
)
with check (
  exists (
    select 1 from public.people
    where people.id = homes.person_id
      and public.is_family_editor(people.family_id)
  )
);

drop policy if exists "home_photos manage family" on public.home_photos;
create policy "home_photos manage family"
on public.home_photos for all
to authenticated
using (
  exists (
    select 1
    from public.homes
    join public.people on people.id = homes.person_id
    where homes.id = home_photos.home_id
      and public.is_family_editor(people.family_id)
  )
)
with check (
  exists (
    select 1
    from public.homes
    join public.people on people.id = homes.person_id
    where homes.id = home_photos.home_id
      and public.is_family_editor(people.family_id)
  )
);

-- The portable PostgreSQL regression does not install Supabase Storage.
-- Production does, so update object mutation policies when the table exists.
do $storage_policy_hardening$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "home photos update own family" on storage.objects';
    execute $policy$
      create policy "home photos update own family"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'home-photos'
        and exists (
          select 1
          from public.home_photos
          join public.homes on homes.id = home_photos.home_id
          join public.people on people.id = homes.person_id
          join public.family_members on family_members.family_id = people.family_id
          where home_photos.storage_path = storage.objects.name
            and family_members.user_id = auth.uid()
            and family_members.role in ('owner', 'admin', 'member')
        )
      )
    $policy$;

    execute 'drop policy if exists "home photos delete own family" on storage.objects';
    execute $policy$
      create policy "home photos delete own family"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'home-photos'
        and exists (
          select 1
          from public.home_photos
          join public.homes on homes.id = home_photos.home_id
          join public.people on people.id = homes.person_id
          join public.family_members on family_members.family_id = people.family_id
          where home_photos.storage_path = storage.objects.name
            and family_members.user_id = auth.uid()
            and family_members.role in ('owner', 'admin', 'member')
        )
      )
    $policy$;
  end if;
end;
$storage_policy_hardening$;

commit;
