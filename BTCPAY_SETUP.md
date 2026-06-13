# BTCPay Server Setup Guide

VERDEXIS uses **BTCPay Server** as the sole crypto deposit provider. BTCPay is a self-hosted, open-source payment processor with **0% fees** and support for multiple cryptocurrencies.

## Why BTCPay?

- **0% fees** — No transaction costs
- **Self-hosted** — Full control over your infrastructure
- **Multi-currency** — BTC, ETH, XMR, LTC, DOGE, and more
- **Privacy-focused** — No third-party payment processors
- **Webhook support** — Real-time payment notifications

## Prerequisites

1. A server to host BTCPay (VPS, Docker host, or local machine)
2. A domain name (for SSL/TLS)
3. Bitcoin node (or use a public node for testing)

## Installation

### Option 1: Docker (Recommended)

```bash
# Pull the official BTCPay image
docker pull btcpayserver/btcpayserver:latest

# Run BTCPay
docker run -d \
  --name btcpay \
  -p 80:80 \
  -p 443:443 \
  -e BTCPAY_HOST=your-domain.com \
  -v btcpay_data:/data \
  btcpayserver/btcpayserver:latest
```

### Option 2: Manual Installation

Follow the official guide: https://docs.btcpayserver.org/Deployment/

## Configuration

### 1. Access Your BTCPay Instance

Navigate to `https://your-domain.com` and complete the setup wizard.

### 2. Create a Store

1. Log in to your BTCPay account
2. Go to **Stores** → **Create new store**
3. Name it (e.g., "VERDEXIS Deposits")
4. Save the Store ID (you'll need this later)

### 3. Generate API Key

1. In your store settings, go to **API Keys**
2. Click **Generate new key**
3. Give it permissions: `invoices_view`, `invoices_create`, `invoices_update`
4. Copy the API key (you'll need this for the server)

### 4. Set Up Webhooks

1. In your store settings, go to **Webhooks**
2. Click **Create new webhook**
3. Set the URL to: `https://your-verdexis-api.com/api/webhooks/btcpay`
4. Select events:
   - `invoice_confirmed` (at least 1 confirmation)
   - `invoice_completed` (6+ confirmations)
   - `invoice_expired`
   - `invoice_failedToConfirm`
5. Save and test the webhook

### 5. Configure Environment Variables

Update `server/.env`:

```env
BTCPAY_SERVER_URL=https://your-btcpay-server.com
BTCPAY_API_KEY=your_api_key_here
BTCPAY_STORE_ID=your_store_id_here
APP_BASE_URL=https://your-verdexis-frontend.com
```

## Usage

### Initiating a Deposit

**POST** `/api/deposits/initiate`

```json
{
  "amount": 100,
  "currency": "USD"
}
```

**Response:**

```json
{
  "deposit_id": "dep_123456",
  "payment_id": "invoice_xyz",
  "provider": "btcpay",
  "payment_url": "https://your-btcpay.com/i/invoice_xyz",
  "deposit_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "amount": 100,
  "currency": "USD",
  "expires_at": "2024-01-15T14:30:00Z"
}
```

### Checking Deposit Status

**GET** `/api/deposits/:depositId`

```json
{
  "id": "dep_123456",
  "status": "pending|completed|failed|expired",
  "amount": 100,
  "currency": "USD",
  "provider": "btcpay",
  "created_at": "2024-01-15T14:15:00Z",
  "updated_at": "2024-01-15T14:20:00Z"
}
```

## Webhook Events

BTCPay will send webhooks when invoice status changes:

| Event | Description |
|-------|-------------|
| `invoice_confirmed` | At least 1 blockchain confirmation received |
| `invoice_completed` | 6+ confirmations (fully settled) |
| `invoice_expired` | Invoice expired without payment |
| `invoice_failedToConfirm` | Payment detected but failed to confirm |

## Troubleshooting

### Webhook Signature Verification Failed

Ensure the webhook secret is correctly configured in both BTCPay and your `BTCPAY_API_KEY` environment variable.

### Payment Address Not Generated

BTCPay must have a configured cryptocurrency node or connection to a public node. Check your BTCPay instance logs.

### Slow Confirmations

Bitcoin transactions typically take 10-60 minutes for 1 confirmation. For faster testing, use testnet or a faster cryptocurrency (LTC, DOGE).

## Security

- Always use HTTPS for your BTCPay instance and API endpoints
- Rotate your API keys regularly
- Never commit `.env` files with credentials to version control
- Use strong passwords for your BTCPay account
- Enable 2FA on your BTCPay dashboard

## Support

- BTCPay Documentation: https://docs.btcpayserver.org/
- VERDEXIS API Docs: See `ARCHITECTURE.md`
- GitHub Issues: https://github.com/btcpayserver/btcpayserver/issues
