#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGRESSION_CONTAINER_NAME="oyano-account-erasure-${GITHUB_RUN_ID:-local}-$$"

case "$REGRESSION_CONTAINER_NAME" in
  oyano-account-erasure-*) ;;
  *) echo "Refusing unexpected regression container name" >&2; exit 1 ;;
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

run_policy_sql() {
  node "$REPO_ROOT/scripts/render-delete-operator-policy-sql.mjs" "$1" |
    docker exec -i "$REGRESSION_CONTAINER_NAME" \
      psql -v ON_ERROR_STOP=1 -U postgres -d postgres
}

run_sql supabase/ai_consult_memory_regression_bootstrap.sql
run_sql supabase/family_role_rls_regression_bootstrap.sql
run_sql supabase/account_erasure_regression_bootstrap.sql
run_sql supabase/schema.sql
run_sql supabase/api_grants.sql
run_sql supabase/production_rls.sql
run_sql supabase/account_delete_executor_schema_regression.sql
run_sql supabase/notebook_atomic_sync_v2.sql
run_sql supabase/ai_consult_memory.sql
run_sql supabase/notebook_diary_delete.sql
run_sql supabase/consult_daily_claim.sql
run_sql supabase/notebook_person_delete.sql
run_sql supabase/admin_auth_hardening.sql
run_sql supabase/account_delete_executor_role.sql
run_sql supabase/account_delete_executor_role.sql
run_sql supabase/account_delete_identity_ledger.sql
run_sql supabase/account_deletion_pipeline.sql
run_sql supabase/account_deletion_pipeline.sql
run_sql supabase/account_erasure_execution_gate_regression_bootstrap.sql
run_sql supabase/account_erasure_execution_gate.sql
run_sql supabase/account_erasure_execution_gate.sql
# Later broad/base bootstraps must not reopen the legacy destructive RPC or
# replace the expiring prepared-write guards with a permanent freeze.
run_sql supabase/account_deletion_pipeline.sql
run_sql supabase/api_grants.sql
run_sql supabase/account_erasure_execution_gate.sql
run_sql supabase/account_delete_identity_ledger_regression.sql
run_sql supabase/account_erasure_regression.sql
run_sql supabase/account_delete_operator_provisioning_regression_bootstrap.sql
run_policy_sql provision
run_policy_sql activate
run_sql supabase/account_delete_operator_provisioning_regression.sql

echo "Verified account erasure PostgreSQL regression: ok"
