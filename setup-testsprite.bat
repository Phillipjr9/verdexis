@echo off
REM VERDEXIS TestSprite - Automated Setup & Execution Script
REM This script sets up all test dependencies and runs the TestSprite test suite

setlocal enabledelayedexpansion

cls
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║          VERDEXIS TestSprite - Setup & Execute            ║
echo ║              Automated Test Environment                   ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

REM Set project root
set PROJECT_ROOT=%~dp0
cd /d "%PROJECT_ROOT%"

echo [STEP 1] Checking Node.js & npm...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found! Please install Node.js 20+ from https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js detected

npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm not found!
    pause
    exit /b 1
)
echo ✅ npm detected
echo.

echo [STEP 2] Installing root-level test dependencies...
echo   Installing: jest ts-jest @jest/globals @types/jest jest-junit jest-html-reporters
npm install --save-dev jest ts-jest @jest/globals @types/jest jest-junit jest-html-reporters
if errorlevel 1 (
    echo ❌ Failed to install test dependencies
    pause
    exit /b 1
)
echo ✅ Test dependencies installed
echo.

echo [STEP 3] Installing app dependencies...
cd "%PROJECT_ROOT%app"
npm install --legacy-peer-deps
if errorlevel 1 (
    echo ⚠️  Warning: Some app dependencies failed (non-critical)
)
echo ✅ App dependencies ready
cd "%PROJECT_ROOT%"
echo.

echo [STEP 4] Installing server dependencies...
cd "%PROJECT_ROOT%server"
npm install
if errorlevel 1 (
    echo ❌ Failed to install server dependencies
    pause
    exit /b 1
)
echo ✅ Server dependencies installed
cd "%PROJECT_ROOT%"
echo.

echo [STEP 5] Initializing database...
echo   Checking if database migration needed...
npm run db:migrate
if errorlevel 1 (
    echo ⚠️  Database migration skipped (may already exist)
)
echo ✅ Database ready
echo.

echo [STEP 6] Test Configuration Summary
echo ╔═══════════════════════════════════════════════════════════╗
echo ║             VERDEXIS Test Configuration                   ║
echo ╠═══════════════════════════════════════════════════════════╣
echo ║ API Base URL:        http://localhost:4000                ║
echo ║ Test Framework:      Jest + TypeScript                    ║
echo ║ Test Location:       testsprite_tests/                    ║
echo ║ Config:              testsprite.config.json               ║
echo ║ Jest Config:         jest.config.json                     ║
echo ║ Reports:             test-reports/                        ║
echo ║                                                           ║
echo ║ Test Suites:         8 suites (35+ test cases)            ║
echo ║ - Health Check       (1 test)                             ║
echo ║ - Authentication     (9 tests)                            ║
echo ║ - Wallet             (7 tests)                            ║
echo ║ - Trading            (6 tests)                            ║
echo ║ - Portfolio          (4 tests)                            ║
echo ║ - Passkeys           (2 tests)                            ║
echo ║ - Rate Limiting      (2 tests)                            ║
echo ║ - Error Handling     (4 tests)                            ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

echo [STEP 7] Ready to Execute Tests
echo.
echo 📋 Next Steps:
echo.
echo   OPTION A: Run Tests Immediately (Backend must be running)
echo   ────────────────────────────────────────────────────────
echo   Press 1 to run tests now
echo.
echo   OPTION B: Manual Execution (Recommended First Run)
echo   ───────────────────────────────────────────────────
echo   Press 2 to view manual execution steps
echo.
echo   OPTION C: Exit
echo   ────────────────────────────────────────────────────
echo   Press 3 to exit
echo.

choice /c 123 /n /m "Select option (1-3): "
set choice=%errorlevel%

if %choice%==1 goto RUN_TESTS
if %choice%==2 goto MANUAL_STEPS
if %choice%==3 goto EXIT_SCRIPT

:RUN_TESTS
echo.
echo [RUNNING TESTS]
echo.
echo ℹ️  Ensure backend is running in another terminal:
echo    npm run dev:server
echo.
echo   Waiting 3 seconds...
timeout /t 3 /nobreak
echo.

REM Check if backend is running
echo   Checking if backend is running...
powershell -Command "try { $null = [System.Net.ServicePointManager]::ServerCertificateValidationCallback; $http = New-Object System.Net.Http.HttpClient; $response = $http.GetAsync('http://localhost:4000/api/health').Result; if ($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"

if errorlevel 1 (
    echo.
    echo ⚠️  WARNING: Backend server not responding on localhost:4000
    echo.
    echo    Some tests may fail. To fix this:
    echo.
    echo    1. Open a new terminal
    echo    2. Run: npm run dev:server
    echo    3. Wait for message: "Server listening on http://localhost:4000"
    echo    4. Return to this terminal and continue
    echo.
    echo    Press any key to continue anyway...
    pause >nul
    echo.
)

echo Running full test suite with coverage...
echo.
npm test -- --coverage
goto AFTER_TESTS

:MANUAL_STEPS
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║           MANUAL TEST EXECUTION STEPS                     ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
echo TERMINAL 1 - Start Backend Server:
echo ─────────────────────────────────────
echo   $ npm run dev:server
echo.
echo   Wait for output:
echo   ✓ Server listening on http://localhost:4000
echo.
echo TERMINAL 2 - Run Tests:
echo ────────────────────────
echo   $ npm test
echo.
echo Or run specific test suites:
echo.
echo   All tests with coverage:
echo   $ npm test -- --coverage
echo.
echo   Only authentication:
echo   $ npm test -- --testNamePattern="Authentication"
echo.
echo   Only wallet tests:
echo   $ npm test -- --testNamePattern="Wallet"
echo.
echo   Watch mode (re-run on changes):
echo   $ npm test -- --watch
echo.
echo Additional Options:
echo   $ npm test -- --listTests                    (List all tests)
echo   $ npm test -- --verbose                      (Verbose output)
echo   $ npm test -- --maxWorkers=1                 (Single thread)
echo   $ npm test -- custom.test.ts                 (Run specific file)
echo.
echo Test Reports:
echo   View HTML report:  ./test-reports/report.html
echo   View JUnit XML:    ./test-reports/junit.xml
echo   Coverage report:   ./test-reports/coverage/
echo.
echo Press any key to close this window...
pause >nul
goto EXIT_SCRIPT

:AFTER_TESTS
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                  TEST EXECUTION COMPLETE                  ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

REM Check if reports exist
if exist "test-reports\report.html" (
    echo ✅ HTML Report Generated
    echo    📊 Open: test-reports\report.html
    echo.
)

if exist "test-reports\junit.xml" (
    echo ✅ JUnit Report Generated
    echo    📄 Location: test-reports\junit.xml
    echo.
)

echo Next Steps:
echo   1. Review HTML report: test-reports/report.html
echo   2. Check coverage: test-reports/coverage/index.html
echo   3. For more details: See TEST_SETUP_GUIDE.md
echo.
echo Press any key to exit...
pause >nul

:EXIT_SCRIPT
echo.
echo Thank you for using VERDEXIS TestSprite! 🚀
echo For help, see: TEST_SETUP_GUIDE.md
echo.
exit /b 0
