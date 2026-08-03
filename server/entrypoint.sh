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

# Attempt to run migrations (with timeout)
echo "Running Prisma migrations..."
timeout 45 npx prisma migrate deploy --schema prisma/schema.prisma || {
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "⚠ Prisma migrate timed out - possible database connectivity issue"
    echo "  Attempting to start server anyway..."
  elif [ $EXIT_CODE -eq 0 ]; then
    echo "✓ Migrations completed successfully"
  else
    echo "⚠ Prisma migrate exited with code $EXIT_CODE - continuing startup"
  fi
}

# Start the server (use exec to replace this process)
echo "Starting server..."
exec node dist/index.js
