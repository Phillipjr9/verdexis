# Admin Transfer Fix

## Problem
Admin transfers money to user but user doesn't receive it.

## Root Cause
Admin account doesn't have USD balance to transfer from.

## Solution
Admin must first seed their treasury:

```bash
POST /api/admin/seed-treasury
Authorization: Bearer <ADMIN_TOKEN>

Response:
{
  "ok": true,
  "balance": 1000000000000,
  "available": 1000000000000,
  "currency": "USD"
}
```

This gives admin $1 trillion USD to distribute.

## Then Transfer Works
```bash
POST /api/admin/transfer
Authorization: Bearer <ADMIN_TOKEN>
{
  "fromUserId": "<ADMIN_USER_ID>",
  "toUserId": "<USER_ID>", 
  "currency": "USD",
  "amount": 1000,
  "reason": "manual_correction",
  "note": "Initial funding"
}
```

## Check User Balance
```bash
GET /api/wallet
Authorization: Bearer <USER_TOKEN>
```

User should now have the transferred amount.
