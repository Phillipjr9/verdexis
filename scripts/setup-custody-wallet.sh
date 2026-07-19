#!/bin/bash

# VERDEXIS Custody Wallet Setup Script
# This script helps generate custody wallets and configure environment variables

set -e

echo "🔐 VERDEXIS Custody Wallet Setup"
echo "=================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC}  $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

# Check Node.js is installed
if ! command -v node &> /dev/null; then
  print_error "Node.js is required but not installed"
  exit 1
fi

print_step "Node.js found: $(node --version)"

# Menu
echo "Choose action:"
echo "1) Generate new Ethereum custody wallet"
echo "2) Generate new Solana custody wallet"
echo "3) Show current environment config"
echo "4) Test withdrawal config endpoint"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
  1)
    echo ""
    echo "📦 Generating Ethereum Custody Wallet..."
    echo "Requires ethers.js CLI (npm install -g ethers)"
    echo ""
    echo "Run this command manually:"
    echo "  ${GREEN}ethers wallet create${NC}"
    echo ""
    echo "Or use cast (Foundry):"
    echo "  ${GREEN}cast wallet new${NC}"
    echo ""
    print_warning "Save the private key and address carefully!"
    ;;

  2)
    echo ""
    echo "📦 Generating Solana Custody Wallet..."
    echo "Requires Solana CLI"
    echo ""
    echo "Run these commands:"
    echo "  ${GREEN}solana-keygen new --outfile custody-keypair.json${NC}"
    echo "  ${GREEN}solana address -k custody-keypair.json${NC}"
    echo "  ${GREEN}cat custody-keypair.json${NC}"
    echo ""
    print_warning "Keep the keypair file safe! It's your private key."
    ;;

  3)
    echo ""
    echo "📋 Current Environment Configuration"
    echo ""
    if [ -f "server/.env" ]; then
      echo "Found server/.env:"
      echo ""
      grep -E "ETHEREUM_|SOLANA_|DATABASE_URL|JWT_SECRET" server/.env || echo "(No custody vars configured)"
    else
      print_warning "server/.env not found"
    fi
    echo ""
    echo "To configure, copy from template:"
    echo "  ${GREEN}cp server/.env.custody-template server/.env${NC}"
    ;;

  4)
    echo ""
    echo "🧪 Testing Withdrawal Config Endpoint"
    echo ""
    
    # Check if server is running
    if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
      print_step "Server is running on localhost:4000"
      echo ""
      
      # Ask for JWT token
      read -p "Enter JWT token (leave blank to skip auth): " jwt_token
      
      if [ -z "$jwt_token" ]; then
        echo ""
        echo "Calling without auth:"
        curl -s http://localhost:4000/api/withdrawals/config | jq . 2>/dev/null || echo "Failed to fetch config"
      else
        echo ""
        echo "Calling with auth:"
        curl -s http://localhost:4000/api/withdrawals/config \
          -H "Authorization: Bearer $jwt_token" | jq . 2>/dev/null || echo "Failed to fetch config"
      fi
    else
      print_error "Server is not running on localhost:4000"
      echo ""
      echo "Start the server:"
      echo "  ${GREEN}cd server && npm run dev${NC}"
    fi
    ;;

  *)
    print_error "Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "📚 For detailed setup instructions, see:"
echo "  docs/CUSTODY_WALLET_SETUP.md"
