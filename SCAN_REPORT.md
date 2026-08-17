# Verdexis Codebase Scan Report

## Critical Issues Found

### 1. **Security Vulnerabilities (Snyk Scan)**
- **20 vulnerable dependency paths** identified
- **11 unique vulnerabilities** across the project

#### High Severity (1):
- **bigint-buffer@1.1.5**: Buffer Overflow (CVSS 8.7)
  - Used by: @solana/spl-token → @solana/buffer-layout-utils
  - Status: NO FIX AVAILABLE (unfixable)
  - Impact: Can crash application

#### Medium Severity (Multiple):
- **uuid@9.0.1**: Improper Validation (CVSS 6.3) - **Multiple instances**
  - Used through firebase-admin@14.2.0
  - Upgrade path available but firebase-admin needs update
  - Impact: Data corruption, partial writes

- **cookie@0.4.0**: XSS Vulnerability (CVSS 6.3)
  - Used by: csurf@1.11.0
  - No upgrade path available
  - Impact: Cross-site scripting attacks

- **multer@1.4.5-lts.2**: Multiple vulnerabilities (8 total)
  - Recommended upgrade to: multer@2.2.0

### 2. **Build Issues**
- ✅ TypeScript compilation: **PASSES** (with deprecation warnings)
- ⚠️ Deprecation warning: Shell option security issue in child process spawning
- Build ID caching mechanism in place but may cause issues

### 3. **Dockerfile Issues**
- Database copy error: `RUN if [ -f server/prisma/dev.db ]...` references wrong path
- Should be `/app/server/prisma/dev.db` not `server/prisma/dev.db`
- Layer caching could be optimized
- Multi-stage build not implemented
- Dev dependencies included in final image

### 4. **Package.json Issues**
- **Old TypeScript version**: `typescript@~6.0.3` (should be 5.x or stable version)
- **Legacy peer dependencies flag**: `--legacy-peer-deps` required for build
- **Overly permissive overrides**: ajv, path-to-regexp, undici forcing old versions

### 5. **Runtime Dependencies**
- Heavy Firebase dependency chain (14.2.0)
- AWS SDK includes outdated version (2.1693.0)
- Bull queue with Redis (ensure Redis configured)
- Prisma with SQLite fallback on Render (potential issues)

### 6. **Environment Configuration**
- `.env` files present but not checked
- Database connection string not validated
- Render/Vercel deployment configs present but may be stale

## Summary
**3 Critical Issues:**
1. Unfixable buffer overflow in bigint-buffer
2. XSS vulnerability in cookie (unfixable)
3. Dockerfile path errors

**6 Moderate Issues:**
1. Multiple UUID validation vulnerabilities
2. Multer needs major upgrade
3. TypeScript version outdated
4. Legacy peer dependency workarounds
5. Inefficient Docker build
6. Missing runtime validation

## Recommendations Priority
1. **URGENT**: Address unfixable vulnerabilities (bigint-buffer, cookie)
   - Consider replacing @solana/spl-token or switching approaches
   - Replace csurf or patch cookie manually
2. **HIGH**: Upgrade multer to 2.2.0 and firebase-admin
3. **MEDIUM**: Fix Dockerfile and optimize build
4. **MEDIUM**: Update TypeScript and dependencies
5. **LOW**: Add runtime environment validation
