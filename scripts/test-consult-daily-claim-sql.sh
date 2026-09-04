#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGRESSION_CONTAINER_NAME="oyano-consult-daily-${GITHUB_RUN_ID:-local}-$$"

case "$REGRESSION_CONTAINER_NAME" in
  oyano-consult-daily-*) ;;
  *)
    echo "Refusing unexpected regression container name" >&2
    exit 1
    ;;
esac

cleanup() {
  docker stop "$REGRESSION_CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker run --rm --detach \
  --name "$REGRESSION_CONTAINER_NAME" \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:16-bookworm >/dev/null

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

run_sql supabase/ai_consult_memory_regression_bootstrap.sql
run_sql supabase/schema.sql
run_sql supabase/api_grants.sql
run_sql supabase/consult_daily_claim.sql
# A later broad grant bootstrap must not reopen the server-only ledger/RPCs.
run_sql supabase/api_grants.sql
run_sql supabase/consult_daily_claim.sql
run_sql supabase/consult_daily_claim_regression.sql

echo "AI consultation daily claim PostgreSQL regression: ok"
