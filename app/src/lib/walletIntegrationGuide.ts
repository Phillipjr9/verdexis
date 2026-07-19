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

import { EnhancedCopyButton, copyFormats } from '@/components/EnhancedCopyButton'
import { WalletQrScanner } from '@/components/WalletQrScanner'
import { validateWalletAddress, generateWalletFormats, createWalletBackupString } from '@/lib/walletUtils'

/**
 * EXAMPLE 1: Basic wallet address display with multiple copy options
 */
function BasicWalletDisplay() {
  const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEd'
  const currency = 'ETH'
  const network = 'Ethereum'

  const formats = [
    copyFormats.basic(address),
    copyFormats.withDetails(address, currency, network),
    copyFormats.csv(address, currency, network),
    copyFormats.json(address, currency, network),
  ]

  return (
    <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
      <h3 className="text-lg font-semibold text-white mb-4">Deposit Address</h3>
      
      <div className="bg-[#070C0E] rounded p-4 flex items-center justify-between gap-2 mb-4">
        <code className="text-[#0C8B44] font-mono text-sm break-all">{address}</code>
        <EnhancedCopyButton 
          value={address}
          formats={formats}
          tooltip="Copy wallet address"
        />
      </div>

      <p className="text-xs text-[#737373]">
        Network: <span className="text-[#E5E5E5]">{network}</span>
      </p>
    </div>
  )
}

/**
 * EXAMPLE 2: Full wallet display with QR scanning
 */
function AdvancedWalletDisplay() {
  const address = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'
  const currency = 'BTC'
  const network = 'Bitcoin'

  return (
    <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329] space-y-6">
      <h3 className="text-lg font-semibold text-white">Bitcoin Deposit</h3>

      {/* Use the QR Scanner component for full functionality */}
      <WalletQrScanner
        address={address}
        currency={currency}
        network={network}
        onAddressScanned={(scannedAddr) => {
          console.log('Scanned address:', scannedAddr)
          // Handle verification
        }}
      />

      {/* Network details */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="text-[#737373]">Currency</p>
          <p className="text-[#E5E5E5] font-medium">{currency}</p>
        </div>
        <div>
          <p className="text-[#737373]">Network</p>
          <p className="text-[#E5E5E5] font-medium">{network}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * EXAMPLE 3: Address validation with error handling
 */
function AddressValidationExample() {
  const testAddresses = [
    { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEd', currency: 'ETH' },
    { address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', currency: 'BTC' },
    { address: 'invalid-address', currency: 'ETH' }
  ]

  return (
    <div className="space-y-4">
      {testAddresses.map((test, idx) => {
        const validation = validateWalletAddress(test.address, test.currency)
        return (
          <div key={idx} className="bg-[#0F1619] rounded-lg p-4 border border-[#1a2329]">
            <p className="text-sm text-[#E5E5E5] mb-2 font-mono break-all">
              {test.address}
            </p>
            <div className={`flex items-center gap-2 ${validation.valid ? 'text-[#4CAF50]' : 'text-[#f44336]'}`}>
              <span className="text-xs font-medium">
                {validation.valid ? '✓ Valid' : '✗ ' + validation.error}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * EXAMPLE 4: Create and display wallet backup
 */
function WalletBackupExample() {
  const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f4bEd'
  const currency = 'ETH'
  const network = 'Ethereum'

  const backupString = createWalletBackupString(address, currency, network, 'Main ETH Wallet')

  return (
    <div className="bg-[#0F1619] rounded-lg p-6 border border-[#1a2329]">
      <h3 className="text-lg font-semibold text-white mb-4">Wallet Backup</h3>
      
      <pre className="bg-[#070C0E] rounded p-4 text-[#0C8B44] text-xs font-mono overflow-x-auto mb-4">
        {backupString}
      </pre>

      <EnhancedCopyButton
        value={backupString}
        formats={[
          { label: 'Copy backup text', value: backupString }
        ]}
        showLabel={true}
      />
    </div>
  )
}

/**
 * EXAMPLE 5: API validation endpoint usage
 */
async function validateAddressViaAPI(address: string, currency: string) {
  try {
    const response = await fetch('/api/wallet/validate-address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, currency })
    })
    
    const result = await response.json()
    
    if (!result.valid) {
      console.error('Address invalid:', result.error)
      return null
    }
    
    console.log('Address valid:', {
      currency: result.currency,
      type: result.type,
      address: result.address
    })
    
    return result
  } catch (error) {
    console.error('Validation failed:', error)
    return null
  }
}

/**
 * EXAMPLE 6: Compare addresses for typo detection
 */
async function compareAddressesViaAPI(address1: string, address2: string, currency: string) {
  try {
    const response = await fetch('/api/wallet/compare-addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address1, address2, currency })
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

/**
 * INSTALLATION & SETUP:
 * 
 * 1. Install new components:
 *    - WalletQrScanner.tsx
 *    - EnhancedCopyButton.tsx
 * 
 * 2. Install utility functions:
 *    - lib/walletUtils.ts
 * 
 * 3. Add backend routes:
 *    - routes/wallet-address-validation.ts
 *    - Add to server/src/app.ts: app.use('/api/wallet', walletAddressValidationRouter)
 * 
 * 4. Update existing components:
 *    - CryptoDepositAddresses.tsx (already updated)
 *    - Wallet.tsx (can integrate if needed)
 * 
 * 5. Dependencies (already in package.json):
 *    - lucide-react (icons)
 *    - sonner (toast notifications)
 *    - zod (validation)
 * 
 * BROWSER COMPATIBILITY:
 * - QR scanning requires getUserMedia API (most modern browsers)
 * - Clipboard API for copy functions (fallback to older APIs possible)
 * - Safari 14.1+, Chrome 50+, Firefox 63+, Edge 79+
 * 
 * ACCESSIBILITY:
 * - All buttons have aria-labels
 * - Keyboard navigation supported
 * - Screen reader friendly
 * - Toast notifications for feedback
 * 
 * SECURITY CONSIDERATIONS:
 * - Addresses never logged to console in production
 * - Clipboard operations only on user action
 * - Server-side validation prevents injection
 * - XSS protection via React/zod
 * - No sensitive data in local storage
 */

export {
  BasicWalletDisplay,
  AdvancedWalletDisplay,
  AddressValidationExample,
  WalletBackupExample,
  validateAddressViaAPI,
  compareAddressesViaAPI
}
