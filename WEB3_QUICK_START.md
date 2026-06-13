# Quick Start: Web3 Auto-Deposits

## Setup (5 minutes)

1. **Server already running?** ✓ (Web3 monitor starts automatically)

2. **Check monitor status**:
   ```bash
   npm run dev
   # Logs: [deposit-monitor] initializing...
   # Logs: [deposit-monitor] started
   ```

## User Flow (30 seconds per deposit)

### 1. User Initiates Deposit
```bash
POST /api/deposits/initiate
{
  "amount": 0.5,
  "currency": "btc",
  "toAddress": "bc1q..."
}
```

Response includes:
- QR code for the wallet address
- "auto_credit": true (will credit wallet automatically)

### 2. User Scans QR & Sends Crypto
- User opens their wallet app
- Scans QR code from deposit screen
- Sends 0.5 BTC to the address
- Transaction broadcasts to blockchain

### 3. Web3 Monitor Detects (0-30 seconds)
Behind the scenes:
```
[deposit-monitor] checking address bc1q...
[deposit-monitor] ✓ deposited 0.5 btc to user 12345
```

### 4. User's Balance Updated
User's wallet automatically shows:
```
Bitcoin: 0.5 BTC (+0.5 BTC from deposit)
```

No manual confirmation needed ✓

## Testing

### Test with Testnet (Recommended)

1. Modify RPC endpoints in `depositMonitor.ts`:
   ```typescript
   bitcoin: {
     rpc: 'https://blockstream.info/testnet/api',
     ...
   }
   ```

2. Create test deposit:
   ```bash
   POST /api/deposits/initiate
   {
     "amount": 0.001,
     "currency": "btc",
     "toAddress": "tb1q..." // testnet address
   }
   ```

3. Send testnet BTC to that address
4. Monitor detects within 30 seconds
5. See "completed" status

### Test Balance Check

```bash
# Before deposit
GET /api/wallet → { btc: 0 }

# After deposit detected
GET /api/wallet → { btc: 0.5 }
```

## API Reference (Quick)

| Endpoint | Purpose | Auto-Detects |
|----------|---------|---|
| `POST /api/deposits/initiate` | Create deposit + start monitoring | ✓ Yes |
| `GET /api/deposits/{id}` | Check status (updates automatically) | ✓ Yes |
| `GET /api/deposits/monitoring/status` | See all pending deposits | ✓ Yes |
| `POST /api/deposits/{id}/confirm` | Manual confirm (if needed) | ✗ Admin only |

## Supported Coins

- Bitcoin (BTC)
- Ethereum (ETH)
- Solana (SOL)
- Ethereum tokens (USDC, USDT, DAI)

## Common Questions

**Q: How long does it take?**
- Average 15 seconds
- Max 30 seconds
- Bitcoin takes longer than Ethereum

**Q: What if I send the wrong amount?**
- If within ±1%: Auto-credited
- If outside ±1%: Admin must confirm manually
- Example: 0.5 BTC ±1% = 0.495-0.505 BTC accepted

**Q: Can I check status in real-time?**
- Yes: `GET /api/deposits/{depositId}`
- Returns "pending" or "completed"
- Updates every 30 seconds automatically

**Q: What if network is down?**
- Monitor continues polling
- Transaction persists on blockchain
- Will detect once network recovers

**Q: Is it secure?**
- Yes: Uses public RPC (no private keys)
- Amount verified before crediting
- Database ensures no duplicates

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Deposit stuck "pending" | Check blockchain explorer for tx |
| Amount mismatch (outside ±1%) | Admin must manually confirm |
| RPC down | Monitor retries automatically |
| User lost deposit address | Show from deposit history |

## Monitor the Logs

```bash
# Watch deposit detections in real-time
npm run dev | grep deposit-monitor

# Output:
# [deposit-monitor] initializing...
# [deposit-monitor] loaded 2 pending deposits
# [deposit-monitor] started
# [deposit-monitor] checking address bc1q...
# [deposit-monitor] ✓ deposited 0.5 btc to user 12345
```

## File Locations

- Web3 Monitor: `server/src/depositMonitor.ts`
- Deposit Routes: `server/src/routes/deposits.ts`
- Docs: `WEB3_DEPOSITS.md`

## Next Steps

1. ✓ Server running with monitor
2. → Test with testnet
3. → Update frontend UI
4. → Enable for production
5. → Monitor real deposits

## Support

See `WEB3_DEPOSITS.md` for:
- Full API documentation
- Example workflows
- Blockchain explorers
- Error scenarios
