#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGRESSION_CONTAINER_NAME="oyano-diary-delete-${GITHUB_RUN_ID:-local}-$$"

case "$REGRESSION_CONTAINER_NAME" in
  oyano-diary-delete-*) ;;
  *) echo "Refusing unexpected regression container name" >&2; exit 1 ;;
esac

cleanup() { docker stop "$REGRESSION_CONTAINER_NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM

docker run --pull=never --network=none --rm --detach --name "$REGRESSION_CONTAINER_NAME" \
  -e POSTGRES_HOST_AUTH_METHOD=trust docker.io/library/postgres:16-bookworm >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$REGRESSION_CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$REGRESSION_CONTAINER_NAME" pg_isready -U postgres >/dev/null

run_sql() {
  docker exec -i "$REGRESSION_CONTAINER_NAME" psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$REPO_ROOT/$1"
}

run_sql supabase/ai_consult_memory_regression_bootstrap.sql
run_sql supabase/schema.sql
run_sql supabase/api_grants.sql
run_sql supabase/production_rls.sql
run_sql supabase/notebook_atomic_sync_v2.sql
run_sql supabase/ai_consult_memory.sql
run_sql supabase/notebook_diary_delete.sql
run_sql supabase/notebook_diary_delete.sql
run_sql supabase/notebook_diary_delete_regression.sql

echo "Notebook diary deletion PostgreSQL regression: ok"
