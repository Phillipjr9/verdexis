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

# Ensure staff-scope / role / seed routes mount before the main admin router.
# Source uses admin-bundle; if dist still imports ./admin.js, rewrite it.
if [ -f dist/index.js ]; then
  if grep -q "routes/admin.js" dist/index.js 2>/dev/null; then
    echo "2. Wiring admin-bundle into dist/index.js..."
    sed -i 's|routes/admin\.js|routes/admin-bundle.js|g' dist/index.js || true
    sed -i 's|routes/admin\.js|routes/admin-bundle.js|g' dist/index.mjs 2>/dev/null || true
  fi
fi
if [ -f dist/routes/admin-bundle.js ]; then
  echo "✅ admin-bundle present in dist"
else
  echo "⚠️ admin-bundle.js not found in dist (build may need redeploy)"
fi

echo "✅ Pre-start checks complete"
