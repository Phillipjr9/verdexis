# VERDEXIS TestSprite - Quick Reference Cheat Sheet

## ⚡ Quick Start (30 seconds)

```bash
# Terminal 1: Start backend
npm run dev:server

# Terminal 2: Run tests
npm test
```

**Expected output:**
```
PASS  testsprite_tests/verdexis.test.ts (2.5s)
  ✓ Health Check (1)
  ✓ Authentication (9)
  ✓ Wallet (7)
  ✓ Trading (6)
  ✓ Portfolio (4)
  ✓ Passkeys (2)
  ✓ Rate Limiting (2)
  ✓ Error Handling (4)

Tests: 35 passed, 35 total
Time:  4.2s
```

---

## 🚀 Setup

| Command | Purpose |
|---------|---------|
| `npm install --save-dev jest ts-jest @jest/globals @types/jest` | Install test dependencies |
| `npm run db:migrate` | Initialize database |
| `npm run dev:server` | Start backend API (port 4000) |
| `npm run dev:app` | Start frontend (port 5173) |

---

## 🧪 Running Tests

### All Tests
```bash
npm test                    # Run all tests once
npm run test:watch         # Run all tests, re-run on changes
npm run test:coverage      # Run all tests with coverage report
npm run test:verbose       # Run all tests with verbose output
```

### Specific Test Suites
```bash
npm run test:auth          # Authentication tests only
npm run test:wallet        # Wallet tests only
npm run test:trading       # Trading tests only
npm run test:portfolio     # Portfolio tests only
npm run test:health        # Health check only
```

### Advanced Options
```bash
npm test -- --listTests              # List all available tests
npm test -- --testNamePattern="Auth" # Run matching tests
npm test -- --maxWorkers=1           # Single-threaded execution
npm test -- custom.test.ts           # Run specific test file
npm test -- --bail                   # Stop on first failure
npm test -- --detectOpenHandles      # Detect unclosed handles
```

---

## 📊 Test Reports

| Report Type | Location | How to View |
|------------|----------|-----------|
| HTML Report | `test-reports/report.html` | Open in browser |
| JUnit XML | `test-reports/junit.xml` | Use in CI/CD systems |
| Coverage | `test-reports/coverage/index.html` | Open in browser |

### Generate Reports
```bash
npm run test:coverage      # Generates all reports

# Or manually:
npm test -- --coverage --reporters=default --reporters=jest-junit --reporters=jest-html-reporters
```

---

## ✅ Test Status Checks

### Verify Backend Running
```bash
curl http://localhost:4000/api/health

# Expected:
# {"status":"ok","timestamp":"...","version":"0.1.0"}
```

### Verify Database
```bash
npm --prefix server run prisma:generate
npm run db:migrate
```

### Check Test Setup
```bash
npm run test:list  # Lists all 35+ tests

npm test -- --testNamePattern="Health"  # Quick health check
```

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| `Cannot find module 'jest'` | `npm install --save-dev jest ts-jest @jest/globals @types/jest` |
| `ECONNREFUSED localhost:4000` | `npm run dev:server` (in separate terminal) |
| `Database not found` | `npm run db:migrate` |
| `SQLITE_CANTOPEN` | `npm --prefix server run prisma:generate && npm run db:migrate` |
| `Port 4000 already in use` | Kill process: `netstat -ano \| findstr :4000` |
| `Tests timeout` | Run single-threaded: `npm test -- --maxWorkers=1` |
| `Module not found` | Clear cache: `npm test -- --clearCache` |

---

## 📈 Test Scenarios

### Scenario: New User Signup → Trade
```bash
npm test -- --testNamePattern="signup|wallet.*deposit|trades.*market"
```
Flow:
1. Create account
2. Get wallet balance
3. Execute buy trade
4. View holdings

### Scenario: Error Handling
```bash
npm test -- --testNamePattern="Error Handling|invalid"
```
Tests:
- Invalid email format
- Weak passwords
- Missing fields
- Nonexistent users

### Scenario: Rate Limiting
```bash
npm test -- --testNamePattern="Rate Limiting"
```
Tests:
- Rate limit headers present
- Multiple concurrent requests
- Request throttling

### Scenario: Security (Passkeys/WebAuthn)
```bash
npm test -- --testNamePattern="Passkey"
```
Tests:
- Passkey registration
- Passkey authentication
- Passkey listing

---

## 🔍 Debugging

### Enable Debug Logging
```bash
DEBUG=* npm test

# Or for specific module:
DEBUG=verdexis:* npm test
```

### Run Tests with Full Output
```bash
npm run test:verbose

# Or:
npm test -- --verbose --detectOpenHandles
```

### Run Single Test
```bash
# Edit verdexis.test.ts and change `it(` to `it.only(`
npm test

# Or use command line:
npm test -- --testNamePattern="POST /api/auth/signup"
```

### Generate Performance Profile
```bash
npm test -- --verbose 2>&1 | tee test-output.log

# Analyze:
grep "PASS\|FAIL\|duration" test-output.log
```

---

## 📋 Test Organization

**Location:** `testsprite_tests/verdexis.test.ts`

**Test Structure:**
```
✓ Health Check (1 test)
✓ Authentication (9 tests)
  ✓ Signup
  ✓ Duplicate email rejection
  ✓ Login
  ✓ Invalid credentials
  ✓ Get profile
  ✓ Token refresh
  ✓ Profile update
  ✓ Password reset
  ✓ Logout

✓ Wallet (7 tests)
  ✓ Get balances
  ✓ Include transaction history
  ✓ Create USD deposit
  ✓ Create crypto deposit
  ✓ Reject duplicate idempotency key
  ✓ Filter by type
  ✓ Pagination

✓ Trading (6 tests)
✓ Portfolio (4 tests)
✓ Passkeys (2 tests)
✓ Rate Limiting (2 tests)
✓ Error Handling (4 tests)
```

---

## 🎯 Success Criteria

- ✅ All 35+ tests pass
- ✅ No authentication failures
- ✅ Response times < 500ms average
- ✅ Coverage > 80%
- ✅ Zero unhandled exceptions
- ✅ Rate limit headers present
- ✅ Error codes correct

---

## 📚 Related Documentation

- **Full Guide:** `TEST_SETUP_GUIDE.md`
- **API Docs:** `API_DOCUMENTATION.md`
- **Product Specs:** `PRODUCT_REQUIREMENTS_DOCUMENT.md`
- **Architecture:** `ARCHITECTURE.md`
- **Config:** `testsprite.config.json`

---

## 🚀 Next Steps

1. Run backend: `npm run dev:server`
2. Run tests: `npm test`
3. View report: `test-reports/report.html`
4. Integrate with CI/CD
5. Monitor coverage

---

## 📞 Support

- Backend issues: Check `server/` directory
- Frontend issues: Check `app/` directory
- Database issues: Check `server/prisma/`
- Test failures: See Troubleshooting section above

**Happy Testing! 🎉**
