-- Test-only fixture that widens the first profile insert so concurrent Web and
-- Mobile first-family calls deterministically overlap.

insert into auth.users (id, email)
values ('fd000000-0000-4000-8000-000000000001', 'concurrent-first-family@example.test');

create or replace function public.delay_concurrent_first_family_profile()
returns trigger
language plpgsql
as $$
begin
  if new.id = 'fd000000-0000-4000-8000-000000000001'::uuid then
    perform pg_sleep(1);
  end if;
  return new;
end;
$$;

create trigger delay_concurrent_first_family_profile
before insert on public.profiles
for each row execute function public.delay_concurrent_first_family_profile();
