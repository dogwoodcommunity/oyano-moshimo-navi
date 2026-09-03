-- Atomically create/complete an anonymous diagnosis and issue its first handoff.
-- The caller must hold the high-entropy token established when the case is
-- created. Run this before deploying the matching Next.js diagnosis route.

create or replace function public.submit_anonymous_case_diagnosis(
  p_case_id uuid,
  p_anonymous_token text,
  p_selected_status text,
  p_answers jsonb,
  p_contact_name text,
  p_contact_email text,
  p_consent_to_contact boolean,
  p_consent_version text,
  p_consent_text text,
  p_ip_address text,
  p_user_agent text,
  p_diagnosis_type text,
  p_summary text,
  p_first_steps jsonb,
  p_tasks jsonb,
  p_provider_categories jsonb,
  p_handoff_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case cases;
  v_result case_results;
begin
  if p_case_id is null
     or p_anonymous_token !~ '^anon_[0-9a-fA-F]{64}$'
     or p_handoff_token !~ '^handoff_[0-9a-fA-F]{48}$' then
    raise exception 'invalid_case_token';
  end if;

  select * into v_case
  from cases
  where id = p_case_id
  for update;

  if found then
    if v_case.anonymous_token is distinct from p_anonymous_token then
      raise exception 'invalid_case_token';
    end if;

    if v_case.user_id is not null
       or v_case.family_id is not null
       or v_case.person_id is not null
       or v_case.status = 'converted' then
      raise exception 'case_already_converted';
    end if;

    if v_case.status = 'result_ready' then
      if v_case.selected_status is distinct from p_selected_status
         or v_case.answers is distinct from coalesce(p_answers, '{}'::jsonb)
         or v_case.contact_name is distinct from p_contact_name
         or v_case.contact_email is distinct from p_contact_email
         or v_case.consent_to_contact is distinct from coalesce(p_consent_to_contact, false)
         or v_case.sensitive_info_consent_version is distinct from p_consent_version then
        raise exception 'case_already_submitted';
      end if;

      select * into v_result
      from case_results
      where case_id = p_case_id
        and app_handoff_consumed_at is null
      order by created_at desc
      limit 1
      for update;

      if not found then
        raise exception 'case_already_submitted';
      end if;

      return jsonb_build_object(
        'handoffToken', v_result.app_handoff_token,
        'createdAt', v_result.created_at,
        'idempotentReplay', true
      );
    end if;

    if v_case.status is distinct from 'draft' then
      raise exception 'case_already_submitted';
    end if;

    update cases
    set
      selected_status = p_selected_status,
      answers = coalesce(p_answers, '{}'::jsonb),
      contact_name = p_contact_name,
      contact_email = p_contact_email,
      consent_to_contact = coalesce(p_consent_to_contact, false),
      consent_to_sensitive_info = true,
      sensitive_info_consent_version = p_consent_version,
      sensitive_info_consented_at = now(),
      updated_at = now()
    where id = p_case_id;
  else
    insert into cases (
      id,
      anonymous_token,
      selected_status,
      answers,
      contact_name,
      contact_email,
      consent_to_contact,
      consent_to_sensitive_info,
      sensitive_info_consent_version,
      sensitive_info_consented_at,
      status
    )
    values (
      p_case_id,
      p_anonymous_token,
      p_selected_status,
      coalesce(p_answers, '{}'::jsonb),
      p_contact_name,
      p_contact_email,
      coalesce(p_consent_to_contact, false),
      true,
      p_consent_version,
      now(),
      'draft'
    );
  end if;

  insert into consent_logs (
    case_id,
    consent_type,
    consent_text,
    ip_address,
    user_agent
  )
  values (
    p_case_id,
    'sensitive_info',
    p_consent_text,
    p_ip_address,
    p_user_agent
  );

  insert into case_results (
    case_id,
    diagnosis_type,
    summary,
    first_steps,
    tasks,
    provider_categories,
    app_handoff_token
  )
  values (
    p_case_id,
    p_diagnosis_type,
    p_summary,
    coalesce(p_first_steps, '[]'::jsonb),
    coalesce(p_tasks, '[]'::jsonb),
    coalesce(p_provider_categories, '[]'::jsonb),
    p_handoff_token
  )
  returning * into v_result;

  update cases
  set status = 'result_ready', updated_at = now()
  where id = p_case_id
    and user_id is null
    and family_id is null
    and person_id is null
    and status = 'draft'
    and anonymous_token = p_anonymous_token;

  if not found then
    raise exception 'case_state_conflict';
  end if;

  return jsonb_build_object(
    'handoffToken', v_result.app_handoff_token,
    'createdAt', v_result.created_at,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.submit_anonymous_case_diagnosis(
  uuid, text, text, jsonb, text, text, boolean, text, text, text, text,
  text, text, jsonb, jsonb, jsonb, text
) from public;
grant execute on function public.submit_anonymous_case_diagnosis(
  uuid, text, text, jsonb, text, text, boolean, text, text, text, text,
  text, text, jsonb, jsonb, jsonb, text
) to service_role;
