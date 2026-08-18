import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()

// Simplehash API for fetching NFTs
const SIMPLEHASH_API_KEY = process.env.SIMPLEHASH_API_KEY
const SIMPLEHASH_BASE_URL = 'https://api.simplehash.com/api/v0'

interface NFTData {
  id: string
  name: string
  collection: string
  category: 'Art' | 'Gaming' | 'PFP' | 'Utility'
  image: string
  floorPrice: number
  floorChange24h: number
  purchasePrice: number
  quantity: number
  chain: string
  openseaUrl: string
}

// Demo data fallback
const DEMO_NFTS: NFTData[] = [
  { id: '1', name: 'Bored Ape #4821', collection: 'Bored Ape Yacht Club', category: 'PFP', image: '🐵', floorPrice: 38.2, floorChange24h: 2.4, purchasePrice: 65.0, quantity: 1, chain: 'ETH', openseaUrl: 'https://opensea.io/collection/boredapeyachtclub' },
  { id: '2', name: 'Pudgy #1102', collection: 'Pudgy Penguins', category: 'PFP', image: '🐧', floorPrice: 11.5, floorChange24h: -1.8, purchasePrice: 8.2, quantity: 1, chain: 'ETH', openseaUrl: 'https://opensea.io/collection/pudgypenguins' },
]

// Get user's NFT holdings
router.get('/:walletAddress', requireAuth, async (req: AuthedRequest, res) => {
  const { walletAddress } = req.params
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    let nfts: NFTData[] = []

    // Try Simplehash API if configured
    if (SIMPLEHASH_API_KEY) {
      try {
        const response = await fetch(
          `${SIMPLEHASH_BASE_URL}/nfts/owners?chains=ethereum,polygon&wallet_addresses=${walletAddress}&limit=50`,
          {
            headers: {
              'X-API-KEY': SIMPLEHASH_API_KEY,
              'Accept': 'application/json',
            },
          }
        )

        if (response.ok) {
          const data = await response.json()
          nfts = (data.nfts || []).map((nft: any) => ({
            id: nft.nft_id,
            name: nft.name || 'Unnamed NFT',
            collection: nft.collection?.name || 'Unknown Collection',
            category: categorizeNFT(nft),
            image: nft.image_properties?.thumb_url || '🖼️',
            floorPrice: nft.collection?.floor_prices?.[0]?.value || 0,
            floorChange24h: nft.collection?.floor_prices_7d_ago ? 
              ((nft.collection?.floor_prices?.[0]?.value - nft.collection?.floor_prices_7d_ago?.[0]?.value) / nft.collection?.floor_prices_7d_ago?.[0]?.value) * 100 
              : 0,
            purchasePrice: 0, // TODO: Fetch from user's transaction history
            quantity: 1,
            chain: nft.blockchain || 'ETH',
            openseaUrl: `https://opensea.io/assets/${nft.blockchain}/${nft.contract_address}/${nft.token_id}`,
          }))
        }
      } catch (simplehashError) {
        console.warn('[nft] Simplehash API error, falling back to demo:', simplehashError)
        nfts = DEMO_NFTS
      }
    } else {
      console.log('[nft] SIMPLEHASH_API_KEY not configured, using demo data')
      nfts = DEMO_NFTS
    }

    const totalValue = nfts.reduce((sum, nft) => sum + nft.floorPrice * nft.quantity, 0)
    const totalCost = nfts.reduce((sum, nft) => sum + nft.purchasePrice * nft.quantity, 0)

    res.json({
      nfts,
      totalValue,
      totalCost,
      totalPnL: totalValue - totalCost,
      count: nfts.length,
      walletAddress,
      lastUpdated: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[nft] NFT fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch NFTs', details: error instanceof Error ? error.message : 'Unknown error' })
  }
})

// Get floor price and stats for a collection
router.get('/floor/:collectionSlug', async (req, res) => {
  const { collectionSlug } = req.params

  try {
    if (!SIMPLEHASH_API_KEY) {
      return res.json({
        collection: collectionSlug,
        floorPrice: 0,
        volume24h: 0,
        change24h: 0,
        source: 'demo',
      })
    }

    const response = await fetch(
      `${SIMPLEHASH_BASE_URL}/collections/ethereum/${collectionSlug}`,
      {
        headers: {
          'X-API-KEY': SIMPLEHASH_API_KEY,
          'Accept': 'application/json',
        },
      }
    )

    if (response.ok) {
      const data = await response.json()
      return res.json({
        collection: collectionSlug,
        floorPrice: data.floor_prices?.[0]?.value || 0,
        floorCurrency: data.floor_prices?.[0]?.payment_token?.symbol || 'ETH',
        volume24h: data.volume_stats?.one_day?.volume || 0,
        change24h: data.volume_stats?.one_day?.change || 0,
        owners: data.unique_owners,
        items: data.total_supply,
        source: 'simplehash',
      })
    }

    res.status(404).json({ error: 'Collection not found' })
  } catch (error) {
    console.error('[nft] Floor price fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch collection data' })
  }
})

// Helper to categorize NFT based on collection name/metadata
function categorizeNFT(nft: any): 'Art' | 'Gaming' | 'PFP' | 'Utility' {
  const name = (nft.collection?.name || nft.name || '').toLowerCase()
  
  if (name.includes('gaming') || name.includes('axie') || name.includes('game')) return 'Gaming'
  if (name.includes('art') || name.includes('pak') || name.includes('art')) return 'Art'
  if (name.includes('pfp') || name.includes('ape') || name.includes('pudgy') || name.includes('doodle')) return 'PFP'
  if (name.includes('utility') || name.includes('ens') || name.includes('domain')) return 'Utility'
  
  return 'PFP' // Default to PFP
}

export default router
