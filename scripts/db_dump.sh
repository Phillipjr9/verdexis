#!/usr/bin/env bash
set -euo pipefail

# Usage example:
# OLD_HOST=old.example.com OLD_PORT=5432 OLD_DB=mydb OLD_USER=postgres OUTPUT_FILE=dump.pg ./scripts/db_dump.sh
# For IAM auth set USE_IAM_AUTH=true and ensure AWS creds are configured.

: ${OLD_HOST:?Missing OLD_HOST}
: ${OLD_PORT:=5432}
: ${OLD_DB:?Missing OLD_DB}
: ${OLD_USER:=postgres}
: ${OUTPUT_FILE:=dump.pg}

if [ "${USE_IAM_AUTH:-false}" = "true" ]; then
  : ${AWS_REGION:?Missing AWS_REGION for IAM auth}
  echo "Generating IAM auth token for $OLD_USER@$OLD_HOST:$OLD_PORT"
  TOKEN=$(aws rds generate-db-auth-token --hostname "$OLD_HOST" --port "$OLD_PORT" --username "$OLD_USER" --region "$AWS_REGION")
  export PGPASSWORD="$TOKEN"
  echo "(IAM token generated — it will expire in ~15 minutes)"
elif [ -n "${PGPASSWORD:-}" ]; then
  echo "Using PGPASSWORD from environment"
else
  echo "No PGPASSWORD provided and USE_IAM_AUTH not set. Provide PGPASSWORD or enable IAM auth." >&2
  exit 1
fi

echo "Running pg_dump against $OLD_HOST:$OLD_PORT/$OLD_DB"
pg_dump -Fc -h "$OLD_HOST" -p "$OLD_PORT" -U "$OLD_USER" -d "$OLD_DB" -f "$OUTPUT_FILE" --no-owner

echo "Dump saved to $OUTPUT_FILE"
