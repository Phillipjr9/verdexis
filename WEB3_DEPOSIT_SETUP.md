# Web3 Deposit Feature - Setup Guide

This guide explains how to set up direct crypto deposits from MetaMask and other Web3 wallets.

## Overview

Users can now send crypto directly from their MetaMask wallet to your admin wallet on multiple chains:
- **Ethereum Mainnet** (ETH, stablecoins, other ERC-20s)
- **Sepolia Testnet** (for testing)
- **Polygon** (MATIC, tokens)
- **Arbitrum** (ETH, tokens)

## Setup Steps

### 1. Configure Deposit Addresses (Admin Only)

1. Log in as an admin
2. Go to **Admin Settings** → **Integrations** → **Web3 Deposits**
3. For each blockchain you want to support:
   - Enter your wallet address (e.g., a hardware wallet or multi-sig)
   - Add a label (e.g., "Main Treasury")
   - Add optional notes (e.g., "3-of-5 multi-sig")
4. Click **Save Addresses**

Example:
```
Ethereum Mainnet:
  Address: 0x1234567890123456789012345678901234567890
  Label: Treasury Multi-sig
  Notes: 3-of-5 multi-sig. Do not send < 0.1 ETH
```

### 2. User Flow (Self-Custody Deposits)

Users follow these steps:

1. **Connect Wallet**
   - Click "Connect Wallet" on the Wallet page
   - Select MetaMask or their Web3 wallet
   - Approve the connection

2. **View Admin Address**
   - See the configured deposit address for their current blockchain
   - Address is shown with your label and notes

3. **Send Crypto**
   - Enter amount and click "Send ETH Now"
   - MetaMask popup appears
   - User reviews transaction and confirms
   - Transaction broadcasts to blockchain

4. **Pending Deposit**
   - System records as "pending" in user dashboard
   - Shows transaction hash and status
   - Admin receives notification

5. **Admin Approval**
   - Admin reviews pending deposits
   - Verifies on-chain transaction (optional)
   - Credits user account
   - User receives notification

### 3. Code Structure

**Frontend Components:**
- `Web3DepositComponent.tsx` - User-facing deposit UI
- `AdminWeb3DepositSettings.tsx` - Admin settings to configure addresses
- `use-web3.ts` hook - Manages wallet connection and transactions

**Libraries:**
- `web3Transfer.ts` - Handles ERC-20 transfers and pending deposit tracking
- `walletConnect.ts` - WalletConnect integration with 8-second timeout

**Backend:**
- `/api/wallet/pending-deposits` - Records on-chain transfers
- `/api/wallet/deposit-instructions` - Stores admin-configured addresses

## Transaction Flow Diagram

```
User (MetaMask)
    ↓
Connect Wallet Hook (use-web3.ts)
    ↓
Web3 Transfer Component (Web3DepositComponent.tsx)
    ↓
MetaMask Signs Transaction
    ↓
Transaction Sent to Blockchain
    ↓
Frontend Records Pending Deposit (/api/wallet/pending-deposits)
    ↓
Admin Dashboard Shows Pending Deposits
    ↓
Admin Reviews & Verifies (checks on-chain tx hash)
    ↓
Admin Credits User Account
    ↓
User Balance Updated
```

## API Endpoints

### Get Deposit Instructions (User)
```bash
GET /api/wallet/deposit-instructions
Authorization: Bearer <token>

Response:
{
  "instructions": {
    "web3": {
      "0x1": {
        "address": "0x...",
        "label": "Ethereum Treasury",
        "notes": "3-of-5 multi-sig"
      }
    }
  }
}
```

### Update Deposit Addresses (Admin)
```bash
PUT /api/wallet/deposit-instructions
Authorization: Bearer <admin-token>

Body:
{
  "wires": [...],
  "cryptos": [...],
  "web3": {
    "0x1": {
      "address": "0x...",
      "label": "...",
      "notes": "..."
    }
  }
}
```

### Record Pending Deposit
```bash
POST /api/wallet/pending-deposits
Authorization: Bearer <token>

Body:
{
  "txHash": "0x...",
  "chainId": "0x1",
  "toAddress": "0x...",
  "fromAddress": "0x...",
  "asset": "ETH",
  "amount": 1.5
}

Response:
{
  "pendingDeposit": {
    "id": "...",
    "txHash": "0x...",
    "status": "pending",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

### Get Pending Deposits (Admin)
```bash
GET /api/wallet/pending-deposits
Authorization: Bearer <admin-token>

Response:
{
  "pendingDeposits": [
    {
      "id": "...",
      "txHash": "0x...",
      "chainId": "0x1",
      "fromAddress": "0x...",
      "toAddress": "0x...",
      "asset": "ETH",
      "amount": 1.5,
      "status": "pending",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

## Security Considerations

1. **Hardware Wallet Recommended**
   - Use a hardware wallet (Ledger, Trezor) for the deposit address
   - Or use a multi-sig wallet (Gnosis Safe)

2. **Chain Verification**
   - Admin should verify user's transaction on block explorer
   - Check sender address, amount, and timestamp

3. **Rate Limiting**
   - Backend applies rate limiting (moneyLimiter middleware)
   - Prevents spam and abuse

4. **Idempotency**
   - Duplicate deposits are deduplicated by txHash
   - Prevents accidental double-crediting

5. **Admin Approval Required**
   - No automatic crediting to user accounts
   - Admin manually verifies each deposit
   - Admin inputs confirmed amount to credit

## Troubleshooting

### "WalletConnect initialization timeout"
- Network may be slow or blocked
- Check firewall/proxy settings
- Try again in a few seconds

### MetaMask popup doesn't appear
- Make sure MetaMask extension is installed
- Try browser restart
- Check extension permissions

### Transaction fails
- Insufficient gas (add 21000 more)
- Network congestion (retry later)
- Wrong recipient address

### Admin settings not saving
- Check admin role
- Verify address format (must start with 0x)
- Check console for errors

## Testing

### Sepolia Testnet (Free Test ETH)
1. Configure Sepolia address in admin settings
2. Get free ETH at faucet.sepolia.dev
3. Send 0.01 ETH to your treasury address
4. Verify pending deposit appears

### Polygon Testnet (Mumbai)
1. Get free MATIC at faucet.polygon.technology
2. Testnet transactions are instant and free

## Next Steps

1. Set up your hardware wallet or multi-sig
2. Configure addresses in Admin Settings
3. Test with testnet first
4. Enable for production
5. Announce to users

## Support

For issues or questions:
- Check browser console (F12)
- Review transaction on block explorer
- Contact admin support
