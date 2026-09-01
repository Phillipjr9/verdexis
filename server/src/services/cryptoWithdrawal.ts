// Crypto Withdrawal Service - DISABLED due to Solana SDK migration
// TODO: Update to use @solana/spl-token v2 exports
export async function executeCryptoWithdrawal() {
  return {
    status: 'pending',
    message: 'Crypto withdrawal service temporarily disabled for SDK migration'
  }
}

export function buildWithdrawalTransferPlan(input: any) {
  return {
    chain: 'ethereum',
    asset: input.asset || '',
    amount: input.amount || 0,
    destinationAddress: input.destinationAddress || '',
    isNative: false
  }
}

export function detectWalletAddressType(address: string): 'ethereum' | 'solana' | 'bitcoin' | 'unknown' {
  const trimmed = (address || '').trim().replace(/^(bitcoin|ethereum|solana):/i, '')
  if (!trimmed) return 'unknown'
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return 'ethereum'
  if (/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmed)) return 'bitcoin'
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) return 'solana'
  return 'unknown'
}

export function resolveWithdrawalChain(input: any) {
  const detectedWalletType = detectWalletAddressType(String(input?.destinationAddress || ''))
  const explicit = input?.chain as 'ethereum' | 'solana' | 'bitcoin' | 'bsc' | undefined
  const asset = String(input?.asset || '').toUpperCase()
  let chain = explicit
  if (!chain) {
    if (asset === 'BTC' || detectedWalletType === 'bitcoin') chain = 'bitcoin'
    else if (asset === 'SOL' || detectedWalletType === 'solana') chain = 'solana'
    else if (asset === 'BNB') chain = 'bsc'
    else if (detectedWalletType === 'ethereum') chain = 'ethereum'
    else if (asset === 'ETH' || asset === 'USDC' || asset === 'USDT') chain = 'ethereum'
  }
  return { chain, detectedWalletType }
}

export function buildExternalWalletTransferMessage(input: any) {
  return 'Service temporarily disabled'
}

export function buildTemporaryFundingTransferResult(input: any) {
  return { status: 'pending', message: 'Service temporarily disabled' }
}

export type WithdrawalTransferPlan = any
export type WalletAddressType = 'ethereum' | 'solana' | 'bitcoin' | 'unknown'
export type WithdrawalTransferResult = { status: string; message: string; txHash?: string }
