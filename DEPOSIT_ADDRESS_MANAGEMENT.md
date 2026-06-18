# Admin Deposit Address Management

## Overview
Admins can now assign unique cryptocurrency deposit addresses to individual users. When a user visits the crypto deposit page, they will see their personalized addresses with automatically generated QR codes.

## How It Works

### For Admins

1. **Navigate to User Management**
   - Go to `/admin/users`
   - Search for and select the user

2. **Manage Deposit Addresses**
   - Click "Manage Deposit Addresses" or navigate to `/admin/deposit-addresses?userId=USER_ID&email=user@example.com`
   - Add cryptocurrency addresses for: BTC, ETH, SOL, USDT, USDC

3. **Configure Each Address**
   - **Currency**: Automatically set based on selected crypto
   - **Network**: Choose the blockchain network (e.g., Ethereum, Arbitrum, BSC)
   - **Address**: Enter the wallet address (QR code generates automatically)
   - **Memo/Tag**: Optional, for networks that require it
   - **Admin Notes**: Internal notes, not visible to user

4. **Save Changes**
   - Click "Save Changes" to update user's deposit addresses
   - Changes are immediately visible to the user

### For Users

1. **View Deposit Addresses**
   - Navigate to `/wallet` and click "Deposit" button
   - Select "Crypto" deposit method
   - Choose the cryptocurrency

2. **Deposit Options**
   - **QR Code**: Scan with mobile wallet app
   - **Address**: Copy address manually
   - **Network Info**: View network type, minimum deposit, confirmations required

3. **No Address Assigned**
   - If admin hasn't configured addresses, user sees a message to contact support
   - Support link directs to WhatsApp

## Key Features

### Automatic QR Code Generation
- QR codes are generated automatically when admin enters an address
- Users can scan QR codes directly from deposit page
- QR codes are downloadable for admin reference

### No Demo/Mock Data
- All demo deposit addresses have been removed
- Users only see real addresses assigned by admin
- System prevents showing mock/placeholder addresses

### Multi-Network Support
- **Bitcoin**: Bitcoin network
- **Ethereum**: Ethereum, Arbitrum, Optimism
- **Solana**: Solana network
- **USDT**: Ethereum (ERC-20), Tron (TRC-20), BSC (BEP-20)
- **USDC**: Ethereum, Polygon, Arbitrum

### Security Features
- Addresses stored in user preferences (encrypted in database)
- Only admins can modify addresses
- Users cannot change their own addresses
- Each address is unique to the user

## Database Storage

Deposit addresses are stored in the `User.prefs` JSON field:

```json
{
  "depositAddresses": {
    "cryptos": {
      "BTC": {
        "currency": "BTC",
        "network": "Bitcoin",
        "address": "bc1q...",
        "memo": "",
        "notes": "Admin notes here"
      },
      "ETH": {
        "currency": "ETH",
        "network": "Ethereum",
        "address": "0x...",
        "memo": "",
        "notes": "Admin notes here"
      }
    },
    "notes": "General notes visible to user",
    "updatedAt": "2025-01-23T10:00:00Z"
  }
}
```

## API Endpoints

### Admin Endpoints (Requires Admin Role)

```typescript
// Get user's deposit addresses
GET /api/admin/users/:userId/deposit-addresses
Response: { addresses: DepositAddresses | null }

// Update user's deposit addresses
PUT /api/admin/users/:userId/deposit-addresses
Body: { cryptos: { [symbol]: CryptoAddress }, notes?: string }
Response: { addresses: DepositAddresses }

// Delete all user's deposit addresses
DELETE /api/admin/users/:userId/deposit-addresses
Response: { ok: true }
```

### User Endpoints (Requires Authentication)

```typescript
// Get my deposit addresses
GET /api/wallet/me/deposit-addresses
Response: { addresses: DepositAddresses | null }
```

## Best Practices

1. **Verify Addresses**: Double-check addresses before saving to prevent loss of funds
2. **Use Correct Networks**: Ensure network matches the address type
3. **Document Changes**: Use admin notes field to track address changes
4. **Test Small Amounts**: Advise users to test with small deposits first
5. **Regular Audits**: Periodically review assigned addresses for accuracy

## Troubleshooting

### User Can't See Address
- Verify address is saved in admin panel
- Check user is logged in with correct account
- Ensure backend is online and responding

### QR Code Not Generating
- Verify address format is correct
- Check browser console for errors
- Try refreshing the page

### Address Not Updating
- Ensure "Save Changes" button was clicked
- Check network connection
- Verify admin permissions

## Future Enhancements

- [ ] Address validation for each blockchain
- [ ] Automatic address generation via API
- [ ] Deposit history tracking
- [ ] Email notifications on new deposits
- [ ] Address rotation for enhanced security
- [ ] Bulk address import for multiple users
