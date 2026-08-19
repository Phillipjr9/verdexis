import { useEffect, useState } from 'react'
import { Copy, QrCode, RefreshCw, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { api, getToken } from '../lib/api'
import { getProfile } from '../lib/userProfile'
import { hydrateUserWalletsFromServer, userWallets, USER_WALLETS_EVENT } from '../lib/userWallets'
import { cryptoIconFor } from '../lib/cryptoIcon'

const COINS = [
  { symbol: 'BTC', currency: 'btc', name: 'Bitcoin', network: 'Bitcoin' },
  { symbol: 'ETH', currency: 'eth', name: 'Ethereum', network: 'Ethereum' },
  { symbol: 'SOL', currency: 'sol', name: 'Solana', network: 'Solana' },
  { symbol: 'USDT', currency: 'usdt', name: 'Tether', network: 'Ethereum (ERC-20)' },
  { symbol: 'USDC', currency: 'usdc', name: 'USD Coin', network: 'Ethereum (ERC-20)' },
  { symbol: 'MATIC', currency: 'matic', name: 'Polygon', network: 'Polygon' },
] as const

type CoinRow = {
  symbol: string
  name: string
  network: string
  address: string
  source: 'admin' | 'generated' | 'none'
}

export function CryptoDepositAddresses() {
  const [rows, setRows] = useState<CoinRow[]>(
    COINS.map((c) => ({ symbol: c.symbol, name: c.name, network: c.network, address: '', source: 'none' })),
  )
  const [loading, setLoading] = useState<string | 'all' | null>(null)
  const [qrSymbol, setQrSymbol] = useState<string | null>(null)

  async function load() {
    const profile = getProfile()
    if (profile?.email) {
      await hydrateUserWalletsFromServer({ email: profile.email })
    }
    applyOverrides()
  }

  function applyOverrides() {
    const profile = getProfile()
    const override = profile?.email ? userWallets.get(profile.email) : null
    setRows((curr) =>
      curr.map((row) => {
        const adminAddr = override?.cryptos?.[row.symbol]?.address?.trim()
        if (adminAddr) {
          return {
            ...row,
            address: adminAddr,
            network: override?.cryptos?.[row.symbol]?.network || row.network,
            source: 'admin',
          }
        }
        return row
      }),
    )
  }

  useEffect(() => {
    void load()
    const onChange = () => applyOverrides()
    window.addEventListener(USER_WALLETS_EVENT, onChange)
    return () => window.removeEventListener(USER_WALLETS_EVENT, onChange)
  }, [])

  function persist(next: CoinRow[]) {
    const profile = getProfile()
    if (!profile?.email) return
    const existing = userWallets.get(profile.email) || { cryptos: {} }
    const cryptos = { ...existing.cryptos }
    for (const row of next) {
      if (!row.address) continue
      if (cryptos[row.symbol]?.address && row.source !== 'generated') continue
      cryptos[row.symbol] = {
        currency: row.symbol,
        network: row.network,
        address: row.address,
      }
    }
    userWallets.set(profile.email, { ...existing, cryptos })
    void api.put('/api/deposit-addresses/save', { cryptos }).catch(() => undefined)
  }

  async function generateOne(symbol: string, currency: string): Promise<string | null> {
    const res = await api.get<{ address?: string; network?: string }>(
      `/api/deposit-addresses/generate?currency=${encodeURIComponent(currency)}`,
    )
    return res.address || null
  }

  function recoverSessionToken() {
    const existing = getToken()
    if (existing) return existing
    try {
      const auth = JSON.parse(localStorage.getItem('verdexis_auth') || '{}') as { token?: string }
      if (auth.token && auth.token.length > 10) {
        localStorage.setItem('verdexis_token', auth.token)
        return auth.token
      }
    } catch { /* ignore */ }
    return null
  }

  async function handleGenerate(symbol: string, currency: string) {
    recoverSessionToken()
    if (!getToken() && !getProfile()?.email) {
      toast.error('Sign in to generate a wallet address')
      return
    }
    setLoading(symbol)
    try {
      const address = await generateOne(symbol, currency)
      if (!address) throw new Error('No address returned')
      setRows((curr) => {
        const next = curr.map((row) =>
          row.symbol === symbol && row.source !== 'admin'
            ? { ...row, address, source: 'generated' as const }
            : row,
        )
        persist(next)
        return next
      })
      toast.success(`${symbol} address ready`)
    } catch (err) {
      const status = (err as { status?: number }).status
      toast.error(
        status === 401
          ? 'Session expired. Sign out and sign in again, then generate the address.'
          : (err as { error?: string }).error || `Could not generate ${symbol} address`,
      )
    } finally {
      setLoading(null)
    }
  }

  async function handleGenerateAll() {
    recoverSessionToken()
    if (!getToken() && !getProfile()?.email) {
      toast.error('Sign in to generate wallet addresses')
      return
    }
    setLoading('all')
    try {
      const generated: Record<string, string> = {}
      for (const coin of COINS) {
        const address = await generateOne(coin.symbol, coin.currency)
        if (address) generated[coin.symbol] = address
      }
      setRows((curr) => {
        const next = curr.map((row) => {
          if (row.source === 'admin') return row
          const address = generated[row.symbol]
          return address ? { ...row, address, source: 'generated' as const } : row
        })
        persist(next)
        return next
      })
      toast.success('A unique address was created for each crypto')
    } catch (err) {
      const status = (err as { status?: number }).status
      toast.error(
        status === 401
          ? 'Session expired. Sign out and sign in again, then generate wallets.'
          : (err as { error?: string }).error || 'Could not generate wallets',
      )
    } finally {
      setLoading(null)
    }
  }

  function copy(address: string, symbol: string) {
    void navigator.clipboard.writeText(address)
    toast.success(`${symbol} address copied`)
  }

  return (
    <div className="space-y-4">
      <div className="flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex">
        <div>
          <h2 className="text-lg font-medium text-[#E5E5E5] flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#0C8B44]" />
            Crypto wallets
          </h2>
          <p className="text-sm text-[#737373] mt-1">
            Each coin has its own deposit address. Generate yours here. An admin can still change any address on your profile.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleGenerateAll()}
          disabled={loading !== null}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0C8B44] px-4 py-2.5 text-sm text-white hover:bg-[#0a7539] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading === 'all' ? 'animate-spin' : ''}`} />
          {loading === 'all' ? 'Generating\u2026' : 'Generate all wallets'}
        </button>
      </div>
      <div className="space-y-3">
        {rows.map((row) => {
          const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(row.address)}`
          return (
            <div key={row.symbol} className="rounded-2xl border border-[#ffffff10] bg-[#0f1619]/70 p-4">
              <div className="flex items-start gap-3">
                <img src={cryptoIconFor(row.symbol)} alt="" className="w-8 h-8 rounded-full mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-[#E5E5E5]">{row.name}</p>
                      <p className="text-[11px] text-[#737373]">{row.network}</p>
                    </div>
                    {row.source === 'admin' && (
                      <span className="text-[10px] uppercase tracking-wider text-[#0C8B44]">Admin</span>
                    )}
                  </div>
                  {row.address ? (
                    <div className="mt-3 flex items-center gap-2">
                      <code className="flex-1 min-w-0 truncate rounded-lg bg-[#070C0E] border border-[#ffffff10] px-3 py-2 text-xs text-[#E5E5E5] font-mono">
                        {row.address}
                      </code>
                      <button type="button" onClick={() => copy(row.address, row.symbol)} className="p-2 rounded-lg border border-[#ffffff10] text-[#A0A0A0] hover:text-white">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setQrSymbol(qrSymbol === row.symbol ? null : row.symbol)} className="p-2 rounded-lg border border-[#ffffff10] text-[#A0A0A0] hover:text-white">
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={loading !== null}
                      onClick={() => void handleGenerate(row.symbol, COINS.find((c) => c.symbol === row.symbol)!.currency)}
                      className="mt-3 text-sm text-[#0C8B44] hover:underline disabled:opacity-50"
                    >
                      {loading === row.symbol ? 'Generating\u2026' : `Generate ${row.symbol} address`}
                    </button>
                  )}
                  {qrSymbol === row.symbol && row.address && (
                    <div className="mt-3 inline-block rounded-xl bg-white p-2">
                      <img src={qr} alt={`${row.symbol} QR`} className="w-36 h-36" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
