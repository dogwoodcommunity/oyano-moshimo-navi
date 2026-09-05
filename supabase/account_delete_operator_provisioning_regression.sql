-- Confirms that the exact SQL blocks documented in ADMIN_AUTH_POLICY.md ran.
-- Disposable PostgreSQL only.

do $test$
declare
  v_identity_record_id uuid;
  v_approval_record_id uuid;
begin
  if not exists (
    select 1
    from regression_support.delete_operator_policy_guard
    where marker
  ) then
    raise exception 'provisioning policy regression requires the disposable guard';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = 'ae000000-0000-4000-8000-000000000001'
      and profile.email = 'operator@example.invalid'
      and profile.display_name is null
      and profile.phone is null
  ) then
    raise exception 'documented provisioning did not create the minimal profile';
  end if;

  if exists (
    select 1
    from public.families family
    where family.owner_user_id = 'ae000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1
    from public.family_members member
    where member.user_id = 'ae000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1
    from public.app_admins admin
    where admin.user_id = 'ae000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'documented provisioning widened application authority';
  end if;

  if (
    select count(*)
    from account_delete_private.operator_identity_events event
    where event.operator_user_id = 'ae000000-0000-4000-8000-000000000001'
      and event.record_kind = 'identity_verified'
      and event.evidence_ref = 'regression-identity-001'
  ) <> 1 then
    raise exception 'documented policy did not create the exact identity evidence';
  end if;

  select event.record_id
    into v_identity_record_id
  from account_delete_private.operator_identity_events event
  where event.operator_user_id = 'ae000000-0000-4000-8000-000000000001'
    and event.record_kind = 'identity_verified'
    and event.evidence_ref = 'regression-identity-001';

  if (
    select count(*)
    from account_delete_private.operator_identity_events event
    where event.operator_user_id = 'ae000000-0000-4000-8000-000000000001'
      and event.approver_user_id = 'ae000000-0000-4000-8000-000000000002'
      and event.record_kind = 'activation_approved'
      and event.identity_record_id = v_identity_record_id
      and event.evidence_ref = 'regression-approval-001'
  ) <> 1 then
    raise exception 'documented policy did not create approval evidence for the exact identity record';
  end if;

  select event.record_id
    into v_approval_record_id
  from account_delete_private.operator_identity_events event
  where event.operator_user_id = 'ae000000-0000-4000-8000-000000000001'
    and event.approver_user_id = 'ae000000-0000-4000-8000-000000000002'
    and event.record_kind = 'activation_approved'
    and event.identity_record_id = v_identity_record_id
    and event.evidence_ref = 'regression-approval-001';

  if not exists (
    select 1
    from public.account_delete_executors executor
    where executor.user_id = 'ae000000-0000-4000-8000-000000000001'
      and executor.created_by = 'ae000000-0000-4000-8000-000000000002'
      and executor.active
      and executor.activated_at is not null
      and executor.revoked_at is null
      and executor.note = concat_ws(
        ' | ',
        'identity=ledger:' || v_identity_record_id::text,
        'approval=ledger:' || v_approval_record_id::text
      )
  ) then
    raise exception 'documented activation did not preserve both evidence pointers';
  end if;
end;
$test$;
