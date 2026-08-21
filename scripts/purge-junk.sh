#!/usr/bin/env bash
# Remove session docs, scan dumps, backups, and other non-source clutter.
set -euo pipefail
cd "$(dirname "$0")/.."

paths=(
  .agent.md
  .rebuild-trigger
  ADMIN_DASHBOARD_ENHANCED_FEATURES.md
  ADMIN_DASHBOARD_ENHANCEMENTS.md
  ADMIN_DASHBOARD_FINAL_SUMMARY.md
  ADMIN_DASHBOARD_IMPLEMENTATION.md
  ADMIN_DASHBOARD_INDEX.md
  ADMIN_DASHBOARD_INTEGRATION_GUIDE.md
  ADMIN_DASHBOARD_QUICKSTART.md
  ADMIN_DASHBOARD_README.md
  ADMIN_DASHBOARD_SUMMARY.md
  ADMIN_DASHBOARD_VISUAL_REFERENCE.md
  ADMIN_DASHBOARD_VISUAL_SUMMARY.md
  ADMIN_FIXES_COMPLETE.md
  ADMIN_FUNDING_VERIFICATION.md
  ADMIN_PAGES_DIAGNOSTIC.md
  ADMIN_SETTINGS_FIX_COMPLETE.md
  ADMIN_SETTINGS_INTEGRATION_GUIDE.md
  ADMIN_SETTINGS_ISSUE.md
  ADMIN_SETTINGS_QUICK_GUIDE.md
  ADMIN_SETTINGS_VERIFICATION.md
  ADMIN_SETTINGS_VERIFICATION_SUMMARY.md
  ADMIN_USERS_DEBUG.md
  API_TEST_RESULTS.md
  CHANGELOG.md
  CHANGES_MADE.md
  COMMIT_VERIFICATION.md
  CRYPTO_WITHDRAWAL_IMPLEMENTATION.md
  Cloudflare-Pages-DEPLOY.md
  DASHBOARD_IMPLEMENTATION_COMPLETE.md
  DATABASE_503_REAL_FIX.md
  DATABASE_503_ROOT_CAUSE.md
  DEPLOYMENT.md
  ENV_VARS.md
  FIXES_APPLIED.md
  IMPLEMENTATION_COMPLETE_SUMMARY.md
  MISSING_FEATURES_IMPLEMENTATION_REPORT.md
  MOCK_DATA_ELIMINATION_FINAL_REPORT.md
  POPUPS_README.md
  SCAN_REPORT.md
  SERVICE_503_COMPLETE_GUIDE.md
  TRANSACTION_HISTORY_AUDIT_REPORT.md
  TRANSACTION_HISTORY_IMPLEMENTATION.md
  VULNERABILITY_MITIGATION.md
  WALLET_CREATION_AND_MANAGEMENT.md
  all_snyk.err all_snyk.json all_snyk_ignore.err all_snyk_ignore.json all_snyk_new.err all_snyk_new.json
  app_snyk.err app_snyk.json app_snyk_new.err app_snyk_new.json
  hardhat-example_snyk.err hardhat-example_snyk.json
  root_snyk.err root_snyk.json
  server_snyk.err server_snyk.json server_snyk_new.err server_snyk_new.json
  snyk-report.json
  dev.db
  app/src/pages/AdminDashboard.tsx.fixed
  app/src/pages/AdminUsers.tsx.original
  docs/ADMIN_EMAIL_SECURITY.md
  docs/EMAIL_ENV.md
  docs/EMAIL_SENDER_AUDIT.md
  docs/VERDEXIS_EMAIL_DNS.md
  docs/WEBSITE_LEGAL_AUDIT.md
  server/.env.backup
  server/dev.db
  server/prisma/dev.db.backup
  server/prisma/prod-backup-20260814-1358.dump
  server/prisma/prod-backup-20260814-1359.dump
  server/src/services/awsCognito.ts.bak
  server/src/services/awsOTP.ts.bak
  server/src/services/awsSNS.ts.bak
  server/src/services/cryptoWithdrawal.ts.bak
  server/tmp_find_admin.mjs
  server/tmp_market.json
  server/tsc_errors.txt
  server/verdexis-server-0.1.0.tgz
  server/.claude/skills/testsprite-onboard/SKILL.md
  server/.claude/skills/testsprite-verify/SKILL.md
)

dirs=(
  .kalai .amazonq .snapshots .firebase scans subagent-sessions
  server/dist server/supabase/.temp server/prisma/prisma
)

for p in "${paths[@]}"; do
  if [ -e "$p" ]; then
    git rm -rf --ignore-unmatch "$p" 2>/dev/null || rm -rf "$p"
    echo "removed $p"
  fi
done

for d in "${dirs[@]}"; do
  if [ -e "$d" ]; then
    git rm -rf --ignore-unmatch "$d" 2>/dev/null || rm -rf "$d"
    echo "removed $d"
  fi
done

echo "Done. Review with: git status"
echo "Then: git add -A && git commit -m 'chore: purge junk files' && git push"
