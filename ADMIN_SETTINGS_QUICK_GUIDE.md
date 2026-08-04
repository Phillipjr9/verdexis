# Admin Settings Management - Quick Reference Guide

## 🚀 QUICK START

### Accessing Settings
1. Log in as admin
2. Go to Dashboard
3. Scroll to "Admin Command Center"
4. Find "Settings Verification" section

### Managing Settings

#### View All Settings
- Settings are organized by category
- Each category shows verification status
- Color-coded badges show status (green=verified, orange=pending, red=failed)

#### Edit a Setting
1. Click the "Edit" button on any setting
2. Enter the new value
3. Click "Save" to save
4. Click "Cancel" to discard changes

#### Verify Settings
- Click "Verify" on individual settings
- Click "Verify All" to verify all settings at once
- Verification checks value format and range

#### View Change History
1. Click "Show Logs" button
2. Filter by "All", "Success", or "Failed"
3. See who changed what and when

---

## 📊 SETTINGS CATEGORIES

### Fees (4 settings)
- `withdrawal_fee_percent` - Withdrawal fee (0-100%)
- `deposit_fee_percent` - Deposit fee (0-100%)
- `trading_fee_percent` - Trading fee (0-100%)
- `transfer_fee_percent` - Transfer fee (0-100%)

### Wallet (3 settings)
- `admin_wallet_address` - Admin wallet (Ethereum address or N/A)
- `treasury_wallet_address` - Treasury wallet (Ethereum address or N/A)
- `custody_wallet_address` - Custody wallet (Ethereum address or N/A)

### Bank (4 settings)
- `bank_account_name` - Account holder name
- `bank_account_number` - Account number
- `bank_routing_number` - Routing number
- `bank_swift_code` - SWIFT code

### Security (4 settings)
- `two_factor_required` - Require 2FA (true/false)
- `ip_whitelist_enabled` - Enable IP whitelist (true/false)
- `session_timeout_minutes` - Session timeout in minutes
- `max_login_attempts` - Max login attempts before lockout

### General (5 settings)
- `platform_name` - Platform name
- `support_email` - Support email address
- `maintenance_mode` - Maintenance mode (true/false)
- `signup_bonus_enabled` - Enable signup bonus (true/false)
- `signup_bonus_amount` - Signup bonus amount in USD

---

## ✅ VALIDATION RULES

### Fees
- Must be a number
- Must be between 0 and 100
- Decimals allowed (e.g., 11.8)

### Wallet Addresses
- Must be valid Ethereum address (0x + 40 hex chars)
- OR can be "N/A"
- Example: 0x742d35Cc6634C0532925a3b844Bc9e7595f42bE

### Bank Details
- Must be non-empty string
- OR can be "N/A"
- No special format required

### Security Settings
- Boolean: true or false
- Numbers: positive integers only
- Example: 30 minutes, 5 attempts

### General Settings
- Strings: non-empty
- Booleans: true or false
- Numbers: positive integers

---

## 🔍 VERIFICATION SUMMARY

The summary card shows:
- **Total Settings**: Total number of settings
- **Verified**: Number of verified settings
- **Pending**: Number of pending verification
- **Failed**: Number of failed verification
- **Verification Rate**: Percentage of verified settings

---

## 📝 CHANGE HISTORY

Each log entry shows:
- Setting key that was changed
- Old value → New value
- Admin email who made the change
- Timestamp of the change
- Status (Success or Failed)
- Error message (if failed)

---

## 🛡️ SECURITY NOTES

- All changes are logged and audited
- Only admins can modify settings
- Sensitive values are masked in the UI
- Click the eye icon to show/hide values
- Copy button copies value to clipboard
- All changes require verification

---

## ⚠️ COMMON ISSUES

### Setting Won't Save
- Check validation rules for your setting type
- Ensure value is in correct format
- Check error message for details

### Verification Fails
- Value may not meet validation requirements
- Check the validation rules above
- Try editing and saving again

### Can't See Settings
- Make sure you're logged in as admin
- Scroll down to Admin Command Center
- Check browser console for errors

---

## 🔧 TROUBLESHOOTING

### Settings Not Loading
1. Refresh the page
2. Check browser console for errors
3. Verify admin access
4. Check network connection

### Changes Not Saving
1. Check validation rules
2. Look at error message
3. Try again with correct format
4. Contact support if issue persists

### Verification Not Working
1. Ensure setting value is valid
2. Check validation rules
3. Try individual verification first
4. Check browser console for errors

---

## 📞 SUPPORT

For issues:
1. Check the validation rules
2. Review the error message
3. Check the change history
4. Contact your system administrator

---

## 💡 TIPS & TRICKS

### Batch Operations
- Use "Verify All" to verify all settings at once
- Saves time compared to individual verification

### Change History
- Filter logs to see only failed changes
- Helps identify problematic settings

### Value Masking
- Click eye icon to show/hide sensitive values
- Useful for security when sharing screen

### Copy Values
- Use copy button to quickly copy values
- Useful for sharing with team members

---

## 🎯 BEST PRACTICES

1. **Always Verify** - Verify settings after making changes
2. **Check History** - Review change history regularly
3. **Use Meaningful Values** - Use clear, descriptive values
4. **Document Changes** - Note why you made changes
5. **Test Changes** - Test settings in staging first
6. **Monitor Logs** - Check logs for failed changes

---

## 📊 MONITORING

Check the verification summary regularly:
- Ensure all settings are verified
- Monitor for failed verifications
- Track pending settings
- Review change history

---

**Last Updated**: 2024
**Version**: 1.0
**Status**: Production Ready
