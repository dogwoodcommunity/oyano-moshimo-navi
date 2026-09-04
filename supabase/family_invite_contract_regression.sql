-- PostgreSQL 16 regression checks for the public family-invite role contract.
-- Run only in a fresh disposable database after the final invite RPC bundle.

begin;

insert into auth.users (id, email)
values
  ('f8000000-0000-4000-8000-000000000001', 'invite-contract-owner@example.test'),
  ('f8000000-0000-4000-8000-000000000002', 'invite-contract-admin@example.test'),
  ('f8000000-0000-4000-8000-000000000003', 'invite-contract-member@example.test'),
  ('f8000000-0000-4000-8000-000000000004', 'invite-contract-legacy@example.test');

insert into public.profiles (id, email)
select id, email
from auth.users
where id::text like 'f8000000-%';

insert into public.families (id, name, owner_user_id, plan)
values (
  'f8000000-0000-4000-8000-000000000010',
  'Invite contract family',
  'f8000000-0000-4000-8000-000000000001',
  'plus'
);

insert into public.family_members (family_id, user_id, role, relationship)
values
  (
    'f8000000-0000-4000-8000-000000000010',
    'f8000000-0000-4000-8000-000000000001',
    'owner',
    'owner'
  ),
  (
    'f8000000-0000-4000-8000-000000000010',
    'f8000000-0000-4000-8000-000000000002',
    'admin',
    'existing admin'
  );

-- Simulate an admin invite created before the public contract was narrowed.
insert into public.family_invites (
  id, family_id, invited_email, role, relationship, token, status, expires_at, created_by
)
values (
  'f8000000-0000-4000-8000-000000000020',
  'f8000000-0000-4000-8000-000000000010',
  'invite-contract-legacy@example.test',
  'admin',
  'legacy admin',
  'legacy-admin-invite-token',
  'pending',
  now() + interval '7 days',
  'f8000000-0000-4000-8000-000000000001'
);

set local role authenticated;

do $family_invite_contract_test$
declare
  v_rejected boolean;
  v_invite public.family_invites%rowtype;
  v_member public.family_members%rowtype;
  v_admin_retry_token text;
begin
  -- Owners keep their existing authority to create a supported invite.
  perform set_config('request.jwt.claim.sub', 'f8000000-0000-4000-8000-000000000001', true);
  select * into v_invite
  from public.create_family_invite(
    'f8000000-0000-4000-8000-000000000010',
    'invite-contract-admin@example.test',
    'viewer',
    'lower role retry'
  );
  if v_invite.role <> 'viewer' then
    raise exception 'owner-created viewer invite returned role %', v_invite.role;
  end if;
  v_admin_retry_token := v_invite.token;

  -- Existing admins remain authorized to create a supported member invite.
  perform set_config('request.jwt.claim.sub', 'f8000000-0000-4000-8000-000000000002', true);
  select * into v_invite
  from public.create_family_invite(
    'f8000000-0000-4000-8000-000000000010',
    'invite-contract-member@example.test',
    'member',
    'member'
  );
  if v_invite.role <> 'member' then
    raise exception 'admin-created member invite returned role %', v_invite.role;
  end if;

  -- Even an owner cannot use the public RPC to mint a new admin invite.
  perform set_config('request.jwt.claim.sub', 'f8000000-0000-4000-8000-000000000001', true);
  v_rejected := false;
  begin
    perform public.create_family_invite(
      'f8000000-0000-4000-8000-000000000010',
      'new-admin@example.test',
      'admin',
      null
    );
  exception when others then
    if position('invalid_invite_role' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'public RPC created an admin invite';
  end if;

  -- A legacy pending admin invite cannot be returned through deduplication.
  v_rejected := false;
  begin
    perform public.create_family_invite(
      'f8000000-0000-4000-8000-000000000010',
      'invite-contract-legacy@example.test',
      'viewer',
      null
    );
  exception when others then
    if position('invite_has_reserved_role' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'public RPC returned a legacy admin invite';
  end if;

  -- The same legacy invite must also fail closed at acceptance.
  perform set_config('request.jwt.claim.sub', 'f8000000-0000-4000-8000-000000000004', true);
  v_rejected := false;
  begin
    perform public.accept_family_invite('legacy-admin-invite-token');
  exception when others then
    if position('invite_has_reserved_role' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'legacy admin invite was accepted';
  end if;

  -- Accepting a lower-role invite never downgrades an existing administrator,
  -- and the composite returned by the RPC reports the persisted role.
  perform set_config('request.jwt.claim.sub', 'f8000000-0000-4000-8000-000000000002', true);
  select * into v_member
  from public.accept_family_invite(v_admin_retry_token);
  if v_member.role <> 'admin' then
    raise exception 'existing admin was downgraded or returned as %', v_member.role;
  end if;
end;
$family_invite_contract_test$;

reset role;

do $family_invite_contract_assert$
begin
  if exists (
    select 1
    from public.family_invites
    where invited_email = 'new-admin@example.test'
  ) then
    raise exception 'rejected admin invite left a row behind';
  end if;

  if not exists (
    select 1
    from public.family_invites
    where id = 'f8000000-0000-4000-8000-000000000020'
      and status = 'pending'
  ) then
    raise exception 'rejected legacy admin invite was mutated';
  end if;

  if exists (
    select 1
    from public.family_members
    where family_id = 'f8000000-0000-4000-8000-000000000010'
      and user_id = 'f8000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'legacy admin invite created a membership';
  end if;

  if not exists (
    select 1
    from public.family_members
    where family_id = 'f8000000-0000-4000-8000-000000000010'
      and user_id = 'f8000000-0000-4000-8000-000000000002'
      and role = 'admin'
  ) then
    raise exception 'existing administrator privilege was downgraded';
  end if;
end;
$family_invite_contract_assert$;

rollback;
