-- Owner-only, append-only identity evidence for account-deletion operations.
-- Apply once after account_delete_executor_role.sql. This migration records no
-- person by itself and grants no application or deletion authority.

begin;

do $guard$
begin
  if to_regnamespace('account_delete_private') is not null then
    raise exception using
      errcode = '55000',
      message = 'account_delete_private already exists; stop and verify the existing security boundary';
  end if;
end;
$guard$;

create schema account_delete_private authorization postgres;

create table account_delete_private.operator_identity_events (
  record_id uuid primary key default gen_random_uuid(),
  record_kind text not null,
  operator_user_id uuid not null,
  approver_user_id uuid,
  identity_record_id uuid,
  identity_record_kind text generated always as (
    case
      when record_kind = 'activation_approved' then 'identity_verified'::text
      else null::text
    end
  ) stored,
  evidence_ref text not null,
  recorded_at timestamptz not null default clock_timestamp(),
  recorded_by name not null default session_user,
  constraint operator_identity_events_kind_allowed
    check (record_kind in ('identity_verified', 'activation_approved')),
  constraint operator_identity_events_evidence_ref_safe
    check (
      char_length(evidence_ref) between 1 and 200
      and evidence_ref ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]*$'
    ),
  constraint operator_identity_events_actor_shape
    check (
      (
        record_kind = 'identity_verified'
        and approver_user_id is null
        and identity_record_id is null
      )
      or (
        record_kind = 'activation_approved'
        and approver_user_id is not null
        and approver_user_id <> operator_user_id
        and identity_record_id is not null
      )
    ),
  constraint operator_identity_events_reference_key
    unique (record_id, operator_user_id, record_kind),
  constraint operator_identity_events_identity_reference
    foreign key (identity_record_id, operator_user_id, identity_record_kind)
    references account_delete_private.operator_identity_events (
      record_id,
      operator_user_id,
      record_kind
    )
    on delete restrict
);

create index operator_identity_events_operator_recorded_idx
  on account_delete_private.operator_identity_events (
    operator_user_id,
    recorded_at desc,
    record_id
  );

alter table account_delete_private.operator_identity_events enable row level security;
alter table account_delete_private.operator_identity_events force row level security;

create function account_delete_private.stamp_operator_identity_event()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.recorded_at := clock_timestamp();
  new.recorded_by := session_user;
  return new;
end;
$$;

create function account_delete_private.reject_operator_identity_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'operator identity events are append-only';
end;
$$;

create trigger operator_identity_events_stamp_insert
before insert on account_delete_private.operator_identity_events
for each row
execute function account_delete_private.stamp_operator_identity_event();

create trigger operator_identity_events_reject_mutation
before update or delete or truncate on account_delete_private.operator_identity_events
for each statement
execute function account_delete_private.reject_operator_identity_event_mutation();

comment on schema account_delete_private is
  'Owner-only operational evidence. Never expose this schema through PostgREST.';
comment on table account_delete_private.operator_identity_events is
  'Append-only identity and separate-approver evidence for deletion operators; stores no email, name, OTP, token, or free text.';

alter schema account_delete_private owner to postgres;
alter table account_delete_private.operator_identity_events owner to postgres;
alter function account_delete_private.stamp_operator_identity_event() owner to postgres;
alter function account_delete_private.reject_operator_identity_event_mutation() owner to postgres;

revoke all on schema account_delete_private
  from public, anon, authenticated, service_role;
revoke all on all tables in schema account_delete_private
  from public, anon, authenticated, service_role;
revoke all on all sequences in schema account_delete_private
  from public, anon, authenticated, service_role;
revoke all on all functions in schema account_delete_private
  from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema account_delete_private
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema account_delete_private
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema account_delete_private
  revoke all on functions from public, anon, authenticated, service_role;

-- PostgreSQL's built-in default for new functions includes PUBLIC EXECUTE and
-- a schema-local default REVOKE does not cancel that global built-in default.
-- Therefore every future function added here must be explicitly REVOKEd in the
-- same transaction, just like the two trigger functions above.

-- Fail closed if inherited/default ACLs granted this private boundary to any
-- role other than its owner. A schema-local REVOKE cannot safely guess every
-- current or future role name.
do $owner_only_acl_guard$
declare
  v_owner_id oid := (select oid from pg_roles where rolname = 'postgres');
  v_schema_id oid := 'account_delete_private'::regnamespace;
begin
  if exists (
    select 1
    from pg_namespace namespace
    cross join lateral aclexplode(
      coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))
    ) privilege
    where namespace.oid = v_schema_id
      and privilege.grantee <> v_owner_id
  ) or exists (
    select 1
    from pg_class relation
    cross join lateral aclexplode(
      coalesce(relation.relacl, acldefault('r', relation.relowner))
    ) privilege
    where relation.oid = 'account_delete_private.operator_identity_events'::regclass
      and privilege.grantee <> v_owner_id
  ) or exists (
    select 1
    from pg_proc procedure_info
    cross join lateral aclexplode(
      coalesce(procedure_info.proacl, acldefault('f', procedure_info.proowner))
    ) privilege
    where procedure_info.pronamespace = v_schema_id
      and privilege.grantee <> v_owner_id
  ) or exists (
    select 1
    from pg_default_acl default_acl
    cross join lateral aclexplode(default_acl.defaclacl) privilege
    where default_acl.defaclrole = v_owner_id
      and default_acl.defaclobjtype in ('r', 'S', 'f')
      and default_acl.defaclnamespace in (0, v_schema_id)
      and privilege.grantee <> v_owner_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'account_delete_private has a non-owner ACL; stop and review default privileges';
  end if;
end;
$owner_only_acl_guard$;

commit;
