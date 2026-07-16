create or replace function public.purge_stale_anonymous_cases(
  p_retention_days integer default 30,
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if p_retention_days < 7 then
    raise exception 'retention_days_too_short';
  end if;

  with targets as (
    select c.id
    from cases c
    where c.user_id is null
      and c.family_id is null
      and c.person_id is null
      and c.status in ('draft', 'result_ready')
      and c.created_at < now() - make_interval(days => p_retention_days)
      and not exists (
        select 1
        from case_results cr
        where cr.case_id = c.id
          and cr.app_handoff_consumed_at is not null
      )
      and not exists (
        select 1
        from support_packs sp
        where sp.case_id = c.id
          and sp.status in ('requested', 'paid', 'reviewing', 'report_ready', 'delivered')
      )
    order by c.created_at asc
    limit greatest(p_limit, 1)
  ),
  deleted as (
    delete from cases c
    using targets t
    where c.id = t.id
    returning c.id
  )
  select count(*) into v_deleted from deleted;

  return v_deleted;
end;
$$;

revoke all on function public.purge_stale_anonymous_cases(integer, integer) from public;
grant execute on function public.purge_stale_anonymous_cases(integer, integer) to service_role;
