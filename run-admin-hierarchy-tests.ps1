# VERDEXIS Admin Hierarchy Test Runner (PowerShell)
# Usage: .\run-admin-hierarchy-tests.ps1

param(
    [switch]$SkipBackend = $false,
    [switch]$CoverageOnly = $false,
    [switch]$Verbose = $false,
    [string]$TestPattern = ""
)

$ErrorActionPreference = "Stop"

function Write-Header {
    param([string]$Text)
    Write-Host "`n" -ForegroundColor White
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  $Text" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Text, [int]$Number)
    Write-Host "📋 Step $Number`: $Text" -ForegroundColor Yellow
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

Write-Header "VERDEXIS Admin Hierarchy Test Suite (TC031) - TestSprite"

# Check Node.js
Write-Info "Checking Node.js installation..."
$nodeVersion = & node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "Node.js is not installed or not in PATH"
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Success "Node.js found: $nodeVersion"
Write-Host ""

# Navigate to project directory
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath
Write-Info "Working directory: $(Get-Location)"
Write-Host ""

# Step 1: Check Dependencies
Write-Step "Checking Dependencies" 1

if (-not (Test-Path "node_modules")) {
    Write-Warning "Installing root dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Failed to install root dependencies"
        exit 1
    }
} else {
    Write-Success "Root dependencies already installed"
}

if (-not (Test-Path "server\node_modules")) {
    Write-Warning "Installing server dependencies..."
    npm --prefix server install
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "Failed to install server dependencies"
        exit 1
    }
} else {
    Write-Success "Server dependencies already installed"
}

# Step 2: Check Test Environment
Write-Step "Checking Test Environment" 2

Write-Info "Verifying Super Admin account..."
$superAdminExists = $false
try {
    $userList = & npm --prefix server run list-users 2>$null
    if ($userList -like "*admin@verdexis.com*") {
        $superAdminExists = $true
    }
} catch {
    Write-Warning "Could not verify super admin via npm script"
}

if ($superAdminExists) {
    Write-Success "Super Admin found: admin@verdexis.com"
} else {
    Write-Warning "Super Admin not found"
    Write-Host "Creating Super Admin account..." -ForegroundColor Yellow
    try {
        & npm --prefix server run create-super-admin
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Super Admin created successfully"
        } else {
            Write-Warning "Super admin creation completed with warnings"
            Write-Host "Some tests may be skipped" -ForegroundColor Yellow
        }
    } catch {
        Write-Warning "Could not create super admin"
    }
}

# Step 3: Start Backend API
Write-Step "Starting Backend API" 3

$backendRunning = $false
$port = 4000

try {
    $response = Invoke-WebRequest -Uri "http://localhost:$port/api/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $backendRunning = $true
    }
} catch {
    $backendRunning = $false
}

if ($backendRunning) {
    Write-Success "API already running on port $port"
} elseif (-not $SkipBackend) {
    Write-Warning "Starting backend API..."
    Write-Host "💡 New terminal window will open for backend" -ForegroundColor Cyan
    Write-Host "💡 Backend will run on: http://localhost:$port" -ForegroundColor Cyan
    Write-Host "💡 Close the terminal to stop backend" -ForegroundColor Cyan
    Write-Host ""
    
    # Start backend in new PowerShell window
    $backendScript = "npm run dev:server; Read-Host 'Press Enter to close'"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$projectPath'; $backendScript" -WindowStyle Normal
    
    Write-Host "Waiting for backend to be ready..." -ForegroundColor Cyan
    $maxAttempts = 15
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        Start-Sleep -Seconds 1
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:$port/api/health" -TimeoutSec 1 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                Write-Success "Backend API is ready"
                $backendRunning = $true
                break
            }
        } catch {
            $attempt++
            Write-Host "⏳ Attempt $attempt/$maxAttempts... waiting..." -ForegroundColor Gray
        }
    }
    
    if (-not $backendRunning) {
        Write-Warning "Backend may not be responding. Tests might fail."
    }
} else {
    Write-Warning "Backend check skipped (--SkipBackend flag used)"
}

Write-Host ""

# Step 4: Run Tests
Write-Step "Running Admin Hierarchy Tests" 4
Write-Host ""

$testArgs = @("test", "--", "testsprite_tests/TC031_Admin_Hierarchy.ts")

if ($Verbose) {
    $testArgs += "--verbose"
}

if ($CoverageOnly) {
    $testArgs = @("run", "test:coverage", "--", "testsprite_tests/TC031_Admin_Hierarchy.ts")
}

if ($TestPattern) {
    $testArgs += @("--testNamePattern=$TestPattern")
}

Write-Info "Running: npm $($testArgs -join ' ')"
Write-Host ""

& npm @testArgs

$testExitCode = $LASTEXITCODE

Write-Host ""
Write-Host "═════════════════════════════════════════════════════════════" -ForegroundColor Cyan

if ($testExitCode -eq 0) {
    Write-Success "All tests passed!"
    Write-Host ""
    Write-Host "📊 Test Reports:" -ForegroundColor Green
    Write-Host "  • HTML Report: test-reports\report.html" -ForegroundColor Green
    Write-Host "  • JUnit XML: test-reports\junit.xml" -ForegroundColor Green
    Write-Host "  • Coverage: test-reports\coverage\index.html" -ForegroundColor Green
} else {
    Write-Error-Custom "Some tests failed (Exit code: $testExitCode)"
    Write-Host ""
    Write-Host "🔧 Troubleshooting:" -ForegroundColor Red
    Write-Host "  • Check that backend is running: npm run dev:server" -ForegroundColor Red
    Write-Host "  • Verify database: npm run db:migrate" -ForegroundColor Red
    Write-Host "  • Review logs in backend console" -ForegroundColor Red
    Write-Host "  • Run with verbose: .\run-admin-hierarchy-tests.ps1 -Verbose" -ForegroundColor Red
}

Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Review test output above" -ForegroundColor Cyan
Write-Host "  2. Check test reports in test-reports\ folder" -ForegroundColor Cyan
Write-Host "  3. For more options, run: npm test -- --help" -ForegroundColor Cyan
Write-Host "  4. To run specific tests: .\run-admin-hierarchy-tests.ps1 -TestPattern 'pattern'" -ForegroundColor Cyan
Write-Host ""

# Advanced usage examples
Write-Host "💡 Advanced Usage Examples:" -ForegroundColor Cyan
Write-Host "  # Run with verbose output:" -ForegroundColor Cyan
Write-Host "  .\run-admin-hierarchy-tests.ps1 -Verbose" -ForegroundColor Gray
Write-Host ""
Write-Host "  # Run specific test suite:" -ForegroundColor Cyan
Write-Host "  .\run-admin-hierarchy-tests.ps1 -TestPattern 'Super Admin'" -ForegroundColor Gray
Write-Host ""
Write-Host "  # Run coverage only:" -ForegroundColor Cyan
Write-Host "  .\run-admin-hierarchy-tests.ps1 -CoverageOnly" -ForegroundColor Gray
Write-Host ""
Write-Host "  # Skip backend check:" -ForegroundColor Cyan
Write-Host "  .\run-admin-hierarchy-tests.ps1 -SkipBackend" -ForegroundColor Gray
Write-Host ""

exit $testExitCode
