import type { EthereumProvider } from '../types/ethereum'
import { api } from './api'

export interface TransferConfig {
  toAddress: string
  asset: string // e.g., 'ETH', 'USDC'
  amount: number // in asset units (not wei)
  chainId: string // e.g., '0x1' for mainnet
  tokenAddress?: string // only for ERC-20, leave blank for native ETH
}

export interface TransferResult {
  txHash: string
  from: string
  to: string
  amount: number
  asset: string
  chainId: string
}

const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
]

/** Encode ERC-20 transfer call data */
function encodeERC20Transfer(toAddress: string, amount: string): string {
  // transfer(address,uint256) = 0xa9059cbb
  const selector = '0xa9059cbb'
  const paddedAddress = toAddress.slice(2).padStart(64, '0')
  const paddedAmount = amount.slice(2).padStart(64, '0')
  return `${selector}${paddedAddress}${paddedAmount}`
}

/** Send ETH from wallet to admin address */
async function sendETH(
  provider: EthereumProvider,
  fromAddress: string,
  toAddress: string,
  ethAmount: number
): Promise<string> {
  const wei = BigInt(Math.floor(ethAmount * 1e18))
  const txHash = await provider.request<string>({
    method: 'eth_sendTransaction',
    params: [
      {
        from: fromAddress,
        to: toAddress,
        value: '0x' + wei.toString(16),
      },
    ],
  })
  if (typeof txHash !== 'string') throw new Error('Transaction failed')
  return txHash
}

/** Send ERC-20 token from wallet to admin address */
async function sendToken(
  provider: EthereumProvider,
  fromAddress: string,
  tokenAddress: string,
  toAddress: string,
  tokenAmount: number,
  decimals: number = 18
): Promise<string> {
  const units = BigInt(Math.floor(tokenAmount * Math.pow(10, decimals)))
  const data = encodeERC20Transfer(toAddress, '0x' + units.toString(16))
  
  const txHash = await provider.request<string>({
    method: 'eth_sendTransaction',
    params: [
      {
        from: fromAddress,
        to: tokenAddress,
        data,
      },
    ],
  })
  if (typeof txHash !== 'string') throw new Error('Transaction failed')
  return txHash
}

/** Execute a transfer from connected wallet to admin wallet and record it server-side */
export async function executeWebhookTransfer(
  provider: EthereumProvider,
  fromAddress: string,
  config: TransferConfig
): Promise<TransferResult> {
  if (!fromAddress) throw new Error('Wallet not connected')
  
  let txHash: string
  
  // Send transaction based on asset type
  if (config.asset === 'ETH' || config.asset === 'eth') {
    txHash = await sendETH(provider, fromAddress, config.toAddress, config.amount)
  } else if (config.tokenAddress) {
    txHash = await sendToken(provider, fromAddress, config.tokenAddress, config.toAddress, config.amount)
  } else {
    throw new Error(`Unknown asset: ${config.asset}. Provide tokenAddress for ERC-20 transfers.`)
  }

  // Record as pending deposit on backend
  // The admin will review and approve it
  try {
    await api.recordPendingDeposit({
      txHash,
      chainId: config.chainId,
      toAddress: config.toAddress,
      fromAddress,
      asset: config.asset,
      amount: config.amount,
    })
  } catch (err) {
    // Log but don't fail — the transaction is on-chain, server record is secondary
    console.warn('[web3Transfer] Failed to record pending deposit:', err)
  }

  return {
    txHash,
    from: fromAddress,
    to: config.toAddress,
    amount: config.amount,
    asset: config.asset,
    chainId: config.chainId,
  }
}

/** Get supported chains for web3 deposits */
export const SUPPORTED_CHAINS = {
  '0x1': { name: 'Ethereum', symbol: 'ETH' },
  '0xaa36a7': { name: 'Sepolia', symbol: 'ETH' },
  '0x89': { name: 'Polygon', symbol: 'MATIC' },
  '0xa4b1': { name: 'Arbitrum', symbol: 'ETH' },
}
