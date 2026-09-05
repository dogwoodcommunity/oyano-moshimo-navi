#!/usr/bin/env bash
set -euo pipefail
RECONCILIATION_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RECONCILIATION_CONTAINER="oyano-reconciliation-local-$$"
RECONCILIATION_DOCKER_HOST="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
case "$RECONCILIATION_DOCKER_HOST" in unix:///*) ;; *) echo "Local Docker required" >&2; exit 1;; esac
export DOCKER_HOST="$RECONCILIATION_DOCKER_HOST"
cleanup() { docker stop "$RECONCILIATION_CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
docker run --pull=never --network=none --rm --detach --name "$RECONCILIATION_CONTAINER" \
  -e POSTGRES_HOST_AUTH_METHOD=trust docker.io/library/postgres:16-bookworm >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$RECONCILIATION_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$RECONCILIATION_CONTAINER" pg_isready -U postgres >/dev/null
for migration in ai_consult_memory_regression_bootstrap schema api_grants production_rls notebook_atomic_sync_v2 ai_consult_memory notebook_diary_delete consult_daily_claim notebook_person_delete notebook_diary_reconciliation; do
  docker exec -i "$RECONCILIATION_CONTAINER" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$RECONCILIATION_ROOT/supabase/$migration.sql"
done
# Reapplying the broad bootstrap grants must not expose the new RPC to clients.
docker exec -i "$RECONCILIATION_CONTAINER" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$RECONCILIATION_ROOT/supabase/api_grants.sql"
docker exec -i "$RECONCILIATION_CONTAINER" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$RECONCILIATION_ROOT/supabase/notebook_diary_reconciliation.sql"
docker exec -i "$RECONCILIATION_CONTAINER" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres < "$RECONCILIATION_ROOT/supabase/notebook_reconciliation_regression.sql"
echo "Notebook reconciliation PostgreSQL regression: ok (disposable local DB only)"
