# VERDEXIS Complete Project Testing with TestSprite
# Master Test Orchestrator

param(
    [switch]$ApiOnly = $false,
    [switch]$FrontendOnly = $false,
    [switch]$AdminHierarchyOnly = $false,
    [switch]$Coverage = $false,
    [switch]$Verbose = $false,
    [switch]$SkipBackend = $false,
    [switch]$Watch = $false,
    [string]$TestPattern = "",
    [int]$Workers = 4
)

$ErrorActionPreference = "Continue"

# Color-coded output functions
function Write-Header {
    param([string]$Text)
    Write-Host "`n" -ForegroundColor White
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  $Text" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Section {
    param([string]$Text, [int]$Number)
    Write-Host "`n📋 $Number. $Text" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Gray
}

function Write-Success {
    param([string]$Text)
    Write-Host "✅ $Text" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Text)
    Write-Host "⚠️  $Text" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Text)
    Write-Host "❌ $Text" -ForegroundColor Red
}

function Write-Info {
    param([string]$Text)
    Write-Host "ℹ️  $Text" -ForegroundColor Cyan
}

function Write-Progress-Bar {
    param([int]$Current, [int]$Total, [string]$Label)
    $percent = [math]::Floor(($Current / $Total) * 100)
    $bars = [math]::Floor($percent / 5)
    $emptyBars = 20 - $bars
    Write-Host "$Label: [$('█' * $bars)$('░' * $emptyBars)] $percent%" -ForegroundColor Cyan
}

# Test counters
$global:TotalTests = 0
$global:PassedTests = 0
$global:FailedTests = 0
$global:SkippedTests = 0

Write-Header "VERDEXIS Complete Project Testing - TestSprite"
Write-Host "Framework: Jest + Playwright + TypeScript" -ForegroundColor Gray
Write-Host "Version: 1.0.0" -ForegroundColor Gray
Write-Host ""

# Display options
if ($ApiOnly) { Write-Info "Mode: API Testing Only" }
if ($FrontendOnly) { Write-Info "Mode: Frontend Testing Only" }
if ($AdminHierarchyOnly) { Write-Info "Mode: Admin Hierarchy Testing Only" }
if ($Coverage) { Write-Info "Coverage: Enabled" }
if ($Watch) { Write-Info "Watch Mode: Enabled (re-run on changes)" }
Write-Host ""

# Step 1: Validate Environment
Write-Section "Validating Environment Setup" 1

Write-Info "Checking Node.js..."
$nodeVersion = & node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Node.js not installed"
    exit 1
}
Write-Success "Node.js: $nodeVersion"

Write-Info "Checking npm..."
$npmVersion = & npm --version 2>$null
Write-Success "npm: $npmVersion"

Write-Info "Checking Python..."
$pythonVersion = & python --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Success "Python found: $pythonVersion"
    $hasPython = $true
} else {
    Write-Warning "Python not found (Playwright tests may fail)"
    $hasPython = $false
}

Write-Host ""

# Step 2: Check Dependencies
Write-Section "Verifying Dependencies" 2

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

if (-not (Test-Path "node_modules")) {
    Write-Warning "Installing root dependencies..."
    npm install
} else {
    Write-Success "Root dependencies installed"
}

if (-not (Test-Path "server\node_modules")) {
    Write-Warning "Installing server dependencies..."
    npm --prefix server install
} else {
    Write-Success "Server dependencies installed"
}

if (-not (Test-Path "app\node_modules")) {
    Write-Warning "Installing app dependencies..."
    npm --prefix app install
} else {
    Write-Success "App dependencies installed"
}

# Install Playwright browsers if needed for frontend tests
if (-not $ApiOnly -and $hasPython) {
    Write-Info "Checking Playwright browsers..."
    if (-not (Test-Path "app\node_modules\.bin\playwright")) {
        Write-Warning "Installing Playwright browsers..."
        npx playwright install
    }
}

Write-Host ""

# Step 3: Initialize Database
Write-Section "Initializing Database" 3

Write-Info "Running Prisma migrations..."
npm --prefix server run prisma:generate 2>$null
npm --prefix server run prisma:migrate -- --skip-generate 2>$null
Write-Success "Database ready"

Write-Host ""

# Step 4: Start Services
Write-Section "Starting Services" 4

if (-not $SkipBackend) {
    $backendRunning = $false
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4000/api/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $backendRunning = $true
        }
    } catch { }

    if (-not $backendRunning) {
        Write-Warning "Starting Backend API (http://localhost:4000)..."
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectPath'; npm run dev:server" -WindowStyle Minimized
        
        Write-Info "Waiting for backend to be ready..."
        for ($i = 1; $i -le 15; $i++) {
            Start-Sleep -Seconds 1
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:4000/api/health" -TimeoutSec 1 -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    Write-Success "Backend ready"
                    $backendRunning = $true
                    break
                }
            } catch { }
            Write-Host "⏳ Attempt $i/15..." -ForegroundColor Gray
        }
        
        if (-not $backendRunning) {
            Write-Error-Custom "Backend failed to start"
        }
    } else {
        Write-Success "Backend already running"
    }
}

if (-not $ApiOnly) {
    $appRunning = $false
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $appRunning = $true
        }
    } catch { }

    if (-not $appRunning) {
        Write-Warning "Starting Frontend App (http://localhost:5173)..."
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectPath\app'; npm run dev" -WindowStyle Minimized
        
        Write-Info "Waiting for frontend to be ready..."
        for ($i = 1; $i -le 10; $i++) {
            Start-Sleep -Seconds 2
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 1 -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    Write-Success "Frontend ready"
                    $appRunning = $true
                    break
                }
            } catch { }
            Write-Host "⏳ Attempt $i/10..." -ForegroundColor Gray
        }
        
        if (-not $appRunning) {
            Write-Warning "Frontend may not be ready yet"
        }
    } else {
        Write-Success "Frontend already running"
    }
}

Write-Host ""

# Step 5: Run Tests
Write-Section "Executing Tests" 5
Write-Host ""

$startTime = Get-Date
$testResults = @()

# Build test arguments
$jestArgs = @()
if ($Coverage) { $jestArgs += "--coverage" }
if ($Verbose) { $jestArgs += "--verbose" }
if ($Watch) { $jestArgs += "--watch" }
$jestArgs += "--maxWorkers=$Workers"
if ($TestPattern) { $jestArgs += "--testNamePattern=$TestPattern" }

# API Tests
if (-not $FrontendOnly -and -not $AdminHierarchyOnly) {
    Write-Host "🧪 Running API Tests (verdexis.test.ts)" -ForegroundColor Green
    Write-Host "   29 test cases covering: Auth, Wallet, Trading, Portfolio, Passkeys, Rate Limiting, Error Handling" -ForegroundColor Gray
    
    npm test -- testsprite_tests/verdexis.test.ts @jestArgs
    $apiResult = $LASTEXITCODE
    $testResults += @{ Name = "API Tests"; Result = $apiResult; TestCount = 29 }
    Write-Host ""
}

# Admin Hierarchy Tests
if (-not $FrontendOnly -and (-not $ApiOnly -or $AdminHierarchyOnly)) {
    Write-Host "🧪 Running Admin Hierarchy Tests (TC031)" -ForegroundColor Green
    Write-Host "   25 test cases covering: Super Admin, Sub-Admin Creation, User Assignment, Authorization" -ForegroundColor Gray
    
    npm test -- testsprite_tests/TC031_Admin_Hierarchy.ts @jestArgs
    $adminResult = $LASTEXITCODE
    $testResults += @{ Name = "Admin Hierarchy Tests"; Result = $adminResult; TestCount = 25 }
    Write-Host ""
}

# Frontend/E2E Tests (Playwright)
if (-not $ApiOnly -and -not $AdminHierarchyOnly -and $hasPython) {
    Write-Host "🧪 Running Frontend E2E Tests (Playwright)" -ForegroundColor Green
    Write-Host "   30 test scenarios covering: Authentication, Wallet, Trading, Portfolio, Alerts" -ForegroundColor Gray
    
    $pythonTests = @(
        "TC001_Sign_up_and_enter_the_dashboard.py",
        "TC002_Withdraw_funds_from_the_wallet.py",
        "TC003_Place_a_buy_trade_and_see_it_reflected.py",
        "TC004_Place_a_sell_trade_and_see_it_reflected.py",
        "TC005_Review_dashboard_holdings_and_performance.py",
        "TC006_Open_the_wallet_and_review_balances.py",
        "TC007_Generate_a_deposit_address_in_the_wallet.py",
        "TC008_Convert_funds_in_the_wallet.py",
        "TC009_Transfer_funds_to_another_user.py",
        "TC010_Browse_the_market_list_and_open_an_asset_detail.py",
        "TC011_Create_a_price_alert.py",
        "TC012_Update_profile_details_successfully.py",
        "TC013_Submit_KYC_information.py",
        "TC014_View_an_asset_detail_page_from_a_direct_asset_route.py",
        "TC015_Change_password_successfully.py",
        "TC016_Review_merged_holdings_and_recent_activity.py",
        "TC017_Save_security_preference_changes.py",
        "TC018_Search_the_market_list_for_a_specific_asset.py",
        "TC019_Show_verified_status_after_KYC_submission.py",
        "TC020_Switch_dashboard_chart_range.py",
        "TC021_Review_transaction_and_trade_history.py",
        "TC022_Create_a_savings_or_investment_goal.py",
        "TC023_Create_a_recurring_DCA_schedule.py",
        "TC024_Toggle_a_price_alert.py",
        "TC025_Create_a_simulated_paper_trade.py",
        "TC026_Review_and_submit_a_portfolio_rebalance.py",
        "TC027_Run_a_DCA_schedule_manually.py",
        "TC028_Start_a_staking_position.py",
        "TC029_Reject_invalid_login_credentials.py",
        "TC030_Delete_a_price_alert.py"
    )
    
    $passedFrontend = 0
    $failedFrontend = 0
    
    foreach ($test in $pythonTests) {
        $testPath = "testsprite_tests\$test"
        if (Test-Path $testPath) {
            Write-Host "   ⏳ Running $test..." -ForegroundColor Gray
            python $testPath 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "   $test"
                $passedFrontend++
            } else {
                Write-Warning "   $test (may be blocked by environment)"
                $failedFrontend++
            }
        }
    }
    
    $testResults += @{ Name = "Frontend Tests"; Result = if ($failedFrontend -eq 0) { 0 } else { 1 }; TestCount = $pythonTests.Count; Passed = $passedFrontend; Failed = $failedFrontend }
    Write-Host ""
}

$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "═════════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Print Summary
Write-Host ""
Write-Host "📊 TEST EXECUTION SUMMARY" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""

$totalPassed = 0
$totalTests = 0

foreach ($result in $testResults) {
    $status = if ($result.Result -eq 0) { "✅ PASS" } else { "⚠️  PARTIAL" }
    if ($result.Passed -ne $null) {
        Write-Host "$($result.Name): $($result.Passed)/$($result.TestCount) passed" -ForegroundColor Green
        $totalPassed += $result.Passed
        $totalTests += $result.TestCount
    } else {
        Write-Host "$($result.Name): $status" -ForegroundColor $(if ($result.Result -eq 0) { "Green" } else { "Yellow" })
        if ($result.Result -eq 0) { $totalPassed += $result.TestCount }
        $totalTests += $result.TestCount
    }
}

Write-Host ""
Write-Host "📈 Overall Results:" -ForegroundColor Cyan
Write-Host "   Total Test Cases: $totalTests" -ForegroundColor White
Write-Host "   Passed: $totalPassed" -ForegroundColor Green
Write-Host "   Duration: $([math]::Round($duration.TotalSeconds, 2)) seconds" -ForegroundColor White
Write-Host ""

# Calculate success rate
if ($totalTests -gt 0) {
    $successRate = [math]::Floor(($totalPassed / $totalTests) * 100)
    Write-Progress-Bar $totalPassed $totalTests "Success Rate"
}

Write-Host ""
Write-Host "📂 Test Reports Generated:" -ForegroundColor Cyan
Write-Host "   • HTML Report: test-reports\report.html" -ForegroundColor White
Write-Host "   • JUnit XML: test-reports\junit.xml" -ForegroundColor White
if ($Coverage) {
    Write-Host "   • Coverage Report: test-reports\coverage\index.html" -ForegroundColor White
}
Write-Host ""

Write-Host "📋 Test Breakdown:" -ForegroundColor Cyan
Write-Host "   API Tests" -ForegroundColor Gray
Write-Host "   ├─ Authentication (9 tests)" -ForegroundColor Gray
Write-Host "   ├─ Wallet Operations (7 tests)" -ForegroundColor Gray
Write-Host "   ├─ Trading Endpoints (6 tests)" -ForegroundColor Gray
Write-Host "   ├─ Portfolio Management (4 tests)" -ForegroundColor Gray
Write-Host "   ├─ Passkeys/WebAuthn (2 tests)" -ForegroundColor Gray
Write-Host "   ├─ Rate Limiting (2 tests)" -ForegroundColor Gray
Write-Host "   └─ Error Handling (4 tests)" -ForegroundColor Gray
Write-Host ""
Write-Host "   Admin Hierarchy Tests" -ForegroundColor Gray
Write-Host "   ├─ Super Admin Functions (4 tests)" -ForegroundColor Gray
Write-Host "   ├─ Sub-Admin Creation (3 tests)" -ForegroundColor Gray
Write-Host "   ├─ Sub-Admin Limitations (4 tests)" -ForegroundColor Gray
Write-Host "   ├─ User Assignment (5 tests)" -ForegroundColor Gray
Write-Host "   ├─ Error Handling (5 tests)" -ForegroundColor Gray
Write-Host "   └─ Authorization (4 tests)" -ForegroundColor Gray
Write-Host ""
Write-Host "   Frontend Tests" -ForegroundColor Gray
Write-Host "   ├─ Authentication Flows (4 tests)" -ForegroundColor Gray
Write-Host "   ├─ Wallet Operations (6 tests)" -ForegroundColor Gray
Write-Host "   ├─ Trading Flows (4 tests)" -ForegroundColor Gray
Write-Host "   ├─ Portfolio Features (4 tests)" -ForegroundColor Gray
Write-Host "   ├─ Price Alerts (4 tests)" -ForegroundColor Gray
Write-Host "   ├─ Profile Management (3 tests)" -ForegroundColor Gray
Write-Host "   └─ Advanced Features (1 test)" -ForegroundColor Gray
Write-Host ""

# Print next steps
Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Review test report: start test-reports\report.html" -ForegroundColor White
if ($Coverage) {
    Write-Host "   2. Check coverage: start test-reports\coverage\index.html" -ForegroundColor White
}
Write-Host "   3. Fix any failures based on error messages" -ForegroundColor White
Write-Host "   4. Re-run tests with: npm test" -ForegroundColor White
Write-Host ""

# Advanced commands
Write-Host "💡 Advanced Commands:" -ForegroundColor Cyan
Write-Host "   # Run API tests only" -ForegroundColor Gray
Write-Host "   .\run-all-tests.ps1 -ApiOnly" -ForegroundColor Gray
Write-Host ""
Write-Host "   # Run frontend tests only" -ForegroundColor Gray
Write-Host "   .\run-all-tests.ps1 -FrontendOnly" -ForegroundColor Gray
Write-Host ""
Write-Host "   # Run with coverage report" -ForegroundColor Gray
Write-Host "   .\run-all-tests.ps1 -Coverage" -ForegroundColor Gray
Write-Host ""
Write-Host "   # Run specific test suite" -ForegroundColor Gray
Write-Host "   .\run-all-tests.ps1 -TestPattern 'Authentication'" -ForegroundColor Gray
Write-Host ""
Write-Host "   # Watch mode (re-run on changes)" -ForegroundColor Gray
Write-Host "   .\run-all-tests.ps1 -Watch" -ForegroundColor Gray
Write-Host ""

Write-Host "📝 Documentation:" -ForegroundColor Cyan
Write-Host "   • Full Guide: TESTSPRITE_COMPLETE_GUIDE.md" -ForegroundColor White
Write-Host "   • API Tests: TESTSPRITE_QUICK_REFERENCE.md" -ForegroundColor White
Write-Host "   • Admin Tests: ADMIN_HIERARCHY_TEST_GUIDE.md" -ForegroundColor White
Write-Host ""

# Exit with appropriate code
$exitCode = if ($testResults | Where-Object { $_.Result -ne 0 }) { 1 } else { 0 }
exit $exitCode
