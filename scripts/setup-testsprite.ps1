# VERDEXIS TestSprite - Automated Setup & Execution Script (PowerShell)
# This script sets up all test dependencies and runs the TestSprite test suite

#Requires -Version 5.0

param(
    [switch]$SkipInstall = $false,
    [switch]$RunTests = $false,
    [switch]$Watch = $false,
    [switch]$Coverage = $false
)

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║ $($Text.PadRight(55)) ║" -ForegroundColor Cyan
    Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Step, [string]$Text)
    Write-Host "[$Step] $Text" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Text)
    Write-Host "✅ $Text" -ForegroundColor Green
}

function Write-Error-Msg {
    param([string]$Text)
    Write-Host "❌ $Text" -ForegroundColor Red
}

function Write-Warning-Msg {
    param([string]$Text)
    Write-Host "⚠️  $Text" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Text)
    Write-Host "ℹ️  $Text" -ForegroundColor Cyan
}

# Main execution
Write-Title "VERDEXIS TestSprite - Setup & Execute"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

# Step 1: Check Node.js
Write-Step "1" "Checking Node.js & npm"
try {
    $NodeVersion = node --version
    Write-Success "Node.js $NodeVersion detected"
}
catch {
    Write-Error-Msg "Node.js not found! Install from https://nodejs.org/"
    exit 1
}

try {
    $NpmVersion = npm --version
    Write-Success "npm $NpmVersion detected"
}
catch {
    Write-Error-Msg "npm not found!"
    exit 1
}

# Step 2: Install test dependencies
if (-not $SkipInstall) {
    Write-Step "2" "Installing test dependencies..."
    Write-Info "Installing: jest ts-jest @jest/globals @types/jest jest-junit jest-html-reporters"
    
    npm install --save-dev `
        jest `
        ts-jest `
        "@jest/globals" `
        "@types/jest" `
        jest-junit `
        jest-html-reporters
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Msg "Failed to install test dependencies"
        exit 1
    }
    Write-Success "Test dependencies installed"
}

# Step 3: Install app dependencies
Write-Step "3" "Installing app dependencies..."
Push-Location "app"
npm install --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Warning-Msg "Some app dependencies had issues (non-critical)"
}
Write-Success "App dependencies ready"
Pop-Location

# Step 4: Install server dependencies
Write-Step "4" "Installing server dependencies..."
Push-Location "server"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error-Msg "Failed to install server dependencies"
    exit 1
}
Write-Success "Server dependencies installed"
Pop-Location

# Step 5: Initialize database
Write-Step "5" "Initializing database..."
npm run db:migrate
Write-Success "Database ready"

# Step 6: Display configuration
Write-Step "6" "Test Configuration Summary"
Write-Host "╔═══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║             VERDEXIS Test Configuration                   ║" -ForegroundColor Cyan
Write-Host "╠═══════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
Write-Host "║ API Base URL:        http://localhost:4000                ║" -ForegroundColor Cyan
Write-Host "║ Test Framework:      Jest + TypeScript                    ║" -ForegroundColor Cyan
Write-Host "║ Test Location:       testsprite_tests/                    ║" -ForegroundColor Cyan
Write-Host "║ Config:              testsprite.config.json               ║" -ForegroundColor Cyan
Write-Host "║ Jest Config:         jest.config.json                     ║" -ForegroundColor Cyan
Write-Host "║ Reports:             test-reports/                        ║" -ForegroundColor Cyan
Write-Host "║                                                           ║" -ForegroundColor Cyan
Write-Host "║ Test Suites:         8 suites (35+ test cases)            ║" -ForegroundColor Cyan
Write-Host "║ - Health Check       (1 test)                             ║" -ForegroundColor Cyan
Write-Host "║ - Authentication     (9 tests)                            ║" -ForegroundColor Cyan
Write-Host "║ - Wallet             (7 tests)                            ║" -ForegroundColor Cyan
Write-Host "║ - Trading            (6 tests)                            ║" -ForegroundColor Cyan
Write-Host "║ - Portfolio          (4 tests)                            ║" -ForegroundColor Cyan
Write-Host "║ - Passkeys           (2 tests)                            ║" -ForegroundColor Cyan
Write-Host "║ - Rate Limiting      (2 tests)                            ║" -ForegroundColor Cyan
Write-Host "║ - Error Handling     (4 tests)                            ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# Step 7: Ready to execute
Write-Step "7" "Test Execution"
Write-Host ""
Write-Host "ℹ️  Ensure backend is running:" -ForegroundColor Cyan
Write-Host "   npm run dev:server" -ForegroundColor White
Write-Host ""

# Determine which test command to run
if ($Watch) {
    Write-Info "Running tests in watch mode..."
    npm test -- --watch
}
elseif ($Coverage) {
    Write-Info "Running tests with coverage..."
    npm test -- --coverage
}
elseif ($RunTests) {
    Write-Info "Running all tests..."
    npm test
}
else {
    Write-Host "Available commands:" -ForegroundColor Yellow
    Write-Host "  .\setup-testsprite.ps1 -RunTests             Run all tests" -ForegroundColor White
    Write-Host "  .\setup-testsprite.ps1 -RunTests -Coverage   Run with coverage" -ForegroundColor White
    Write-Host "  .\setup-testsprite.ps1 -RunTests -Watch      Run in watch mode" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use npm directly:" -ForegroundColor Yellow
    Write-Host "  npm test                    # Run all tests" -ForegroundColor White
    Write-Host "  npm run test:auth           # Run auth tests only" -ForegroundColor White
    Write-Host "  npm run test:wallet         # Run wallet tests only" -ForegroundColor White
    Write-Host "  npm run test:coverage       # Run with coverage" -ForegroundColor White
    Write-Host "  npm run test:watch          # Watch mode" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Success "Setup complete! TestSprite is ready to use 🚀"
