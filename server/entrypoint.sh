#!/bin/sh

echo "Starting application..."
echo "DATABASE_URL set: $(test -n "$DATABASE_URL" && echo 'yes' || echo 'NO - MISSING!')"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: ${PORT:-4000}"

# Only use SQLite if the service is explicitly configured for SQLite.
# Never override a valid Postgres DATABASE_URL on Render.
if [ "${DATABASE_PROVIDER:-postgresql}" = "sqlite" ] && [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/tmp/verdexis-render.db"
  echo "SQLite fallback enabled: $DATABASE_URL"
fi

# Attempt to resolve failed migrations (with timeout, non-blocking)
echo "Checking for failed migrations..."
# Try several likely locations because working dir may differ in some runtimes
found_resolver=0
for p in "./scripts/resolve-failed-migration.js" "server/scripts/resolve-failed-migration.js" "/app/server/scripts/resolve-failed-migration.js"; do
  if [ -f "$p" ]; then
    echo "Found resolver at $p"
    timeout 20 node "$p" || {
      EXIT_CODE=$?
      if [ $EXIT_CODE -eq 124 ]; then
        echo "⚠ Migration resolver timed out (skipping)"
      elif [ $EXIT_CODE -ne 0 ]; then
        echo "⚠ Migration resolver failed with code $EXIT_CODE (continuing)"
      fi
    }
    found_resolver=1
    break
  fi
done

if [ $found_resolver -eq 0 ]; then
  echo "⚠ Migration resolver not found in expected locations; continuing startup"
fi

run_migrations() {
  echo "Checking for failed migrations..."
  timeout 20 node ./scripts/resolve-failed-migration.js || {
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 124 ]; then
      echo "⚠ Migration resolver timed out (skipping)"
    elif [ $EXIT_CODE -ne 0 ]; then
      echo "⚠ Migration resolver failed with code $EXIT_CODE (continuing)"
    fi
  }

  if [ "$DATABASE_PROVIDER" = "sqlite" ] || [ "$DATABASE_URL" = "" ]; then
    echo "Using SQLite fallback; skipping Prisma migrate deploy"
    return 0
  fi

  echo "Running Prisma migrations..."
  MAX_RETRIES=3
  RETRY=0
  MIGRATION_SUCCESS=0

  while [ $RETRY -lt $MAX_RETRIES ]; do
    echo "Migration attempt $((RETRY + 1))/$MAX_RETRIES..."

    # Increased timeout to 180s (3 minutes) to allow for slow database initialization
    timeout 180 npx prisma migrate deploy --schema prisma/schema.prisma 2>&1
    EXIT_CODE=$?

    if [ $EXIT_CODE -eq 0 ]; then
      echo "✓ Migrations completed successfully"
      MIGRATION_SUCCESS=1
      break
    elif [ $EXIT_CODE -eq 124 ]; then
      echo "⚠ Attempt $((RETRY + 1)) timed out - retrying..."
      RETRY=$((RETRY + 1))
      sleep 5
    else
      # Non-timeout error
      if [ $RETRY -lt $((MAX_RETRIES - 1)) ]; then
        echo "⚠ Attempt $((RETRY + 1)) failed with code $EXIT_CODE - retrying..."
        RETRY=$((RETRY + 1))
        sleep 5
      else
        echo "⚠ Final migration attempt failed - continuing startup"
        break
      fi
    fi
  done

  if [ $MIGRATION_SUCCESS -eq 1 ]; then
    echo "✓ Database schema ready"
  else
    echo "⚠ Migrations may not have completed - database tables may not exist"
  fi
}

# If running with SQLite at runtime (fallback), ensure the runtime SQLite file has the schema.
if [ "$DATABASE_PROVIDER" = "sqlite" ]; then
  echo "Applying Prisma schema to runtime SQLite database at $DATABASE_URL"
  # Use the sqlite schema file generated at build time (schema.sqlite.prisma exists in image)
  timeout 120 npx prisma db push --schema prisma/schema.sqlite.prisma || {
    echo "⚠ prisma db push failed - continuing startup"
  }
fi

# Kick off migrations in the background so the web process can bind the port promptly.
echo "Starting server and running migrations in the background..."
run_migrations &

# Start the server (use exec to replace this process)
exec node dist/index.js
