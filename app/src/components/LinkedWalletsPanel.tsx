import { useEffect, useState } from 'react'
import { Wallet as WalletIcon, Star, Trash2, Copy, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { detectWalletAddressType, getWalletChainHint, type DetectedWalletType } from '../lib/walletUtils'

interface WalletLink {
  id: string
  address: string
  chainId: string | null
  provider: string | null
  label: string | null
  isPrimary: boolean
  linkedAt: string
}

interface LinkedWalletsPanelProps {
  /** Address currently active in the use-web3 hook (for highlighting). */
  activeAddress: string | null
  /** Bumped by the parent whenever a new wallet is connected so the
   *  panel re-fetches the list and shows the freshly-added entry. */
  refreshKey: number
  /** Called after the panel removes the address that was the active one
   *  in the hook so the parent can run web3.disconnect() locally. */
  onActiveRemoved?: () => void
}

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}\u2026${a.slice(-4)}` : a
}

export default function LinkedWalletsPanel({ activeAddress, refreshKey, onActiveRemoved }: LinkedWalletsPanelProps) {
  const [links, setLinks] = useState<WalletLink[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newAddress, setNewAddress] = useState('')
  const [newChainId, setNewChainId] = useState('')
  const [newProvider, setNewProvider] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [detectedAddressType, setDetectedAddressType] = useState<DetectedWalletType>('unknown')
  const [chainHintTouched, setChainHintTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const { links } = await api.listWalletLinks()
      setLinks(links)
    } catch (err) {
      // Likely the user just isn't signed in yet \u2014 hide the panel.
       
      console.warn('[LinkedWalletsPanel] load failed', err)
      setLinks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [refreshKey])

  useEffect(() => {
    const address = newAddress.trim()
    const detected = address ? detectWalletAddressType(address) : 'unknown'
    setDetectedAddressType(detected)

    if (!address) {
      setNewChainId('')
      setChainHintTouched(false)
      return
    }

    const hint = getWalletChainHint(detected)
    if (!chainHintTouched && hint) {
      setNewChainId(hint)
    }
  }, [newAddress, chainHintTouched])

  async function setPrimary(id: string) {
    setBusyId(id)
    try {
      await api.setPrimaryWalletLink(id)
      await load()
      toast.success('Primary wallet updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set primary')
    } finally {
      setBusyId(null)
    }
  }

  async function addWalletLink() {
    const address = newAddress.trim()
    if (!address) {
      setFormError('Enter a wallet address to link.')
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      await api.addWalletLink({
        address,
        chainId: newChainId.trim() || undefined,
        provider: newProvider.trim() || undefined,
        label: newLabel.trim() || undefined,
      })
      setNewAddress('')
      setNewChainId('')
      setNewProvider('')
      setNewLabel('')
      setDetectedAddressType('unknown')
      setChainHintTouched(false)
      toast.success('Wallet linked successfully')
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to link wallet')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(link: WalletLink) {
    if (!confirm(`Remove ${shortAddr(link.address)} from your account?`)) return
    setBusyId(link.id)
    try {
      await api.removeWalletLink(link.id)
      const wasActive = activeAddress && link.address.toLowerCase() === activeAddress.toLowerCase()
      await load()
      toast.success('Wallet removed')
      if (wasActive) onActiveRemoved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove wallet')
    } finally {
      setBusyId(null)
    }
  }

  if (loading && links.length === 0) {
    return (
      <div className="glass-card p-6 mb-8">
        <p className="text-xs text-[#737373]">Loading linked wallets\u2026</p>
      </div>
    )
  }

  const canSubmit = !submitting && newAddress.trim().length > 0
  const detectedChainHint = getWalletChainHint(detectedAddressType)

  return (
    <div className="glass-card p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <WalletIcon className="w-4 h-4 text-[#0C8B44]" />
          <h3 className="text-sm font-medium text-[#E5E5E5]">Linked Wallets</h3>
          <span className="text-[10px] uppercase tracking-wider text-[#737373]">{links.length}</span>
        </div>
        <button
          onClick={() => void load()}
          className="text-[#737373] hover:text-[#E5E5E5] transition-colors p-1"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-[11px] text-[#737373] mb-4">
        Add any self-custody wallet address to keep it linked. The <span className="text-[#0C8B44]">primary</span> wallet
        is used for deposit attribution and shown on the admin page.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-3 mb-6">
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-[#A0A0A0] mb-1 block">Address</label>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="0x..., solana address, bitcoin address, etc."
              className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]"
            />
            <p className="mt-1 text-[10px] text-[#737373]">
              {detectedAddressType === 'unknown'
                ? 'Auto-detects Ethereum, Solana, and Bitcoin addresses as you type.'
                : `Detected ${detectedAddressType} address${detectedChainHint ? ` • chain hint: ${detectedChainHint}` : ''}.`}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-[#A0A0A0] mb-1 block">Network / chain</label>
              <input
                type="text"
                value={newChainId}
                onChange={(e) => {
                  setNewChainId(e.target.value)
                  setChainHintTouched(true)
                }}
                placeholder="ethereum, solana, bitcoin, 0x1, ..."
                className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#A0A0A0] mb-1 block">Label (optional)</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="MetaMask, Phantom, Trust Wallet"
                className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]"
              />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-[#A0A0A0] mb-1 block">Provider (optional)</label>
            <input
              type="text"
              value={newProvider}
              onChange={(e) => setNewProvider(e.target.value)}
              placeholder="Wallet provider name"
              className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#ffffff10] rounded-lg text-sm text-[#E5E5E5] placeholder-[#737373] focus:outline-none focus:border-[#0C8B44]"
            />
          </div>
          <div className="flex flex-col gap-2">
            {formError && <p className="text-[11px] text-[#EF4444]">{formError}</p>}
            <button
              onClick={addWalletLink}
              disabled={!canSubmit}
              className="w-full py-2.5 text-sm text-white bg-[#0C8B44] rounded-lg hover:bg-[#0a7539] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Linking…' : 'Add linked wallet'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {links.map((link) => {
          const isActive = activeAddress && link.address.toLowerCase() === activeAddress.toLowerCase()
          return (
            <div
              key={link.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                link.isPrimary ? 'border-[#0C8B44]/40 bg-[#0C8B44]/5' : 'border-[#ffffff10] bg-[#1a1a1a]/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-[#E5E5E5] truncate">{shortAddr(link.address)}</span>
                  {link.isPrimary && (
                    <span className="text-[9px] uppercase tracking-wider text-[#0C8B44] bg-[#0C8B44]/10 px-1.5 py-0.5 rounded">
                      Primary
                    </span>
                  )}
                  {isActive && (
                    <span className="text-[9px] uppercase tracking-wider text-[#22d3ee] bg-[#22d3ee]/10 px-1.5 py-0.5 rounded">
                      Active session
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-[#737373] flex-wrap">
                  {link.label && <span>{link.label}</span>}
                  {link.provider && <span>{link.provider}</span>}
                  {link.chainId && <span className="font-mono">{link.chainId}</span>}
                  <span>linked {new Date(link.linkedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { navigator.clipboard.writeText(link.address); toast.success('Address copied') }}
                  className="p-2 text-[#737373] hover:text-[#E5E5E5] rounded-lg hover:bg-[#ffffff05] transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {!link.isPrimary && (
                  <button
                    onClick={() => void setPrimary(link.id)}
                    disabled={busyId === link.id}
                    className="p-2 text-[#737373] hover:text-[#0C8B44] rounded-lg hover:bg-[#ffffff05] transition-colors disabled:opacity-40"
                    title="Make primary"
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => void remove(link)}
                  disabled={busyId === link.id}
                  className="p-2 text-[#737373] hover:text-[#f44336] rounded-lg hover:bg-[#ffffff05] transition-colors disabled:opacity-40"
                  title="Remove wallet"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
