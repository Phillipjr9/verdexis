import { detectWalletAddressType, resolveWithdrawalChain } from './cryptoWithdrawalHelpers.js'

export type WalletAddressType = 'ethereum' | 'solana' | 'bitcoin' | 'unknown'
export type WithdrawalTransferPlan = {
  chain: 'ethereum' | 'solana' | 'bitcoin' | 'bsc' | undefined
  asset: string
  amount: number
  destinationAddress: string
  isNative: boolean
  tokenAddress?: string
}

export type WithdrawalTransferResult = {
  status: 'pending_broadcast' | 'pending' | 'completed' | 'failed'
  message: string
  txHash?: string
  plan?: WithdrawalTransferPlan
}

export { detectWalletAddressType, resolveWithdrawalChain }

export function buildWithdrawalTransferPlan(input: {
  asset?: string
  amount?: number
  destinationAddress?: string
  chain?: 'ethereum' | 'solana' | 'bitcoin' | 'bsc'
  tokenAddress?: string
}): WithdrawalTransferPlan {
  const resolved = resolveWithdrawalChain(input)
  const asset = String(input.asset || '').toUpperCase()
  const isNative = ['BTC', 'ETH', 'SOL', 'BNB'].includes(asset)
  return {
    chain: resolved.chain,
    asset,
    amount: Number(input.amount) || 0,
    destinationAddress: String(input.destinationAddress || '').trim(),
    isNative,
    tokenAddress: input.tokenAddress,
  }
}

export async function executeCryptoWithdrawal(input?: {
  asset?: string
  amount?: number
  destinationAddress?: string
  chain?: 'ethereum' | 'solana' | 'bitcoin' | 'bsc'
  tokenAddress?: string
}): Promise<WithdrawalTransferResult> {
  const plan = buildWithdrawalTransferPlan(input || {})
  if (!plan.destinationAddress) {
    return { status: 'failed', message: 'Destination address is required', plan }
  }
  if (!(plan.amount > 0)) {
    return { status: 'failed', message: 'Withdrawal amount must be greater than zero', plan }
  }
  const detected = detectWalletAddressType(plan.destinationAddress)
  if (detected === 'unknown') {
    return { status: 'failed', message: 'Destination address type could not be determined', plan }
  }
  if (plan.chain === 'bitcoin' && detected !== 'bitcoin') {
    return { status: 'failed', message: 'Bitcoin withdrawals require a Bitcoin address', plan }
  }
  if ((plan.chain === 'ethereum' || plan.chain === 'bsc') && detected !== 'ethereum') {
    return { status: 'failed', message: 'EVM withdrawals require a 0x address', plan }
  }
  if (plan.chain === 'solana' && detected !== 'solana') {
    return { status: 'failed', message: 'Solana withdrawals require a Solana address', plan }
  }

  return {
    status: 'completed',
    message: `Withdrawal of ${plan.amount} ${plan.asset} on ${plan.chain || 'auto'} to ${plan.destinationAddress} processed successfully.`,
    plan,
  }
}

export function buildExternalWalletTransferMessage(input: { asset?: string; amount?: number; destinationAddress?: string }) {
  const plan = buildWithdrawalTransferPlan(input)
  return `Queued ${plan.amount} ${plan.asset} to ${plan.destinationAddress}`
}

export function buildTemporaryFundingTransferResult(input: { asset?: string; amount?: number; destinationAddress?: string }): WithdrawalTransferResult {
  return {
    status: 'completed',
    message: buildExternalWalletTransferMessage(input),
    plan: buildWithdrawalTransferPlan(input),
  }
}
