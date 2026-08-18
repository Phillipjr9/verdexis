// WalletConnect v2 (Reown) provider — single shared instance, lazy-init.

import type { EthereumProvider as Eip1193Provider } from '../types/ethereum'
import './walletconnect-modal.css'

let cached: Promise<Eip1193Provider | null> | null = null

export const WC_PROJECT_ID =
  (import.meta.env.VITE_WC_PROJECT_ID as string | undefined) ||
  '242e95d2634817c56a6742ee75e92acb'

export function isWalletConnectConfigured(): boolean {
  return WC_PROJECT_ID.length > 0
}

export function getWalletConnectProvider(): Promise<Eip1193Provider | null> {
  if (!isWalletConnectConfigured()) return Promise.resolve(null)
  if (cached) return cached
  cached = (async () => {
    try {
      const initPromise = (async () => {
        const mod = await import('@walletconnect/ethereum-provider')
        const provider = await mod.EthereumProvider.init({
          projectId: WC_PROJECT_ID,
          chains: [1],
          optionalChains: [137, 42161, 10, 8453, 56, 43114, 11155111],
          showQrModal: true,
          qrModalOptions: {
            themeMode: 'dark' as const,
            enableExplorer: true,
            themeVariables: {
              '--wcm-z-index': '2147483000',
              '--wcm-accent-color': '#0C8B44',
              '--wcm-background-color': '#111111',
            },
            explorerRecommendedWalletIds: [
              'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
              '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
              'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa',
              '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
              '971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709',
              '38f5d18bd8522c244bdd70cb4a68e0e718865155811c043f052fb9f1c51de662',
              '8a0ee50d1f22f6651afcae7eb4253e52a3310b90af5daef78a8c4929a9bb99d4',
            ],
            mobileWallets: [
              {
                id: 'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
                name: 'MetaMask',
                links: { native: 'metamask://', universal: 'https://metamask.app.link' },
              },
              {
                id: '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
                name: 'Trust Wallet',
                links: { native: 'trust://', universal: 'https://link.trustwallet.com' },
              },
              {
                id: '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
                name: 'Rainbow',
                links: { native: 'rainbow://', universal: 'https://rnbwapp.com' },
              },
            ],
            walletImages: {
              'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96':
                'https://explorer-api.walletconnect.com/v3/logo/md/eebe4a7f-7166-402f-92e0-1f64ca2aa800?projectId=' +
                WC_PROJECT_ID,
              '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0':
                'https://explorer-api.walletconnect.com/v3/logo/md/7677b54f-3486-46e2-4e37-bf8747814f00?projectId=' +
                WC_PROJECT_ID,
              '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369':
                'https://explorer-api.walletconnect.com/v3/logo/md/7a33d7f1-3d12-4b5c-f3ee-5cd83cb1b500?projectId=' +
                WC_PROJECT_ID,
            },
          },
          metadata: {
            name: 'Verdexis',
            description: 'Verdexis crypto investing — connect your wallet',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://www.verdexisgroup.com',
            icons: [
              (typeof window !== 'undefined' ? window.location.origin : '') + '/assets/logo-icon-transparent.png',
            ],
          },
        })
        return provider as unknown as Eip1193Provider
      })()

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('WalletConnect initialization timeout. Check your network or Reown project allowlist.')), 20000)
      )

      return await Promise.race([initPromise, timeoutPromise])
    } catch (err) {
      console.error('[WalletConnect] init failed', err)
      cached = null
      throw err
    }
  })()
  return cached
}

export function resetWalletConnect(): void {
  cached = null
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
    logo:
      'https://explorer-api.walletconnect.com/v3/logo/md/eebe4a7f-7166-402f-92e0-1f64ca2aa800?projectId=' +
      WC_PROJECT_ID,
  },
  {
    id: '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0',
    name: 'Trust Wallet',
    native: 'trust://',
    universal: 'https://link.trustwallet.com',
    logo:
      'https://explorer-api.walletconnect.com/v3/logo/md/7677b54f-3486-46e2-4e37-bf8747814f00?projectId=' +
      WC_PROJECT_ID,
  },
  {
    id: '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
    name: 'Rainbow',
    native: 'rainbow://',
    universal: 'https://rnbwapp.com',
    logo:
      'https://explorer-api.walletconnect.com/v3/logo/md/7a33d7f1-3d12-4b5c-f3ee-5cd83cb1b500?projectId=' +
      WC_PROJECT_ID,
  },
]

export function buildWalletDeepLink(wallet: WcMobileWallet, wcUri: string): { native: string; universal: string } {
  const encoded = encodeURIComponent(wcUri)
  return {
    native: `${wallet.native}wc?uri=${encoded}`,
    universal: `${wallet.universal}/wc?uri=${encoded}`,
  }
}
