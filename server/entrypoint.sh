#!/bin/sh

echo "Starting application..."
echo "DATABASE_URL set: $(test -n "$DATABASE_URL" && echo 'yes' || echo 'NO - MISSING!')"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: ${PORT:-4000}"

# Attempt to resolve failed migrations (with timeout, non-blocking)
echo "Checking for failed migrations..."
timeout 20 node scripts/resolve-failed-migration.js || {
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "⚠ Migration resolver timed out (skipping)"
  elif [ $EXIT_CODE -ne 0 ]; then
    echo "⚠ Migration resolver failed with code $EXIT_CODE (continuing)"
  fi
}

# Attempt to run migrations with retry logic
echo "Running Prisma migrations..."
MAX_RETRIES=3
RETRY=0
MIGRATION_SUCCESS=0

while [ $RETRY -lt $MAX_RETRIES ]; do
  echo "Migration attempt $((RETRY + 1))/$MAX_RETRIES..."
  
  # Increased timeout to 180s (3 minutes) to allow for slow database initialization
  timeout 180 npx prisma migrate deploy --schema prisma/schema.prisma
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

# Start the server (use exec to replace this process)
echo "Starting server..."
exec node dist/index.js
