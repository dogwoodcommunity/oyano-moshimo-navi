-- Disposable-only regression for account_delete_identity_ledger.sql.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $regression_environment$
begin
  if to_regclass('auth.users') is null
     or to_regclass('auth.mfa_factors') is not null
     or (
       select array_agg(attribute.attname::text order by attribute.attname)
       from pg_attribute attribute
       where attribute.attrelid = 'auth.users'::regclass
         and attribute.attnum > 0
         and not attribute.attisdropped
     ) <> array['email', 'id']::text[] then
    raise exception 'refusing to run private-ledger regression outside the disposable Auth shim';
  end if;
end;
$regression_environment$;

do $test$
declare
  v_identity_id uuid;
  v_other_identity_id uuid;
  v_operator_id uuid := 'ad000000-0000-4000-8000-000000000001';
  v_approver_id uuid := 'ad000000-0000-4000-8000-000000000002';
begin
  if to_regnamespace('account_delete_private') is null
     or to_regclass('account_delete_private.operator_identity_events') is null then
    raise exception 'private operator identity ledger is missing';
  end if;

  if (
    select pg_get_userbyid(namespace.nspowner)
    from pg_namespace namespace
    where namespace.oid = 'account_delete_private'::regnamespace
  ) <> 'postgres' then
    raise exception 'private operator identity schema owner is not postgres';
  end if;

  if (
    select pg_get_userbyid(relation.relowner)
    from pg_class relation
    where relation.oid = 'account_delete_private.operator_identity_events'::regclass
  ) <> 'postgres' then
    raise exception 'private operator identity table owner is not postgres';
  end if;

  if not exists (
    select 1
    from pg_class relation
    where relation.oid = 'account_delete_private.operator_identity_events'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) then
    raise exception 'private operator identity ledger did not force RLS';
  end if;

  if has_schema_privilege('anon', 'account_delete_private', 'USAGE,CREATE')
     or has_schema_privilege('authenticated', 'account_delete_private', 'USAGE,CREATE')
     or has_schema_privilege('service_role', 'account_delete_private', 'USAGE,CREATE') then
    raise exception 'an API role can access the private operator identity schema';
  end if;

  if has_table_privilege('anon', 'account_delete_private.operator_identity_events', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated', 'account_delete_private.operator_identity_events', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('service_role', 'account_delete_private.operator_identity_events', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then
    raise exception 'an API role can access the private operator identity ledger';
  end if;

  if has_function_privilege('anon', 'account_delete_private.stamp_operator_identity_event()', 'EXECUTE')
     or has_function_privilege('authenticated', 'account_delete_private.stamp_operator_identity_event()', 'EXECUTE')
     or has_function_privilege('service_role', 'account_delete_private.stamp_operator_identity_event()', 'EXECUTE')
     or has_function_privilege('anon', 'account_delete_private.reject_operator_identity_event_mutation()', 'EXECUTE')
     or has_function_privilege('authenticated', 'account_delete_private.reject_operator_identity_event_mutation()', 'EXECUTE')
     or has_function_privilege('service_role', 'account_delete_private.reject_operator_identity_event_mutation()', 'EXECUTE') then
    raise exception 'an API role can execute private ledger trigger functions';
  end if;

  if exists (
    select 1
    from pg_namespace namespace
    cross join lateral aclexplode(
      coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))
    ) privilege
    where namespace.oid = 'account_delete_private'::regnamespace
      and privilege.grantee <> namespace.nspowner
  ) or exists (
    select 1
    from pg_class relation
    cross join lateral aclexplode(
      coalesce(relation.relacl, acldefault('r', relation.relowner))
    ) privilege
    where relation.oid = 'account_delete_private.operator_identity_events'::regclass
      and privilege.grantee <> relation.relowner
  ) or exists (
    select 1
    from pg_proc procedure_info
    cross join lateral aclexplode(
      coalesce(procedure_info.proacl, acldefault('f', procedure_info.proowner))
    ) privilege
    where procedure_info.pronamespace = 'account_delete_private'::regnamespace
      and privilege.grantee <> procedure_info.proowner
  ) or exists (
    select 1
    from pg_default_acl default_acl
    cross join lateral aclexplode(default_acl.defaclacl) privilege
    where default_acl.defaclrole = (
        select oid from pg_roles where rolname = 'postgres'
      )
      and default_acl.defaclobjtype in ('r', 'S', 'f')
      and default_acl.defaclnamespace in (
        0,
        'account_delete_private'::regnamespace
      )
      and privilege.grantee <> default_acl.defaclrole
  ) then
    raise exception 'a non-owner role retains a private-ledger ACL';
  end if;

  if exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'account_delete_private'
      and column_info.table_name = 'operator_identity_events'
      and column_info.column_name ~ '(email|name|otp|secret|token|note|metadata)'
  ) then
    raise exception 'private operator identity ledger contains a prohibited data column';
  end if;

  insert into account_delete_private.operator_identity_events (
    record_kind,
    operator_user_id,
    evidence_ref,
    recorded_at,
    recorded_by
  ) values (
    'identity_verified',
    v_operator_id,
    'SESSION_HANDOFF-309',
    '2000-01-01 00:00:00+00',
    'forged'
  )
  returning record_id into v_identity_id;

  if not exists (
    select 1
    from account_delete_private.operator_identity_events event
    where event.record_id = v_identity_id
      and event.recorded_at > '2000-01-02 00:00:00+00'
      and event.recorded_by = session_user
  ) then
    raise exception 'private ledger insert metadata was not server-stamped';
  end if;

  insert into account_delete_private.operator_identity_events (
    record_kind,
    operator_user_id,
    approver_user_id,
    identity_record_id,
    evidence_ref
  ) values (
    'activation_approved',
    v_operator_id,
    v_approver_id,
    v_identity_id,
    'approval-session-001'
  );

  insert into account_delete_private.operator_identity_events (
    record_kind,
    operator_user_id,
    evidence_ref
  ) values (
    'identity_verified',
    'ad000000-0000-4000-8000-000000000003',
    'other-identity-001'
  )
  returning record_id into v_other_identity_id;

  begin
    insert into account_delete_private.operator_identity_events (
      record_kind,
      operator_user_id,
      approver_user_id,
      identity_record_id,
      evidence_ref
    ) values (
      'activation_approved',
      v_operator_id,
      v_approver_id,
      v_other_identity_id,
      'wrong-parent-001'
    );
    raise exception 'approval accepted another operator identity record';
  exception
    when foreign_key_violation then null;
  end;

  begin
    insert into account_delete_private.operator_identity_events (
      record_kind,
      operator_user_id,
      approver_user_id,
      identity_record_id,
      evidence_ref
    ) values (
      'activation_approved',
      v_operator_id,
      v_operator_id,
      v_identity_id,
      'same-person-001'
    );
    raise exception 'approval accepted the operator as approver';
  exception
    when check_violation then null;
  end;

  begin
    insert into account_delete_private.operator_identity_events (
      record_kind,
      operator_user_id,
      evidence_ref
    ) values (
      'identity_verified',
      v_operator_id,
      'contains@email.example'
    );
    raise exception 'ledger accepted an unsafe evidence reference';
  exception
    when check_violation then null;
  end;

  begin
    update account_delete_private.operator_identity_events
    set evidence_ref = 'changed-001'
    where record_id = v_identity_id;
    raise exception 'ledger update unexpectedly succeeded';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    delete from account_delete_private.operator_identity_events
    where record_id = v_identity_id;
    raise exception 'ledger delete unexpectedly succeeded';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    execute 'truncate account_delete_private.operator_identity_events';
    raise exception 'ledger truncate unexpectedly succeeded';
  exception
    when sqlstate '55000' then null;
  end;
end;
$test$;

rollback;
