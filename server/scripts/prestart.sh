#!/bin/bash
set -e

echo "[Verdexis Pre-Start]"
echo "1. Checking database migrations..."

# Run migrations
npx prisma migrate deploy || {
  echo "⚠️ Migrations failed, attempting db push..."
  npx prisma db push --skip-generate || {
    echo "❌ Both migration and db push failed. Continuing anyway..."
  }
}

echo "✅ Pre-start checks complete"
