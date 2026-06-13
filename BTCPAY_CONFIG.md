# VERDEXIS - BTCPay Server Configuration

## Summary

VERDEXIS has been simplified to use **BTCPay Server** as the exclusive crypto deposit provider. All references to Crypto.com Pay and Coinbase Commerce have been removed from the deposit flow.

## Changes Made

### 1. Deposits Route (`server/src/routes/deposits.ts`)
- ✅ Removed multi-provider fallback logic
- ✅ Removed Crypto.com Pay imports and handling
- ✅ Removed Coinbase Commerce imports and handling
- ✅ Kept BTCPay Server as the only provider
- ✅ Renamed `/api/deposits/providers` → `/api/deposits/provider` (single provider)
- ✅ Simplified deposit initiation flow

### 2. Environment Configuration (`server/.env.example`)
- ✅ Removed `CRYPTOCOM_PAY_KEY` and `CRYPTOCOM_PAY_SECRET`
- ✅ Removed `COINBASE_COMMERCE_KEY`
- ✅ Added BTCPay environment variables:
  - `BTCPAY_SERVER_URL`
  - `BTCPAY_API_KEY`
  - `BTCPAY_STORE_ID`

### 3. Environment Schema (`server/src/env.ts`)
- ✅ Added optional BTCPay configuration variables

## API Endpoints

### Get Provider Info
```
GET /api/deposits/provider
```

Returns info about BTCPay Server (0% fees, supported currencies, etc.)

### Initiate Deposit
```
POST /api/deposits/initiate
Body: { amount: number, currency: string }
```

Returns BTCPay invoice with payment URL and deposit address.

### Check Deposit Status
```
GET /api/deposits/:depositId
```

Returns current status of a pending deposit.

### Webhook Handler
```
POST /api/webhooks/btcpay
```

Accepts webhook events from BTCPay Server. Automatically credits user wallet upon payment confirmation.

## Legacy Provider Files

The following files are **NOT used** and can be kept for reference or removed:
- `server/src/providers/cryptocomPay.ts` (unused)
- `server/src/providers/coinbaseCommerce.ts` (unused)

Only `server/src/providers/btcpayServer.ts` is actively used.

## Setup Instructions

1. Deploy a self-hosted BTCPay Server instance
2. Create a store and API key in BTCPay
3. Configure environment variables in `server/.env`
4. Set up webhook at `https://your-api.com/api/webhooks/btcpay`
5. Restart the server

See `BTCPAY_SETUP.md` for detailed instructions.

## Supported Cryptocurrencies

- Bitcoin (BTC)
- Ethereum (ETH)
- Monero (XMR)
- Litecoin (LTC)
- Dogecoin (DOGE)
- Any other currency your BTCPay instance supports

## Advantages of BTCPay

| Feature | BTCPay | Crypto.com | Coinbase |
|---------|--------|-----------|----------|
| Fees | 0% | 0.1% | 1% + $30/mo |
| Hosting | Self-hosted | Managed | Managed |
| Control | Full | Limited | Limited |
| Privacy | High | Medium | Low |
| Setup | More complex | Simple | Simple |

## Next Steps

1. Deploy BTCPay Server instance
2. Generate API key and store ID
3. Configure `.env` variables
4. Set up webhooks
5. Test deposit flow in sandbox/testnet
6. Deploy to production

For frontend integration, see the deposit components in `app/src/components/`.
