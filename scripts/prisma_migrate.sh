#!/usr/bin/env bash
set -euo pipefail

# Usage: set DATABASE_URL in env, then run this script from repo root.
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set. Example: export DATABASE_URL=\"postgresql://user:pass@host:5432/dbname?schema=public\"" >&2
  exit 1
fi

echo "Running Prisma generate and migrations against DATABASE_URL"
cd server
npx prisma generate
npx prisma migrate deploy

echo "Prisma migrations applied"
