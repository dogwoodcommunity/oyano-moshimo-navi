-- Atomically consume a Web-to-app handoff token and create/reuse family data.
-- Run after schema.sql and notification_delivery_hardening.sql.

create or replace function public.consume_case_handoff(
  p_case_id uuid,
  p_token text,
  p_user_id uuid,
  p_user_email text default null,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case cases;
  v_result case_results;
  v_family_id uuid;
  v_person_id uuid;
  v_family_name text;
  v_task jsonb;
  v_tasks_created int := 0;
  v_existing_task_count int := 0;
  v_due_date date;
begin
  if p_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_result
  from case_results
  where case_id = p_case_id
    and app_handoff_token = p_token
    and app_handoff_consumed_at is null
    and created_at > now() - interval '24 hours'
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'invalid_or_consumed_handoff_token';
  end if;

  select * into v_case
  from cases
  where id = p_case_id
  for update;

  if not found then
    raise exception 'case_not_found';
  end if;

  insert into profiles (id, email, display_name, updated_at)
  values (
    p_user_id,
    p_user_email,
    coalesce(nullif(trim(p_display_name), ''), p_user_email),
    now()
  )
  on conflict (id) do update set
    email = coalesce(excluded.email, profiles.email),
    display_name = coalesce(excluded.display_name, profiles.display_name),
    updated_at = now();

  if v_case.family_id is not null and v_case.person_id is not null then
    insert into family_members (family_id, user_id, role, relationship)
    values (v_case.family_id, p_user_id, 'owner', '家族代表')
    on conflict (family_id, user_id) do update set
      role = excluded.role,
      relationship = excluded.relationship;

    select count(*) into v_existing_task_count
    from tasks
    where person_id = v_case.person_id;

    update case_results
    set app_handoff_consumed_at = now()
    where id = v_result.id;

    return jsonb_build_object(
      'familyId', v_case.family_id,
      'personId', v_case.person_id,
      'tasksCreated', v_existing_task_count,
      'reusedExistingCase', true
    );
  end if;

  v_family_name := coalesce(
    nullif(v_case.answers ->> 'familyStructure', '') || 'の家族',
    '親のもしもナビ家族'
  );

  insert into families (name, owner_user_id, plan)
  values (v_family_name, p_user_id, 'free')
  returning id into v_family_id;

  insert into family_members (family_id, user_id, role, relationship)
  values (v_family_id, p_user_id, 'owner', '家族代表');

  insert into people (
    family_id,
    display_name,
    relationship_to_family,
    current_status
  )
  values (
    v_family_id,
    coalesce(nullif(trim(p_display_name), ''), v_case.contact_name, '親'),
    '親',
    coalesce(v_case.selected_status, 'preparing')
  )
  returning id into v_person_id;

  for v_task in
    select value from jsonb_array_elements(coalesce(v_result.tasks, '[]'::jsonb))
  loop
    v_due_date := null;
    if (v_task ->> 'dueDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      v_due_date := (v_task ->> 'dueDate')::date;
    end if;

    insert into tasks (
      person_id,
      title,
      description,
      priority,
      category,
      due_date,
      status
    )
    values (
      v_person_id,
      coalesce(nullif(v_task ->> 'title', ''), '確認事項'),
      nullif(v_task ->> 'description', ''),
      coalesce(nullif(v_task ->> 'priority', '')::int, 3),
      nullif(v_task ->> 'category', ''),
      v_due_date,
      'todo'
    );

    v_tasks_created := v_tasks_created + 1;
  end loop;

  update cases
  set
    family_id = v_family_id,
    person_id = v_person_id,
    status = 'converted',
    updated_at = now()
  where id = p_case_id;

  update case_results
  set app_handoff_consumed_at = now()
  where id = v_result.id;

  return jsonb_build_object(
    'familyId', v_family_id,
    'personId', v_person_id,
    'tasksCreated', v_tasks_created,
    'reusedExistingCase', false
  );
end;
$$;

revoke all on function public.consume_case_handoff(uuid, text, uuid, text, text) from public;
grant execute on function public.consume_case_handoff(uuid, text, uuid, text, text) to service_role;
