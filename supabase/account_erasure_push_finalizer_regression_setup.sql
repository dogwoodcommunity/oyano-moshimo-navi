-- DISPOSABLE REGRESSION DATABASE ONLY. Reconstruct the observed old body.
create schema finalizer_patch_regression;
create table finalizer_patch_regression.original as
select oid, pg_get_functiondef(oid) as definition, proacl, proowner, proconfig
from pg_proc where oid = 'public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)'::regprocedure;
do $test$
declare
  v_definition text;
  v_check text := $check$  if to_regclass('push_private.installations') is not null then
    execute 'select $1 + count(*) from push_private.installations where owner_id = $2'
      into v_db_residual_count using v_db_residual_count, p_target_user_id;
  end if;
$check$;
begin
  select definition into strict v_definition from finalizer_patch_regression.original;
  execute replace(v_definition, v_check, '');
  if (select md5(prosrc) from pg_proc where oid = 'public.finalize_account_erasure_v1(uuid,uuid,uuid,boolean,boolean,integer)'::regprocedure)
    <> 'ec5733e6fba67d9e3d8211b8b067fc9d' then
    raise exception 'regression_old_finalizer_not_reconstructed';
  end if;
end;
$test$;
