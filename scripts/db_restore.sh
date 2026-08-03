#!/usr/bin/env bash
set -euo pipefail

# Usage example:
# TARGET_HOST=database-1.cluster... TARGET_PORT=5432 TARGET_DB=postgres TARGET_USER=postgres INPUT_FILE=dump.pg ./scripts/db_restore.sh
# For IAM auth set USE_IAM_AUTH=true and ensure AWS creds are configured.

: ${TARGET_HOST:?Missing TARGET_HOST}
: ${TARGET_PORT:=5432}
: ${TARGET_DB:=postgres}
: ${TARGET_USER:=postgres}
: ${INPUT_FILE:?Missing INPUT_FILE}

if [ "${USE_IAM_AUTH:-false}" = "true" ]; then
  : ${AWS_REGION:?Missing AWS_REGION for IAM auth}
  echo "Generating IAM auth token for $TARGET_USER@$TARGET_HOST:$TARGET_PORT"
  TOKEN=$(aws rds generate-db-auth-token --hostname "$TARGET_HOST" --port "$TARGET_PORT" --username "$TARGET_USER" --region "$AWS_REGION")
  export PGPASSWORD="$TOKEN"
  echo "(IAM token generated — it will expire in ~15 minutes)"
elif [ -n "${PGPASSWORD:-}" ]; then
  echo "Using PGPASSWORD from environment"
else
  echo "No PGPASSWORD provided and USE_IAM_AUTH not set. Provide PGPASSWORD or enable IAM auth." >&2
  exit 1
fi

echo "Waiting for target DB to accept connections..."
until pg_isready -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" >/dev/null 2>&1; do
  sleep 3
done

echo "Restoring $INPUT_FILE into $TARGET_HOST:$TARGET_PORT/$TARGET_DB"
pg_restore -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d "$TARGET_DB" -v "$INPUT_FILE"

echo "Restore complete"
