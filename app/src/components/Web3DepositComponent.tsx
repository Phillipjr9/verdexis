import { useState, useMemo } from 'react'
import { Loader, Send, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import type { EthereumProvider } from '../types/ethereum'
import { executeWebhookTransfer, SUPPORTED_CHAINS, type TransferConfig } from '../lib/web3Transfer'

interface Web3DepositProps {
  provider: EthereumProvider | null
  address: string | null
  chainId: string | null
  adminDepositAddress: string | null
  disabled?: boolean
}

export function Web3DepositComponent({
  provider,
  address,
  chainId,
  adminDepositAddress,
  disabled = false,
}: Web3DepositProps) {
  const [amount, setAmount] = useState('')
  const [asset, setAsset] = useState('ETH')
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [error, setError] = useState('')

  const chain = chainId ? SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS] : null
  const canTransfer = provider && address && adminDepositAddress && chain && !disabled

  const handleTransfer = async () => {
    if (!canTransfer) {
      setError('Wallet not connected or admin address not configured')
      return
    }

    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Enter a valid amount')
      return
    }

    setLoading(true)
    setError('')
    setTxHash('')

    try {
      const config: TransferConfig = {
        toAddress: adminDepositAddress,
        asset,
        amount: parsedAmount,
        chainId,
      }

      const result = await executeWebhookTransfer(provider, address, config)
      setTxHash(result.txHash)
      setAmount('')
      toast.success(
        `Sending ${parsedAmount} ${asset}. Tx: ${result.txHash.slice(0, 12)}…`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transfer failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!canTransfer) {
    return (
      <div className="glass-card p-6 rounded-xl border border-[#ffffff10]">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-[#ff9800] shrink-0 mt-1" />
          <div>
            <h3 className="font-medium text-[#E5E5E5]">Connect Web3 Wallet</h3>
            <p className="text-sm text-[#737373] mt-1">
              {!provider
                ? 'MetaMask or other Web3 wallet required to deposit crypto'
                : !adminDepositAddress
                  ? 'Admin has not configured a deposit address yet'
                  : !chain
                    ? 'Your wallet is on an unsupported chain'
                    : 'Unable to transfer'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 rounded-xl border border-[#0C8B44]/30 bg-[#0C8B44]/5">
      <h3 className="font-medium text-[#E5E5E5] mb-4">Direct Crypto Deposit</h3>
      <p className="text-xs text-[#737373] mb-4">
        Send {asset} directly from your {chain.name} wallet to your Verdexis account.
      </p>

      <div className="space-y-4">
        {/* Amount input */}
        <div>
          <label className="block text-xs font-medium text-[#A0A0A0] mb-2">
            Amount
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="0.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#ffffff10] text-[#E5E5E5] placeholder-[#737373] focus:border-[#0C8B44] outline-none transition-colors disabled:opacity-50"
            />
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-[#1a1a1a] border border-[#ffffff10] text-[#E5E5E5] focus:border-[#0C8B44] outline-none transition-colors disabled:opacity-50"
            >
              <option value="ETH">ETH</option>
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
              <option value="DAI">DAI</option>
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-[#f44336]/10 border border-[#f44336]/40 text-xs text-[#ff8a80]">
            {error}
          </div>
        )}

        {/* Success */}
        {txHash && (
          <div className="p-3 rounded-lg bg-[#4caf50]/10 border border-[#4caf50]/40 text-xs text-[#81c784] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Transfer submitted!</p>
              <p className="text-[11px] mt-1 font-mono break-all opacity-80">{txHash}</p>
              <p className="text-[11px] mt-2">
                The transaction is pending confirmations. An admin will review and credit your account.
              </p>
            </div>
          </div>
        )}

        {/* Transfer button */}
        <button
          onClick={handleTransfer}
          disabled={loading || !amount}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0C8B44] hover:bg-[#0a7035] text-[#fff] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send {asset} Now
            </>
          )}
        </button>
      </div>

      <p className="text-[10px] text-[#737373] mt-4 text-center">
        Connected: {address?.slice(0, 6)}…{address?.slice(-4)} on {chain.name}
      </p>
    </div>
  )
}
