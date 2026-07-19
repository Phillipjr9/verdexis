@echo off
REM VERDEXIS Mainnet Custody Wallet Generator (Windows)
REM Generates production wallets for Ethereum and Solana mainnet

setlocal enabledelayedexpansion

cls
echo.
echo 🔐 VERDEXIS Mainnet Custody Wallet Generator
echo =============================================
echo.

REM Check Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo ❌ Node.js required. Install from https://nodejs.org/
  pause
  exit /b 1
)

echo ✓ Node.js found
echo.

REM Check ethers CLI
where ethers >nul 2>nul
if errorlevel 1 (
  echo Installing ethers.js CLI (this may take a minute)...
  echo.
  call npm install -g ethers
  if errorlevel 1 (
    echo ❌ Failed to install ethers CLI
    pause
    exit /b 1
  )
)

echo.
echo 🔑 ETHEREUM MAINNET WALLET
echo ==========================
echo.
echo Generating new Ethereum mainnet custody wallet...
echo.

REM Generate Ethereum wallet
for /f "tokens=*" %%i in ('ethers wallet create --no-mnemonic 2^>^&1') do (
  set "line=%%i"
  if "!line:~0,8!"=="Address:" (
    set "ETHEREUM_ADDRESS=!line:~9!"
  )
  if "!line:~0,12!"=="Private Key:" (
    set "ETHEREUM_PRIVATE_KEY=!line:~13!"
  )
)

echo ✅ Ethereum Wallet Generated:
echo    Address:     %ETHEREUM_ADDRESS%
echo    Private Key: %ETHEREUM_PRIVATE_KEY%
echo.

echo 🔑 SOLANA MAINNET WALLET
echo ========================
echo.
echo Checking for Solana CLI...
echo.

where solana-keygen >nul 2>nul
if errorlevel 1 (
  echo ⚠  Solana CLI not installed
  echo.
  echo To use Solana, install Solana CLI from:
  echo   https://docs.solana.com/cli/install-solana-cli-tools
  echo.
  echo For now, you can use an existing Solana mainnet wallet address and private key.
  echo.
  set "SOLANA_ADDRESS=YOUR_SOLANA_ADDRESS"
  set "SOLANA_PRIVATE_KEY=YOUR_SOLANA_PRIVATE_KEY"
) else (
  echo Generating new Solana mainnet custody wallet...
  echo.
  
  call solana-keygen new --outfile solana-custody-keypair.json --force
  
  for /f "tokens=*" %%i in ('solana address -k solana-custody-keypair.json 2^>nul') do (
    set "SOLANA_ADDRESS=%%i"
  )
  
  echo ✅ Solana Wallet Generated:
  echo    Address: !SOLANA_ADDRESS!
  echo    Keypair saved to: solana-custody-keypair.json
)

echo.
echo =========================================
echo 📝 NEXT STEPS
echo =========================================
echo.
echo 1. FUND THE WALLETS (MAINNET - REAL MONEY):
echo    - Send ETH to: %ETHEREUM_ADDRESS%
echo    - Send SOL to: %SOLANA_ADDRESS%
echo    - Recommended: 0.5+ ETH (^^^~$1000+^^^) and 1+ SOL (^^^~$200+^^^)
echo.
echo 2. CONFIGURE ENVIRONMENT:
echo    copy server\.env.custody-template server\.env
echo.
echo 3. EDIT server\.env with these values:
echo.
echo    ETHEREUM_WITHDRAWAL_PRIVATE_KEY=%ETHEREUM_PRIVATE_KEY%
echo    ETHEREUM_RPC_ENDPOINT=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
echo    ETHEREUM_WITHDRAWAL_ADDRESS=%ETHEREUM_ADDRESS%
echo.
echo    SOLANA_WITHDRAWAL_PRIVATE_KEY=%SOLANA_PRIVATE_KEY%
echo    SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com
echo    SOLANA_WITHDRAWAL_ADDRESS=%SOLANA_ADDRESS%
echo.
echo 4. GET RPC ENDPOINTS:
echo    - Ethereum Alchemy: https://www.alchemy.com/
echo    - Solana QuickNode: https://www.quicknode.com/
echo.
echo 5. START SERVER AND TEST:
echo    cd server
echo    npm run dev
echo.
echo 6. DEPLOY TO PRODUCTION
echo.

REM Save to file
(
  echo VERDEXIS MAINNET CUSTODY WALLETS
  echo Generated: %date% %time%
  echo.
  echo ⚠ KEEP THIS FILE SECURE - IT CONTAINS PRIVATE KEYS!
  echo ⚠ NEVER COMMIT TO GIT
  echo ⚠ DELETE AFTER CONFIGURING .env
  echo.
  echo ETHEREUM MAINNET
  echo ================
  echo Address:     %ETHEREUM_ADDRESS%
  echo Private Key: %ETHEREUM_PRIVATE_KEY%
  echo.
  echo SOLANA MAINNET
  echo ==============
  echo Address:     %SOLANA_ADDRESS%
  echo Private Key: %SOLANA_PRIVATE_KEY%
  echo.
  echo If solana-custody-keypair.json exists, it also contains the Solana private key.
  echo.
  echo FUNDING INSTRUCTIONS
  echo ====================
  echo Send mainnet funds to the custody wallet addresses above.
  echo.
  echo Recommended amounts:
  echo - Ethereum: 0.5+ ETH (allows ~100+ withdrawals with current gas)
  echo - Solana: 1+ SOL (allows ~1000+ withdrawals)
  echo.
  echo SECURITY NOTES
  echo ===============
  echo ✓ Private keys are ONLY needed once to configure server/.env
  echo ✓ After configuration, delete this file and solana-custody-keypair.json
  echo ✓ In production, store secrets in Vercel/Railway environment dashboard
  echo ✓ Never commit private keys to git
  echo ✓ Rotate keys quarterly or after staff changes
) > MAINNET_WALLETS.txt

echo.
echo 💾 Wallet details saved to: MAINNET_WALLETS.txt
echo.
echo ⚠ SECURITY REMINDER:
echo    - This file contains private keys - keep it secret!
echo    - Delete after configuring server\.env
echo    - Never commit to git
echo.
pause
