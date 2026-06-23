# Quick Start: Adding Web3 Deposits to Your App

## 1-Minute Setup

### Step 1: Import the Component (in Wallet.tsx)
```tsx
import { Web3DepositComponent } from '../components/Web3DepositComponent'
import { AdminWeb3DepositSettings } from '../components/AdminWeb3DepositSettings'
```

### Step 2: Add to User Wallet Page
In the Web3 section of your Wallet page, add:
```tsx
{web3.isConnected && (
  <Web3DepositComponent
    provider={providerRef.current}
    address={web3.address}
    chainId={web3.chainId}
    adminDepositAddress={web3Payout?.address || null}
    disabled={false}
  />
)}
```

### Step 3: Add Admin Settings Panel
Add to your admin dashboard/settings:
```tsx
<AdminWeb3DepositSettings />
```

## What's Already Working

✅ Wallet connection (fixed timeout issue)
✅ MetaMask integration
✅ Multi-chain support (Ethereum, Polygon, Arbitrum, Sepolia)
✅ Pending deposit tracking
✅ Admin deposit instructions API

## What You Get

- ✨ Beautiful UI matching Verdexis design
- 🔗 Direct blockchain transfers (no intermediary)
- 📱 Mobile-friendly MetaMask deep links
- ⏱️ Instant transaction status
- 🛡️ Rate limiting and fraud prevention
- 🔄 Automatic pending deposit recording

## Usage Flow

**Admin:**
1. Go to Admin Settings
2. Click "Web3 Deposits"
3. Enter your ETH address for Ethereum
4. Save

**User:**
1. Click "Connect Wallet" → MetaMask
2. See your admin's address appear
3. Enter amount and click "Send ETH Now"
4. MetaMask confirms transaction
5. Tx broadcasts to blockchain
6. Shows as "Pending" in dashboard
7. Admin reviews and credits account

## API Endpoints Used

The feature uses existing endpoints:
- `GET /api/wallet/deposit-instructions` - Get admin config
- `PUT /api/wallet/deposit-instructions` - Admin updates config
- `POST /api/wallet/pending-deposits` - Record pending transfer
- `GET /api/wallet/pending-deposits` - Admin views pending

No new backend endpoints needed!

## File Structure

```
New Files:
├── app/src/lib/web3Transfer.ts              (240 lines)
├── app/src/components/Web3DepositComponent.tsx
 (150 lines)
├── app/src/components/AdminWeb3DepositSettings.tsx (250 lines)
├── WEB3_DEPOSIT_SETUP.md                   (setup guide)
└── WEB3_IMPLEMENTATION_SUMMARY.md          (detailed docs)

Modified Files:
├── app/src/lib/walletConnect.ts            (+timeout)
└── app/src/hooks/use-web3.ts              (+timeout)
```

## Testing on Sepolia

1. Switch MetaMask to Sepolia testnet
2. Get free ETH: https://faucet.sepolia.dev
3. In admin settings, add Sepolia address: 0x1234...
4. User sends 0.01 ETH to your address
5. Verify on Etherscan: https://sepolia.etherscan.io

## Code Examples

### Send ETH via Web3Transfer
```typescript
import { executeWebhookTransfer } from '../lib/web3Transfer'

const result = await executeWebhookTransfer(provider, userAddress, {
  toAddress: adminAddress,
  asset: 'ETH',
  amount: 1.5,
  chainId: '0x1', // Ethereum
})

console.log(result.txHash) // 0x...
```

### Get Admin Config
```typescript
import { api } from '../lib/api'

const instructions = await api.getDepositInstructions()
const web3Config = instructions.instructions?.web3
const ethAddress = web3Config?.['0x1']?.address
```

### Record Pending Deposit (automatic in Web3DepositComponent)
```typescript
await api.recordPendingDeposit({
  txHash: '0x...',
  chainId: '0x1',
  toAddress: adminAddress,
  fromAddress: userAddress,
  asset: 'ETH',
  amount: 1.5,
})
```

## Supported Chains

| Chain | ID | Network |
|-------|----|---------| 
| Ethereum | 0x1 | Mainnet |
| Ethereum | 0xaa36a7 | Sepolia (testnet) |
| Polygon | 0x89 | Mainnet |
| Arbitrum | 0xa4b1 | Mainnet |

## Troubleshooting

**"WalletConnect initialization timeout"**
→ Network issue. Retry in a few seconds.

**MetaMask popup doesn't appear**
→ Restart browser. Check extension permissions.

**Transaction fails**
→ Insufficient gas. Network congestion. Check address format.

**Admin config not saving**
→ Verify admin role. Check address starts with 0x.

## Security

- ✅ No private keys stored on server
- ✅ All transactions signed in MetaMask
- ✅ Admin manual approval required
- ✅ Rate limiting on all money operations
- ✅ Idempotent pending deposits
- ✅ Hardware wallet recommended

## Performance

| Operation | Time |
|-----------|------|
| Connect MetaMask | ~1-2 seconds |
| Send transaction | User controls |
| Record pending | <500ms |
| Bundle size | +15KB |

## Next: Advanced

- Add token swaps (ETH → USDC)
- Add gas optimization
- Add multi-chain aggregation
- Add ENS name support
- Add transaction history

---

**Need help?** See `WEB3_DEPOSIT_SETUP.md` for complete docs.
