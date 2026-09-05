#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGRESSION_CONTAINER_NAME="oyano-monthly-checkin-${GITHUB_RUN_ID:-local}-$$"

case "$REGRESSION_CONTAINER_NAME" in
  oyano-monthly-checkin-*) ;;
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

docker cp \
  "$REPO_ROOT/supabase/monthly_checkin_notifications.sql" \
  "$REGRESSION_CONTAINER_NAME:/tmp/monthly_checkin_notifications.sql"
docker cp \
  "$REPO_ROOT/supabase/notification_email_delivery.sql" \
  "$REGRESSION_CONTAINER_NAME:/tmp/notification_email_delivery.sql"
docker cp \
  "$REPO_ROOT/supabase/monthly_checkin_notifications_regression.sql" \
  "$REGRESSION_CONTAINER_NAME:/tmp/monthly_checkin_notifications_regression.sql"

docker exec "$REGRESSION_CONTAINER_NAME" \
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -f /tmp/monthly_checkin_notifications_regression.sql

echo "Monthly check-in notification PostgreSQL regression: ok"
