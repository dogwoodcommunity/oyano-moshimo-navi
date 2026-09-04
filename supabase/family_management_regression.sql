-- PostgreSQL 16 regression checks for atomic family membership management.
-- Run only in a fresh disposable database after family_management_rpc.sql.
-- Every seed and mutation is rolled back.

begin;

insert into auth.users (id, email)
values
  ('fa000000-0000-4000-8000-000000000001', 'owner-a@example.test'),
  ('fa000000-0000-4000-8000-000000000002', 'admin-a@example.test'),
  ('fa000000-0000-4000-8000-000000000003', 'member-a@example.test'),
  ('fa000000-0000-4000-8000-000000000004', 'viewer-a@example.test'),
  ('fa000000-0000-4000-8000-000000000005', 'leaver-a@example.test'),
  ('fa000000-0000-4000-8000-000000000006', 'photo-member-a@example.test'),
  ('fa000000-0000-4000-8000-000000000007', 'fake-photo-member-a@example.test'),
  ('fb000000-0000-4000-8000-000000000001', 'owner-b@example.test'),
  ('fb000000-0000-4000-8000-000000000002', 'member-b@example.test');

insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

insert into public.families (id, name, owner_user_id, plan)
values
  (
    'fa000000-0000-4000-8000-000000000010',
    'Family A',
    'fa000000-0000-4000-8000-000000000001',
    'plus'
  ),
  (
    'fb000000-0000-4000-8000-000000000010',
    'Family B',
    'fb000000-0000-4000-8000-000000000001',
    'plus'
  );

insert into public.family_members (id, family_id, user_id, role, relationship)
values
  ('fa000000-0000-4000-8000-000000000101', 'fa000000-0000-4000-8000-000000000010', 'fa000000-0000-4000-8000-000000000001', 'owner', 'owner A'),
  ('fa000000-0000-4000-8000-000000000102', 'fa000000-0000-4000-8000-000000000010', 'fa000000-0000-4000-8000-000000000002', 'admin', 'admin A'),
  ('fa000000-0000-4000-8000-000000000103', 'fa000000-0000-4000-8000-000000000010', 'fa000000-0000-4000-8000-000000000003', 'member', 'member A'),
  ('fa000000-0000-4000-8000-000000000104', 'fa000000-0000-4000-8000-000000000010', 'fa000000-0000-4000-8000-000000000004', 'viewer', 'viewer A'),
  ('fa000000-0000-4000-8000-000000000105', 'fa000000-0000-4000-8000-000000000010', 'fa000000-0000-4000-8000-000000000005', 'member', 'leaver A'),
  ('fa000000-0000-4000-8000-000000000106', 'fa000000-0000-4000-8000-000000000010', 'fa000000-0000-4000-8000-000000000006', 'member', 'photo member A'),
  ('fa000000-0000-4000-8000-000000000107', 'fa000000-0000-4000-8000-000000000010', 'fa000000-0000-4000-8000-000000000007', 'member', 'fake photo member A'),
  ('fb000000-0000-4000-8000-000000000101', 'fb000000-0000-4000-8000-000000000010', 'fb000000-0000-4000-8000-000000000001', 'owner', 'owner B'),
  ('fb000000-0000-4000-8000-000000000102', 'fb000000-0000-4000-8000-000000000010', 'fb000000-0000-4000-8000-000000000002', 'member', 'member B');

insert into public.family_invites (
  id, family_id, invited_email, role, token, status, expires_at, created_by
)
values
  (
    'fa000000-0000-4000-8000-000000000201',
    'fa000000-0000-4000-8000-000000000010',
    'pending-a@example.test',
    'member',
    'pending-family-a',
    'pending',
    now() + interval '7 days',
    'fa000000-0000-4000-8000-000000000001'
  ),
  (
    'fb000000-0000-4000-8000-000000000201',
    'fb000000-0000-4000-8000-000000000010',
    'pending-b@example.test',
    'member',
    'pending-family-b',
    'pending',
    now() + interval '7 days',
    'fb000000-0000-4000-8000-000000000001'
  );

insert into public.people (id, family_id, display_name, relationship_to_family, profile)
values (
  'fa000000-0000-4000-8000-000000000300',
  'fa000000-0000-4000-8000-000000000010',
  'Photo test person',
  'parent',
  '{"localCaseId":"photo-test-case"}'::jsonb
);

insert into public.timeline_events (
  id, person_id, event_type, event_date, title, body, attachments, metadata, created_by
)
values
  (
    'fa000000-0000-4000-8000-000000000301',
    'fa000000-0000-4000-8000-000000000300',
    'diary',
    current_date,
    'Leaver photo',
    'photo',
    '[{"storageBucket":"home-photos","storagePath":"notebook/fa000000-0000-4000-8000-000000000005/leaver.jpg"}]'::jsonb,
    '{"localCaseId":"photo-test-case","localDiaryId":"leaver-photo"}'::jsonb,
    'fa000000-0000-4000-8000-000000000005'
  ),
  (
    'fa000000-0000-4000-8000-000000000302',
    'fa000000-0000-4000-8000-000000000300',
    'diary',
    current_date,
    'Removed member photo',
    'photo',
    '[{"storageBucket":"home-photos","storagePath":"notebook/fa000000-0000-4000-8000-000000000006/removed.jpg"}]'::jsonb,
    '{"localCaseId":"photo-test-case","localDiaryId":"removed-photo"}'::jsonb,
    'fa000000-0000-4000-8000-000000000006'
  ),
  (
    'fa000000-0000-4000-8000-000000000303',
    'fa000000-0000-4000-8000-000000000300',
    'diary',
    current_date,
    'Missing object must not block',
    'fake path',
    '[{"storageBucket":"home-photos","storagePath":"notebook/fa000000-0000-4000-8000-000000000007/not-real.jpg"}]'::jsonb,
    '{"localCaseId":"photo-test-case","localDiaryId":"missing-object"}'::jsonb,
    'fa000000-0000-4000-8000-000000000007'
  ),
  (
    'fa000000-0000-4000-8000-000000000304',
    'fa000000-0000-4000-8000-000000000300',
    'status',
    current_date,
    'Non-diary object must not block',
    'not a diary',
    '[{"storageBucket":"home-photos","storagePath":"notebook/fa000000-0000-4000-8000-000000000007/non-diary.jpg"}]'::jsonb,
    '{}'::jsonb,
    'fa000000-0000-4000-8000-000000000007'
  );

insert into storage.objects (id, bucket_id, name)
values
  ('fa000000-0000-4000-8000-000000000401', 'home-photos', 'notebook/fa000000-0000-4000-8000-000000000005/leaver.jpg'),
  ('fa000000-0000-4000-8000-000000000402', 'home-photos', 'notebook/fa000000-0000-4000-8000-000000000006/removed.jpg'),
  ('fa000000-0000-4000-8000-000000000403', 'home-photos', 'notebook/fa000000-0000-4000-8000-000000000007/non-diary.jpg');

set local role authenticated;

do $family_management_test$
declare
  v_rejected boolean;
  v_summary jsonb;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  v_rejected := false;
  begin
    perform public.transfer_family_ownership(
      'fa000000-0000-4000-8000-000000000010',
      'fa000000-0000-4000-8000-000000000103'
    );
  exception when others then
    if position('not_authenticated' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'unauthenticated ownership transfer unexpectedly succeeded'; end if;

  perform set_config('request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000002', true);
  v_summary := public.get_family_management_summary('fa000000-0000-4000-8000-000000000010');
  if coalesce((v_summary->>'canManage')::boolean, false) is not true
     or jsonb_array_length(v_summary->'pendingInvites') <> 1
     or v_summary->'pendingInvites'->0->>'invitedEmail' <> 'pending-a@example.test' then
    raise exception 'admin summary did not include its pending invite: %', v_summary;
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(v_summary->'members') member
    where member->>'memberId' = 'fa000000-0000-4000-8000-000000000106'
      and coalesce((member->>'canRemove')::boolean, true) is false
      and member->>'removeBlockedReason' = 'notebook_photos'
  ) then
    raise exception 'admin summary did not block a member whose notebook photo is still referenced: %', v_summary;
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(v_summary->'members') member
    where member->>'memberId' = 'fa000000-0000-4000-8000-000000000107'
      and coalesce((member->>'canRemove')::boolean, false) is true
      and member->>'removeBlockedReason' is null
  ) then
    raise exception 'missing-object/non-diary paths incorrectly blocked member removal: %', v_summary;
  end if;

  perform public.remove_family_member(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000107'
  );

  perform set_config('request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000004', true);
  v_summary := public.get_family_management_summary('fa000000-0000-4000-8000-000000000010');
  if coalesce((v_summary->>'canManage')::boolean, true) is not false
     or jsonb_array_length(v_summary->'pendingInvites') <> 0
     or v_summary::text like '%pending-a@example.test%'
     or exists (
       select 1
       from jsonb_array_elements(v_summary->'members') member
       where member->>'removeBlockedReason' is not null
     ) then
    raise exception 'viewer summary exposed invite operations/email: %', v_summary;
  end if;

  perform set_config('request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000002', true);
  v_rejected := false;
  begin
    perform public.promote_family_member_to_owner('fa000000-0000-4000-8000-000000000103');
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'deprecated owner promotion RPC remained client-callable'; end if;

  v_rejected := false;
  begin
    perform public.transfer_family_ownership(
      'fa000000-0000-4000-8000-000000000010',
      'fa000000-0000-4000-8000-000000000103'
    );
  exception when others then
    if position('ownership_transfer_requires_current_owner' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'admin ownership transfer unexpectedly succeeded'; end if;

  perform set_config('request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000001', true);
  v_rejected := false;
  begin
    perform public.transfer_family_ownership(
      'fa000000-0000-4000-8000-000000000010',
      'fb000000-0000-4000-8000-000000000102'
    );
  exception when others then
    if position('member_not_found' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'cross-family ownership transfer unexpectedly succeeded'; end if;

  perform public.transfer_family_ownership(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000103'
  );

  v_rejected := false;
  begin
    perform public.remove_family_member(
      'fa000000-0000-4000-8000-000000000010',
      'fa000000-0000-4000-8000-000000000103'
    );
  exception when others then
    if position('cannot_remove_family_owner' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'removing the current owner unexpectedly succeeded'; end if;

  perform public.remove_family_member(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000104'
  );

  perform set_config('request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000004', true);
  v_rejected := false;
  begin
    perform public.get_family_management_summary('fa000000-0000-4000-8000-000000000010');
  exception when others then
    if position('not_a_family_member' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'removed viewer still received a family summary'; end if;

  perform set_config('request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000001', true);

  v_rejected := false;
  begin
    perform public.remove_family_member(
      'fa000000-0000-4000-8000-000000000010',
      'fb000000-0000-4000-8000-000000000102'
    );
  exception when others then
    if position('member_not_found' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'cross-family member removal unexpectedly succeeded'; end if;

  v_rejected := false;
  begin
    perform public.cancel_family_invite(
      'fa000000-0000-4000-8000-000000000010',
      'fb000000-0000-4000-8000-000000000201'
    );
  exception when others then
    if position('invite_not_found' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'cross-family invite cancellation unexpectedly succeeded'; end if;

  perform public.cancel_family_invite(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000201'
  );
  -- Cancellation is idempotent for browser retries.
  perform public.cancel_family_invite(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000201'
  );

  perform set_config('request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000005', true);
  v_rejected := false;
  begin
    perform public.remove_family_member(
      'fa000000-0000-4000-8000-000000000010',
      'fa000000-0000-4000-8000-000000000102'
    );
  exception when others then
    if position('not_family_admin' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'plain member removal unexpectedly succeeded'; end if;

  v_summary := public.get_family_management_summary('fa000000-0000-4000-8000-000000000010');
  if coalesce((v_summary->>'canLeave')::boolean, true) is not false
     or v_summary->>'leaveBlockedReason' <> 'notebook_photos' then
    raise exception 'photo-owning member summary did not block leave: %', v_summary;
  end if;

  v_rejected := false;
  begin
    perform public.leave_family('fa000000-0000-4000-8000-000000000010');
  exception when others then
    if position('member_has_notebook_photos' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'member with a referenced notebook photo unexpectedly left'; end if;

  delete from public.timeline_events
  where id = 'fa000000-0000-4000-8000-000000000301';
  perform public.leave_family('fa000000-0000-4000-8000-000000000010');

  perform set_config('request.jwt.claim.sub', 'fa000000-0000-4000-8000-000000000003', true);
  v_rejected := false;
  begin
    perform public.remove_family_member(
      'fa000000-0000-4000-8000-000000000010',
      'fa000000-0000-4000-8000-000000000106'
    );
  exception when others then
    if position('member_has_notebook_photos' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'member with a referenced notebook photo was unexpectedly removed'; end if;

  delete from public.timeline_events
  where id = 'fa000000-0000-4000-8000-000000000302';
  perform public.remove_family_member(
    'fa000000-0000-4000-8000-000000000010',
    'fa000000-0000-4000-8000-000000000106'
  );

  v_rejected := false;
  begin
    perform public.leave_family('fa000000-0000-4000-8000-000000000010');
  exception when others then
    if position('owner_must_transfer_before_leaving' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'current owner leave unexpectedly succeeded'; end if;

  perform set_config('request.jwt.claim.sub', 'fb000000-0000-4000-8000-000000000002', true);
  perform public.leave_family('fb000000-0000-4000-8000-000000000010');

  -- A non-primary legacy role='owner' was normalized to admin by the migration
  -- and must have a normal exit instead of becoming permanently trapped.
  perform set_config('request.jwt.claim.sub', 'fc000000-0000-4000-8000-000000000002', true);
  perform public.leave_family('fc000000-0000-4000-8000-000000000010');
end;
$family_management_test$;

reset role;

do $family_management_assert$
declare
  v_count integer;
  v_owner uuid;
  v_status text;
begin
  select owner_user_id into v_owner
  from public.families
  where id = 'fa000000-0000-4000-8000-000000000010';
  if v_owner <> 'fa000000-0000-4000-8000-000000000003' then
    raise exception 'ownership pointer was not transferred: %', v_owner;
  end if;

  select count(*) into v_count
  from public.family_members
  where family_id = 'fa000000-0000-4000-8000-000000000010'
    and role = 'owner'
    and user_id = 'fa000000-0000-4000-8000-000000000003';
  if v_count <> 1 then raise exception 'new current owner membership count is %', v_count; end if;

  select count(*) into v_count
  from public.family_members
  where family_id = 'fa000000-0000-4000-8000-000000000010'
    and role = 'owner';
  if v_count <> 1 then raise exception 'family A has % role owners after transfer', v_count; end if;

  select count(*) into v_count
  from public.family_members
  where id in (
    'fa000000-0000-4000-8000-000000000104',
    'fa000000-0000-4000-8000-000000000105',
    'fa000000-0000-4000-8000-000000000106',
    'fb000000-0000-4000-8000-000000000102'
  );
  if v_count <> 0 then raise exception 'removed/left memberships still present: %', v_count; end if;

  select count(*) into v_count
  from public.family_members
  where id in (
    'fa000000-0000-4000-8000-000000000103',
    'fb000000-0000-4000-8000-000000000101'
  );
  if v_count <> 2 then raise exception 'a family lost its current owner'; end if;

  select count(*) into v_count
  from public.family_members
  where family_id = 'fc000000-0000-4000-8000-000000000010'
    and (
      (user_id = 'fc000000-0000-4000-8000-000000000001' and role = 'owner')
      or user_id = 'fc000000-0000-4000-8000-000000000002'
    );
  if v_count <> 1 then raise exception 'legacy co-owner normalization/exit left % unexpected rows', v_count; end if;

  select status into v_status
  from public.family_invites
  where id = 'fa000000-0000-4000-8000-000000000201';
  if v_status <> 'cancelled' then raise exception 'family A invite status is %', v_status; end if;

  select status into v_status
  from public.family_invites
  where id = 'fb000000-0000-4000-8000-000000000201';
  if v_status <> 'pending' then raise exception 'cross-family invite was changed to %', v_status; end if;

  if has_table_privilege('authenticated', 'public.family_members', 'insert')
     or has_table_privilege('authenticated', 'public.family_members', 'update')
     or has_table_privilege('authenticated', 'public.family_members', 'delete') then
    raise exception 'authenticated retained a direct family_members write privilege';
  end if;
  if has_table_privilege('authenticated', 'public.families', 'update') then
    raise exception 'authenticated retained a direct families update privilege';
  end if;

  if has_function_privilege('anon', 'public.transfer_family_ownership(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.remove_family_member(uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.leave_family(uuid)', 'execute')
     or has_function_privilege('anon', 'public.cancel_family_invite(uuid,uuid)', 'execute') then
    raise exception 'anon retained a family-management RPC execute privilege';
  end if;
  if has_function_privilege('anon', 'public.get_family_management_summary(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.get_family_management_summary(uuid)', 'execute') then
    raise exception 'family summary RPC ACL is incorrect';
  end if;
  if has_function_privilege('authenticated', 'public.promote_family_member_to_owner(uuid)', 'execute')
     or has_function_privilege('anon', 'public.promote_family_member_to_owner(uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.promote_family_member_to_owner(uuid)', 'execute') then
    raise exception 'deprecated owner promotion RPC ACL was reopened';
  end if;
end;
$family_management_assert$;

rollback;
