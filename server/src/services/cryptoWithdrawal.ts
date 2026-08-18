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
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'ethereum'
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'solana'
  return 'unknown'
}

export function resolveWithdrawalChain(input: any) {
  return { chain: undefined as 'ethereum' | 'solana' | 'bitcoin' | 'bsc' | undefined, detectedWalletType: 'unknown' }
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
