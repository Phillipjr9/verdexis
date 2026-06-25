# Super Admin Capabilities - Full Guide

## Overview

The **Super Admin** (admin@verdexis.com) has COMPLETE CONTROL over all users and operations. Sub-admins have LIMITED access only to their assigned users.

---

## Super Admin Capabilities

### 1. View & Manage ALL Users

**Super Admin Can:**
- ✅ View all users in the system (not just assigned ones)
- ✅ Search and filter all users
- ✅ View ANY user's profile with full details
- ✅ See user holdings, transactions, trades, alerts
- ✅ View user login history and metadata

**Sub-Admin Can Only:**
- View their assigned users only
- Cannot see other admins' users

---

### 2. Transfer Funds Between Any Users

**Endpoint:** `POST /api/admin/transfer`

**Super Admin Can:**
- ✅ Transfer from User A → User B (ANY users)
- ✅ Transfer between users they don't manage
- ✅ Allow negative balances with `allowNegative: true`
- ✅ Specify reason codes (court_order, gift, etc.)

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/transfer \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "fromUserId": "usr_123",
    "toUserId": "usr_456",
    "currency": "USD",
    "amount": 1000,
    "reason": "gift",
    "note": "Birthday gift",
    "notify": true
  }'
```

---

### 3. Deposit/Credit to Any User Account

**Endpoint:** `POST /api/admin/users/:id/deposit`

**Super Admin Can:**
- ✅ Credit any user's account with USD/crypto
- ✅ Invest deposits automatically into assets
- ✅ Backdate deposits to specific dates
- ✅ Set deposit status (pending/completed)
- ✅ Users they don't manage

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/users/usr_123/deposit \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "USD",
    "amount": 5000,
    "reason": "promo_credit",
    "note": "VIP bonus",
    "status": "completed",
    "notify": true
  }'
```

---

### 4. Debit/Deduct from Any User Account

**Endpoint:** `POST /api/admin/users/:id/deduct`

**Super Admin Can:**
- ✅ Debit any user's account
- ✅ Charge fees (maintenance, wire, etc.)
- ✅ Prevent negative balances or allow them
- ✅ Reverse chargeback/fraud amounts
- ✅ Any user in the system

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/users/usr_123/deduct \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "USD",
    "amount": 100,
    "reason": "compliance_sanctions",
    "note": "Sanctions violation",
    "status": "completed",
    "allowNegative": false
  }'
```

---

### 5. Restrict User Access (Hold Account)

**Endpoint:** `POST /api/admin/users/:id/hold`

**Super Admin Can:**
- ✅ Place holds on ANY user's account
- ✅ Restrict withdrawals, transfers, or all
- ✅ Specify compliance reasons
- ✅ Add private notes
- ✅ Any user regardless of admin assignment

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/users/usr_123/hold \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "holdType": "all",
    "reason": "aml_kyc_review",
    "note": "Pending document verification",
    "notify": true
  }'
```

**Hold Types:**
- `all` - Block everything (withdrawals & transfers)
- `withdraw` - Only block withdrawals
- `transfer` - Only block peer-to-peer transfers

---

### 6. Add/Link Wallet Accounts to Any User

**Endpoint:** `POST /api/admin/users/:id/wallet-links`

**Super Admin Can:**
- ✅ Add crypto wallets to ANY user
- ✅ Add multiple wallets per user
- ✅ Set primary wallet
- ✅ Add wallet labels and notes
- ✅ Link wallets to any user they don't manage

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/users/usr_123/wallet-links \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890123456789012345678901234567890",
    "chainId": "0x1",
    "provider": "MetaMask",
    "label": "Personal Wallet",
    "setPrimary": true
  }'
```

---

### 7. Manage User Balances Directly

**Endpoint:** `POST /api/admin/users/:id/wallet`

**Super Admin Can:**
- ✅ Set wallet balance directly (no auth required)
- ✅ Create new currency walances
- ✅ Update available/total balance
- ✅ Any user in the system

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/users/usr_123/wallet \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "BTC",
    "symbol": "₿",
    "balance": 2.5,
    "available": 2.5
  }'
```

---

### 8. Charge Fees to Any User

**Endpoint:** `POST /api/admin/users/:id/fee`

**Super Admin Can:**
- ✅ Charge maintenance fees
- ✅ Charge wire fees
- ✅ Charge inactivity fees
- ✅ Charge service fees
- ✅ Any user (not restricted to assigned)

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/users/usr_123/fee \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "USD",
    "amount": 25,
    "feeType": "maintenance",
    "note": "Monthly account fee",
    "notify": true
  }'
```

---

### 9. Modify User Data & Preferences

**Endpoint:** `PATCH /api/admin/users/:id`

**Super Admin Can:**
- ✅ Update name, email, avatar
- ✅ Change roles (user ↔ admin)
- ✅ Suspend/unsuspend accounts
- ✅ Update 2FA settings
- ✅ Backdate creation date
- ✅ Any user in system

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/admin/users/usr_123 \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "suspended": true,
    "suspendedReason": "Account locked pending review",
    "name": "Updated Name"
  }'
```

---

### 10. View & Control User KYC Status

**Endpoint:** `POST /api/admin/users/:id/kyc`

**Super Admin Can:**
- ✅ Approve KYC (any user)
- ✅ Reject KYC (any user)
- ✅ Add KYC review notes
- ✅ Set status (approved/rejected/pending)
- ✅ Any user regardless of assignment

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/users/usr_123/kyc \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "notes": "Verified government ID and address",
    "notify": true
  }'
```

---

### 11. Manage User Holdings & Trades

**Endpoint:** `POST /api/admin/users/:id/holdings`

**Super Admin Can:**
- ✅ Add holdings (securities/crypto)
- ✅ Adjust holdings (buy/sell)
- ✅ Set avg price and amount
- ✅ Add notes for adjustments
- ✅ Any user in system

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/users/usr_123/holdings/adjust \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC",
    "name": "Bitcoin",
    "side": "buy",
    "amount": 1.5,
    "price": 45000,
    "reason": "compensation",
    "note": "Compensation for exchange error",
    "notify": true
  }'
```

---

### 12. Set Transaction Limits

**Endpoint:** `PATCH /api/admin/users/:id/limits`

**Super Admin Can:**
- ✅ Set daily withdrawal limits
- ✅ Set monthly withdrawal limits
- ✅ Set daily transfer limits
- ✅ Set monthly transfer limits
- ✅ Any user (override user preferences)

**Example:**
```bash
curl -X PATCH http://localhost:3000/api/admin/users/usr_123/limits \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "dailyWithdrawLimit": 10000,
    "monthlyWithdrawLimit": 100000,
    "dailyTransferLimit": 5000,
    "monthlyTransferLimit": 50000
  }'
```

---

### 13. Manage IP Allowlists

**Endpoint:** `PATCH /api/admin/users/:id/ip-allowlist`

**Super Admin Can:**
- ✅ Restrict login to specific IPs
- ✅ Whitelist corporate networks
- ✅ Add security controls
- ✅ Any user in system

---

### 14. Reverse Transactions

**Endpoint:** `POST /api/admin/transactions/:id/reverse`

**Super Admin Can:**
- ✅ Reverse any transaction
- ✅ Reverse deposits
- ✅ Reverse withdrawals
- ✅ Reverse transfers
- ✅ Refund wallets automatically
- ✅ Add reversal notes

---

### 15. Create/Delete Transactions Directly

**Endpoint:** `POST /api/admin/users/:id/transactions`

**Super Admin Can:**
- ✅ Create custom transactions (deposit/withdraw/transfer)
- ✅ Set status (pending/completed/failed/reversed)
- ✅ Backdate transactions
- ✅ Any user (wallet auto-updates)

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/users/usr_123/transactions \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "deposit",
    "currency": "USD",
    "amount": 2000,
    "status": "completed",
    "reference": "Wire transfer from account",
    "createdAt": "2024-01-15T10:00:00Z"
  }'
```

---

### 16. Approve Pending Deposits

**Endpoint:** `POST /api/admin/pending-deposits/:id/approve`

**Super Admin Can:**
- ✅ Approve any pending deposit
- ✅ Override amounts
- ✅ Change credited currency
- ✅ Reject with reason
- ✅ Any user's pending deposits

---

### 17. Bulk User Actions

**Endpoint:** `POST /api/admin/users/bulk`

**Super Admin Can:**
- ✅ Hold multiple users at once
- ✅ Release holds (multiple)
- ✅ Suspend multiple users
- ✅ Revoke sessions (multiple)
- ✅ Delete users (bulk)
- ✅ up to 500 users at once

**Example:**
```bash
curl -X POST http://localhost:3000/api/admin/users/bulk \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["usr_123", "usr_456", "usr_789"],
    "action": "hold",
    "reason": "compliance_review",
    "holdType": "all",
    "notify": true
  }'
```

---

### 18. Impersonate Any User

**Endpoint:** `POST /api/admin/users/:id/impersonate`

**Super Admin Can:**
- ✅ Get login token for ANY user
- ✅ View account as the user
- ✅ 15-minute session limit
- ✅ Audit trail recorded

---

### 19. View Complete Audit Logs

**Endpoint:** `GET /api/admin/audit`

**Super Admin Can:**
- ✅ View all admin actions in system
- ✅ Filter by actor, target, action, date
- ✅ Export CSV audit trail
- ✅ Full compliance audit trail

---

### 20. Broadcast Notifications

**Endpoint:** `POST /api/admin/broadcast`

**Super Admin Can:**
- ✅ Send system notifications to ALL users
- ✅ Send maintenance alerts
- ✅ Send security announcements
- ✅ Reach all non-suspended users

---

## Comparison: Super Admin vs Sub-Admin

| Action | Super Admin | Sub-Admin |
|--------|:----------:|:----------:|
| View all users | ✅ | ❌ (only assigned) |
| Transfer between any users | ✅ | ❌ (only assigned) |
| Deposit to any user | ✅ | ❌ (only assigned) |
| Debit any user | ✅ | ❌ (only assigned) |
| Hold any user | ✅ | ❌ (only assigned) |
| Add wallet to any user | ✅ | ❌ (only assigned) |
| Charge fees to any user | ✅ | ❌ (only assigned) |
| Create admins | ✅ | ❌ |
| View audit logs | ✅ | ❌ |
| Broadcast notifications | ✅ | ❌ |
| Manage assigned users | ✅ | ✅ |
| Create users | ✅ | ✅ |
| Impersonate users | ✅ | ✅ |
| View transactions | ✅ | ✅ (assigned only) |

---

## Authorization Model

### Super Admin (admin@verdexis.com)
- Email: admin@verdexis.com
- Role: admin
- **Access Level**: FULL SYSTEM CONTROL
- Can do EVERYTHING listed above
- Cannot be demoted (last admin protection)
- All users are automatically accessible

### Sub-Admins (created by Super Admin)
- Role: admin
- Email: anything except admin@verdexis.com
- **Access Level**: LIMITED TO ASSIGNED USERS
- Cannot create other admins
- Can only manage users explicitly assigned
- Cannot view other admins' users
- Cannot see all-users dashboard

### Regular Users
- Role: user
- No admin privileges
- Assigned to one admin
- Can use the platform normally

---

## Super Admin Use Cases

### Scenario 1: User Has Technical Issue

```bash
# 1. Find the user
GET /api/admin/users?q=user@example.com

# 2. Check their account
GET /api/admin/users/usr_123

# 3. If balance is wrong, fix it directly
POST /api/admin/users/usr_123/wallet
# Set correct balance

# 4. If they lost access, reset password
POST /api/admin/users/usr_123/password

# 5. Revoke old sessions
POST /api/admin/users/usr_123/revoke
```

### Scenario 2: Fraud Reversal

```bash
# 1. Find fraudulent transaction
GET /api/admin/audit?q=transaction_id

# 2. Reverse it
POST /api/admin/transactions/tx_id/reverse
# Wallet auto-refunded

# 3. Review user's activity
GET /api/admin/users/usr_id/audit

# 4. Hold account for investigation
POST /api/admin/users/usr_id/hold
# holdType: "all"
```

### Scenario 3: Chargeback Management

```bash
# 1. Debit the user
POST /api/admin/users/usr_id/deduct
# currency: USD
# amount: chargeamount
# reason: "chargeback"

# 2. Hold account
POST /api/admin/users/usr_id/hold
# reason: "chargeback_investigation"

# 3. Send notification
POST /api/admin/users/usr_id/email
```

---

## Key Points

✅ **Super Admin can see ALL users** - No assignment restrictions  
✅ **Super Admin can transfer between ANY users** - Not just assigned  
✅ **Super Admin can debit/credit ANY user** - Full control  
✅ **Super Admin can add wallets to ANY user** - Complete account control  
✅ **Super Admin cannot be demoted** - System security  
✅ **All actions are audited** - Full compliance trail  
✅ **Sub-admins only see assigned users** - Isolation/security  

---

## Next Steps

1. Create Sub-Admin via `/api/admin/hierarchy/admins`
2. Assign users to that admin
3. Sub-admin can now manage those users only
4. Super Admin sees everything and can intervene anytime
5. All actions logged in `/api/admin/audit`
