#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGRESSION_CONTAINER_NAME="oyano-family-management-${GITHUB_RUN_ID:-local}-$$"

case "$REGRESSION_CONTAINER_NAME" in
  oyano-family-management-*) ;;
  *)
    echo "Refusing unexpected regression container name" >&2
    exit 1
    ;;
esac

cleanup() {
  docker stop "$REGRESSION_CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker run --pull=never --network=none --rm --detach \
  --name "$REGRESSION_CONTAINER_NAME" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  docker.io/library/postgres:16-bookworm >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$REGRESSION_CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$REGRESSION_CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
  echo "Disposable PostgreSQL did not become ready" >&2
  exit 1
fi

run_sql() {
  docker exec -i "$REGRESSION_CONTAINER_NAME" \
    psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$REPO_ROOT/$1"
}

run_inline_sql() {
  docker exec -i "$REGRESSION_CONTAINER_NAME" \
    psql -v ON_ERROR_STOP=1 -U postgres -d postgres
}

wait_for_database_sleep() {
  local marker="$1"
  for _ in $(seq 1 80); do
    if [ "$(docker exec "$REGRESSION_CONTAINER_NAME" psql -At -U postgres -d postgres -c \
      "select exists (select 1 from pg_stat_activity where pid <> pg_backend_pid() and application_name = '$marker' and state = 'active' and wait_event = 'PgSleep');")" = "t" ]; then
      return 0
    fi
    sleep 0.05
  done
  echo "Timed out waiting for database race barrier: $marker" >&2
  return 1
}

run_sql supabase/ai_consult_memory_regression_bootstrap.sql
run_sql supabase/family_role_rls_regression_bootstrap.sql
run_sql supabase/schema.sql
run_sql supabase/api_grants.sql
run_sql supabase/production_rls.sql
run_sql supabase/notebook_atomic_sync_v2.sql
run_sql supabase/create_initial_family_person.sql
run_sql supabase/family_invite_rpc.sql
run_sql supabase/admin_auth_hardening.sql
run_sql supabase/family_management_legacy_bootstrap.sql
run_sql supabase/notebook_diary_delete.sql
run_sql supabase/notebook_diary_delete.sql
run_sql supabase/family_management_rpc.sql
# The production migration is explicitly rerunnable.
run_sql supabase/family_management_rpc.sql
# Historical bundles and the broad grant bootstrap may be reapplied later.
# Each one must keep the deprecated memberId-only owner promotion closed.
run_sql supabase/family_owner_succession.sql
run_sql supabase/production_pending_hardening.sql
run_sql supabase/api_grants.sql
run_sql supabase/family_invite_contract_regression.sql
run_sql supabase/family_first_creation_concurrency_setup.sql

docker exec "$REGRESSION_CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "begin; set local role authenticated; select set_config('request.jwt.claim.sub', 'fd000000-0000-4000-8000-000000000001', true); select set_config('request.jwt.claims', '{\"email\":\"concurrent-first-family@example.test\"}', true); select public.create_initial_family_person('Concurrent parent', 'parent', 'preparing'); commit;" &
MOBILE_FIRST_PID=$!

docker exec "$REGRESSION_CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "begin; set local role service_role; select set_config('request.jwt.claim.role', 'service_role', true); select public.sync_notebook_v2('fd000000-0000-4000-8000-000000000001', 'concurrent-first-family@example.test', null, true, '[]'::jsonb, '[]'::jsonb, 'fd000000-0000-4000-8000-000000000901'); commit;" &
WEB_FIRST_PID=$!

wait "$MOBILE_FIRST_PID"
wait "$WEB_FIRST_PID"
run_sql supabase/family_first_creation_concurrency_assert.sql

run_sql supabase/family_invite_capacity_concurrency_setup.sql

docker exec "$REGRESSION_CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "begin; set local role authenticated; select set_config('request.jwt.claim.sub', 'fe000000-0000-4000-8000-000000000001', true); select public.create_family_invite('fe000000-0000-4000-8000-000000000010', 'invite-one@example.test', 'member', 'one'); commit;" &
INVITE_ONE_PID=$!
docker exec "$REGRESSION_CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "begin; set local role authenticated; select set_config('request.jwt.claim.sub', 'fe000000-0000-4000-8000-000000000001', true); select public.create_family_invite('fe000000-0000-4000-8000-000000000010', 'invite-two@example.test', 'member', 'two'); commit;" &
INVITE_TWO_PID=$!

if wait "$INVITE_ONE_PID"; then INVITE_ONE_STATUS=0; else INVITE_ONE_STATUS=$?; fi
if wait "$INVITE_TWO_PID"; then INVITE_TWO_STATUS=0; else INVITE_TWO_STATUS=$?; fi
if ! { { [ "$INVITE_ONE_STATUS" -eq 0 ] && [ "$INVITE_TWO_STATUS" -ne 0 ]; } || { [ "$INVITE_ONE_STATUS" -ne 0 ] && [ "$INVITE_TWO_STATUS" -eq 0 ]; }; }; then
  echo "Expected exactly one concurrent invite create to succeed; statuses=$INVITE_ONE_STATUS,$INVITE_TWO_STATUS" >&2
  exit 1
fi

docker exec "$REGRESSION_CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "begin; set local role authenticated; select set_config('request.jwt.claim.sub', 'ff000000-0000-4000-8000-000000000002', true); select public.accept_family_invite('concurrent-accept-one'); commit;" &
ACCEPT_ONE_PID=$!
docker exec "$REGRESSION_CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c \
  "begin; set local role authenticated; select set_config('request.jwt.claim.sub', 'ff000000-0000-4000-8000-000000000003', true); select public.accept_family_invite('concurrent-accept-two'); commit;" &
ACCEPT_TWO_PID=$!

if wait "$ACCEPT_ONE_PID"; then ACCEPT_ONE_STATUS=0; else ACCEPT_ONE_STATUS=$?; fi
if wait "$ACCEPT_TWO_PID"; then ACCEPT_TWO_STATUS=0; else ACCEPT_TWO_STATUS=$?; fi
if ! { { [ "$ACCEPT_ONE_STATUS" -eq 0 ] && [ "$ACCEPT_TWO_STATUS" -ne 0 ]; } || { [ "$ACCEPT_ONE_STATUS" -ne 0 ] && [ "$ACCEPT_TWO_STATUS" -eq 0 ]; }; }; then
  echo "Expected exactly one concurrent invite accept to succeed; statuses=$ACCEPT_ONE_STATUS,$ACCEPT_TWO_STATUS" >&2
  exit 1
fi

run_sql supabase/family_invite_capacity_concurrency_assert.sql

# Cancel and accept use the same notebook-family lock. Exercise both commit
# orders so a pending token can never be both accepted and cancelled.
run_inline_sql <<'SQL'
insert into auth.users (id, email) values
  ('f9000000-0000-4000-8000-000000000001', 'invite-race-owner@example.test'),
  ('f9000000-0000-4000-8000-000000000002', 'invite-race-cancel@example.test'),
  ('f9000000-0000-4000-8000-000000000003', 'invite-race-accept@example.test');
insert into public.profiles (id, email) select id, email from auth.users
where id::text like 'f9000000-%';
insert into public.families (id, name, owner_user_id, plan) values
  ('f9000000-0000-4000-8000-000000000010', 'Cancel first', 'f9000000-0000-4000-8000-000000000001', 'plus'),
  ('f9000000-0000-4000-8000-000000000011', 'Accept first', 'f9000000-0000-4000-8000-000000000001', 'plus');
insert into public.family_members (family_id, user_id, role) values
  ('f9000000-0000-4000-8000-000000000010', 'f9000000-0000-4000-8000-000000000001', 'owner'),
  ('f9000000-0000-4000-8000-000000000011', 'f9000000-0000-4000-8000-000000000001', 'owner');
insert into public.family_invites (
  id, family_id, invited_email, role, token, status, expires_at, created_by
) values
  (
    'f9000000-0000-4000-8000-000000000020', 'f9000000-0000-4000-8000-000000000010',
    'invite-race-cancel@example.test', 'viewer', 'cancel-wins-token', 'pending', now() + interval '7 days',
    'f9000000-0000-4000-8000-000000000001'
  ),
  (
    'f9000000-0000-4000-8000-000000000021', 'f9000000-0000-4000-8000-000000000011',
    'invite-race-accept@example.test', 'member', 'accept-wins-token', 'pending', now() + interval '7 days',
    'f9000000-0000-4000-8000-000000000001'
  );
SQL

run_inline_sql <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f9000000-0000-4000-8000-000000000001', true);
select set_config('application_name', 'family-race-cancel-first', true);
select public.cancel_family_invite(
  'f9000000-0000-4000-8000-000000000010',
  'f9000000-0000-4000-8000-000000000020'
);
select pg_sleep(2);
commit;
SQL
CANCEL_FIRST_PID=$!
wait_for_database_sleep "family-race-cancel-first"

run_inline_sql <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f9000000-0000-4000-8000-000000000002', true);
do $cancel_first_accept$
begin
  begin
    perform public.accept_family_invite('cancel-wins-token');
    raise exception 'cancel-first token was also accepted';
  exception when others then
    if position('invite_invalid_or_expired' in sqlerrm) = 0 then raise; end if;
  end;
end;
$cancel_first_accept$;
commit;
SQL
wait "$CANCEL_FIRST_PID"

run_inline_sql <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f9000000-0000-4000-8000-000000000003', true);
select set_config('application_name', 'family-race-accept-first', true);
select public.accept_family_invite('accept-wins-token');
select pg_sleep(5);
commit;
SQL
ACCEPT_FIRST_PID=$!
wait_for_database_sleep "family-race-accept-first"

run_inline_sql <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f9000000-0000-4000-8000-000000000001', true);
do $accept_first_cancel$
begin
  begin
    perform public.cancel_family_invite(
      'f9000000-0000-4000-8000-000000000011',
      'f9000000-0000-4000-8000-000000000021'
    );
    raise exception 'accepted token was also cancelled';
  exception when others then
    if position('invite_not_pending' in sqlerrm) = 0 then raise; end if;
  end;
end;
$accept_first_cancel$;
commit;
SQL
wait "$ACCEPT_FIRST_PID"

run_inline_sql <<'SQL'
do $invite_race_assert$
begin
  if (select status from public.family_invites where id = 'f9000000-0000-4000-8000-000000000020') <> 'cancelled'
     or exists (
       select 1 from public.family_members
       where family_id = 'f9000000-0000-4000-8000-000000000010'
         and user_id = 'f9000000-0000-4000-8000-000000000002'
     ) then
    raise exception 'cancel-first invite race left inconsistent state';
  end if;
  if (select status from public.family_invites where id = 'f9000000-0000-4000-8000-000000000021') <> 'accepted'
     or not exists (
       select 1 from public.family_members
       where family_id = 'f9000000-0000-4000-8000-000000000011'
         and user_id = 'f9000000-0000-4000-8000-000000000003'
         and role = 'member'
     ) then
    raise exception 'accept-first invite race left inconsistent state';
  end if;
end;
$invite_race_assert$;
SQL

run_sql supabase/family_management_regression.sql
run_sql supabase/family_management_photo_race_setup.sql

# Photo reference commits first: removal waits for the same family lock and
# must then see the real object-backed diary attachment.
run_inline_sql <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000002', true);
select set_config('application_name', 'family-race-photo-first', true);
insert into public.timeline_events (
  id, person_id, event_type, event_date, title, body, attachments, metadata, created_by
) values (
  'f1000000-0000-4000-8000-000000000030',
  'f1000000-0000-4000-8000-000000000020',
  'diary', current_date, 'Photo wins', 'race',
  '[{"storageBucket":"home-photos","storagePath":"notebook/f1000000-0000-4000-8000-000000000002/race.jpg"}]',
  '{"localCaseId":"race-insert-case","localDiaryId":"race-insert-diary"}',
  'f1000000-0000-4000-8000-000000000002'
);
select pg_sleep(2);
commit;
SQL
PHOTO_FIRST_PID=$!
wait_for_database_sleep "family-race-photo-first"

run_inline_sql <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-4000-8000-000000000001', true);
do $photo_first_remove$
declare
  v_rejected boolean := false;
begin
  begin
    perform public.remove_family_member(
      'f1000000-0000-4000-8000-000000000010',
      'f1000000-0000-4000-8000-000000000102'
    );
  exception when others then
    if position('member_has_notebook_photos' in sqlerrm) = 0 then raise; end if;
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'photo-first race unexpectedly removed the uploader';
  end if;
end;
$photo_first_remove$;
commit;
SQL
wait "$PHOTO_FIRST_PID"

# Removal commits first: a direct authenticated INSERT may start while the
# remover still holds the lock, but must fail RLS after the lock is released.
run_inline_sql <<'SQL' &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2000000-0000-4000-8000-000000000001', true);
select set_config('application_name', 'family-race-removal-first', true);
select public.remove_family_member(
  'f2000000-0000-4000-8000-000000000010',
  'f2000000-0000-4000-8000-000000000102'
);
select pg_sleep(2);
commit;
SQL
REMOVAL_FIRST_PID=$!
wait_for_database_sleep "family-race-removal-first"

run_inline_sql <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f2000000-0000-4000-8000-000000000002', true);
do $removal_first_insert$
declare
  v_rejected boolean := false;
begin
  begin
    insert into public.timeline_events (
      id, person_id, event_type, event_date, title, body, attachments, metadata, created_by
    ) values (
      'f2000000-0000-4000-8000-000000000030',
      'f2000000-0000-4000-8000-000000000020',
      'diary', current_date, 'Late photo', 'race',
      '[{"storageBucket":"home-photos","storagePath":"notebook/f2000000-0000-4000-8000-000000000002/race.jpg"}]',
      '{"localCaseId":"race-remove-case","localDiaryId":"race-remove-diary"}',
      'f2000000-0000-4000-8000-000000000002'
    );
  exception when insufficient_privilege then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'removal-first race accepted a late uploader diary';
  end if;
end;
$removal_first_insert$;
commit;
SQL
wait "$REMOVAL_FIRST_PID"
run_sql supabase/family_management_photo_race_assert.sql

echo "Family management PostgreSQL regression: ok"
