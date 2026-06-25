# 🧪 VERDEXIS TestSprite - Complete Resource Index

## Welcome! 👋

Your VERDEXIS project now has a **complete, production-grade testing infrastructure** with **35+ automated test cases** covering all API endpoints. This index helps you navigate all the resources.

---

## ⚡ START HERE (Choose Your Path)

### 🏃 I want to start testing RIGHT NOW (5 minutes)
1. Read: **[TESTSPRITE_QUICK_REFERENCE.md](./TESTSPRITE_QUICK_REFERENCE.md)**
2. Run: `setup-testsprite.bat` (Windows) or manual commands
3. Execute: `npm test`
4. View: `test-reports/report.html`

### 📚 I want to understand everything first (15 minutes)
1. Read: **[TESTSPRITE_README.md](./TESTSPRITE_README.md)** - Overview
2. Read: **[TEST_SETUP_GUIDE.md](./TEST_SETUP_GUIDE.md)** - Detailed guide
3. Review: **[testsprite.config.json](./testsprite.config.json)** - Configuration
4. Then: Run tests and view results

### 🛠️ I want to set up automatically (3 minutes)
1. Double-click: `setup-testsprite.bat` (Windows)
2. Or run: `.\setup-testsprite.ps1 -RunTests` (PowerShell)
3. Or run: `npm install --save-dev jest ts-jest @jest/globals @types/jest` then `npm test`

---

## 📖 Documentation Files

### Essential Reading

| Document | Purpose | Read Time | File |
|----------|---------|-----------|------|
| **Quick Reference** ⭐⭐⭐ | Quick commands & troubleshooting | 2 min | `TESTSPRITE_QUICK_REFERENCE.md` |
| **Main README** ⭐⭐ | Overview & getting started | 5 min | `TESTSPRITE_README.md` |
| **Setup Guide** ⭐ | Comprehensive step-by-step | 15 min | `TEST_SETUP_GUIDE.md` |
| **Implementation Summary** | What was created | 5 min | `TESTSPRITE_IMPLEMENTATION_SUMMARY.md` |

### Configuration Reference

| File | Contains | Size |
|------|----------|------|
| `testsprite.config.json` | 50+ endpoints, test scenarios, validation rules | ~400 lines |
| `jest.config.json` | Jest framework, TypeScript, coverage config | ~100 lines |
| `package.json` | Root scripts for test commands | Updated |

### Test Files

| File | Contents | Tests |
|------|----------|-------|
| `testsprite_tests/verdexis.test.ts` | Main test suite with all 35+ tests | 35+ |
| `testsprite_tests/setup.ts` | Custom matchers & configuration | - |

---

## 🚀 Automation Scripts

### For Windows Users

**Batch Script (Recommended)**
```bash
setup-testsprite.bat
```
- Interactive menu
- Automatic dependency installation
- Database initialization
- Option to run tests immediately

**PowerShell Script**
```bash
.\setup-testsprite.ps1 -RunTests
```
Options:
- `-RunTests` - Execute tests after setup
- `-Watch` - Run in watch mode
- `-Coverage` - Include coverage report
- `-SkipInstall` - Skip installation

---

## 🎯 Quick Command Reference

### Installation
```bash
npm install --save-dev jest ts-jest @jest/globals @types/jest jest-junit jest-html-reporters
npm run db:migrate
```

### Running Backend
```bash
npm run dev:server    # Terminal 1
```

### Running Tests
```bash
npm test              # All tests
npm run test:watch   # Watch mode
npm run test:coverage # With coverage
npm run test:auth     # Auth only
npm run test:wallet   # Wallet only
npm run test:trading  # Trading only
npm run test:portfolio # Portfolio only
npm run test:health   # Health check
```

### View Reports
```bash
# Open in browser:
test-reports/report.html       # HTML test report
test-reports/coverage/index.html # Coverage report
test-reports/junit.xml         # JUnit XML (for CI/CD)
```

---

## 📊 Test Organization

### 8 Test Suites (35+ Tests)

```
✅ Health Check (1 test)
   └─ Service status verification

✅ Authentication (9 tests)
   ├─ Signup & account creation
   ├─ Login & credentials
   ├─ JWT tokens & refresh
   ├─ Password reset
   ├─ Profile updates
   ├─ Logout
   ├─ 2FA/Passkeys
   └─ Error handling

✅ Wallet (7 tests)
   ├─ Get wallet balances
   ├─ USD deposits
   ├─ Crypto deposits
   ├─ Withdrawals
   ├─ Transfers
   ├─ Transaction filtering
   └─ Pagination

✅ Trading (6 tests)
   ├─ Market quotes
   ├─ Symbol search
   ├─ OHLC charts
   ├─ Market orders
   ├─ Order history
   └─ Invalid symbol handling

✅ Portfolio (4 tests)
   ├─ Get holdings
   ├─ Add holdings
   ├─ Allocation calculations
   └─ P&L verification

✅ Passkeys/WebAuthn (2 tests)
   ├─ Registration options
   └─ Passkey listing

✅ Rate Limiting (2 tests)
   ├─ Rate limit headers
   └─ Concurrent request handling

✅ Error Handling (4 tests)
   ├─ Invalid inputs
   ├─ Weak passwords
   ├─ Missing fields
   └─ Nonexistent resources
```

---

## 🔧 Configuration Overview

### API Endpoints Covered
- **50+ endpoints** fully configured in `testsprite.config.json`
- **Authentication:** signup, login, refresh, 2FA, passkeys
- **Wallet:** balances, deposits, withdrawals, transfers, transactions
- **Trading:** quotes, orders, charts, history
- **Portfolio:** holdings, allocation, performance
- **Admin:** user management, approvals, reports

### Database Setup
- **Type:** SQLite (development)
- **File:** `server/prisma/dev.db`
- **Initialize:** `npm run db:migrate`

### Rate Limiting
- **Limit:** 600 requests/minute per user
- **Verified:** Via headers in rate limiting tests

### Performance Expectations
| Operation | Expected | Max |
|-----------|----------|-----|
| Health check | 5-10ms | 100ms |
| Signup | 100-200ms | 500ms |
| Get wallet | 50-100ms | 200ms |
| Execute trade | 200-400ms | 1000ms |

---

## ✅ Step-by-Step Setup

### Step 1: Choose Your Method

**Option A: Windows Batch (Easiest)**
```bash
setup-testsprite.bat
# Follow interactive menu
```

**Option B: PowerShell**
```bash
.\setup-testsprite.ps1 -RunTests
```

**Option C: Manual**
```bash
npm install --save-dev jest ts-jest @jest/globals @types/jest
npm run db:migrate
```

### Step 2: Start Backend
```bash
npm run dev:server
# Wait for: "✓ Server listening on http://localhost:4000"
```

### Step 3: Run Tests
```bash
npm test
```

### Step 4: View Results
```bash
# Open in browser:
test-reports/report.html
```

---

## 📚 Documentation Map

### Quick References
- **Quick Commands:** `TESTSPRITE_QUICK_REFERENCE.md`
- **Troubleshooting:** See Quick Reference
- **Error Solutions:** `TEST_SETUP_GUIDE.md`

### Setup & Installation
- **Full Guide:** `TEST_SETUP_GUIDE.md`
- **Windows Automation:** `setup-testsprite.bat`
- **PowerShell:** `setup-testsprite.ps1`

### Test Configuration
- **Test Config:** `testsprite.config.json` (endpoints, scenarios)
- **Jest Config:** `jest.config.json` (framework settings)

### Test Implementation
- **Main Suite:** `testsprite_tests/verdexis.test.ts` (35+ tests)
- **Setup:** `testsprite_tests/setup.ts` (custom matchers)

### API & Product
- **API Documentation:** `API_DOCUMENTATION.md` (50+ endpoints)
- **Product Specs:** `PRODUCT_REQUIREMENTS_DOCUMENT.md`
- **Architecture:** `ARCHITECTURE.md`

---

## 🎯 Common Tasks

### Run All Tests
```bash
npm test
```

### Run Specific Suite
```bash
npm run test:auth       # Authentication only
npm run test:wallet     # Wallet only
npm run test:trading    # Trading only
npm run test:portfolio  # Portfolio only
npm run test:health     # Health check only
```

### Run Tests in Watch Mode
```bash
npm run test:watch
# Re-runs on file changes
```

### Generate Coverage Report
```bash
npm run test:coverage
# Creates HTML report at test-reports/coverage/index.html
```

### Run Single Test
```bash
npm test -- --testNamePattern="Signup"
npm test -- --testNamePattern="Auth.*login"
```

### Debug Tests
```bash
npm run test:verbose
npm test -- --detectOpenHandles
npm test -- --maxWorkers=1
```

---

## 🐛 Troubleshooting Quick Links

| Problem | Solution |
|---------|----------|
| Backend not responding | Run `npm run dev:server` |
| Database errors | Run `npm run db:migrate` |
| Missing jest | Run `npm install --save-dev jest ts-jest @jest/globals` |
| Port 4000 in use | Kill process: `netstat -ano \| findstr :4000` |
| Tests timing out | Use `npm test -- --testTimeout=60000` |
| Full details | See `TEST_SETUP_GUIDE.md` Troubleshooting section |

---

## 📈 Test Results Interpretation

### Success Output
```
Test Suites: 1 passed, 1 total
Tests:       35 passed, 35 total
Coverage:    80%+ overall
Time:        4-5 seconds
```

### Common Failures
- **ECONNREFUSED** → Backend not running
- **SQLITE_CANTOPEN** → Database not initialized
- **Timeout** → API slow or not responding
- **401 Unauthorized** → JWT token issue

---

## 🔐 Test Data

### Test Users
- **Email:** `test-{timestamp}@verdexis.com` (unique per run)
- **Password:** `TestPassword123!`
- **Token Type:** JWT Bearer (7-day expiry)

### Test Amounts
- **Small:** 100 (USD), 0.01 (BTC)
- **Medium:** 1000 (USD), 0.5 (BTC)
- **Large:** 10000 (USD), 2.0 (BTC)

### Test Assets
- **Crypto:** BTC, ETH, SOL, USDT, USDC
- **Stocks:** AAPL, GOOGL, MSFT

---

## 🚀 Next Steps

### First Run (Today)
- [ ] Read `TESTSPRITE_QUICK_REFERENCE.md`
- [ ] Run `setup-testsprite.bat` or manual install
- [ ] Start backend: `npm run dev:server`
- [ ] Run tests: `npm test`
- [ ] View report: `test-reports/report.html`

### Integration (This Week)
- [ ] Review test failures if any
- [ ] Adjust timeouts for your system
- [ ] Integrate with CI/CD pipeline
- [ ] Set up test reporting

### Ongoing (Every Sprint)
- [ ] Run tests before commits
- [ ] Monitor coverage metrics
- [ ] Add tests for new features
- [ ] Review test execution time

---

## 📞 Getting Help

### Documentation
1. **Quick questions?** → `TESTSPRITE_QUICK_REFERENCE.md`
2. **Setup help?** → `TEST_SETUP_GUIDE.md`
3. **Overview?** → `TESTSPRITE_README.md`
4. **Errors?** → Search in `TEST_SETUP_GUIDE.md` Troubleshooting

### Manual Execution
```bash
npm run dev:server      # Terminal 1: Backend
npm test                # Terminal 2: Tests
npm test -- --verbose   # Verbose output
npm test -- --watch     # Watch mode
```

### View Generated Files
- `test-reports/report.html` - Test results
- `test-reports/coverage/index.html` - Coverage metrics
- `test-reports/junit.xml` - CI/CD reports

---

## 📋 File Organization

```
VERDEXIS/
├── 📄 TESTSPRITE_README.md              ⭐ Main documentation
├── 📄 TESTSPRITE_QUICK_REFERENCE.md     ⭐ Quick commands
├── 📄 TEST_SETUP_GUIDE.md               Complete setup guide
├── 📄 TESTSPRITE_IMPLEMENTATION_SUMMARY.md  Summary
├── 📄 TESTSPRITE_RESOURCE_INDEX.md      This file
│
├── 🔧 setup-testsprite.bat              Windows automation
├── 🔧 setup-testsprite.ps1              PowerShell automation
│
├── 📋 jest.config.json                  Jest configuration
├── 📋 testsprite.config.json            Test configuration
├── 📋 package.json                      (updated with test scripts)
│
├── 🧪 testsprite_tests/
│   ├── verdexis.test.ts                 35+ test cases
│   ├── setup.ts                         Jest setup & matchers
│   └── ...other tests...
│
├── 🚀 server/                           Backend API
├── 🎨 app/                              Frontend
└── ...other project files...
```

---

## ✨ Features Summary

✅ **35+ Automated Tests** - Comprehensive API coverage
✅ **8 Organized Suites** - Health, Auth, Wallet, Trading, Portfolio, Passkeys, Rate Limiting, Errors
✅ **Custom Matchers** - UUID, JWT, Email, Ethereum validation
✅ **API Helper Functions** - Reusable HTTP client
✅ **Multiple Run Modes** - Normal, watch, coverage, verbose
✅ **HTML Reports** - Professional test & coverage reports
✅ **JUnit XML** - CI/CD integration ready
✅ **Windows Automation** - Batch and PowerShell scripts
✅ **npm Scripts** - Easy command shortcuts
✅ **TypeScript Support** - Full type safety

---

## 🎉 You're All Set!

Your VERDEXIS TestSprite infrastructure is ready to use. Everything you need is configured and documented.

### Start testing right now:
```bash
npm run dev:server    # Terminal 1
npm test              # Terminal 2
```

### Questions?
- **Quick commands:** `TESTSPRITE_QUICK_REFERENCE.md`
- **Full setup:** `TEST_SETUP_GUIDE.md`
- **Overview:** `TESTSPRITE_README.md`

---

**Happy Testing! 🚀**

*Last Updated: January 2025*
*Version: 1.0 - Production Ready*
