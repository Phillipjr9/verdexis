# VERDEXIS Self-Hosted Wallet Deposits

VERDEXIS uses **self-hosted wallet addresses** for deposits. Admins generate their own wallet addresses for each cryptocurrency, users scan QR codes and send crypto directly. **No third-party payment processors needed.**

## How It Works

1. **Admin creates wallet addresses** for supported cryptocurrencies (BTC, ETH, SOL, etc.)
2. **Admin shares QR codes** with deposit amounts displayed on the dashboard
3. **Users scan QR code** with their wallet app
4. **User sends crypto** to the admin's wallet address
5. **Admin verifies transaction** and confirms deposit in dashboard
6. **User's account credited** with the crypto amount

## Setup Steps

### Step 1: Generate Wallet Addresses

As an admin, generate addresses for each cryptocurrency you accept:

```bash
# Get available cryptocurrencies
GET /api/deposit-addresses/supported

# Generate a new Bitcoin address
GET /api/deposit-addresses/generate?currency=btc

# Generate an Ethereum address
GET /api/deposit-addresses/generate?currency=eth
```

### Step 2: Link Your Wallets

Link your existing wallet addresses to VERDEXIS:

```bash
POST /api/deposit-addresses/link
Content-Type: application/json
Authorization: Bearer {admin_jwt_token}

{
  "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "chainId": "bitcoin",
  "provider": "self-hosted",
  "label": "Main Bitcoin Wallet",
  "isPrimary": true
}
```

### Step 3: Display QR Codes to Users

Frontend displays QR codes with:
- Wallet address
- Expected amount to send
- Countdown timer (24 hours)

Users scan with their wallet app and send crypto.

### Step 4: Confirm Deposits

When you see the transaction on-chain, confirm it in the dashboard:

```bash
POST /api/deposits/:depositId/confirm
Content-Type: application/json
Authorization: Bearer {admin_jwt_token}

{
  "txHash": "0x1234...abcd",
  "confirmations": 1
}
```

The user's account is immediately credited.

## API Endpoints

### Get Supported Currencies
```
GET /api/deposit-addresses/supported
```

Response:
```json
{
  "currencies": [
    { "symbol": "btc", "name": "Bitcoin", "network": "Bitcoin Mainnet" },
    { "symbol": "eth", "name": "Ethereum", "network": "Ethereum Mainnet" },
    { "symbol": "sol", "name": "Solana", "network": "Solana Mainnet" },
    // ... more currencies
  ]
}
```

### Generate Address
```
GET /api/deposit-addresses/generate?currency=btc
```

Response:
```json
{
  "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "currency": "btc",
  "qrCodeUrl": "data:image/png;base64,iVBORw0KGgo..."
}
```

### Link Wallet Address
```
POST /api/deposit-addresses/link

{
  "address": "bc1q...",
  "chainId": "bitcoin",
  "label": "My Bitcoin Wallet",
  "isPrimary": true
}
```

### List Your Addresses
```
GET /api/deposit-addresses
```

### Initiate Deposit Request
```
POST /api/deposits/initiate

{
  "amount": 0.5,
  "currency": "btc",
  "toAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
}
```

Response:
```json
{
  "deposit_id": "dep_abc123",
  "provider": "self-hosted",
  "deposit_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "amount": 0.5,
  "currency": "btc",
  "instructions": "Send 0.5 btc to: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "expires_at": "2024-01-16T10:30:00Z"
}
```

### Check Deposit Status
```
GET /api/deposits/{depositId}
```

### Confirm Deposit (Admin Only)
```
POST /api/deposits/{depositId}/confirm

{
  "txHash": "0x123...abc",
  "confirmations": 1
}
```

## Supported Cryptocurrencies

- Bitcoin (BTC)
- Ethereum (ETH)
- Solana (SOL)
- Polygon (MATIC)
- USD Coin (USDC)
- Tether (USDT)
- Dai (DAI)

## Best Practices

1. **Use hardware wallets** for storing admin wallet addresses
2. **Monitor blockchain** for incoming transactions
3. **Verify transactions** before confirming in dashboard
4. **Keep addresses private** - only share QR codes, not raw addresses
5. **Use a separate admin wallet** per user to track deposits
6. **Document transactions** for accounting/tax purposes

## Security

- All admin actions require JWT authentication
- Deposit confirmations can only be done by admins
- Wallet addresses are stored securely in database
- All deposit history is auditable
- No private keys stored in VERDEXIS

## Wallet Address Generation

For manual address generation outside VERDEXIS:

**Bitcoin:**
```bash
# Using bitcoin-cli
bitcoin-cli getnewaddress "user-label" bech32
```

**Ethereum:**
```bash
# Using ethers.js
const wallet = ethers.Wallet.createRandom()
console.log(wallet.address)
```

**Solana:**
```bash
# Using Solana CLI
solana-keygen new --outfile keypair.json
```

## Troubleshooting

**Q: How do I verify a transaction on-chain?**
- Bitcoin: https://blockchair.com/bitcoin
- Ethereum: https://etherscan.io
- Solana: https://solscan.io

**Q: Can users self-confirm deposits?**
- No, only admins can confirm deposits. This prevents fraud.

**Q: What happens if a user sends the wrong amount?**
- Manual adjustment needed. Admin must approve the actual amount received.

**Q: How long does a deposit take?**
- Depends on blockchain confirmation times (10 min - 2 hours typically)

## Migration from Payment Processors

If migrating from BTCPay/Crypto.com/Coinbase:

1. Generate new wallet addresses in VERDEXIS
2. Update links in admin dashboard
3. Notify users of new deposit addresses
4. Archive old payment processor accounts

## Support

For issues with wallet generation or deposit flow, check:
- Database logs: `pendingDeposit` table for deposit history
- Blockchain explorers: Verify transactions exist
- Admin dashboard: Review deposit queue

## Example Workflow

```
1. User navigates to Wallet → Deposit
2. User selects "Bitcoin" and enters amount "0.5 BTC"
3. Frontend calls POST /api/deposits/initiate with:
   {
     "amount": 0.5,
     "currency": "btc",
     "toAddress": "bc1q..." // from deposit-addresses
   }
4. API returns deposit_id and QR code
5. Frontend displays QR code with "Send 0.5 BTC to bc1q..."
6. User scans QR with their wallet app
7. User sends 0.5 BTC to bc1q...
8. User provides transaction hash to admin (or admin scans blockchain)
9. Admin confirms via POST /api/deposits/{depositId}/confirm
10. User's wallet balance updated: +0.5 BTC
```
