# Admin Hierarchy - npm Scripts Reference

Add these scripts to `server/package.json` in the `"scripts"` section:

```json
{
  "scripts": {
    "create-super-admin": "node scripts/create-super-admin.mjs",
    "test-admin-hierarchy": "node scripts/test-admin-hierarchy.mjs",
    "create-admin": "node scripts/create-admin.mjs",
    "promote-admin": "node scripts/promote-admin.ts",
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node build/index.js"
  }
}
```

## Usage

### Initialize Super Admin
```bash
npm run create-super-admin
```

Sets up the initial Super Admin account with full permissions.

**Environment Variables:**
- `ADMIN_EMAIL` - Email for Super Admin (default: admin@verdexis.com)
- `ADMIN_PASSWORD` - Password for Super Admin (default: Admin@Verdexis2024)

### Create Sub-Admin
For programmatic creation of admins without API:
```bash
npm run create-admin -- --email admin1@example.com --name "Admin One" --password "SecurePass123"
```

### Promote User to Admin
Convert an existing user to admin:
```bash
npm run promote-admin -- --email user@example.com
```

### Test Admin Hierarchy API
Run comprehensive tests of all admin endpoints:
```bash
npm run test-admin-hierarchy
```

**Environment Variables:**
- `API_URL` - API base URL (default: http://localhost:3000)
- `ADMIN_EMAIL` - Admin email for testing (default: admin@verdexis.com)
- `ADMIN_PASSWORD` - Admin password for testing (default: Admin@Verdexis2024)

## Development Workflow

### First Time Setup
```bash
# 1. Start the server
npm run dev

# 2. In another terminal, initialize Super Admin
npm run create-super-admin

# 3. Test the API
npm run test-admin-hierarchy
```

### Create New Admin
```bash
# Option A: Via CLI script
npm run create-admin -- --email admin@company.com --name "Company Admin" --password "SecurePassword123"

# Option B: Via API (requires Super Admin token)
curl -X POST http://localhost:3000/api/admin/hierarchy/admins \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com",
    "name": "Company Admin",
    "password": "SecurePassword123"
  }'
```

### Configure Auto-Assignment
```bash
# Set the default admin for new signups
export DEFAULT_ADMIN_ID="<ADMIN_ID_FROM_ABOVE>"

# Restart the server
npm run dev
```

## Full Quick Start Command Sequence

```bash
# Terminal 1: Start development server
cd server
npm install
npm run dev

# Terminal 2: Setup admin hierarchy
cd server

# Create Super Admin
npm run create-super-admin

# Store the Super Admin token (from login)
export SUPER_ADMIN_TOKEN="your_token_here"

# Test API endpoints
npm run test-admin-hierarchy

# (Optional) Create additional admin via CLI
npm run create-admin -- --email admin1@example.com --name "Admin 1" --password "SecurePass123"

# (Optional) Configure auto-assignment
export DEFAULT_ADMIN_ID="<ADMIN_ID>"

# Restart server to apply default admin
# Ctrl+C to stop, then npm run dev
```

## Production Deployment

### Environment Variables
Set these before deploying:
```bash
# Required
ADMIN_EMAIL=admin@production.com
ADMIN_PASSWORD=YourStrongPassword123
DEFAULT_ADMIN_ID=  # Optional

# JWT & Auth
JWT_SECRET=your_jwt_secret_key
NODE_ENV=production

# Database
DATABASE_URL=your_production_db_url
```

### Deployment Steps
```bash
# 1. Build
npm run build

# 2. Initialize Super Admin (one-time only)
npm run create-super-admin

# 3. Run server
npm start

# 4. Test
npm run test-admin-hierarchy
```

## Script Details

### create-super-admin.mjs
- Creates Super Admin user account
- Sets up admin hierarchy with full permissions
- Initializes wallet balances (USD, BTC, ETH)
- Safe to run multiple times (idempotent)
- Logs credentials to stdout

### test-admin-hierarchy.mjs
- Logs in as Super Admin
- Tests all admin endpoints
- Creates test sub-admin
- Creates test user
- Tests user assignment
- Tests unauthorized access blocking
- Reports pass/fail count

### create-admin.mjs (existing)
- Creates admin user without hierarchy setup
- Useful for quick admin creation

### promote-admin.ts (existing)
- Converts regular user to admin
- Updates admin treasury

## Troubleshooting Scripts

### Check Admin Status
```bash
# View all admins
npm run create-admin -- --list

# View specific admin
npm run create-admin -- --email admin@example.com --show
```

### Reset Super Admin Password
```bash
# Re-run to reset to default password
npm run create-super-admin
```

### Manual Database Query
```bash
# Check admin hierarchy table
sqlite3 dev.db "SELECT * FROM AdminHierarchy;" # For SQLite

# PostgreSQL
psql $DATABASE_URL -c "SELECT * FROM admin_hierarchy;"
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Admin Hierarchy Tests

on: [push, pull_request]

jobs:
  test-admin:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd server && npm install
      - run: npm run create-super-admin
        env:
          ADMIN_EMAIL: test@example.com
          ADMIN_PASSWORD: TestPass123
      - run: npm run test-admin-hierarchy
        env:
          API_URL: http://localhost:3000
```

## Monitoring

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Admin User Count
```bash
sqlite3 dev.db "SELECT COUNT(*) FROM User WHERE role='admin';"
```

### User Assignment Status
```bash
sqlite3 dev.db "SELECT COUNT(*) FROM UserAdminAssignment;"
```

## Notes

- All scripts are idempotent (safe to run multiple times)
- Super Admin creation only happens if admin@verdexis.com doesn't exist
- Test script doesn't pollute production data (creates temporary test accounts)
- All scripts include error handling and graceful failure
- Logs include timestamps and status indicators
