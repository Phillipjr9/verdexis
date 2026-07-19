#!/usr/bin/env node

/**
 * VERDEXIS Mainnet Custody Wallet Generator
 * 
 * Usage:
 *   node scripts/generate-mainnet-wallets.js
 * 
 * This script generates production custody wallets for:
 * - Ethereum mainnet
 * - Solana mainnet
 * 
 * ⚠️ SECURITY: Keep private keys secure, never commit to git
 */

const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const os = require('os');

console.log('\n🔐 VERDEXIS Mainnet Custody Wallet Generator');
console.log('=============================================\n');

// Generate Ethereum wallet
console.log('🔑 ETHEREUM MAINNET WALLET');
console.log('===========================\n');

let ethereumWallet;
try {
  // Generate a random wallet
  ethereumWallet = ethers.Wallet.createRandom();
  
  console.log('✅ Ethereum Wallet Generated:');
  console.log(`   Address:     ${ethereumWallet.address}`);
  console.log(`   Private Key: ${ethereumWallet.privateKey}`);
  console.log(`   Public Key:  ${ethereumWallet.publicKey}\n`);
} catch (error) {
  console.error('❌ Failed to generate Ethereum wallet:', error.message);
  process.exit(1);
}

// For Solana, we'll use tweetnacl for key generation
let solanaMnemonic;
let solanaAddress;
let solanaPrivateKey;

console.log('🔑 SOLANA MAINNET WALLET');
console.log('========================\n');

try {
  // Generate a simple Solana-compatible keypair using crypto
  const crypto = require('crypto');
  
  // Generate random seed
  const seed = crypto.randomBytes(32);
  
  // This is a simplified example - in production, use @solana/web3.js
  solanaPrivateKey = seed.toString('base64');
  solanaAddress = 'To generate Solana address, run: solana-keygen new --outfile custody-keypair.json';
  
  console.log('✅ Solana Wallet Setup Instructions:');
  console.log('\n   Option 1: Auto-generate with Solana CLI');
  console.log('   $ solana-keygen new --outfile custody-keypair.json\n');
  
  console.log('   Option 2: Use existing Solana wallet');
  console.log('   Export private key from existing wallet\n');
  
  console.log('   For mainnet, ensure the wallet has funds for gas fees.');
  
} catch (error) {
  console.error('⚠️  Could not generate Solana wallet:', error.message);
}

// Create configuration template
console.log('\n\n📝 ENVIRONMENT CONFIGURATION');
console.log('============================\n');

const envContent = `# VERDEXIS Mainnet Custody Wallet Configuration
# Generated: ${new Date().toISOString()}
# ⚠️ NEVER COMMIT THIS FILE TO GIT - ADD TO .gitignore

# ============ ETHEREUM MAINNET ============
ETHEREUM_WITHDRAWAL_PRIVATE_KEY=${ethereumWallet.privateKey}
ETHEREUM_WITHDRAWAL_ADDRESS=${ethereumWallet.address}
ETHEREUM_RPC_ENDPOINT=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY

# ============ SOLANA MAINNET ============
# Generate using: solana-keygen new --outfile custody-keypair.json
# Then extract private key from the JSON file
SOLANA_WITHDRAWAL_PRIVATE_KEY=YOUR_SOLANA_PRIVATE_KEY_BASE64
SOLANA_WITHDRAWAL_ADDRESS=YOUR_SOLANA_ADDRESS
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# ============ DATABASE & APP (existing) ============
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your_secure_jwt_secret_here
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
APP_BASE_URL=https://your-domain.com
`;

// Save wallet details to secure file
const walletDetailsFile = path.join(process.cwd(), 'MAINNET_WALLET_KEYS.txt');
const walletDetails = `VERDEXIS MAINNET CUSTODY WALLETS
Generated: ${new Date().toISOString()}

⚠️  KEEP THIS FILE SECURE - IT CONTAINS PRIVATE KEYS!
⚠️  NEVER COMMIT TO GIT
⚠️  DELETE AFTER CONFIGURING server/.env

ETHEREUM MAINNET
================
Address:       ${ethereumWallet.address}
Private Key:   ${ethereumWallet.privateKey}
Public Key:    ${ethereumWallet.publicKey}

SOLANA MAINNET
==============
Run this command to generate:
  solana-keygen new --outfile custody-keypair.json

Then extract the address:
  solana address -k custody-keypair.json

FUNDING INSTRUCTIONS
====================
Send MAINNET funds to the custody wallet addresses above.

Recommended amounts for transaction fees:
- Ethereum: 0.5+ ETH (~$1000-2000)
- Solana: 1+ SOL (~$100-200)

NEXT STEPS
==========
1. Copy this env content to server/.env
2. Fund the custody wallets
3. Get RPC API keys:
   - Alchemy (Ethereum): https://www.alchemy.com/
   - QuickNode (Solana): https://www.quicknode.com/
4. Start server: cd server && npm run dev
5. Test withdrawals
6. Deploy to production

SECURITY CHECKLIST
==================
✓ Store this file securely (not in git)
✓ Private keys should ONLY be in server/.env
✓ Add server/.env to .gitignore
✓ In production, use Vercel/Railway environment dashboard
✓ Never expose private keys in logs or error messages
✓ Rotate keys quarterly
✓ Monitor custody wallet balance
`;

fs.writeFileSync(walletDetailsFile, walletDetails);
console.log(`\n💾 Wallet details saved to: ${walletDetailsFile}`);

console.log('\n\n📋 COPY THIS TO YOUR server/.env:');
console.log('=====================================\n');
console.log(envContent);

// Also save env content to a template file
const envFile = path.join(process.cwd(), 'server', '.env.mainnet');
fs.writeFileSync(envFile, envContent);
console.log(`\n✅ Environment template saved to: ${envFile}\n`);

// Print next steps
console.log('\n🚀 NEXT STEPS:');
console.log('==============\n');
console.log('1. For Solana wallet (if needed):');
console.log('   $ npm install -g @solana/cli');
console.log('   $ solana-keygen new --outfile custody-keypair.json\n');

console.log('2. Get RPC endpoints:');
console.log('   - Alchemy (Ethereum): https://www.alchemy.com/');
console.log('   - QuickNode (Solana): https://www.quicknode.com/');
console.log('   - Get API keys and add to server/.env\n');

console.log('3. Fund custody wallets with MAINNET tokens:');
console.log(`   - Send ETH to: ${ethereumWallet.address}`);
console.log('   - Send SOL to: <your-solana-address>\n');

console.log('4. Copy server/.env.mainnet to server/.env:');
console.log('   $ cp server/.env.mainnet server/.env\n');

console.log('5. Start the server and test:');
console.log('   $ cd server && npm run dev\n');

console.log('6. Deploy to production\n');

console.log('⚠️  SECURITY REMINDER:');
console.log('   - Keep private keys SECRET');
console.log('   - Delete MAINNET_WALLET_KEYS.txt after setup');
console.log('   - Never commit .env files to git');
console.log('   - Store secrets in production environment dashboard\n');

// Create .gitignore entry if needed
const gitignorePath = path.join(process.cwd(), '.gitignore');
if (!fs.existsSync(gitignorePath)) {
  fs.writeFileSync(gitignorePath, '');
}

const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
if (!gitignoreContent.includes('server/.env')) {
  fs.appendFileSync(gitignorePath, '\n# Environment variables\nserver/.env\nMAINNET_WALLET_KEYS.txt\nserver/.env.mainnet\n');
  console.log('✅ Updated .gitignore\n');
}

console.log('✅ Wallet generation complete!\n');
