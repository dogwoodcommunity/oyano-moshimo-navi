-- Create the first family board directly from the mobile app.
-- This is used when a signed-in user opens the app before any Web handoff exists.

create or replace function public.create_initial_family_person(
  p_display_name text,
  p_relationship text default null,
  p_status text default 'preparing'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := auth.jwt() ->> 'email';
  v_family_id uuid;
  v_person_id uuid;
  v_tasks_created integer := 0;
  v_display_name text := nullif(trim(p_display_name), '');
  v_relationship text := nullif(trim(coalesce(p_relationship, '')), '');
  v_status text := coalesce(nullif(trim(p_status), ''), 'preparing');
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if v_display_name is null then
    raise exception 'display_name_required';
  end if;

  insert into profiles (id, email)
  values (v_user_id, v_email)
  on conflict (id) do update
    set email = coalesce(profiles.email, excluded.email),
        updated_at = now();

  select family_id into v_family_id
  from family_members
  where user_id = v_user_id
  order by created_at asc
  limit 1;

  if v_family_id is null then
    insert into families (name, owner_user_id, plan)
    values (v_display_name || 'さんの家族', v_user_id, 'free')
    returning id into v_family_id;

    insert into family_members (family_id, user_id, role, relationship)
    values (v_family_id, v_user_id, 'owner', '家族代表');
  end if;

  insert into people (
    family_id,
    display_name,
    relationship_to_family,
    current_status,
    profile,
    profile_updated_at
  )
  values (
    v_family_id,
    v_display_name,
    v_relationship,
    v_status,
    jsonb_strip_nulls(jsonb_build_object(
      'displayName', v_display_name,
      'relationship', v_relationship,
      'careStatus', v_status,
      'createdFrom', 'mobile_initial'
    )),
    now()
  )
  returning id into v_person_id;

  insert into person_status_events (
    person_id,
    previous_status,
    new_status,
    note,
    created_by
  )
  values (
    v_person_id,
    null,
    v_status,
    'mobile initial family board created',
    v_user_id
  );

  select count(*) into v_tasks_created
  from tasks
  where person_id = v_person_id;

  return jsonb_build_object(
    'familyId', v_family_id,
    'personId', v_person_id,
    'tasksCreated', v_tasks_created
  );
end;
$$;

revoke all on function public.create_initial_family_person(text, text, text) from public;
grant execute on function public.create_initial_family_person(text, text, text) to authenticated;
