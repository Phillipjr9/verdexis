/**
 * WALLET ADDRESS BARCODE SCANNING & COPY FEATURES
 * 
 * Features added to prevent user mistakes:
 * 
 * 1. QR CODE SCANNING
 *    - Scan existing QR codes to verify wallet address
 *    - Compare scanned address with wallet address
 *    - Uses device camera via getUserMedia API
 *    - Fallback for browsers without camera support
 * 
 * 2. MULTIPLE COPY FORMATS
 *    - Plain address copy
 *    - Copy with network details
 *    - CSV format for spreadsheets
 *    - JSON format for apps
 *    - Full backup string with warnings
 * 
 * 3. ADDRESS VALIDATION
 *    - Client-side format validation per currency
 *    - Server-side validation via API
 *    - Bitcoin: P2PKH, P2SH, SegWit formats
 *    - Ethereum: EVM-compatible addresses (0x...)
 *    - Solana: Base58 format
 *    - XRP: R-address format
 *    - Dogecoin: D-address format
 * 
 * 4. ERROR PREVENTION
 *    - Address comparison with character-level diff
 *    - Typo detection
 *    - Network mismatch warnings
 *    - Asset-specific validation
 * 
 * USAGE EXAMPLES:
 */

import { validateWalletAddress, createWalletBackupString } from '@/lib/walletUtils'

export function BasicWalletDisplay() {
  const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEd'
  const currency = 'ETH'
  const network = 'Ethereum'

  const formats = [
    { label: 'Basic', value: address },
    { label: 'With details', value: `${address} | ${currency} | ${network}` },
    { label: 'CSV', value: `${address},${currency},${network}` },
    { label: 'JSON', value: JSON.stringify({ address, currency, network }) },
  ]

  return {
    address,
    currency,
    network,
    formats,
  }
}

export function AdvancedWalletDisplay() {
  const address = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
  const currency = 'BTC'
  const network = 'Bitcoin'

  return {
    address,
    currency,
    network,
  }
}

export function AddressValidationExample() {
  return [
    { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEd', currency: 'ETH' },
    { address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', currency: 'BTC' },
    { address: 'invalid-address', currency: 'ETH' },
  ].map((test) => ({
    ...test,
    validation: validateWalletAddress(test.address, test.currency),
  }))
}

export function WalletBackupExample() {
  const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEd'
  const currency = 'ETH'
  const network = 'Ethereum'

  return {
    backupString: createWalletBackupString(address, currency, network, 'Main ETH Wallet'),
    address,
    currency,
    network,
  }
}

export async function validateAddressViaAPI(address: string, currency: string) {
  try {
    const response = await fetch('/api/wallet/validate-address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, currency }),
    })

    const result = await response.json()

    if (!result.valid) {
      console.error('Address invalid:', result.error)
      return null
    }

    console.log('Address valid:', {
      currency: result.currency,
      type: result.type,
      address: result.address,
    })

    return result
  } catch (error) {
    console.error('Validation failed:', error)
    return null
  }
}

export async function compareAddressesViaAPI(address1: string, address2: string, currency: string) {
  try {
    const response = await fetch('/api/wallet/compare-addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address1, address2, currency }),
    })

    const result = await response.json()

    if (!result.match) {
      console.warn('Addresses do not match!')
      if (result.differences) {
        console.warn('Differences found at positions:', result.differences)
      }
    }

    return result
  } catch (error) {
    console.error('Comparison failed:', error)
    return null
  }
}
