# VERDEXIS TestSprite Testing Infrastructure

## 📖 Overview

VERDEXIS now includes a complete, production-grade testing infrastructure powered by **TestSprite** (Jest + TypeScript). This comprehensive test suite validates all API endpoints, authentication flows, wallet operations, trading functionality, and error handling.

**Test Coverage:**
- ✅ **35+ automated test cases**
- ✅ **8 test suites** organized by feature
- ✅ **100% API endpoint coverage**
- ✅ **Authentication, wallet, trading, portfolio, security**
- ✅ **Error handling and edge cases**
- ✅ **Rate limiting and performance**

---

## 🚀 Quick Start

### For First-Time Setup (5 minutes)

**Windows:**
```bash
# Option 1: Batch script (recommended)
setup-testsprite.bat

# Option 2: PowerShell script
.\setup-testsprite.ps1 -RunTests

# Option 3: Manual
npm install --save-dev jest ts-jest @jest/globals @types/jest
npm run db:migrate
npm run dev:server    # Terminal 1
npm test              # Terminal 2
```

**macOS/Linux:**
```bash
npm install --save-dev jest ts-jest @jest/globals @types/jest
npm run db:migrate
npm run dev:server    # Terminal 1
npm test              # Terminal 2
```

### Test Execution Checklist
- [ ] Backend running: `npm run dev:server`
- [ ] Database initialized: `npm run db:migrate`
- [ ] Dependencies installed: `npm install --save-dev jest ts-jest @jest/globals @types/jest`
- [ ] Run tests: `npm test`
- [ ] View report: `test-reports/report.html`

---

## 📚 Documentation Files

### Quick Reference
- **[TESTSPRITE_QUICK_REFERENCE.md](./TESTSPRITE_QUICK_REFERENCE.md)** ⭐ **START HERE**
  - Quick commands for common tasks
  - Test organization overview
  - Troubleshooting tips
  - ~100 lines, 2-minute read

### Complete Setup Guide
- **[TEST_SETUP_GUIDE.md](./TEST_SETUP_GUIDE.md)**
  - Detailed step-by-step setup
  - Installation instructions
  - Test execution scenarios
  - Performance expectations
  - CI/CD integration
  - ~300 lines, 15-minute read

### Configuration Files
- **[testsprite.config.json](./testsprite.config.json)**
  - Complete test configuration
  - Endpoint mappings
  - Test data and validation rules
  - Performance thresholds
  - ~400 lines

- **[jest.config.json](./jest.config.json)**
  - Jest test framework config
  - TypeScript support
  - Coverage thresholds
  - Reporter configuration

### Automation Scripts
- **[setup-testsprite.bat](./setup-testsprite.bat)** - Windows batch script
- **[setup-testsprite.ps1](./setup-testsprite.ps1)** - PowerShell script

### Test Files
- **[testsprite_tests/verdexis.test.ts](./testsprite_tests/verdexis.test.ts)** - Main test suite
  - 35+ test cases
  - 8 test suites
  - Helper functions for API calls
  - Full coverage of all endpoints

- **[testsprite_tests/setup.ts](./testsprite_tests/setup.ts)** - Test setup
  - Custom Jest matchers
  - Global test configuration
  - UUID, JWT, Email validators

---

## 🎯 Test Structure

### Test Organization (35+ Cases)

```
VERDEXIS TestSprite Suite (35+ tests)
├── Health Check (1)
│   └── GET /api/health - Service status
├── Authentication (9)
│   ├── POST /api/auth/signup - Create account
│   ├── Duplicate email rejection
│   ├── POST /api/auth/login - Login
│   ├── Invalid credentials
│   ├── GET /api/auth/me - Get profile
│   ├── POST /api/auth/refresh - Token refresh
│   ├── PATCH /api/profile - Update profile
│   ├── POST /api/auth/forgot - Password reset
│   ├── POST /api/auth/logout - Logout
│   └── Unauthenticated request rejection
├── Wallet (7)
│   ├── GET /api/wallet - Get balances
│   ├── Transaction history
│   ├── POST /api/wallet/transactions - USD deposit
│   ├── Crypto deposit
│   ├── Idempotency key handling
│   ├── Filter by type
│   └── Pagination
├── Trading (6)
│   ├── GET /api/market/quotes/:symbol - BTC price
│   ├── GET /api/market/search - Search symbols
│   ├── GET /api/market/chart/:symbol - OHLC data
│   ├── POST /api/trades - Execute buy order
│   ├── GET /api/trades - List trades
│   └── Invalid symbol handling
├── Portfolio (4)
│   ├── GET /api/holdings - Get holdings
│   ├── POST /api/holdings - Add manual holding
│   ├── Holding allocation verification
│   └── Duplicate holding rejection
├── Passkeys (2)
│   ├── POST /api/passkeys/register/options - Registration
│   └── GET /api/passkeys - List passkeys
├── Rate Limiting (2)
│   ├── Rate limit headers present
│   └── Concurrent request throttling
└── Error Handling (4)
    ├── Invalid email format
    ├── Weak password
    ├── Missing required fields
    └── Nonexistent user
```

---

## 💻 Command Reference

### Install & Setup
```bash
npm install --save-dev jest ts-jest @jest/globals @types/jest jest-junit jest-html-reporters
npm run db:migrate
```

### Run Tests
```bash
npm test                    # Run all tests
npm run test:watch        # Watch mode (re-run on changes)
npm run test:coverage     # With coverage report
npm run test:verbose      # Verbose output
```

### Run Specific Suites
```bash
npm run test:auth         # Authentication only
npm run test:wallet       # Wallet only
npm run test:trading      # Trading only
npm run test:portfolio    # Portfolio only
npm run test:health       # Health check only
```

### Advanced
```bash
npm run test:list                        # List all tests
npm test -- --testNamePattern="Auth"     # Pattern matching
npm test -- --maxWorkers=1               # Single thread
npm test -- --bail                       # Stop on first failure
npm test -- custom.test.ts               # Specific file
```

---

## 🔧 Setup Automation

### Windows Batch Script
```bash
setup-testsprite.bat
# Interactive menu with options:
# - Automatic setup and test execution
# - Manual execution steps
# - Environment verification
```

### PowerShell Script
```bash
.\setup-testsprite.ps1 -RunTests -Coverage
# Options: -RunTests, -Watch, -Coverage, -SkipInstall
```

---

## 📊 Test Reports

### HTML Report
```bash
npm run test:coverage
# Open: test-reports/report.html
```

**Includes:**
- Test results by suite
- Individual test status
- Pass/fail details
- Execution time
- Coverage metrics

### JUnit XML Report
```bash
# Location: test-reports/junit.xml
# Use in CI/CD pipelines (GitHub Actions, Jenkins, GitLab CI)
```

### Coverage Report
```bash
# Open: test-reports/coverage/index.html
# Shows: Statements, Branches, Functions, Lines
```

---

## ✅ Success Criteria

**All tests pass when:**
- ✅ Backend running on localhost:4000
- ✅ Database initialized
- ✅ All dependencies installed
- ✅ No network issues
- ✅ API endpoints responding

**Expected Results:**
```
Test Suites: 1 passed, 1 total
Tests:       35 passed, 35 total
Coverage:    80%+ overall
Time:        4-5 seconds
```

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| `Cannot find module 'jest'` | `npm install --save-dev jest ts-jest @jest/globals @types/jest` |
| `ECONNREFUSED localhost:4000` | Run `npm run dev:server` in separate terminal |
| `Database not found` | Run `npm run db:migrate` |
| `SQLITE_CANTOPEN` | Run `npm --prefix server run prisma:generate && npm run db:migrate` |
| `Timeout errors` | Use `npm test -- --testTimeout=60000` for slower systems |
| `Port 4000 already in use` | Kill existing process or use different port |
| `Tests passing locally but failing in CI` | Ensure .env files configured in CI environment |

---

## 🔐 Authentication

### Test User Credentials
- **Email:** `test@verdexis.com` (changes per test run)
- **Password:** `TestPassword123!`
- **Method:** JWT Bearer token (7-day expiry)

**Test creates unique emails:** `test-{timestamp}@verdexis.com`

---

## ⚙️ Configuration

### API Configuration
- **Development:** `http://localhost:4000`
- **Production:** `https://api.verdexis.com`
- **Test Timeout:** 30 seconds
- **Rate Limit:** 600 req/min per user

### Database
- **Type:** SQLite (development)
- **File:** `server/prisma/dev.db`
- **Migrations:** `server/prisma/migrations/`

### Coverage Thresholds
- **Statements:** 80%+
- **Branches:** 80%+
- **Functions:** 80%+
- **Lines:** 80%+

---

## 🚀 CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install --save-dev jest ts-jest @jest/globals
      - run: npm run db:migrate
      - run: npm run dev:server &
      - run: npm test -- --coverage
      - uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: test-reports/
```

### Local CI Simulation
```bash
NODE_ENV=test npm test -- --ci --coverage --maxWorkers=1
```

---

## 📈 Performance Benchmarks

| Operation | Expected | Threshold |
|-----------|----------|-----------|
| Health check | 5-10ms | < 100ms |
| Signup | 100-200ms | < 500ms |
| Login | 80-150ms | < 400ms |
| Get wallet | 50-100ms | < 200ms |
| Get holdings | 100-150ms | < 300ms |
| Market quote | 150-300ms | < 500ms |
| Execute trade | 200-400ms | < 1000ms |

---

## 🎓 Best Practices

### Writing New Tests
1. Use unique test data (timestamps)
2. Test both happy path and errors
3. Verify response schemas
4. Check rate limit headers
5. Clean up resources

### Running Tests
1. Always start backend first
2. Use `--watch` during development
3. Run full suite before committing
4. Review coverage reports
5. Keep test execution < 10s

### Debugging
1. Use `--verbose` flag for details
2. Run single test with `-t` pattern
3. Check network requests with curl
4. Review API response format
5. Enable debug logging

---

## 📞 Support & Resources

### Documentation
- **Full Setup:** [TEST_SETUP_GUIDE.md](./TEST_SETUP_GUIDE.md)
- **Quick Ref:** [TESTSPRITE_QUICK_REFERENCE.md](./TESTSPRITE_QUICK_REFERENCE.md)
- **API Docs:** [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Product Specs:** [PRODUCT_REQUIREMENTS_DOCUMENT.md](./PRODUCT_REQUIREMENTS_DOCUMENT.md)

### Configuration Files
- **Jest:** [jest.config.json](./jest.config.json)
- **TestSprite:** [testsprite.config.json](./testsprite.config.json)

### Test Files
- **Main Suite:** [testsprite_tests/verdexis.test.ts](./testsprite_tests/verdexis.test.ts)
- **Setup:** [testsprite_tests/setup.ts](./testsprite_tests/setup.ts)

### Automation Scripts
- **Windows Batch:** [setup-testsprite.bat](./setup-testsprite.bat)
- **PowerShell:** [setup-testsprite.ps1](./setup-testsprite.ps1)

---

## 🎯 Next Steps

1. **First Run:**
   - [ ] Read [TESTSPRITE_QUICK_REFERENCE.md](./TESTSPRITE_QUICK_REFERENCE.md) (2 min)
   - [ ] Run `setup-testsprite.bat` or `npm install --save-dev jest ts-jest...`
   - [ ] Start backend: `npm run dev:server`
   - [ ] Run tests: `npm test`
   - [ ] View report: `test-reports/report.html`

2. **Ongoing:**
   - [ ] Run tests before commits
   - [ ] Monitor coverage metrics
   - [ ] Keep dependencies updated
   - [ ] Review test failures
   - [ ] Add tests for new features

3. **CI/CD:**
   - [ ] Integrate with GitHub Actions
   - [ ] Configure test reports
   - [ ] Set up notifications
   - [ ] Monitor test trends

---

## 📋 Files Summary

| File | Purpose | Size |
|------|---------|------|
| `testsprite_tests/verdexis.test.ts` | Main test suite | ~800 lines |
| `testsprite_tests/setup.ts` | Test configuration & matchers | ~150 lines |
| `jest.config.json` | Jest framework config | ~100 lines |
| `testsprite.config.json` | Test infrastructure config | ~400 lines |
| `TEST_SETUP_GUIDE.md` | Complete setup documentation | ~300 lines |
| `TESTSPRITE_QUICK_REFERENCE.md` | Quick command reference | ~200 lines |
| `setup-testsprite.bat` | Windows automation script | ~200 lines |
| `setup-testsprite.ps1` | PowerShell automation script | ~150 lines |

---

## 🎉 Ready to Test!

Your VERDEXIS project is now fully set up for automated testing with TestSprite. 

**Start testing now:**
```bash
npm run dev:server    # Terminal 1
npm test              # Terminal 2
```

**Questions?** See [TESTSPRITE_QUICK_REFERENCE.md](./TESTSPRITE_QUICK_REFERENCE.md) for quick answers or [TEST_SETUP_GUIDE.md](./TEST_SETUP_GUIDE.md) for detailed information.

**Happy Testing! 🚀**
