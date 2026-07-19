@echo off
REM VERDEXIS Custody Wallet Setup Script for Windows
REM This script helps configure custody wallets

setlocal enabledelayedexpansion

echo.
echo 🔐 VERDEXIS Custody Wallet Setup (Windows)
echo ==========================================
echo.

REM Check Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ✗ Node.js is required but not installed
  exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js found: %NODE_VERSION%

echo.
echo Choose action:
echo 1 - Generate new Ethereum custody wallet
echo 2 - Generate new Solana custody wallet  
echo 3 - Show current environment config
echo 4 - Test withdrawal config endpoint
echo 5 - Copy environment template
echo.

set /p choice="Enter choice (1-5): "

if "%choice%"=="1" (
  cls
  echo.
  echo 📦 Generating Ethereum Custody Wallet...
  echo.
  echo Option 1: Using ethers.js CLI
  echo   npm install -g ethers
  echo   ethers wallet create
  echo.
  echo Option 2: Using Foundry (Windows)
  echo   Download from: https://book.getfoundry.sh/
  echo   cast wallet new
  echo.
  echo Option 3: Export from MetaMask
  echo   Open MetaMask Settings ^> Security & Privacy ^> Reveal Secret Recovery Phrase
  echo   Or export private key directly if available
  echo.
  echo ⚠  Save the private key and address carefully!
  echo.
  pause
  
) else if "%choice%"=="2" (
  cls
  echo.
  echo 📦 Generating Solana Custody Wallet...
  echo.
  echo Step 1: Install Solana CLI
  echo   https://docs.solana.com/cli/install-solana-cli-tools
  echo.
  echo Step 2: Generate keypair
  echo   solana-keygen new --outfile custody-keypair.json
  echo.
  echo Step 3: View wallet address
  echo   solana address -k custody-keypair.json
  echo.
  echo Step 4: Export keypair (base58 private key^)
  echo   type custody-keypair.json
  echo.
  echo ⚠  Keep the keypair file safe! It's your private key.
  echo.
  pause
  
) else if "%choice%"=="3" (
  cls
  echo.
  echo 📋 Current Environment Configuration
  echo.
  if exist "server\.env" (
    echo Found server\.env:
    echo.
    findstr /R "ETHEREUM_ SOLANA_ DATABASE_URL JWT_SECRET" server\.env || (
      echo (No custody vars configured^)
    )
  ) else (
    echo ⚠  server\.env not found
  )
  echo.
  echo To configure, copy from template:
  echo   copy server\.env.custody-template server\.env
  echo.
  pause
  
) else if "%choice%"=="4" (
  cls
  echo.
  echo 🧪 Testing Withdrawal Config Endpoint
  echo.
  
  REM Check if server is running
  for /f "tokens=*" %%i in ('curl -s -o nul -w "%%{http_code}" http://localhost:4000/api/health 2^>nul') do set HTTP_CODE=%%i
  
  if "!HTTP_CODE!"=="200" (
    echo ✓ Server is running on localhost:4000
    echo.
    set /p jwt_token="Enter JWT token (leave blank to skip auth): "
    
    if "!jwt_token!"=="" (
      echo.
      echo Calling without auth:
      curl -s http://localhost:4000/api/withdrawals/config
    ) else (
      echo.
      echo Calling with auth:
      curl -s http://localhost:4000/api/withdrawals/config -H "Authorization: Bearer !jwt_token!"
    )
  ) else (
    echo ✗ Server is not running on localhost:4000
    echo.
    echo Start the server:
    echo   cd server
    echo   npm run dev
  )
  echo.
  pause
  
) else if "%choice%"=="5" (
  if exist "server\.env.custody-template" (
    copy server\.env.custody-template server\.env
    echo ✓ Copied server\.env.custody-template to server\.env
    echo.
    echo Next steps:
    echo   1. Open server\.env in an editor
    echo   2. Add your Ethereum private key
    echo   3. Add your Ethereum RPC endpoint
    echo   4. Repeat for Solana (optional^)
    echo   5. Restart the server
    echo.
  ) else (
    echo ✗ Template file not found: server\.env.custody-template
  )
  pause
  
) else (
  echo ✗ Invalid choice
  exit /b 1
)

echo.
echo 📚 For detailed setup instructions, see:
echo   docs\CUSTODY_WALLET_SETUP.md
echo.
