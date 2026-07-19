#!/bin/bash

# VERDEXIS Mainnet Custody Wallet Generator
# Generates production wallets for Ethereum and Solana mainnet

echo "🔐 VERDEXIS Mainnet Custody Wallet Generator"
echo "=============================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js required. Install from https://nodejs.org/"
  exit 1
fi

# Install ethers CLI globally if not present
if ! command -v ethers &> /dev/null; then
  echo "Installing ethers.js CLI..."
  npm install -g ethers
fi

echo "🔑 ETHEREUM MAINNET WALLET"
echo "=========================="
echo ""
echo "Generating new Ethereum mainnet custody wallet..."
echo ""

# Generate Ethereum wallet
ETHEREUM_OUTPUT=$(ethers wallet create --no-mnemonic 2>&1)
ETHEREUM_ADDRESS=$(echo "$ETHEREUM_OUTPUT" | grep "Address:" | awk '{print $2}')
ETHEREUM_PRIVATE_KEY=$(echo "$ETHEREUM_OUTPUT" | grep "Private Key:" | awk '{print $3}')

echo "✅ Ethereum Wallet Generated:"
echo "   Address:     $ETHEREUM_ADDRESS"
echo "   Private Key: $ETHEREUM_PRIVATE_KEY"
echo ""

echo "🔑 SOLANA MAINNET WALLET"
echo "========================"
echo ""
echo "Generating new Solana mainnet custody wallet..."
echo ""

# Generate Solana wallet
if command -v solana-keygen &> /dev/null; then
  solana-keygen new --outfile solana-custody-keypair.json --force
  SOLANA_ADDRESS=$(solana address -k solana-custody-keypair.json 2>/dev/null || echo "MANUAL: Run: solana address -k solana-custody-keypair.json")
  
  # Extract private key from keypair JSON
  SOLANA_PRIVATE_KEY=$(node -e "const k=require('./solana-custody-keypair.json'); console.log(k.join(','))")
  
  echo "✅ Solana Wallet Generated:"
  echo "   Address: $SOLANA_ADDRESS"
  echo "   Keypair saved to: solana-custody-keypair.json"
  echo ""
  echo "   Private Key (base58): $SOLANA_PRIVATE_KEY"
else
  echo "⚠️  Solana CLI not found. Install from:"
  echo "   https://docs.solana.com/cli/install-solana-cli-tools"
fi

echo ""
echo "📝 NEXT STEPS:"
echo "=============="
echo ""
echo "1. FUND THE WALLETS (MAINNET - REAL MONEY):"
echo "   - Send ETH to: $ETHEREUM_ADDRESS"
echo "   - Send SOL to: $SOLANA_ADDRESS"
echo "   - Recommended: 0.5+ ETH and 1+ SOL for gas fees"
echo ""
echo "2. CONFIGURE ENVIRONMENT:"
echo "   cp server/.env.custody-template server/.env"
echo ""
echo "3. EDIT server/.env with these values:"
echo ""
echo "   ETHEREUM_WITHDRAWAL_PRIVATE_KEY=$ETHEREUM_PRIVATE_KEY"
echo "   ETHEREUM_RPC_ENDPOINT=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY"
echo "   ETHEREUM_WITHDRAWAL_ADDRESS=$ETHEREUM_ADDRESS"
echo ""
echo "   SOLANA_WITHDRAWAL_PRIVATE_KEY=$SOLANA_PRIVATE_KEY"
echo "   SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com"
echo "   SOLANA_WITHDRAWAL_ADDRESS=$SOLANA_ADDRESS"
echo ""
echo "4. TEST WITHDRAWALS"
echo "5. DEPLOY TO PRODUCTION"
echo ""

# Save to file for reference
cat > MAINNET_WALLETS.txt << EOF
VERDEXIS MAINNET CUSTODY WALLETS
Generated: $(date)

⚠️  KEEP THIS FILE SECURE - IT CONTAINS PRIVATE KEYS!
⚠️  NEVER COMMIT TO GIT
⚠️  DELETE AFTER CONFIGURING .env

ETHEREUM MAINNET
================
Address:     $ETHEREUM_ADDRESS
Private Key: $ETHEREUM_PRIVATE_KEY

SOLANA MAINNET
==============
Address:     $SOLANA_ADDRESS
Private Key: $SOLANA_PRIVATE_KEY
(Also saved in: solana-custody-keypair.json)

FUNDING INSTRUCTIONS
====================
Send mainnet funds to the custody wallet addresses above.
Recommended amounts:
- Ethereum: 0.5+ ETH (~$1000+)
- Solana: 1+ SOL (~$200+)

These will be used for withdrawal transaction fees.

SECURITY NOTES
==============
✓ Private keys are ONLY needed once to configure server/.env
✓ After configuration, you can delete this file and solana-custody-keypair.json
✓ In production, use environment variable management (Vercel, Railway, etc.)
✓ Consider using a hardware wallet for extra security
✓ Rotate keys quarterly or after staff changes
EOF

echo "💾 Wallet details saved to: MAINNET_WALLETS.txt"
echo ""
echo "⚠️  SECURITY REMINDER:"
echo "   - This file contains private keys - keep it secret!"
echo "   - Delete after configuring server/.env"
echo "   - Never commit to git"
