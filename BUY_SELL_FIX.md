# 🚨 Buy/Sell Not Working - Quick Fix Guide

## Problem

Users cannot buy/sell cryptocurrency because they start with **$0 USD balance**.

### Why This Happens

The app was recently updated to remove mock seed data (fake $125k balance) to make it look more professional. Now all new users start with:
- ✅ Account created successfully  
- ❌ **$0.00 USD balance** (cannot buy anything)
- ✅ Trading features work perfectly
- ❌ Just need funds first

## Solution: Fund User Accounts

### Option 1: Admin Panel (Recommended)

1. **Login as admin**: `admin@verdexis.com` / `Admin@Verdexis2024`
2. Go to: `/admin/users`
3. Find user → Click **"Manage Wallet"**
4. **Add USD balance**: Deposit $10,000 USD
5. User can now trade immediately

### Option 2: Backend Script (Fast for Multiple Users)

Run this on the server:

```bash
cd server
npm run tsx src/scripts/seed-user-balance.ts <userEmail> <amount>
```

Example:
```bash
npm run tsx src/scripts/seed-user-balance.ts user@example.com 10000
```

### Option 3: Seed Script (Give All Users $10k)

Create `server/src/scripts/seed-all-users.ts`:

```typescript
import { prisma } from '../db.js'

async function main() {
  const users = await prisma.user.findMany({ where: { role: 'user' } })
  
  for (const user of users) {
    await prisma.walletBalance.upsert({
      where: { userId_currency: { userId: user.id, currency: 'USD' } },
      create: {
        userId: user.id,
        currency: 'USD',
        symbol: '$',
        balance: 10000,
        available: 10000,
      },
      update: {
        balance: { increment: 10000 },
        available: { increment: 10000 },
      },
    })
    
    await prisma.transaction.create({
      data: {
        userId: user.id,
        kind: 'deposit',
        currency: 'USD',
        amount: 10000,
        reference: 'Welcome bonus - demo funds',
        status: 'completed',
      },
    })
    
    console.log(`✅ Funded ${user.email} with $10,000 USD`)
  }
  
  console.log(`\n🎉 Funded ${users.length} users`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

Run it:
```bash
cd server
npm run tsx src/scripts/seed-all-users.ts
```

## Quick Test After Funding

1. **Sign in** to user account
2. Go to **Dashboard** → Should show $10,000 USD balance
3. Go to **Trading** page
4. Select **BTC/USD**
5. Try to buy **0.001 BTC** (about $63)
6. **Confirm order**
7. Check **Dashboard** → Should see BTC holding

## Add Automatic Welcome Bonus

Update `server/src/routes/auth.ts` signup to give new users $10k automatically:

```typescript
// After user creation:
await prisma.walletBalance.create({
  data: {
    userId: user.id,
    currency: 'USD',
    symbol: '$',
    balance: 10000,
    available: 10000,
  },
})

await prisma.transaction.create({
  data: {
    userId: user.id,
    kind: 'deposit',
    currency: 'USD',
    amount: 10000,
    reference: 'Welcome bonus',
    status: 'completed',
  },
})
```

## Enable Real Deposits (Production)

For production, users need real deposit methods:

### 1. **Bank Transfer (ACH)** - via Plaid
Already have UI at `/wallet` → "Deposit" → "Bank Transfer"
Need to add Plaid Link integration

### 2. **Crypto Deposits** - Already Working!
Users can deposit BTC, ETH, SOL:
1. Go to `/wallet` → "Deposit" → "Crypto"
2. Shows deposit address
3. Send crypto to address
4. Auto-credits when confirmed on-chain

### 3. **Debit Card** - via Stripe
Quick $50-$500 deposits with instant credit
Need Stripe integration

## Current Trading Feature Status

### ✅ What Works Perfectly:
- Buy/sell execution (atomic database transactions)
- Real-time price updates (Binance WebSocket)
- Order book + recent trades (Coinbase Exchange)
- P&L tracking with weighted-average cost basis
- Transaction history
- Idempotency protection
- Fee calculation (0.10%)
- Risk warnings (concentration, large orders)

### ❌ What's Blocking Users:
- **Zero starting balance** (solved by funding accounts)
- No swap feature (need `/api/wallet/swap` endpoint)

## Summary

**The trading features work perfectly.** Users just need USD balance to start trading.

**Quick Fix:** 
1. Login as admin
2. Fund user wallets with $10,000 USD
3. Users can trade immediately

**Long-term:**
- Add welcome bonus to signup flow ($10k demo funds)
- Enable real deposit methods (ACH, debit card, crypto)
- Add swap endpoint for crypto-to-crypto trades
