-- DISPOSABLE REGRESSION DATABASE ONLY.
do $test$
begin
  if not exists (
    select 1 from finalizer_patch_regression.original o join pg_proc p on p.oid = o.oid
    where pg_get_functiondef(p.oid) = o.definition and p.proacl = o.proacl
      and p.proowner = o.proowner and p.proconfig = o.proconfig
      and md5(p.prosrc) = '14e94525c994d32f5cac89930a313d22'
  ) then raise exception 'regression_finalizer_or_privileges_changed'; end if;
end;
$test$;
