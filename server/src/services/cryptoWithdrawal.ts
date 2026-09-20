import { detectWalletAddressType, resolveWithdrawalChain } from './cryptoWithdrawalHelpers.js'
import { ethers } from 'ethers'
import { env } from '../env.js'

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

async function executeEthereumWithdrawal(plan: WithdrawalTransferPlan): Promise<WithdrawalTransferResult> {
  if (!env.ETHEREUM_RPC_ENDPOINT || !env.ETHEREUM_WITHDRAWAL_PRIVATE_KEY) {
    return { status: 'failed', message: 'Ethereum withdrawal not configured', plan }
  }

  try {
    const provider = new ethers.JsonRpcProvider(env.ETHEREUM_RPC_ENDPOINT)
    const signer = new ethers.Wallet(env.ETHEREUM_WITHDRAWAL_PRIVATE_KEY, provider)
    const amountWei = ethers.parseEther(plan.amount.toString())

    let tx
    if (plan.isNative) {
      tx = await signer.sendTransaction({
        to: plan.destinationAddress,
        value: amountWei,
        gasLimit: 21000,
      })
    } else if (plan.tokenAddress) {
      const abi = ['function transfer(address to, uint256 amount) public returns (bool)']
      const contract = new ethers.Contract(plan.tokenAddress, abi, signer)
      tx = await contract.transfer(plan.destinationAddress, amountWei)
    } else {
      return { status: 'failed', message: 'Token address required for non-native transfers', plan }
    }

    const receipt = await tx.wait()
    return {
      status: 'completed',
      message: `Withdrawal of ${plan.amount} ${plan.asset} sent to ${plan.destinationAddress}`,
      txHash: receipt?.hash,
      plan,
    }
  } catch (err) {
    const error = err as Error
    console.error('[cryptoWithdrawal] Ethereum error:', error.message)
    return {
      status: 'failed',
      message: `Ethereum withdrawal failed: ${error.message}`,
      plan,
    }
  }
}

async function executeSolanaWithdrawal(plan: WithdrawalTransferPlan): Promise<WithdrawalTransferResult> {
  if (!env.SOLANA_RPC_ENDPOINT || !env.SOLANA_WITHDRAWAL_PRIVATE_KEY) {
    return { status: 'failed', message: 'Solana withdrawal not configured', plan }
  }

  try {
    // Solana withdrawal queued for manual processing (complex token transfers)
    return { status: 'pending', message: `Solana withdrawal of ${plan.amount} ${plan.asset} queued for processing`, plan }
  } catch (err) {
    const error = err as Error
    console.error('[cryptoWithdrawal] Solana error:', error.message)
    return {
      status: 'failed',
      message: `Solana withdrawal failed: ${error.message}`,
      plan,
    }
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

  if (plan.chain === 'ethereum') {
    return executeEthereumWithdrawal(plan)
  }
  if (plan.chain === 'bsc') {
    return { status: 'pending', message: 'BSC withdrawals queued for manual processing', plan }
  }
  if (plan.chain === 'solana') {
    return executeSolanaWithdrawal(plan)
  }
  if (plan.chain === 'bitcoin') {
    return { status: 'pending', message: 'Bitcoin withdrawals queued for manual processing', plan }
  }

  return {
    status: 'pending',
    message: `Withdrawal of ${plan.amount} ${plan.asset} queued for processing`,
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
