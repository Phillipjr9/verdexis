# Web3 Deposit Monitoring

VERDEXIS automatically detects on-chain crypto deposits and credits user wallets without manual intervention. The system monitors blockchain transactions every 30 seconds.

## How It Works

1. **User initiates deposit** → API creates deposit request and registers wallet address
2. **Web3 Monitor starts watching** → Scans blockchain every 30 seconds
3. **Transaction detected** → When crypto arrives at wallet address
4. **Amount verified** → Checks if amount matches expected deposit (±1% tolerance for fees)
5. **User auto-credited** → Wallet balance updated immediately
6. **Status updated** → Deposit marked as "completed"

## Supported Blockchains

| Blockchain | RPC Provider | Currency | Confirmations |
|-----------|--------------|----------|---|
| Bitcoin | blockstream.info | BTC | 1+ |
| Ethereum | Infura | ETH, USDC, USDT, DAI | 1+ |
| Solana | api.mainnet-beta.solana.com | SOL | 1+ |

## API Endpoints

### Initiate Deposit (Auto-Monitored)
```
POST /api/deposits/initiate
Authorization: Bearer {user_jwt}
Content-Type: application/json

{
  "amount": 0.5,
  "currency": "btc",
  "toAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
}
```

**Response:**
```json
{
  "deposit_id": "dep_abc123",
  "provider": "self-hosted",
  "deposit_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "amount": 0.5,
  "currency": "btc",
  "instructions": "Send 0.5 btc to: bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "auto_credit": true,
  "auto_credit_note": "Your balance will be updated automatically once we detect the on-chain transaction",
  "expires_at": "2024-01-16T10:30:00Z"
}
```

### Check Deposit Status
```
GET /api/deposits/{depositId}
Authorization: Bearer {user_jwt}
```

**Response (Pending):**
```json
{
  "id": "dep_abc123",
  "status": "pending",
  "amount": 0.5,
  "currency": "btc",
  "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "tx_hash": "",
  "auto_credited": false,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

**Response (Auto-Completed):**
```json
{
  "id": "dep_abc123",
  "status": "completed",
  "amount": 0.5,
  "currency": "btc",
  "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "tx_hash": "a1b2c3d4e5f6...",
  "auto_credited": true,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:05:30Z"
}
```

### Get Monitoring Status
```
GET /api/deposits/monitoring/status
Authorization: Bearer {user_jwt}
```

**Response:**
```json
{
  "monitoring_active": true,
  "check_interval_ms": 30000,
  "pending_deposits": 2,
  "deposits": [
    {
      "id": "dep_abc123",
      "asset": "btc",
      "amount": 0.5,
      "toAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      "createdAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "dep_xyz789",
      "asset": "eth",
      "amount": 1.5,
      "toAddress": "0x1234567890abcdef1234567890abcdef12345678",
      "createdAt": "2024-01-15T10:05:00Z"
    }
  ],
  "note": "Web3 monitor scans blockchain every 30 seconds for incoming deposits"
}
```

### Manual Confirmation (Admin Only - Fallback)
If auto-detection fails, admin can manually confirm:

```
POST /api/deposits/{depositId}/confirm
Authorization: Bearer {admin_jwt}
Content-Type: application/json

{
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "confirmations": 6
}
```

## Example Workflow

### Step 1: User Initiates Deposit
```bash
curl -X POST http://localhost:4000/api/deposits/initiate \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 0.5,
    "currency": "btc",
    "toAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
  }'
```

Response:
```json
{
  "deposit_id": "dep_abc123",
  "deposit_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "auto_credit": true
}
```

### Step 2: User Sends Crypto
User opens their wallet app and scans QR code or copy-pastes address:
- Sends 0.5 BTC to `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh`
- Transaction broadcasts to Bitcoin network

### Step 3: Web3 Monitor Detects
Monitor finds transaction in next poll cycle (30 seconds or less):
```
[deposit-monitor] ✓ deposited 0.5 btc to user 12345
```

### Step 4: User Balance Updated
```bash
GET /api/wallet
Authorization: Bearer eyJhbGc...
```

Response:
```json
{
  "total_balance_usd": 15500,
  "balances": [
    {
      "currency": "btc",
      "balance": 0.5,
      "available": 0.5,
      "in_orders": 0,
      "usd_value": 15500
    }
  ]
}
```

## Monitor Configuration

### Poll Interval
Default: **30 seconds** (configurable)

To change, modify in `depositMonitor.ts`:
```typescript
private pollIntervalMs = 30_000 // Change this value
```

### Confirmation Requirements
- Bitcoin: 1+ confirmations (auto-detect)
- Ethereum: 1+ confirmations (auto-detect)
- Solana: 1 confirmation (finality)

### Amount Tolerance
Default: **±1%** to account for network fees

For 1 BTC deposit, system accepts 0.99 - 1.01 BTC

## Blockchain Explorers

Check transactions manually:
- **Bitcoin**: https://blockchair.com/bitcoin/transactions
- **Ethereum**: https://etherscan.io
- **Solana**: https://solscan.io

## Error Handling

### Scenarios

**Deposit Amount Mismatch:**
- User sends 0.4 BTC instead of 0.5 BTC
- Monitor rejects (outside ±1% tolerance)
- Admin must manually confirm with correct amount

**Multiple Transactions:**
- User sends 0.3 BTC twice
- Monitor detects first one and credits 0.3 BTC
- Admin manually confirms second one for remaining 0.2 BTC

**RPC Endpoint Down:**
- Monitor logs error and retries in next cycle
- No transactions missed (blockchain persists data)

**Network Congestion:**
- Bitcoin transaction takes 2+ hours to confirm
- Monitor continues polling until detection
- User balance updated once detected

## Security

- Web3 Monitor uses **public RPC endpoints** (no private keys exposed)
- Only **receive addresses** stored (read-only, no sending capability)
- **HMAC signatures** verify transactions before crediting
- **Database transactions** ensure atomicity

## Troubleshooting

**Q: Why isn't my deposit showing up?**
1. Check blockchain explorer (search for your address)
2. Verify transaction has at least 1 confirmation
3. Check deposit amount matches expected ±1%
4. Wait 30 seconds for next monitor cycle

**Q: How do I speed up detection?**
- Increase confirmations on your transaction
- Monitor checks every 30 seconds (no way to speed up)
- Use manual confirmation endpoint if urgent

**Q: What if RPC is slow?**
- Monitor has timeout fallback
- Retries in next cycle
- User not charged multiple times

**Q: Can I change the monitor interval?**
- Yes, edit `depositMonitor.ts` and restart server
- Minimum recommended: 15 seconds
- Maximum recommended: 60 seconds

## Performance

- **Latency**: 0-30 seconds (average 15 seconds)
- **CPU Usage**: <5% (minimal polling)
- **Database**: 1 query per pending deposit per cycle
- **RPC Usage**: 1 call per address per cycle

For 100 pending deposits = 100 RPC calls / 30 seconds = 3.3 calls/sec (very low)

## Deployment

Web3 monitor starts automatically when server boots:

```bash
npm run dev
# Logs: [deposit-monitor] initializing...
# Logs: [deposit-monitor] loaded 0 pending deposits
# Logs: [deposit-monitor] started
```

## Next Steps

1. Test deposit flow in testnet first
2. Monitor logs for transaction detection
3. Verify user balance updates
4. Set up blockchain explorer bookmarks for manual verification
