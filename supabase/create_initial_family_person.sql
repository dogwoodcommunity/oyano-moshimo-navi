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
  v_membership_count integer := 0;
  v_existing_people integer := 0;
  v_role text;
  v_plan text;
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

  if v_status not in (
    'preparing',
    'hospitalized',
    'post_discharge_home',
    'facility',
    'cognitive_decline',
    'end_of_life',
    'after_death',
    'after_funeral',
    'inheritance',
    'home_clearance',
    'completed'
  ) then
    raise exception 'invalid_parent_status';
  end if;

  -- Serialize retries from the same account. Without this lock two initial
  -- launches can both observe no membership and create separate free families.
  -- sync_notebook_v2 uses this exact namespace for the same first-family gate.
  perform pg_advisory_xact_lock(
    hashtextextended('notebook-first-family:' || v_user_id::text, 0)
  );

  insert into profiles (id, email)
  values (v_user_id, v_email)
  on conflict (id) do update
    set email = coalesce(profiles.email, excluded.email),
        updated_at = now();

  select
    count(*),
    (array_agg(family_id order by created_at, family_id))[1]
  into v_membership_count, v_family_id
  from family_members
  where user_id = v_user_id;

  if v_membership_count = 0 then
    insert into families (name, owner_user_id, plan)
    values (v_display_name || 'さんの家族', v_user_id, 'free')
    returning id into v_family_id;

    insert into family_members (family_id, user_id, role, relationship)
    values (v_family_id, v_user_id, 'owner', '家族代表');
  elsif v_membership_count > 1 then
    raise exception 'initial_family_selection_required';
  end if;

  -- Share the same family lock namespace as sync_notebook_v2 so the free-plan
  -- count remains correct when Web sync and mobile initialization overlap.
  perform pg_advisory_xact_lock(
    hashtextextended('notebook-family:' || v_family_id::text, 0)
  );

  select family_members.role, families.plan
  into v_role, v_plan
  from family_members
  join families on families.id = family_members.family_id
  where family_members.family_id = v_family_id
    and family_members.user_id = v_user_id
  for update of family_members, families;

  if not found then
    raise exception 'initial_family_membership_required';
  end if;

  -- Creating a new person changes the family board itself. The Web/PWA
  -- contract reserves that operation for owner/admin; members can edit shared
  -- tasks and diary entries, while viewers remain read-only.
  if v_role not in ('owner', 'admin') then
    raise exception 'initial_person_requires_family_admin';
  end if;

  select count(*) into v_existing_people
  from people
  where family_id = v_family_id;

  if coalesce(v_plan, 'free') <> 'plus' and v_existing_people >= 1 then
    raise exception 'initial_free_plan_person_limit';
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
    'tasksCreated', v_tasks_created,
    'memberRole', v_role
  );
end;
$$;

revoke all on function public.create_initial_family_person(text, text, text) from public;
grant execute on function public.create_initial_family_person(text, text, text) to authenticated;
