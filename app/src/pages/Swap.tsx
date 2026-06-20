import { useState } from 'react'
import { ArrowDownUp, Info } from 'lucide-react'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import { portfolioStore } from '../lib/portfolioStore'
import { api, newIdempotencyKey } from '../lib/api'
import { toast } from 'sonner'
import { cryptoIconFor, assetIconFor, cryptoIconErrorFallback } from '../lib/cryptoIcon'

const SWAP_ASSETS = ['USD', 'BTC', 'ETH', 'SOL', 'USDC', 'USDT', 'ADA', 'XRP', 'DOGE', 'MATIC', 'DOT', 'AVAX', 'LINK', 'LTC', 'BCH']

export default function SwapPage() {
  const wallet = portfolioStore.getWallet()
  const [fromCurrency, setFromCurrency] = useState('USD')
  const [toCurrency, setToCurrency] = useState('BTC')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(1)
  const [swapping, setSwapping] = useState(false)

  const getUsdRate = (currency: string): number => {
    const live = portfolioStore.getQuote(currency)
    if (live != null && live > 0) return live
    const baseline: Record<string, number> = { USD: 1, USDC: 1, USDT: 1, BTC: 67432, ETH: 3521, SOL: 178.45, ADA: 0.52, XRP: 0.55, DOGE: 0.12, MATIC: 0.62, DOT: 6.8, AVAX: 32, LINK: 14, LTC: 75, BCH: 380 }
    return baseline[currency] || 1
  }

  const fromRate = getUsdRate(fromCurrency)
  const toRate = getUsdRate(toCurrency)
  const rate = fromRate / toRate
  const fromAmount = parseFloat(amount) || 0
  const toAmount = fromAmount * rate * (1 - slippage / 100)

  const fromBalance = wallet.find(w => w.currency === fromCurrency)?.available || 0

  const handleSwap = async () => {
    if (!amount || fromAmount <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    if (fromAmount > fromBalance) {
      toast.error(`Insufficient ${fromCurrency} balance`)
      return
    }
    setSwapping(true)
    try {
      await api.swap({ fromCurrency, toCurrency, amount: fromAmount, slippage })
      portfolioStore.addTransaction('transfer', -fromAmount, fromCurrency, `Swap ${fromCurrency}→${toCurrency}`, newIdempotencyKey(), { skipApi: true })
      portfolioStore.addTransaction('transfer', toAmount, toCurrency, `Swap ${fromCurrency}→${toCurrency}`, newIdempotencyKey(), { skipApi: true })
      toast.success(`Swapped ${fromAmount} ${fromCurrency} → ${toAmount.toFixed(6)} ${toCurrency}`)
      setAmount('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Swap failed')
    } finally {
      setSwapping(false)
    }
  }

  function CurrencyIcon({ currency, size = 32 }: { currency: string; size?: number }) {
    if (currency === 'USD') {
      return <img src="https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/usd.svg" alt="USD" className="rounded-full bg-white/5 shrink-0 object-contain p-0.5" style={{ width: size, height: size }} onError={(e) => { e.currentTarget.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='%230C8B44'/><text x='16' y='21' text-anchor='middle' font-family='Inter,system-ui,sans-serif' font-size='14' font-weight='700' fill='white'>$</text></svg>` }} />
    }
    return <img src={cryptoIconFor(currency) || assetIconFor(currency) || undefined} alt={currency} className="rounded-full bg-white/5 shrink-0 object-contain p-0.5" style={{ width: size, height: size }} onError={cryptoIconErrorFallback(currency.charAt(0).toUpperCase(), currency)} />
  }

  return (
    <div className="min-h-screen bg-[#070C0E]">
      <Navigation />
      <div className="pt-24 pb-16 px-6">
        <div className="max-w-lg mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-light tracking-[-0.03em] text-[#E5E5E5]">Swap</h1>
            <p className="text-sm text-[#737373] mt-1">Instant currency exchange</p>
          </div>

          <div className="glass-card p-6 space-y-4">
            <div>
              <label className="text-xs text-[#A0A0A0] mb-2 block">From</label>
              <div className="bg-[#0a0e10] border border-[#ffffff10] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} className="bg-transparent text-lg text-[#E5E5E5] focus:outline-none">
                    {SWAP_ASSETS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <CurrencyIcon currency={fromCurrency} size={36} />
                </div>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent text-2xl text-[#E5E5E5] focus:outline-none" />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[#737373]">Balance: {fromBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                  <button onClick={() => setAmount(String(fromBalance))} className="text-xs text-[#0C8B44] hover:underline">Max</button>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={() => { setFromCurrency(toCurrency); setToCurrency(fromCurrency) }} className="w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#ffffff10] flex items-center justify-center hover:border-[#0C8B44]/40 transition-colors">
                <ArrowDownUp className="w-5 h-5 text-[#0C8B44]" />
              </button>
            </div>

            <div>
              <label className="text-xs text-[#A0A0A0] mb-2 block">To</label>
              <div className="bg-[#0a0e10] border border-[#ffffff10] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} className="bg-transparent text-lg text-[#E5E5E5] focus:outline-none">
                    {SWAP_ASSETS.filter(c => c !== fromCurrency).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <CurrencyIcon currency={toCurrency} size={36} />
                </div>
                <p className="text-2xl text-[#E5E5E5]">{toAmount.toFixed(6)}</p>
                <p className="text-xs text-[#737373] mt-2">≈ ${(toAmount * toRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="rounded-xl bg-[#1a1a1a]/50 border border-[#ffffff08] p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-[#A0A0A0]">Rate</span>
                <span className="text-[#E5E5E5]">1 {fromCurrency} = {rate.toFixed(6)} {toCurrency}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#A0A0A0]">Slippage</span>
                <div className="flex items-center gap-2">
                  <input type="number" value={slippage} onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)} min="0" max="50" step="0.1" className="w-16 px-2 py-1 bg-[#0d0d0d] border border-[#ffffff10] rounded text-xs text-[#E5E5E5] text-right" />
                  <span className="text-[#E5E5E5]">%</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-[#737373] bg-[#0C8B44]/10 border border-[#0C8B44]/30 rounded-lg p-3">
              <Info className="w-4 h-4 text-[#0C8B44] shrink-0 mt-0.5" />
              <p>Swap executes instantly at current rates with {slippage}% slippage protection. Rates may fluctuate.</p>
            </div>

            <button onClick={handleSwap} disabled={swapping || !amount || fromAmount > fromBalance} className="w-full py-3.5 bg-[#0C8B44] text-white text-sm font-medium rounded-xl hover:bg-[#0a7539] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {swapping ? 'Swapping...' : `Swap ${fromCurrency} → ${toCurrency}`}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
