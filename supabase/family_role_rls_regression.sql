-- PostgreSQL 16 regression checks for the shared-family writer boundary.
-- Run only in a fresh disposable database after schema.sql, api_grants.sql,
-- production_rls.sql, and create_initial_family_person.sql.
-- Every seed and mutation is rolled back.

begin;

insert into auth.users (id, email)
values
  ('f3000000-0000-4000-8000-000000000001', 'rls-owner@example.test'),
  ('f3000000-0000-4000-8000-000000000002', 'rls-admin@example.test'),
  ('f3000000-0000-4000-8000-000000000003', 'rls-member@example.test'),
  ('f3000000-0000-4000-8000-000000000004', 'rls-viewer@example.test'),
  ('f3000000-0000-4000-8000-000000000005', 'rls-fresh@example.test'),
  ('f3000000-0000-4000-8000-000000000006', 'rls-multiple@example.test'),
  ('f3000000-0000-4000-8000-000000000007', 'rls-invalid-status@example.test');

insert into public.profiles (id, email, display_name)
select id, email, split_part(email, '@', 1)
from auth.users
where id in (
  'f3000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000002',
  'f3000000-0000-4000-8000-000000000003',
  'f3000000-0000-4000-8000-000000000004',
  'f3000000-0000-4000-8000-000000000006'
);

insert into public.families (id, name, owner_user_id, plan)
values
  (
    'f3000000-0000-4000-8000-000000000010',
    'RLS plus family',
    'f3000000-0000-4000-8000-000000000001',
    'plus'
  ),
  (
    'f3000000-0000-4000-8000-000000000011',
    'Second family',
    'f3000000-0000-4000-8000-000000000006',
    'plus'
  );

insert into public.family_members (family_id, user_id, role, relationship)
values
  ('f3000000-0000-4000-8000-000000000010', 'f3000000-0000-4000-8000-000000000001', 'owner', 'owner'),
  ('f3000000-0000-4000-8000-000000000010', 'f3000000-0000-4000-8000-000000000002', 'admin', 'admin'),
  ('f3000000-0000-4000-8000-000000000010', 'f3000000-0000-4000-8000-000000000003', 'member', 'member'),
  ('f3000000-0000-4000-8000-000000000010', 'f3000000-0000-4000-8000-000000000004', 'viewer', 'viewer'),
  ('f3000000-0000-4000-8000-000000000010', 'f3000000-0000-4000-8000-000000000006', 'admin', 'multiple one'),
  ('f3000000-0000-4000-8000-000000000011', 'f3000000-0000-4000-8000-000000000006', 'owner', 'multiple two');

insert into public.people (
  id, family_id, display_name, relationship_to_family, current_status, profile
)
values (
  'f3000000-0000-4000-8000-000000000020',
  'f3000000-0000-4000-8000-000000000010',
  'Shared parent',
  'parent',
  'preparing',
  '{}'::jsonb
);

insert into public.asset_categories (id, key, label)
values ('f3000000-0000-4000-8000-000000000021', 'rls-test', 'RLS test');

insert into public.tasks (id, person_id, title, status)
values (
  'f3000000-0000-4000-8000-000000000030',
  'f3000000-0000-4000-8000-000000000020',
  'Shared task',
  'todo'
);

insert into public.asset_items (id, person_id, category_id, title)
values (
  'f3000000-0000-4000-8000-000000000031',
  'f3000000-0000-4000-8000-000000000020',
  'f3000000-0000-4000-8000-000000000021',
  'Shared asset'
);

insert into public.timeline_events (id, person_id, event_type, title, body)
values (
  'f3000000-0000-4000-8000-000000000032',
  'f3000000-0000-4000-8000-000000000020',
  'diary',
  'Shared diary',
  'visible to the family'
);

insert into public.homes (id, person_id, city, notes)
values (
  'f3000000-0000-4000-8000-000000000033',
  'f3000000-0000-4000-8000-000000000020',
  'Kobe',
  'Shared home'
);

insert into public.home_photos (id, home_id, storage_path, caption)
values (
  'f3000000-0000-4000-8000-000000000034',
  'f3000000-0000-4000-8000-000000000033',
  'rls/shared-home.jpg',
  'Shared home photo'
);

set local role authenticated;

do $rls_test$
declare
  v_actor uuid;
  v_role text;
  v_count integer;
begin
  -- All four family roles retain read access to shared content. Only the three
  -- editor roles may mutate it.
  for v_actor, v_role in
    select * from (values
      ('f3000000-0000-4000-8000-000000000001'::uuid, 'owner'),
      ('f3000000-0000-4000-8000-000000000002'::uuid, 'admin'),
      ('f3000000-0000-4000-8000-000000000003'::uuid, 'member'),
      ('f3000000-0000-4000-8000-000000000004'::uuid, 'viewer')
    ) roles(actor_id, role_name)
  loop
    perform set_config('request.jwt.claim.sub', v_actor::text, true);

    select count(*) into v_count
    from public.tasks
    where id = 'f3000000-0000-4000-8000-000000000030';
    if v_count <> 1 then
      raise exception '% lost task read access', v_role;
    end if;

    select count(*) into v_count
    from public.asset_items
    where id = 'f3000000-0000-4000-8000-000000000031';
    if v_count <> 1 then
      raise exception '% lost asset read access', v_role;
    end if;

    select count(*) into v_count
    from public.timeline_events
    where id = 'f3000000-0000-4000-8000-000000000032';
    if v_count <> 1 then
      raise exception '% lost timeline read access', v_role;
    end if;

    select count(*) into v_count
    from public.homes
    where id = 'f3000000-0000-4000-8000-000000000033';
    if v_count <> 1 then
      raise exception '% lost home read access', v_role;
    end if;

    select count(*) into v_count
    from public.home_photos
    where id = 'f3000000-0000-4000-8000-000000000034';
    if v_count <> 1 then
      raise exception '% lost home photo read access', v_role;
    end if;

    if public.is_family_editor('f3000000-0000-4000-8000-000000000010')
       is distinct from (v_role <> 'viewer') then
      raise exception 'is_family_editor returned the wrong result for %', v_role;
    end if;
  end loop;

  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000004', true);

  begin
    insert into public.tasks (person_id, title, status)
    values ('f3000000-0000-4000-8000-000000000020', 'viewer task', 'todo');
    raise exception 'viewer task INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.tasks set title = 'viewer task update'
  where id = 'f3000000-0000-4000-8000-000000000030';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'viewer task UPDATE affected % row(s)', v_count; end if;
  delete from public.tasks where id = 'f3000000-0000-4000-8000-000000000030';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'viewer task DELETE affected % row(s)', v_count; end if;

  begin
    insert into public.asset_items (person_id, category_id, title)
    values (
      'f3000000-0000-4000-8000-000000000020',
      'f3000000-0000-4000-8000-000000000021',
      'viewer asset'
    );
    raise exception 'viewer asset INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.asset_items set title = 'viewer asset update'
  where id = 'f3000000-0000-4000-8000-000000000031';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'viewer asset UPDATE affected % row(s)', v_count; end if;
  delete from public.asset_items where id = 'f3000000-0000-4000-8000-000000000031';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'viewer asset DELETE affected % row(s)', v_count; end if;

  begin
    insert into public.timeline_events (person_id, event_type, title)
    values ('f3000000-0000-4000-8000-000000000020', 'diary', 'viewer diary');
    raise exception 'viewer timeline INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.timeline_events set body = 'viewer timeline update'
  where id = 'f3000000-0000-4000-8000-000000000032';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'viewer timeline UPDATE affected % row(s)', v_count; end if;
  delete from public.timeline_events where id = 'f3000000-0000-4000-8000-000000000032';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'viewer timeline DELETE affected % row(s)', v_count; end if;

  begin
    insert into public.homes (person_id, city)
    values ('f3000000-0000-4000-8000-000000000020', 'viewer home');
    raise exception 'viewer home INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.homes set notes = 'viewer home update'
  where id = 'f3000000-0000-4000-8000-000000000033';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'viewer home UPDATE affected % row(s)', v_count; end if;
  delete from public.homes where id = 'f3000000-0000-4000-8000-000000000033';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'viewer home DELETE affected % row(s)', v_count; end if;

  begin
    insert into public.home_photos (home_id, storage_path)
    values ('f3000000-0000-4000-8000-000000000033', 'rls/viewer-home.jpg');
    raise exception 'viewer home photo INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  update public.home_photos set caption = 'viewer home photo update'
  where id = 'f3000000-0000-4000-8000-000000000034';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'viewer home photo UPDATE affected % row(s)', v_count; end if;
  delete from public.home_photos where id = 'f3000000-0000-4000-8000-000000000034';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'viewer home photo DELETE affected % row(s)', v_count; end if;

  begin
    insert into public.person_status_events (person_id, new_status)
    values ('f3000000-0000-4000-8000-000000000020', 'viewer status');
    raise exception 'viewer status INSERT unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;

  -- Basic person/profile data stays owner/admin-only, matching the Web UI.
  update public.people set display_name = 'viewer profile update'
  where id = 'f3000000-0000-4000-8000-000000000020';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'viewer people UPDATE affected % row(s)', v_count; end if;

  -- Owner/admin/member are all allowed to collaborate on shared content.
  for v_actor, v_role in
    select * from (values
      ('f3000000-0000-4000-8000-000000000001'::uuid, 'owner'),
      ('f3000000-0000-4000-8000-000000000002'::uuid, 'admin'),
      ('f3000000-0000-4000-8000-000000000003'::uuid, 'member')
    ) roles(actor_id, role_name)
  loop
    perform set_config('request.jwt.claim.sub', v_actor::text, true);

    insert into public.tasks (person_id, title, status, created_by)
    values ('f3000000-0000-4000-8000-000000000020', v_role || ' task', 'todo', v_actor);
    update public.tasks set title = v_role || ' task updated'
    where person_id = 'f3000000-0000-4000-8000-000000000020'
      and created_by = v_actor;
    get diagnostics v_count = row_count;
    if v_count <> 1 then raise exception '% task UPDATE affected % row(s)', v_role, v_count; end if;

    insert into public.asset_items (person_id, category_id, title, created_by)
    values (
      'f3000000-0000-4000-8000-000000000020',
      'f3000000-0000-4000-8000-000000000021',
      v_role || ' asset',
      v_actor
    );
    update public.asset_items set title = v_role || ' asset updated'
    where person_id = 'f3000000-0000-4000-8000-000000000020'
      and created_by = v_actor;
    get diagnostics v_count = row_count;
    if v_count <> 1 then raise exception '% asset UPDATE affected % row(s)', v_role, v_count; end if;

    insert into public.timeline_events (person_id, event_type, title, created_by)
    values ('f3000000-0000-4000-8000-000000000020', 'diary', v_role || ' diary', v_actor);
    update public.timeline_events set body = v_role || ' diary updated'
    where person_id = 'f3000000-0000-4000-8000-000000000020'
      and created_by = v_actor;
    get diagnostics v_count = row_count;
    if v_count <> 1 then raise exception '% timeline UPDATE affected % row(s)', v_role, v_count; end if;

    insert into public.homes (person_id, city, notes)
    values ('f3000000-0000-4000-8000-000000000020', v_role, v_role || ' home');
    update public.homes set notes = v_role || ' home updated'
    where person_id = 'f3000000-0000-4000-8000-000000000020'
      and city = v_role;
    get diagnostics v_count = row_count;
    if v_count <> 1 then raise exception '% home UPDATE affected % row(s)', v_role, v_count; end if;

    insert into public.person_status_events (person_id, new_status, created_by)
    values ('f3000000-0000-4000-8000-000000000020', v_role || ' status', v_actor);
  end loop;

  -- A member collaborates on content, but cannot alter basic person/profile data.
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000003', true);
  update public.people set display_name = 'member profile update'
  where id = 'f3000000-0000-4000-8000-000000000020';
  get diagnostics v_count = row_count;
  if v_count <> 0 then raise exception 'member people UPDATE affected % row(s)', v_count; end if;

  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000002', true);
  update public.people set display_name = 'Admin-updated parent'
  where id = 'f3000000-0000-4000-8000-000000000020';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'admin people UPDATE affected % row(s)', v_count; end if;
end;
$rls_test$;

do $initial_person_test$
declare
  v_result jsonb;
  v_family_id uuid;
  v_count integer;
begin
  -- A fresh authenticated user creates exactly one free family/person and is
  -- recorded as its owner.
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000005', true);
  perform set_config('request.jwt.claims', '{"email":"rls-fresh@example.test"}', true);
  select public.create_initial_family_person('Fresh parent', 'parent', 'preparing') into v_result;
  v_family_id := (v_result->>'familyId')::uuid;

  if v_result->>'memberRole' is distinct from 'owner' then
    raise exception 'fresh initial family did not return owner role: %', v_result;
  end if;
  select count(*) into v_count
  from public.families f
  join public.family_members fm on fm.family_id = f.id
  join public.people p on p.family_id = f.id
  where f.id = v_family_id
    and f.plan = 'free'
    and fm.user_id = 'f3000000-0000-4000-8000-000000000005'
    and fm.role = 'owner';
  if v_count <> 1 then
    raise exception 'fresh initial family/person owner seed is invalid';
  end if;

  begin
    perform public.create_initial_family_person('Second free parent', 'parent', 'preparing');
    raise exception 'expected_initial_free_plan_person_limit';
  exception when others then
    if sqlerrm = 'expected_initial_free_plan_person_limit' then raise; end if;
    if sqlerrm <> 'initial_free_plan_person_limit' then
      raise exception 'wrong second-free-person error: %', sqlerrm;
    end if;
  end;

  -- A viewer cannot use the SECURITY DEFINER RPC to bypass RLS.
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000004', true);
  perform set_config('request.jwt.claims', '{"email":"rls-viewer@example.test"}', true);
  begin
    perform public.create_initial_family_person('Viewer parent', 'parent', 'preparing');
    raise exception 'expected_initial_person_requires_family_admin';
  exception when others then
    if sqlerrm = 'expected_initial_person_requires_family_admin' then raise; end if;
    if sqlerrm <> 'initial_person_requires_family_admin' then
      raise exception 'wrong viewer initial-person error: %', sqlerrm;
    end if;
  end;

  -- A member may edit shared tasks/diary but may not create another person.
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000003', true);
  perform set_config('request.jwt.claims', '{"email":"rls-member@example.test"}', true);
  begin
    perform public.create_initial_family_person('Member parent', 'parent', 'preparing');
    raise exception 'expected_member_initial_person_requires_family_admin';
  exception when others then
    if sqlerrm = 'expected_member_initial_person_requires_family_admin' then raise; end if;
    if sqlerrm <> 'initial_person_requires_family_admin' then
      raise exception 'wrong member initial-person error: %', sqlerrm;
    end if;
  end;

  -- Plus plan allows an admin to add another person.
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000002', true);
  perform set_config('request.jwt.claims', '{"email":"rls-admin@example.test"}', true);
  select public.create_initial_family_person('Admin plus parent', 'parent', 'hospitalized') into v_result;
  if v_result->>'memberRole' is distinct from 'admin' then
    raise exception 'plus admin initial person returned wrong role: %', v_result;
  end if;
  select count(*) into v_count
  from public.people
  where family_id = 'f3000000-0000-4000-8000-000000000010';
  if v_count <> 2 then
    raise exception 'plus admin did not create exactly one additional person: %', v_count;
  end if;

  -- The parameterless RPC must not silently choose one of multiple families.
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000006', true);
  perform set_config('request.jwt.claims', '{"email":"rls-multiple@example.test"}', true);
  begin
    perform public.create_initial_family_person('Ambiguous parent', 'parent', 'preparing');
    raise exception 'expected_initial_family_selection_required';
  exception when others then
    if sqlerrm = 'expected_initial_family_selection_required' then raise; end if;
    if sqlerrm <> 'initial_family_selection_required' then
      raise exception 'wrong multiple-family error: %', sqlerrm;
    end if;
  end;

  -- Untrusted status strings are rejected before any family/profile is made.
  perform set_config('request.jwt.claim.sub', 'f3000000-0000-4000-8000-000000000007', true);
  perform set_config('request.jwt.claims', '{"email":"rls-invalid-status@example.test"}', true);
  begin
    perform public.create_initial_family_person('Invalid status parent', 'parent', 'arbitrary-status');
    raise exception 'expected_invalid_parent_status';
  exception when others then
    if sqlerrm = 'expected_invalid_parent_status' then raise; end if;
    if sqlerrm <> 'invalid_parent_status' then
      raise exception 'wrong invalid-status error: %', sqlerrm;
    end if;
  end;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.create_initial_family_person('Anonymous parent', 'parent', 'preparing');
    raise exception 'expected_not_authenticated';
  exception when others then
    if sqlerrm = 'expected_not_authenticated' then raise; end if;
    if sqlerrm <> 'not_authenticated' then
      raise exception 'wrong anonymous initial-person error: %', sqlerrm;
    end if;
  end;
end;
$initial_person_test$;

reset role;
rollback;
