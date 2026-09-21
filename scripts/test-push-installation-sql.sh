#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGRESSION_CONTAINER_NAME="oyano-push-installation-${GITHUB_RUN_ID:-local}-$$"
REGRESSION_DATABASE_NAME=postgres
REGRESSION_LOG_DIR="$(mktemp -d /tmp/oyano-push-installation.XXXXXX)"
case "$REGRESSION_CONTAINER_NAME" in
  oyano-push-installation-*) ;;
  *) echo "Refusing unexpected regression container name" >&2; exit 1 ;;
esac
cleanup() { docker stop "$REGRESSION_CONTAINER_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

docker run --pull=never --network=none --rm --detach \
  --name "$REGRESSION_CONTAINER_NAME" -e POSTGRES_HOST_AUTH_METHOD=trust \
  docker.io/library/postgres:16-bookworm >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$REGRESSION_CONTAINER_NAME" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! docker exec "$REGRESSION_CONTAINER_NAME" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then
  echo "Disposable PostgreSQL did not become ready" >&2; exit 1
fi
run_sql() {
  docker exec -i -e PGOPTIONS='-c client_min_messages=warning -c statement_timeout=10000' "$REGRESSION_CONTAINER_NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$REGRESSION_DATABASE_NAME" < "$REPO_ROOT/$1"
}
run_query() {
  docker exec -e PGOPTIONS='-c client_min_messages=warning -c statement_timeout=10000' "$REGRESSION_CONTAINER_NAME" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$REGRESSION_DATABASE_NAME" -c "$1"
}
run_sql supabase/ai_consult_memory_regression_bootstrap.sql
run_sql supabase/family_role_rls_regression_bootstrap.sql
run_sql supabase/schema.sql
run_sql supabase/api_grants.sql
run_sql supabase/production_rls.sql
run_query "insert into auth.users(id,email) values ('a1100000-0000-4000-8000-000000000004','push-legacy@example.test');
insert into public.profiles(id,email) values ('a1100000-0000-4000-8000-000000000004','push-legacy@example.test');
insert into public.push_tokens(id,user_id,expo_push_token,platform,device_name,is_active,created_at,updated_at) values
('a1400000-0000-4000-8000-000000000001','a1100000-0000-4000-8000-000000000004','ExpoPushToken[legacy-active]','ios','legacy-fixture',true,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z'),
('a1400000-0000-4000-8000-000000000002','a1100000-0000-4000-8000-000000000004','ExpoPushToken[legacy-inactive]','ios','legacy-fixture',false,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z');"
run_sql supabase/push_installation_protocol.sql
run_sql supabase/push_installation_protocol.sql
# A routine base ACL reapplication must not reopen either the old direct DML
# path or service-only RPCs to general authenticated clients.
run_sql supabase/api_grants.sql
run_sql supabase/push_installation_protocol_regression.sql

# Independent psql connections overlap while the first operation's transaction
# still owns its locks. Observe PgSleep before starting the competing request.
run_concurrent_case() {
  local case_name="$1" first_sql="$2" second_sql="$3"
  local first_pid second_pid ready=false blocked=false
  run_query "set application_name = '$case_name'; begin; $first_sql select pg_sleep(3); commit;" > "$REGRESSION_LOG_DIR/$case_name.first.log" 2>&1 &
  first_pid=$!
  for _ in $(seq 1 40); do
    if [ "$(docker exec "$REGRESSION_CONTAINER_NAME" psql -X -Atq -U postgres -d postgres -c "select exists (select 1 from pg_stat_activity where application_name = '$case_name' and wait_event = 'PgSleep')")" = t ]; then
      ready=true; break
    fi
    if ! kill -0 "$first_pid" 2>/dev/null; then break; fi
    sleep 0.05
  done
  if [ "$ready" != true ]; then
    wait "$first_pid" || true
    sed -n '1,120p' "$REGRESSION_LOG_DIR/$case_name.first.log"
    echo "First concurrency transaction did not reach its held-lock checkpoint: $case_name" >&2
    exit 1
  fi
  run_query "set application_name = '$case_name-competing'; $second_sql" > "$REGRESSION_LOG_DIR/$case_name.second.log" 2>&1 &
  second_pid=$!
  for _ in $(seq 1 40); do
    if [ "$(docker exec "$REGRESSION_CONTAINER_NAME" psql -X -Atq -U postgres -d postgres -c "select exists (select 1 from pg_stat_activity where application_name = '$case_name-competing' and wait_event_type = 'Lock')")" = t ]; then
      blocked=true; break
    fi
    if ! kill -0 "$second_pid" 2>/dev/null; then break; fi
    sleep 0.05
  done
  if [ "$blocked" != true ]; then
    wait "$first_pid" || true
    wait "$second_pid" || true
    sed -n '1,120p' "$REGRESSION_LOG_DIR/$case_name.second.log"
    echo "Competing connection did not overlap a held lock: $case_name" >&2
    exit 1
  fi
  if ! wait "$second_pid"; then
    sed -n '1,120p' "$REGRESSION_LOG_DIR/$case_name.second.log"
    return 1
  fi
  if ! wait "$first_pid"; then
    sed -n '1,120p' "$REGRESSION_LOG_DIR/$case_name.first.log"
    return 1
  fi
}

run_concurrent_case push-register-first \
  "do \$t\$ declare r jsonb; begin r := public.apply_push_installation_operation_v2('a1100000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000101',repeat('1',64),11,'a1300000-0000-4000-8000-000000000101','register','ExpoPushToken[concurrent-register-first]','ios'); if not (r @> '{\"ok\":true,\"state\":\"active\"}') then raise exception 'first register failed: %', r; end if; end; \$t\$;" \
  "do \$t\$ declare r jsonb; begin r := public.apply_push_installation_operation_v2('a1100000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000101',repeat('1',64),12,'a1300000-0000-4000-8000-000000000102','revoke'); if not (r @> '{\"ok\":true,\"revision\":12,\"state\":\"revoked\"}') then raise exception 'competing revoke failed: %', r; end if; end; \$t\$;"
run_concurrent_case push-revoke-first \
  "do \$t\$ declare r jsonb; begin r := public.apply_push_installation_operation_v2('a1100000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000102',repeat('2',64),12,'a1300000-0000-4000-8000-000000000104','revoke'); if not (r @> '{\"ok\":true,\"state\":\"revoked\"}') then raise exception 'first revoke failed: %', r; end if; end; \$t\$;" \
  "do \$t\$ declare r jsonb; begin r := public.apply_push_installation_operation_v2('a1100000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000102',repeat('2',64),11,'a1300000-0000-4000-8000-000000000103','register','ExpoPushToken[concurrent-revoke-first]','ios'); if r->>'error' is distinct from 'stale_revision' then raise exception 'late concurrent register accepted: %', r; end if; end; \$t\$;"
run_concurrent_case push-token-conflict \
  "do \$t\$ declare r jsonb; begin r := public.apply_push_installation_operation_v2('a1100000-0000-4000-8000-000000000001','a1200000-0000-4000-8000-000000000103',repeat('3',64),1,'a1300000-0000-4000-8000-000000000105','register','ExpoPushToken[concurrent-shared-token]','ios'); if not (r @> '{\"ok\":true,\"state\":\"active\"}') then raise exception 'first token claim failed: %', r; end if; end; \$t\$;" \
  "do \$t\$ declare r jsonb; begin r := public.apply_push_installation_operation_v2('a1100000-0000-4000-8000-000000000002','a1200000-0000-4000-8000-000000000104',repeat('4',64),1,'a1300000-0000-4000-8000-000000000106','register','ExpoPushToken[concurrent-shared-token]','android'); if r->>'error' is distinct from 'token_conflict' then raise exception 'concurrent token takeover accepted: %', r; end if; end; \$t\$;"
run_query "do \$t\$ begin
  if (select count(*) from push_private.installations where id in ('a1200000-0000-4000-8000-000000000101','a1200000-0000-4000-8000-000000000102') and revision = 12 and state = 'revoked') <> 2 then raise exception 'concurrent arrival orders did not converge to revoked 12'; end if;
  if exists (select 1 from public.list_deliverable_push_tokens_v2(array['a1100000-0000-4000-8000-000000000001'::uuid]) where installation_id in ('a1200000-0000-4000-8000-000000000101','a1200000-0000-4000-8000-000000000102')) then raise exception 'concurrent revoked installation remained deliverable'; end if;
  if (select count(*) from public.push_tokens where expo_push_token = 'ExpoPushToken[concurrent-shared-token]' and user_id = 'a1100000-0000-4000-8000-000000000001' and is_active) <> 1 then raise exception 'concurrent foreign token owner changed'; end if;
end; \$t\$;"
# The erasure executor uses this exact target lock before deleting profiles.
# Exercise both overlap orders independently of the full executor proof below.
run_query "insert into auth.users(id,email) values
('a1100000-0000-4000-8000-000000000005','push-race-delete-one@example.test'),
('a1100000-0000-4000-8000-000000000006','push-race-delete-two@example.test');
insert into public.profiles(id,email) select id,email from auth.users where id in
('a1100000-0000-4000-8000-000000000005','a1100000-0000-4000-8000-000000000006');"
run_concurrent_case push-register-before-erasure \
  "do \$t\$ declare r jsonb; begin r := public.apply_push_installation_operation_v2('a1100000-0000-4000-8000-000000000005','a1200000-0000-4000-8000-000000000105',repeat('5',64),1,'a1300000-0000-4000-8000-000000000107','register','ExpoPushToken[register-before-erasure]','ios'); if not (r @> '{\"ok\":true}') then raise exception 'registration before erasure failed: %',r; end if; end; \$t\$;" \
  "do \$t\$ begin perform pg_advisory_xact_lock(hashtextextended('account-erasure-target:a1100000-0000-4000-8000-000000000005',0)); delete from public.profiles where id = 'a1100000-0000-4000-8000-000000000005'; end; \$t\$;"
run_query "select public.apply_push_installation_operation_v2('a1100000-0000-4000-8000-000000000006','a1200000-0000-4000-8000-000000000106',repeat('6',64),1,'a1300000-0000-4000-8000-000000000108','register','ExpoPushToken[erasure-before-register]','ios');"
run_concurrent_case push-erasure-before-register \
  "do \$t\$ begin perform pg_advisory_xact_lock(hashtextextended('account-erasure-target:a1100000-0000-4000-8000-000000000006',0)); delete from public.profiles where id = 'a1100000-0000-4000-8000-000000000006'; end; \$t\$;" \
  "do \$t\$ declare r jsonb; begin r := public.apply_push_installation_operation_v2('a1100000-0000-4000-8000-000000000006','a1200000-0000-4000-8000-000000000106',repeat('6',64),2,'a1300000-0000-4000-8000-000000000109','register','ExpoPushToken[erasure-before-register]','ios'); if r->>'error' is distinct from 'profile_unavailable' then raise exception 'concurrent registration resurrected erased profile: %',r; end if; end; \$t\$;"
run_query "do \$t\$ begin
  if (select count(*) from push_private.installations where id in ('a1200000-0000-4000-8000-000000000105','a1200000-0000-4000-8000-000000000106') and revision = 1 and state = 'erased' and owner_id is null and secret_hash is null and request_hash is null) <> 2 then raise exception 'concurrent account erasure did not preserve terminal tombstones'; end if;
  if exists (select 1 from public.push_tokens where user_id in ('a1100000-0000-4000-8000-000000000005','a1100000-0000-4000-8000-000000000006')) then raise exception 'concurrent account erasure retained tokens'; end if;
end; \$t\$;"
# Clone this completed synthetic database; no original erasure-test source is
# modified. Fixture triggers insert v2 registrations for its actual target and
# preserved owner, then assert after the existing executor reaches each phase.
run_query "create database push_erasure template postgres;"
REGRESSION_DATABASE_NAME=push_erasure
run_sql supabase/account_erasure_regression_bootstrap.sql
run_sql supabase/account_delete_executor_schema_regression.sql
run_sql supabase/notebook_atomic_sync_v2.sql
run_sql supabase/ai_consult_memory.sql
run_sql supabase/notebook_diary_delete.sql
run_sql supabase/consult_daily_claim.sql
run_sql supabase/notebook_person_delete.sql
run_sql supabase/admin_auth_hardening.sql
run_sql supabase/account_delete_executor_role.sql
run_sql supabase/account_delete_identity_ledger.sql
run_sql supabase/account_deletion_pipeline.sql
run_sql supabase/account_erasure_execution_gate_regression_bootstrap.sql
run_sql supabase/account_erasure_execution_gate.sql
run_sql supabase/account_deletion_pipeline.sql
run_sql supabase/api_grants.sql
run_sql supabase/account_erasure_execution_gate.sql
run_sql supabase/push_installation_erasure_regression_hooks.sql
run_sql supabase/account_erasure_regression.sql
# Sequence increments survive that regression's intentional fixture rollback,
# proving our assertions ran during both the database and finalizer phases.
run_query "do \$t\$ begin
  if not (select is_called from push_regression.database_erasure_observed)
    or not (select is_called from push_regression.completed_erasure_observed) then
    raise exception 'push erasure integration assertions did not execute';
  end if;
end; \$t\$;"
echo "Verified push installation PostgreSQL regression, five independent-connection races, and existing account-erasure executor integration: ok"
