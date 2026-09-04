do $family_photo_race_assert$
begin
  if not exists (
    select 1 from public.family_members
    where family_id = 'f1000000-0000-4000-8000-000000000010'
      and user_id = 'f1000000-0000-4000-8000-000000000002'
  ) or not exists (
    select 1 from public.timeline_events
    where id = 'f1000000-0000-4000-8000-000000000030'
  ) then
    raise exception 'photo-first race did not keep both the member and committed diary';
  end if;

  if exists (
    select 1 from public.family_members
    where family_id = 'f2000000-0000-4000-8000-000000000010'
      and user_id = 'f2000000-0000-4000-8000-000000000002'
  ) or exists (
    select 1 from public.timeline_events
    where id = 'f2000000-0000-4000-8000-000000000030'
  ) then
    raise exception 'removal-first race retained the member or accepted the late diary';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.timeline_events'::regclass
      and tgname = 'timeline_events_notebook_storage_delete_guard'
      and not tgisinternal
      and tgenabled in ('O', 'A')
  ) then
    raise exception 'notebook storage deletion reference guard is absent or disabled';
  end if;
end;
$family_photo_race_assert$;
