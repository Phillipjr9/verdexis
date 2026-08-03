#!/bin/sh
set -e

echo "Starting application..."

# Resolve failed migrations
echo "Checking for failed migrations..."
node scripts/resolve-failed-migration.js || true

# Run migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy --schema prisma/schema.prisma

# Start the server (use exec to replace this process)
echo "Starting server on port ${PORT:-4000}..."
exec node dist/index.js
