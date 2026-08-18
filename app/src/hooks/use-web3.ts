import { useCallback, useEffect, useRef, useState } from 'react'
import type { EthereumProvider } from '../types/ethereum'
import {
  discoverWallets,
  WALLET_RDNS_STORAGE,
  brandLetterIcon,
  type DiscoveredProvider,
  type WalletProviderInfo,
} from '../lib/walletProviders'
import { getWalletConnectProvider, isWalletConnectConfigured, resetWalletConnect } from '../lib/walletConnect'
import { api, getToken } from '../lib/api'

const STORAGE_KEY = 'verdexis_web3_address'

export const WALLETCONNECT_RDNS = 'org.walletconnect'
const WALLETCONNECT_INFO: WalletProviderInfo = {
  uuid: 'walletconnect',
  name: 'WalletConnect',
  rdns: WALLETCONNECT_RDNS,
  icon: brandLetterIcon('W', '#3B99FC'),
}

const CHAIN_NAMES: Record<string, string> = {
  '0x1': 'Ethereum',
  '0x5': 'Goerli',
  '0xaa36a7': 'Sepolia',
  '0x89': 'Polygon',
  '0xa4b1': 'Arbitrum',
  '0xa': 'Optimism',
  '0x2105': 'Base',
  '0x38': 'BNB Chain',
  '0xa86a': 'Avalanche',
  '0x7a69': 'Local Hardhat',
}

export interface Web3State {
  address: string | null
  chainId: string | null
  chainName: string
  balanceEth: number | null
  isConnected: boolean
  isConnecting: boolean
  isAvailable: boolean
  error: string | null
  walletInfo: WalletProviderInfo | null
}

const initialState: Web3State = {
  address: null,
  chainId: null,
  chainName: '',
  balanceEth: null,
  isConnected: false,
  isConnecting: false,
  isAvailable: typeof window !== 'undefined' && !!window.ethereum,
  error: null,
  walletInfo: null,
}

function chainNameFor(id: string | null): string {
  if (!id) return ''
  const s = typeof id === 'string' ? id : String(id)
  return CHAIN_NAMES[s.toLowerCase()] ?? `Chain ${parseInt(s, 16) || s}`
}

function normalizeChainId(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number') return '0x' + raw.toString(16)
  return String(raw)
}

async function fetchBalance(provider: EthereumProvider, address: string): Promise<number | null> {
  try {
    const hex = await provider.request<string>({ method: 'eth_getBalance', params: [address, 'latest'] })
    if (typeof hex !== 'string') return null
    const wei = BigInt(hex)
    const eth = Number(wei) / 1e18
    return Number.isFinite(eth) ? eth : null
  } catch {
    return null
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

async function hydrateChainAndBalance(provider: EthereumProvider, address: string) {
  const chainId = normalizeChainId(
    await withTimeout(provider.request({ method: 'eth_chainId' }).catch(() => null), 2500, null),
  )
  const balanceEth = await withTimeout(fetchBalance(provider, address), 3000, null)
  return { chainId, balanceEth }
}

async function persistLinkToBackend(address: string, chainId: string | null, providerName: string): Promise<void> {
  if (!getToken()) return
  try {
    await api.linkWallet({
      address,
      chainId: chainId ?? undefined,
      provider: providerName,
    })
  } catch {
    /* link is convenience */
  }
}

async function clearLinkOnBackend(): Promise<void> {
  if (!getToken()) return
  try { await api.unlinkWallet() } catch { /* ignore */ }
}

export function useWeb3() {
  const [state, setState] = useState<Web3State>(initialState)
  const providerRef = useRef<EthereumProvider | null>(null)
  const [discovered, setDiscovered] = useState<DiscoveredProvider[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const attachListeners = useCallback((provider: EthereumProvider) => {
    if (!provider?.on) return () => {}
    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = (args[0] as string[]) ?? []
      if (!accounts.length) {
        setState((s) => ({ ...s, address: null, isConnected: false, balanceEth: null }))
        try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      } else {
        const addr = accounts[0]
        setState((s) => ({ ...s, address: addr, isConnected: true, error: null }))
        try { localStorage.setItem(STORAGE_KEY, addr) } catch { /* ignore */ }
        fetchBalance(provider, addr).then((bal) => setState((s) => ({ ...s, balanceEth: bal })))
      }
    }
    const onChainChanged = (...args: unknown[]) => {
      const raw = args[0]
      const id = typeof raw === 'string'
        ? raw
        : typeof raw === 'number'
          ? '0x' + raw.toString(16)
          : raw == null ? null : String(raw)
      setState((s) => ({ ...s, chainId: id, chainName: chainNameFor(id) }))
    }
    provider.on('accountsChanged', onAccountsChanged)
    provider.on('chainChanged', onChainChanged)
    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged)
      provider.removeListener?.('chainChanged', onChainChanged)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let detach: (() => void) | undefined

    ;(async () => {
      const list = await discoverWallets()
      if (cancelled) return
      setDiscovered(list)
      setState((s) => ({ ...s, isAvailable: list.length > 0 }))

      const lastRdns = (() => {
        try { return localStorage.getItem(WALLET_RDNS_STORAGE) } catch { return null }
      })()
      const target = lastRdns
        ? list.find((d) => d.info.rdns === lastRdns) ?? list[0]
        : list[0]
      if (!target) return

      try {
        const accounts = await target.provider.request<string[]>({ method: 'eth_accounts' })
        if (cancelled) return
        if (accounts && accounts.length > 0) {
          const addr = accounts[0]
          providerRef.current = target.provider
          detach = attachListeners(target.provider)
          if (cancelled) return
          setState({
            address: addr,
            chainId: null,
            chainName: '',
            balanceEth: null,
            isConnected: true,
            isConnecting: false,
            isAvailable: true,
            error: null,
            walletInfo: target.info,
          })
          try { localStorage.setItem(STORAGE_KEY, addr) } catch { /* ignore */ }
          void hydrateChainAndBalance(target.provider, addr).then(({ chainId, balanceEth }) => {
            if (cancelled) return
            setState((s) => s.address === addr ? { ...s, chainId, chainName: chainNameFor(chainId), balanceEth } : s)
          })
        }
      } catch {
        /* leave disconnected */
      }
    })()

    return () => {
      cancelled = true
      detach?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connectTo = useCallback(async (uuid: string) => {
    if (uuid === WALLETCONNECT_INFO.uuid) {
      await connectWalletConnectInternal()
      return
    }

    const target = discovered.find((d) => d.info.uuid === uuid)
    const refreshed = target ? discovered : await discoverWallets()
    setDiscovered(refreshed)
    const resolvedTarget = refreshed.find((d) => d.info.uuid === uuid) ?? target
    if (!resolvedTarget) {
      setState((s) => ({ ...s, error: 'Wallet not detected. Make sure the extension is installed and unlocked.' }))
      return
    }
    setState((s) => ({ ...s, isConnecting: true, error: null }))
    try {
      const accounts = await resolvedTarget.provider.request<string[]>({ method: 'eth_requestAccounts' })
      if (accounts && accounts.length > 0) {
        const addr = accounts[0]
        const provider = resolvedTarget.provider
        providerRef.current = provider
        attachListeners(provider)
        setState({
          address: addr,
          chainId: null,
          chainName: '',
          balanceEth: null,
          isConnected: true,
          isConnecting: false,
          isAvailable: true,
          error: null,
          walletInfo: resolvedTarget.info,
        })
        try {
          localStorage.setItem(STORAGE_KEY, addr)
          localStorage.setItem(WALLET_RDNS_STORAGE, resolvedTarget.info.rdns)
        } catch { /* ignore */ }
        setPickerOpen(false)
        void (async () => {
          const { chainId, balanceEth } = await hydrateChainAndBalance(provider, addr)
          setState((s) => s.address === addr ? { ...s, chainId, chainName: chainNameFor(chainId), balanceEth } : s)
          const linkTimeout = setTimeout(() => {
            console.warn('[persistLink] request exceeded 10s, abandoning')
          }, 10000)
          persistLinkToBackend(addr, chainId, resolvedTarget.info.name).finally(() => clearTimeout(linkTimeout))
        })()
      } else {
        setState((s) => ({ ...s, isConnecting: false, error: 'No account selected' }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection rejected'
      setState((s) => ({ ...s, isConnecting: false, error: msg }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachListeners])

  const connectWalletConnectInternal = useCallback(async () => {
    if (!isWalletConnectConfigured()) {
      setState((s) => ({
        ...s,
        error: 'WalletConnect is not configured. Set VITE_WC_PROJECT_ID in app/.env.',
      }))
      return
    }
    setState((s) => ({ ...s, isConnecting: true, error: null }))
    try {
      const wc = await getWalletConnectProvider()
      if (!wc) {
        setState((s) => ({ ...s, isConnecting: false, error: 'WalletConnect failed to initialize' }))
        return
      }
      type WcEnable = { enable: () => Promise<string[]> }
      const enablePromise = (wc as unknown as WcEnable).enable()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection request timed out after 3 minutes. Please try again.')), 180000)
      )
      const accounts = await Promise.race([enablePromise, timeoutPromise])
      if (accounts && accounts.length > 0) {
        const addr = accounts[0]
        providerRef.current = wc
        attachListeners(wc)
        setState({
          address: addr,
          chainId: null,
          chainName: '',
          balanceEth: null,
          isConnected: true,
          isConnecting: false,
          isAvailable: true,
          error: null,
          walletInfo: WALLETCONNECT_INFO,
        })
        try {
          localStorage.setItem(STORAGE_KEY, addr)
          localStorage.setItem(WALLET_RDNS_STORAGE, WALLETCONNECT_INFO.rdns)
        } catch { /* ignore */ }
        setPickerOpen(false)
        void (async () => {
          const { chainId, balanceEth } = await hydrateChainAndBalance(wc, addr)
          setState((s) => s.address === addr ? { ...s, chainId, chainName: chainNameFor(chainId), balanceEth } : s)
          const linkTimeout = setTimeout(() => {
            console.warn('[persistLink] request exceeded 10s, abandoning')
          }, 10000)
          persistLinkToBackend(addr, chainId, 'WalletConnect').finally(() => clearTimeout(linkTimeout))
        })()
      } else {
        setState((s) => ({ ...s, isConnecting: false, error: 'No account approved' }))
      }
    } catch (err) {
      console.error('[WalletConnect] connect failed', err)
      const raw = err instanceof Error ? err.message : String(err ?? '')
      let msg = raw || 'Connection rejected'
      const expired = /Proposal expired|expired|timeout/i.test(raw)
      if (/projectId|project id|unauthorized|not authorized|origin/i.test(raw)) {
        msg = 'WalletConnect rejected this domain. The project allowlist on cloud.reown.com needs to include this site\u2019s URL.'
      } else if (expired) {
        msg = 'The connection request timed out. Tap WalletConnect again to get a fresh request and choose your wallet.'
      } else if (/User rejected|user closed|user denied/i.test(raw)) {
        msg = 'You closed the wallet without approving. Tap WalletConnect again to retry.'
      } else if (!raw) {
        msg = 'WalletConnect didn\u2019t respond. Check your network connection and try again.'
      }
      if (expired) resetWalletConnect()
      setState((s) => ({ ...s, isConnecting: false, error: msg }))
    }
  }, [attachListeners])

  const connect = useCallback(async () => {
    const list = await discoverWallets()
    setDiscovered(list)
    if (list.length === 0) {
      setState((s) => ({ ...s, error: 'No Web3 wallet detected. Choose one to install.', isAvailable: false }))
      setPickerOpen(true)
      return
    }
    if (list.length === 1) {
      await connectTo(list[0].info.uuid)
      return
    }
    setPickerOpen(true)
  }, [connectTo])

  const refreshDiscovered = useCallback(async () => {
    const list = await discoverWallets()
    setDiscovered(list)
    setState((s) => ({ ...s, isAvailable: list.length > 0 }))
    return list
  }, [])

  const disconnect = useCallback(() => {
    const p = providerRef.current as (EthereumProvider & { disconnect?: () => Promise<void> }) | null
    if (p && typeof p.disconnect === 'function') {
      try { void p.disconnect() } catch { /* ignore */ }
    }
    resetWalletConnect()
    setState((s) => ({ ...s, address: null, isConnected: false, balanceEth: null, error: null, walletInfo: null }))
    providerRef.current = null
    try {
      localStorage.removeItem(STORAGE_KEY)
      localStorage.removeItem(WALLET_RDNS_STORAGE)
    } catch { /* ignore */ }
    void clearLinkOnBackend()
  }, [])

  const refreshBalance = useCallback(async () => {
    const provider = providerRef.current
    if (!provider || !state.address) return
    const bal = await fetchBalance(provider, state.address)
    setState((s) => ({ ...s, balanceEth: bal }))
  }, [state.address])

  useEffect(() => {
    if (!state.isConnected || !state.address) return

    void refreshBalance()
    const interval = window.setInterval(() => {
      void refreshBalance()
    }, 2000)

    return () => window.clearInterval(interval)
  }, [state.isConnected, state.address, refreshBalance])

  const sendTransaction = useCallback(async (params: { to?: string; valueEth: number | string }): Promise<string> => {
    const provider = providerRef.current
    if (!provider) throw new Error('No Web3 wallet connected')
    if (!state.address) throw new Error('Wallet not connected')
    const value = typeof params.valueEth === 'string' ? Number(params.valueEth) : params.valueEth
    if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid amount')
    const to = (params.to ?? state.address).toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(to)) throw new Error('Invalid recipient address')
    const wei = BigInt(Math.floor(value * 1e18))
    const hexValue = '0x' + wei.toString(16)
    const txHash = await provider.request<string>({
      method: 'eth_sendTransaction',
      params: [{ from: state.address, to, value: hexValue }],
    })
    if (typeof txHash !== 'string') throw new Error('Transaction failed')
    setTimeout(() => { void refreshBalance() }, 2500)
    return txHash
  }, [state.address, refreshBalance])

  const shortAddress = state.address ? `${state.address.slice(0, 6)}\u2026${state.address.slice(-4)}` : null

  return {
    ...state,
    shortAddress,
    discovered,
    pickerOpen,
    setPickerOpen,
    connect,
    connectTo,
    refreshDiscovered,
    disconnect,
    sendTransaction,
    refreshBalance,
  }
}
