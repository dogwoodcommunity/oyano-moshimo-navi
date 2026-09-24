-- Narrow, DB-first release candidate. NOT applied to production automatically.
-- Baseline body/owner/ACL/config were read-only verified on 2026-09-24.
-- Stop on drift; never reapply the complete erasure pipeline to fix this check.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';

do $patch$
declare
  v_oid oid := to_regprocedure('public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)');
  v_proc pg_proc%rowtype;
  v_definition text;
  v_check text := $check$  if to_regclass('push_private.installations') is not null then
    execute 'select $1 + count(*) from push_private.installations where owner_id = $2'
      into v_db_residual_count using v_db_residual_count, p_target_user_id;
  end if;
$check$;
  v_anchor text := $anchor$  if to_regclass('public.notebook_sync_receipts') is not null then$anchor$;
begin
  if v_oid is null then raise exception 'finalizer_patch_missing_function'; end if;
  select * into strict v_proc from pg_proc where oid = v_oid;
  if pg_get_userbyid(v_proc.proowner) <> 'postgres'
    or not v_proc.prosecdef
    or v_proc.proconfig is distinct from array['search_path=pg_catalog, public, extensions']
    or v_proc.proacl is distinct from '{postgres=X/postgres,service_role=X/postgres}'::aclitem[] then
    raise exception 'finalizer_patch_security_drift';
  end if;
  -- Already applied: verify the complete body, not just an included substring.
  if md5(v_proc.prosrc) = '14e94525c994d32f5cac89930a313d22' then return; end if;
  if md5(v_proc.prosrc) <> 'ec5733e6fba67d9e3d8211b8b067fc9d' then
    raise exception 'finalizer_patch_definition_drift';
  end if;
  v_definition := pg_get_functiondef(v_oid);
  if (length(v_definition) - length(replace(v_definition, v_anchor, ''))) / length(v_anchor) <> 1 then
    raise exception 'finalizer_patch_anchor_mismatch';
  end if;
  -- CREATE OR REPLACE preserves the function identity, owner and grants.
  execute replace(v_definition, v_anchor, v_check || v_anchor);
  if not exists (
    select 1 from pg_proc p where p.oid = v_oid
      and md5(p.prosrc) = '14e94525c994d32f5cac89930a313d22'
      and p.proowner = v_proc.proowner and p.proacl = v_proc.proacl
      and p.proconfig = v_proc.proconfig and p.prosecdef = v_proc.prosecdef
  ) then raise exception 'finalizer_patch_postcondition_failed'; end if;
end;
$patch$;
commit;
