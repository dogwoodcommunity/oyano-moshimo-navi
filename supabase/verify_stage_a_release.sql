-- Read-only Stage A release metadata verification for Supabase SQL Editor.
-- Returns only aggregate states/counts. It does not call application RPCs,
-- return account rows, or expose function definitions.
-- This is a structural/ACL drift check, not a substitute for the repository's
-- behavioral regressions, multi-account device tests, or an independent review.

with
api_roles as (
  select
    max(oid) filter (where rolname = 'anon') as anon_oid,
    max(oid) filter (where rolname = 'authenticated') as authenticated_oid,
    max(oid) filter (where rolname = 'service_role') as service_role_oid
  from pg_catalog.pg_roles
),
function_expectations (
  check_name,
  signature,
  allow_authenticated,
  allow_service_role,
  expected_volatility,
  expected_search_path,
  source_check
) as (
  values
    (
      'family_role_editor_rpc',
      'public.is_family_editor(uuid)',
      true,
      true,
      's',
      'public',
      'family_editor'
    ),
    (
      'family_management_rpcs',
      'public.transfer_family_ownership(uuid,uuid)',
      true,
      true,
      'v',
      'pg_catalog,public',
      null
    ),
    (
      'family_management_rpcs',
      'public.remove_family_member(uuid,uuid)',
      true,
      true,
      'v',
      'pg_catalog,public',
      null
    ),
    (
      'family_management_rpcs',
      'public.leave_family(uuid)',
      true,
      true,
      'v',
      'pg_catalog,public',
      null
    ),
    (
      'family_management_rpcs',
      'public.cancel_family_invite(uuid,uuid)',
      true,
      true,
      'v',
      'pg_catalog,public',
      null
    ),
    (
      'family_management_rpcs',
      'public.get_family_management_summary(uuid)',
      true,
      true,
      'v',
      'pg_catalog,public',
      null
    ),
    (
      'consult_daily_claim_rpcs',
      'public.claim_daily_free_consult(uuid,uuid,uuid,uuid)',
      false,
      true,
      'v',
      'pg_catalog,public',
      null
    ),
    (
      'consult_daily_claim_rpcs',
      'public.persist_and_finalize_daily_free_consult(uuid,uuid,uuid,uuid,uuid,text,jsonb,uuid[],integer,text)',
      false,
      true,
      'v',
      'pg_catalog,public',
      null
    ),
    (
      'consult_daily_claim_rpcs',
      'public.release_daily_free_consult(uuid,uuid,uuid)',
      false,
      true,
      'v',
      'pg_catalog,public',
      null
    ),
    (
      'monthly_checkin_rpc',
      'public.ensure_monthly_checkin_notifications()',
      false,
      true,
      'v',
      'public',
      'monthly_alias'
    )
),
function_inventory as (
  select
    expected.*,
    procedure_info.oid as procedure_oid,
    procedure_info.prosecdef,
    procedure_info.provolatile,
    procedure_info.proconfig,
    procedure_info.prosrc,
    roles.anon_oid,
    roles.authenticated_oid,
    roles.service_role_oid
  from function_expectations expected
  cross join api_roles roles
  left join pg_catalog.pg_proc procedure_info
    on procedure_info.oid = pg_catalog.to_regprocedure(expected.signature)
),
function_compatibility as (
  select
    inventory.*,
    case
      when procedure_oid is null then false
      else
        prosecdef
        and provolatile = expected_volatility::"char"
        and exists (
          select 1
          from unnest(coalesce(proconfig, array[]::text[])) setting(value)
          where regexp_replace(lower(setting.value), '[[:space:]]', '', 'g')
            = 'search_path=' || expected_search_path
        )
        and coalesce(
          pg_catalog.has_function_privilege(
            anon_oid,
            procedure_oid,
            'EXECUTE'
          ),
          false
        ) = false
        and coalesce(
          pg_catalog.has_function_privilege(
            authenticated_oid,
            procedure_oid,
            'EXECUTE'
          ),
          false
        ) = allow_authenticated
        and coalesce(
          pg_catalog.has_function_privilege(
            service_role_oid,
            procedure_oid,
            'EXECUTE'
          ),
          false
        ) = allow_service_role
        and case source_check
          when 'family_editor' then
            prosrc ~ $pattern$family_members\.role[[:space:]]+in[[:space:]]*\([[:space:]]*'owner'[[:space:]]*,[[:space:]]*'admin'[[:space:]]*,[[:space:]]*'member'[[:space:]]*\)$pattern$
            and prosrc !~ $pattern$family_members\.role[[:space:]]+in[^;]*'viewer'$pattern$
          when 'monthly_alias' then
            prosrc ~ $pattern$scheduled_notifications\.user_id[[:space:]]*=[[:space:]]*profiles\.id$pattern$
            and prosrc !~ $pattern$scheduled_notifications\.user_id[[:space:]]*=[[:space:]]*push_tokens\.user_id$pattern$
          else true
        end
    end as compatible
  from function_inventory inventory
),
function_checks as (
  select
    check_name,
    count(*)::bigint as required_count,
    count(procedure_oid)::bigint as present_count,
    count(*) filter (where compatible)::bigint as compatible_count,
    0::bigint as unexpected_count
  from function_compatibility
  group by check_name
),
policy_expectations (
  check_name,
  schema_name,
  table_name,
  policy_name,
  command_code,
  using_kind,
  check_kind,
  required_marker
) as (
  values
    (
      'family_role_public_policies',
      'public',
      'person_status_events',
      'status_events insert family',
      'a',
      'empty',
      'direct_roles',
      'person_status_events.person_id'
    ),
    (
      'family_role_public_policies',
      'public',
      'tasks',
      'tasks manage family',
      '*',
      'direct_roles',
      'direct_roles',
      'tasks.person_id'
    ),
    (
      'family_role_public_policies',
      'public',
      'asset_items',
      'asset_items manage family',
      '*',
      'editor_helper',
      'editor_helper',
      'asset_items.person_id'
    ),
    (
      'family_role_public_policies',
      'public',
      'timeline_events',
      'timeline_events manage family',
      '*',
      'direct_roles',
      'direct_roles',
      'timeline_events.person_id'
    ),
    (
      'family_role_public_policies',
      'public',
      'homes',
      'homes manage family',
      '*',
      'editor_helper',
      'editor_helper',
      'homes.person_id'
    ),
    (
      'family_role_public_policies',
      'public',
      'home_photos',
      'home_photos manage family',
      '*',
      'editor_helper',
      'editor_helper',
      'home_photos.home_id'
    ),
    (
      'family_role_storage_policies',
      'storage',
      'objects',
      'home photos update own family',
      'w',
      'direct_roles',
      'empty',
      'home_photos.storage_path'
    ),
    (
      'family_role_storage_policies',
      'storage',
      'objects',
      'home photos delete own family',
      'd',
      'direct_roles',
      'empty',
      'home_photos.storage_path'
    )
),
policy_inventory as (
  select
    expected.*,
    policy.oid as policy_oid,
    policy.polcmd,
    policy.polpermissive,
    policy.polroles,
    relation.relrowsecurity,
    roles.authenticated_oid,
    lower(coalesce(
      pg_catalog.pg_get_expr(policy.polqual, relation.oid),
      ''
    )) as using_text,
    lower(coalesce(
      pg_catalog.pg_get_expr(policy.polwithcheck, relation.oid),
      ''
    )) as check_text
  from policy_expectations expected
  cross join api_roles roles
  left join pg_catalog.pg_namespace namespace
    on namespace.nspname = expected.schema_name
  left join pg_catalog.pg_class relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.table_name
  left join pg_catalog.pg_policy policy
    on policy.polrelid = relation.oid
   and policy.polname = expected.policy_name
),
policy_checks as (
  select
    check_name,
    count(*)::bigint as required_count,
    count(policy_oid)::bigint as present_count,
    count(*) filter (
      where policy_oid is not null
        and relrowsecurity
        and polpermissive
        and polcmd = command_code::"char"
        and cardinality(polroles) = 1
        and polroles @> array[authenticated_oid]::oid[]
        and case using_kind
          when 'empty' then btrim(using_text) = ''
          when 'editor_helper' then
            using_text like '%is_family_editor%'
            and using_text like '%' || required_marker || '%'
          when 'direct_roles' then
            using_text like '%' || required_marker || '%'
            and using_text like '%''owner''%'
            and using_text like '%''admin''%'
            and using_text like '%''member''%'
            and using_text not like '%''viewer''%'
          else false
        end
        and case check_kind
          when 'empty' then btrim(check_text) = ''
          when 'editor_helper' then
            check_text like '%is_family_editor%'
            and check_text like '%' || required_marker || '%'
          when 'direct_roles' then
            check_text like '%' || required_marker || '%'
            and check_text like '%''owner''%'
            and check_text like '%''admin''%'
            and check_text like '%''member''%'
            and check_text not like '%''viewer''%'
          else false
        end
    )::bigint as compatible_count,
    0::bigint as unexpected_count
  from policy_inventory
  group by check_name
),
family_management_tables as (
  select
    pg_catalog.to_regclass('public.family_members') as family_members_oid,
    pg_catalog.to_regclass('public.family_invites') as family_invites_oid,
    pg_catalog.to_regclass('public.families') as families_oid,
    roles.anon_oid,
    roles.authenticated_oid,
    roles.service_role_oid
  from api_roles roles
),
family_management_boundary as (
  select
    'family_management_direct_writes_closed'::text as check_name,
    3::bigint as required_count,
    (
      (family_members_oid is not null)::integer
      + (family_invites_oid is not null)::integer
      + (families_oid is not null)::integer
    )::bigint as present_count,
    (
      (
        family_members_oid is not null
        and not coalesce(pg_catalog.has_table_privilege(
          authenticated_oid,
          family_members_oid,
          'INSERT,UPDATE,DELETE'
        ), false)
        and not coalesce(pg_catalog.has_table_privilege(
          anon_oid,
          family_members_oid,
          'INSERT,UPDATE,DELETE'
        ), false)
      )::integer
      + (
        family_invites_oid is not null
        and not coalesce(pg_catalog.has_table_privilege(
          authenticated_oid,
          family_invites_oid,
          'INSERT,UPDATE,DELETE'
        ), false)
        and not coalesce(pg_catalog.has_table_privilege(
          anon_oid,
          family_invites_oid,
          'INSERT,UPDATE,DELETE'
        ), false)
      )::integer
      + (
        families_oid is not null
        and not coalesce(pg_catalog.has_table_privilege(
          authenticated_oid,
          families_oid,
          'UPDATE,DELETE'
        ), false)
        and not coalesce(pg_catalog.has_table_privilege(
          anon_oid,
          families_oid,
          'UPDATE,DELETE'
        ), false)
      )::integer
    )::bigint as compatible_count,
    (
      select count(*)::bigint
      from pg_catalog.pg_policy policy
      join pg_catalog.pg_class relation on relation.oid = policy.polrelid
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and policy.polname in (
          'families update admins',
          'family_members manage admins',
          'family_members update admins',
          'family_members delete admins'
        )
    ) + case
      when pg_catalog.to_regprocedure('public.promote_family_member_to_owner(uuid)') is null then 0
      when coalesce(pg_catalog.has_function_privilege(
             authenticated_oid,
             pg_catalog.to_regprocedure('public.promote_family_member_to_owner(uuid)'),
             'EXECUTE'
           ), false)
        or coalesce(pg_catalog.has_function_privilege(
             anon_oid,
             pg_catalog.to_regprocedure('public.promote_family_member_to_owner(uuid)'),
             'EXECUTE'
           ), false)
        or not coalesce(pg_catalog.has_function_privilege(
             service_role_oid,
             pg_catalog.to_regprocedure('public.promote_family_member_to_owner(uuid)'),
             'EXECUTE'
           ), false)
      then 1
      else 0
    end as unexpected_count
  from family_management_tables
),
consult_ledger as (
  select
    pg_catalog.to_regclass('public.ai_consult_daily_claims') as relation_oid,
    roles.anon_oid,
    roles.authenticated_oid,
    roles.service_role_oid
  from api_roles roles
),
consult_ledger_check as (
  select
    'consult_daily_claim_ledger'::text as check_name,
    1::bigint as required_count,
    (relation_oid is not null)::integer::bigint as present_count,
    (
      relation_oid is not null
      and coalesce((
        select relation.relrowsecurity and relation.relforcerowsecurity
        from pg_catalog.pg_class relation
        where relation.oid = relation_oid
      ), false)
      and exists (
        select 1
        from pg_catalog.pg_attribute attribute
        where attribute.attrelid = relation_oid
          and attribute.attname = 'turn_id'
          and not attribute.attisdropped
      )
      and pg_catalog.to_regclass('public.idx_ai_consult_daily_claims_reserved') is not null
      and pg_catalog.to_regclass('public.ux_ai_consult_daily_claims_turn_id') is not null
      and not coalesce(pg_catalog.has_table_privilege(
        anon_oid,
        relation_oid,
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
      ), false)
      and not coalesce(pg_catalog.has_table_privilege(
        authenticated_oid,
        relation_oid,
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
      ), false)
      and not coalesce(pg_catalog.has_table_privilege(
        service_role_oid,
        relation_oid,
        'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
      ), false)
    )::integer::bigint as compatible_count,
    (pg_catalog.to_regprocedure('public.finalize_daily_free_consult(uuid,uuid,uuid)') is not null)::integer::bigint
      as unexpected_count
  from consult_ledger
),
monthly_index_check as (
  select
    'monthly_checkin_unique_index'::text as check_name,
    1::bigint as required_count,
    count(index_info.indexrelid)::bigint as present_count,
    count(*) filter (
      where index_info.indisunique
        and lower(coalesce(
          pg_catalog.pg_get_expr(index_info.indpred, index_info.indrelid),
          ''
        )) like '%task_id is null%'
        and lower(coalesce(
          pg_catalog.pg_get_expr(index_info.indpred, index_info.indrelid),
          ''
        )) like '%monthly_checkin%'
    )::bigint as compatible_count,
    0::bigint as unexpected_count
  from pg_catalog.pg_index index_info
  where index_info.indexrelid = pg_catalog.to_regclass(
    'public.idx_scheduled_monthly_checkins_unique'
  )
),
private_gate_objects as (
  select
    pg_catalog.to_regnamespace('account_delete_private') as private_schema_oid,
    pg_catalog.to_regclass(
      'account_delete_private.account_erasure_execution_control'
    ) as control_oid,
    pg_catalog.to_regclass(
      'account_delete_private.account_erasure_execution_grants'
    ) as grants_oid,
    pg_catalog.to_regclass(
      'account_delete_private.account_erasure_execution_grants_one_open_per_epoch'
    ) as one_open_index_oid,
    pg_catalog.to_regprocedure(
      'account_delete_private.open_account_erasure_execution_control_v1(integer)'
    ) as open_function_oid,
    pg_catalog.to_regprocedure(
      'account_delete_private.close_account_erasure_execution_control_v1()'
    ) as close_function_oid,
    pg_catalog.to_regprocedure(
      'account_delete_private.fail_close_account_erasure_execution_control_v1(uuid,text)'
    ) as fail_close_function_oid,
    roles.anon_oid,
    roles.authenticated_oid,
    roles.service_role_oid
  from api_roles roles
),
private_gate_shape as (
  select
    objects.*,
    (
      objects.control_oid is not null
      and (
        select count(*)
        from pg_catalog.pg_attribute attribute
        where attribute.attrelid = objects.control_oid
          and attribute.attname in (
            'control_key',
            'epoch',
            'opened_at',
            'enabled_until',
            'consumed_at',
            'closed_at'
          )
          and not attribute.attisdropped
      ) = 6
      and objects.grants_oid is not null
      and (
        select count(*)
        from pg_catalog.pg_attribute attribute
        where attribute.attrelid = objects.grants_oid
          and attribute.attname in ('expires_at', 'consumed_at', 'revoked_at')
          and not attribute.attisdropped
      ) = 3
    ) as state_columns_compatible
  from private_gate_objects objects
),
private_gate_check as (
  select
    'erasure_execution_control_private'::text as check_name,
    6::bigint as required_count,
    (
      (control_oid is not null)::integer
      + (grants_oid is not null)::integer
      + (one_open_index_oid is not null)::integer
      + (open_function_oid is not null)::integer
      + (close_function_oid is not null)::integer
      + (fail_close_function_oid is not null)::integer
    )::bigint as present_count,
    (
      (
        control_oid is not null
        and coalesce((
          select pg_catalog.pg_get_userbyid(relation.relowner) = 'postgres'
            and relation.relrowsecurity
            and relation.relforcerowsecurity
          from pg_catalog.pg_class relation
          where relation.oid = control_oid
        ), false)
        and not coalesce(pg_catalog.has_table_privilege(
          anon_oid,
          control_oid,
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        ), false)
        and not coalesce(pg_catalog.has_table_privilege(
          authenticated_oid,
          control_oid,
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        ), false)
        and not coalesce(pg_catalog.has_table_privilege(
          service_role_oid,
          control_oid,
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        ), false)
      )::integer
      + (
        grants_oid is not null
        and coalesce((
          select pg_catalog.pg_get_userbyid(relation.relowner) = 'postgres'
            and relation.relrowsecurity
            and relation.relforcerowsecurity
          from pg_catalog.pg_class relation
          where relation.oid = grants_oid
        ), false)
        and not coalesce(pg_catalog.has_table_privilege(
          anon_oid,
          grants_oid,
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        ), false)
        and not coalesce(pg_catalog.has_table_privilege(
          authenticated_oid,
          grants_oid,
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        ), false)
        and not coalesce(pg_catalog.has_table_privilege(
          service_role_oid,
          grants_oid,
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        ), false)
      )::integer
      + (
        one_open_index_oid is not null
        and coalesce((
          select index_info.indisunique
          from pg_catalog.pg_index index_info
          where index_info.indexrelid = one_open_index_oid
        ), false)
      )::integer
      + (
        open_function_oid is not null
        and coalesce((
          select pg_catalog.pg_get_userbyid(procedure_info.proowner) = 'postgres'
          from pg_catalog.pg_proc procedure_info
          where procedure_info.oid = open_function_oid
        ), false)
        and not coalesce(pg_catalog.has_function_privilege(
          anon_oid,
          open_function_oid,
          'EXECUTE'
        ), false)
        and not coalesce(pg_catalog.has_function_privilege(
          authenticated_oid,
          open_function_oid,
          'EXECUTE'
        ), false)
        and not coalesce(pg_catalog.has_function_privilege(
          service_role_oid,
          open_function_oid,
          'EXECUTE'
        ), false)
      )::integer
      + (
        close_function_oid is not null
        and coalesce((
          select pg_catalog.pg_get_userbyid(procedure_info.proowner) = 'postgres'
          from pg_catalog.pg_proc procedure_info
          where procedure_info.oid = close_function_oid
        ), false)
        and not coalesce(pg_catalog.has_function_privilege(
          anon_oid,
          close_function_oid,
          'EXECUTE'
        ), false)
        and not coalesce(pg_catalog.has_function_privilege(
          authenticated_oid,
          close_function_oid,
          'EXECUTE'
        ), false)
        and not coalesce(pg_catalog.has_function_privilege(
          service_role_oid,
          close_function_oid,
          'EXECUTE'
        ), false)
      )::integer
      + (
        fail_close_function_oid is not null
        and coalesce((
          select pg_catalog.pg_get_userbyid(procedure_info.proowner) = 'postgres'
          from pg_catalog.pg_proc procedure_info
          where procedure_info.oid = fail_close_function_oid
        ), false)
        and not coalesce(pg_catalog.has_function_privilege(
          anon_oid,
          fail_close_function_oid,
          'EXECUTE'
        ), false)
        and not coalesce(pg_catalog.has_function_privilege(
          authenticated_oid,
          fail_close_function_oid,
          'EXECUTE'
        ), false)
        and not coalesce(pg_catalog.has_function_privilege(
          service_role_oid,
          fail_close_function_oid,
          'EXECUTE'
        ), false)
      )::integer
    )::bigint as compatible_count,
    (
      (
        private_schema_oid is not null
        and (
          coalesce(pg_catalog.has_schema_privilege(
            anon_oid,
            private_schema_oid,
            'USAGE,CREATE'
          ), false)
          or coalesce(pg_catalog.has_schema_privilege(
            authenticated_oid,
            private_schema_oid,
            'USAGE,CREATE'
          ), false)
          or coalesce(pg_catalog.has_schema_privilege(
            service_role_oid,
            private_schema_oid,
            'USAGE,CREATE'
          ), false)
        )
      )::integer
    )::bigint as unexpected_count
  from private_gate_shape
),
private_gate_state_xml as (
  select
    shape.*,
    case
      when not state_columns_compatible then null::xml
      else pg_catalog.query_to_xml(
        $query$
          select
            (select count(*) from account_delete_private.account_erasure_execution_control)
              as control_rows,
            (select count(*)
             from account_delete_private.account_erasure_execution_control
             where epoch is not null
               and consumed_at is null
               and closed_at is null
               and enabled_until > pg_catalog.clock_timestamp())
              as active_controls,
            (select count(*)
             from account_delete_private.account_erasure_execution_grants
             where consumed_at is null
               and revoked_at is null
               and expires_at > pg_catalog.clock_timestamp())
              as active_grants
        $query$,
        false,
        false,
        ''
      )
    end as state_xml
  from private_gate_shape shape
),
private_gate_state as (
  select
    source.control_oid,
    source.grants_oid,
    source.state_columns_compatible,
    state.control_rows,
    state.active_controls,
    state.active_grants
  from private_gate_state_xml source
  left join lateral xmltable(
    '/table/row'
    passing source.state_xml
    columns
      control_rows bigint path 'control_rows',
      active_controls bigint path 'active_controls',
      active_grants bigint path 'active_grants'
  ) state on true
),
private_gate_state_check as (
  select
    'erasure_execution_control_off'::text as check_name,
    1::bigint as required_count,
    (
      control_oid is not null
      and grants_oid is not null
    )::integer::bigint as present_count,
    (
      state_columns_compatible
      and control_rows = 1
      and active_controls = 0
      and active_grants = 0
    )::integer::bigint as compatible_count,
    0::bigint as unexpected_count
  from private_gate_state
),
role_check as (
  select
    'supabase_api_roles'::text as check_name,
    3::bigint as required_count,
    (
      (anon_oid is not null)::integer
      + (authenticated_oid is not null)::integer
      + (service_role_oid is not null)::integer
    )::bigint as present_count,
    (
      (anon_oid is not null)::integer
      + (authenticated_oid is not null)::integer
      + (service_role_oid is not null)::integer
    )::bigint as compatible_count,
    0::bigint as unexpected_count
  from api_roles
),
all_checks as (
  select * from role_check
  union all select * from function_checks
  union all select * from policy_checks
  union all select * from family_management_boundary
  union all select * from consult_ledger_check
  union all select * from monthly_index_check
  union all select * from private_gate_check
  union all select * from private_gate_state_check
)
select
  check_name,
  case
    when present_count < required_count then 'missing'
    when compatible_count < required_count or unexpected_count > 0 then 'incompatible'
    else 'ok'
  end as state,
  (
    present_count = required_count
    and compatible_count = required_count
    and unexpected_count = 0
  ) as ok,
  required_count,
  present_count,
  compatible_count,
  unexpected_count
from all_checks
order by check_name;
