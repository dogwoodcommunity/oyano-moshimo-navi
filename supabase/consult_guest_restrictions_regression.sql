-- TEST ONLY: disposable PostgreSQL/Supabase shims, never production.
-- Requires schema, RLS, the invite RPCs, Storage shim, and guest restrictions.
-- Every fixture, permissive test policy and mutation is rolled back.
begin;
insert into auth.users (id, email) values
  ('f7000000-0000-4000-8000-000000000001', 'guest-guard-owner@example.test'),
  ('f7000000-0000-4000-8000-000000000002', 'guest-guard-member@example.test');
insert into public.profiles (id, email)
select id, email from auth.users where id::text like 'f7000000-%';
insert into public.families (id, name, owner_user_id, plan) values
  ('f7000000-0000-4000-8000-000000000010', 'Synthetic guest guard', 'f7000000-0000-4000-8000-000000000001', 'plus');
insert into public.family_members (family_id, user_id, role, relationship) values
  ('f7000000-0000-4000-8000-000000000010', 'f7000000-0000-4000-8000-000000000001', 'owner', 'synthetic');

alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, update on storage.objects to authenticated;
-- Deliberately permissive TEST policy proves the restrictive guest policies
-- cannot be bypassed even if another upload path is later permitted.
create policy "synthetic guest guard baseline" on storage.objects for all to authenticated
using (true) with check (true);
insert into storage.objects (id, bucket_id, name) values
  ('f7000000-0000-4000-8000-000000000020', 'home-photos', 'synthetic-original.jpg');

set local role authenticated;
do $guest_guard_test$
declare
  v_rejected boolean;
  v_invite public.family_invites%rowtype;
  v_member public.family_members%rowtype;
  v_rows integer;
begin
  perform set_config('request.jwt.claim.sub', 'f7000000-0000-4000-8000-000000000001', true);
  perform set_config('request.jwt.claims', '{"is_anonymous":true}', true);
  v_rejected := false;
  begin
    perform public.create_family_invite('f7000000-0000-4000-8000-000000000010', 'guest-guard-member@example.test', 'viewer', null);
  exception when others then
    if position('registered_account_required' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'guest owner created a direct RPC invitation'; end if;

  -- The same owner, once registered, retains the existing invitation authority.
  perform set_config('request.jwt.claims', '{"is_anonymous":false}', true);
  select * into v_invite from public.create_family_invite(
    'f7000000-0000-4000-8000-000000000010', 'guest-guard-member@example.test', 'viewer', null);
  if v_invite.role <> 'viewer' then raise exception 'registered invitation regressed'; end if;

  perform set_config('request.jwt.claim.sub', 'f7000000-0000-4000-8000-000000000002', true);
  perform set_config('request.jwt.claims', '{"is_anonymous":true}', true);
  v_rejected := false;
  begin
    perform public.accept_family_invite(v_invite.token);
  exception when others then
    if position('registered_account_required' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'guest accepted invitation via direct RPC'; end if;
  perform set_config('request.jwt.claims', '{"is_anonymous":false}', true);
  select * into v_member from public.accept_family_invite(v_invite.token);
  if v_member.role <> 'viewer' then raise exception 'registered acceptance regressed'; end if;

  perform set_config('request.jwt.claims', '{"is_anonymous":true}', true);
  v_rejected := false;
  begin
    insert into storage.objects (bucket_id, name) values ('home-photos', 'synthetic-guest.jpg');
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'guest bypassed Storage INSERT guard'; end if;
  update storage.objects set name = 'synthetic-forbidden.jpg'
  where id = 'f7000000-0000-4000-8000-000000000020';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'guest bypassed Storage UPDATE guard'; end if;

  insert into storage.objects (id, bucket_id, name) values
    ('f7000000-0000-4000-8000-000000000021', 'unrelated-test-bucket', 'synthetic-unrelated.jpg');
  v_rejected := false;
  begin
    update storage.objects set bucket_id = 'home-photos'
    where id = 'f7000000-0000-4000-8000-000000000021';
  exception when insufficient_privilege then v_rejected := true;
  end;
  if not v_rejected then raise exception 'guest moved another bucket object into home-photos'; end if;

  -- Legacy registered JWTs that omit the anonymous claim continue to work.
  perform set_config('request.jwt.claims', '{}', true);
  insert into storage.objects (bucket_id, name) values ('home-photos', 'synthetic-registered.jpg');
  update storage.objects set name = 'synthetic-registered-update.jpg'
  where id = 'f7000000-0000-4000-8000-000000000020';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'registered Storage UPDATE regressed'; end if;
end;
$guest_guard_test$;
rollback;
