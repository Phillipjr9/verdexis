// Reown AppKit — official wallet modal (QR + injected + mobile).
import type { EthereumProvider as Eip1193Provider } from '../types/ethereum'
import './walletconnect-modal.css'

export const WC_PROJECT_ID =
  (import.meta.env.VITE_WC_PROJECT_ID as string | undefined) ||
  '242e95d2634817c56a6742ee75e92acb'

export function isWalletConnectConfigured(): boolean {
  return WC_PROJECT_ID.length > 0
}

type AppKitModal = {
  open: (opts?: { view?: string }) => Promise<void>
  close?: () => void
  disconnect?: () => Promise<void>
  getAddress?: () => string | undefined
  getWalletProvider?: () => unknown
  getIsConnectedState?: () => boolean
  subscribeAccount: (cb: (account: { address?: string; isConnected?: boolean }) => void) => () => void
  subscribeState?: (cb: (state: { open?: boolean }) => void) => () => void
}

let modal: AppKitModal | null = null
let initPromise: Promise<AppKitModal> | null = null

async function ensureAppKit(): Promise<AppKitModal> {
  if (modal) return modal
  if (initPromise) return initPromise
  initPromise = (async () => {
    const [{ createAppKit }, { EthersAdapter }, networks] = await Promise.all([
      import('@reown/appkit'),
      import('@reown/appkit-adapter-ethers'),
      import('@reown/appkit/networks'),
    ])
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.verdexisgroup.com'
    const instance = createAppKit({
      adapters: [new EthersAdapter()],
      networks: [
        networks.mainnet,
        networks.polygon,
        networks.arbitrum,
        networks.optimism,
        networks.base,
        networks.bsc,
        networks.avalanche,
        networks.sepolia,
      ],
      projectId: WC_PROJECT_ID,
      metadata: {
        name: 'Verdexis',
        description: 'Verdexis — connect your wallet',
        url: origin,
        icons: [`${origin}/assets/logo-icon-transparent.png`],
      },
      themeMode: 'dark',
      featuredWalletIds: [
        'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
        '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
        'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa',
        '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
      ],
      features: {
        analytics: false,
        email: false,
        socials: false,
        onramp: false,
      },
    }) as unknown as AppKitModal
    modal = instance
    return instance
  })()
  try {
    return await initPromise
  } catch (err) {
    initPromise = null
    modal = null
    throw err
  }
}

export async function getWalletConnectProvider(): Promise<Eip1193Provider | null> {
  if (!isWalletConnectConfigured()) return null
  const kit = await ensureAppKit()
  return (kit.getWalletProvider?.() as Eip1193Provider) || null
}

export async function connectWithAppKit(): Promise<{ address: string; provider: Eip1193Provider }> {
  if (!isWalletConnectConfigured()) {
    throw new Error('WalletConnect is not configured. Set VITE_WC_PROJECT_ID.')
  }
  const kit = await ensureAppKit()
  const existing = kit.getAddress?.()
  const existingProvider = kit.getWalletProvider?.() as Eip1193Provider | undefined
  if (existing && existingProvider && kit.getIsConnectedState?.()) {
    return { address: existing, provider: existingProvider }
  }

  await kit.open({ view: 'Connect' })

  return await new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { unsubAcc() } catch { /* ignore */ }
      try { unsubState?.() } catch { /* ignore */ }
      fn()
    }

    const unsubAcc = kit.subscribeAccount((account) => {
      if (!account?.isConnected || !account.address) return
      const provider = kit.getWalletProvider?.() as Eip1193Provider | undefined
      if (!provider) return
      finish(() => resolve({ address: account.address as string, provider }))
    })

    const unsubState = kit.subscribeState?.((state) => {
      if (state.open === false && !kit.getIsConnectedState?.() && !kit.getAddress?.()) {
        finish(() => reject(new Error('You closed the wallet without approving. Tap WalletConnect again to retry.')))
      }
    })

    const timer = setTimeout(() => {
      finish(() => reject(new Error('The connection request timed out. Tap WalletConnect again to get a fresh request.')))
    }, 180_000)
  })
}

export function resetWalletConnect(): void {
  try { void modal?.disconnect?.() } catch { /* ignore */ }
}

export interface WcMobileWallet {
  id: string
  name: string
  native: string
  universal: string
  logo: string
}

export const WC_MOBILE_WALLETS: WcMobileWallet[] = [
  {
    id: 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
    name: 'MetaMask',
    native: 'metamask://',
    universal: 'https://metamask.app.link',
    logo: 'https://explorer-api.walletconnect.com/v3/logo/md/eebe4a7f-7166-402f-92e0-1f64ca2aa800?projectId=' + WC_PROJECT_ID,
  },
  {
    id: '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
    name: 'Trust Wallet',
    native: 'trust://',
    universal: 'https://link.trustwallet.com',
    logo: 'https://explorer-api.walletconnect.com/v3/logo/md/7677b54f-3486-46e2-4e37-bf8747814f00?projectId=' + WC_PROJECT_ID,
  },
  {
    id: '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
    name: 'Rainbow',
    native: 'rainbow://',
    universal: 'https://rnbwapp.com',
    logo: 'https://explorer-api.walletconnect.com/v3/logo/md/7a33d7f1-3d12-4b5c-f3ee-5cd83cb1b500?projectId=' + WC_PROJECT_ID,
  },
]

export function buildWalletDeepLink(wallet: WcMobileWallet, wcUri: string): { native: string; universal: string } {
  const encoded = encodeURIComponent(wcUri)
  return {
    native: `${wallet.native}wc?uri=${encoded}`,
    universal: `${wallet.universal}/wc?uri=${encoded}`,
  }
}
