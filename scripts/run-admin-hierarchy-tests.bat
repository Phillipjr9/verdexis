@echo off
REM VERDEXIS Admin Hierarchy Test Runner
REM This script sets up and runs the Admin Hierarchy test suite

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║   VERDEXIS Admin Hierarchy Test Suite (TC031)              ║
echo ║   TestSprite Framework                                     ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if !errorlevel! neq 0 (
    echo ❌ ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found: 
node --version
echo.

REM Change to project directory
cd /d "%~dp0"
if !errorlevel! neq 0 (
    echo ❌ ERROR: Could not change to project directory
    pause
    exit /b 1
)

echo.
echo 📋 Step 1: Checking dependencies...
echo ─────────────────────────────────────────────────────────────

if not exist "node_modules" (
    echo ⚠️  Installing root dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo ❌ ERROR: Failed to install root dependencies
        pause
        exit /b 1
    )
) else (
    echo ✅ Root dependencies already installed
)

if not exist "server\node_modules" (
    echo ⚠️  Installing server dependencies...
    call npm --prefix server install
    if !errorlevel! neq 0 (
        echo ❌ ERROR: Failed to install server dependencies
        pause
        exit /b 1
    )
) else (
    echo ✅ Server dependencies already installed
)

echo.
echo ✅ Dependencies verified
echo.

echo 📊 Step 2: Checking test environment...
echo ─────────────────────────────────────────────────────────────

REM Check if Super Admin exists
echo ℹ️  Verifying Super Admin account...
call npm --prefix server run list-users 2>nul | findstr "admin@verdexis.com" >nul 2>nul
if !errorlevel! equ 0 (
    echo ✅ Super Admin found: admin@verdexis.com
) else (
    echo ⚠️  Super Admin not found
    echo.
    echo Creating Super Admin account...
    call npm --prefix server run create-super-admin
    if !errorlevel! neq 0 (
        echo ⚠️  Warning: Super admin creation may have issues
        echo Some tests may be skipped
    ) else (
        echo ✅ Super Admin created successfully
    )
)

echo.
echo 🚀 Step 3: Starting Backend API...
echo ─────────────────────────────────────────────────────────────

REM Check if port 4000 is already in use
netstat -ano | findstr ":4000" >nul 2>nul
if !errorlevel! equ 0 (
    echo ✅ API already running on port 4000
) else (
    echo ⚠️  Starting backend API...
    echo.
    echo 💡 TIP: Open a new terminal to see backend logs
    echo 💡 Backend will run on: http://localhost:4000
    echo.
    
    REM Start backend in new window
    start "VERDEXIS Backend API" cmd /k "npm run dev:server"
    
    REM Wait for backend to start
    echo Waiting for backend to be ready...
    timeout /t 5 /nobreak
    
    REM Verify backend is running
    for /L %%i in (1,1,10) do (
        curl -s http://localhost:4000/api/health >nul 2>nul
        if !errorlevel! equ 0 (
            echo ✅ Backend API is ready
            goto backend_ready
        )
        echo ⏳ Attempt %%i/10... waiting...
        timeout /t 1 /nobreak
    )
    
    echo ⚠️  Warning: Backend may not be responding. Tests might fail.
)

:backend_ready
echo.
echo 🧪 Step 4: Running Admin Hierarchy Tests...
echo ─────────────────────────────────────────────────────────────
echo.

REM Run the admin hierarchy tests
call npm test -- testsprite_tests/TC031_Admin_Hierarchy.ts --verbose

echo.
echo ═════════════════════════════════════════════════════════════
echo.

REM Check if tests passed
if !errorlevel! equ 0 (
    echo ✅ All tests passed!
    echo.
    echo 📊 Test Reports:
    echo   • HTML Report: test-reports\report.html
    echo   • JUnit XML: test-reports\junit.xml
    echo   • Coverage: test-reports\coverage\index.html
    echo.
) else (
    echo ❌ Some tests failed!
    echo.
    echo 🔧 Troubleshooting:
    echo   • Check that backend is running: npm run dev:server
    echo   • Verify database: npm run db:migrate
    echo   • Review logs in server console
    echo.
)

echo.
echo 📝 Next Steps:
echo   1. Review test output above
echo   2. Check test reports in test-reports\ folder
echo   3. For more options, run: npm test -- --help
echo   4. To run specific tests: npm test -- --testNamePattern="pattern"
echo.

pause
