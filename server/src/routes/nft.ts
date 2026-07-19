import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()

// Get user's NFT holdings
// TODO: Integrate with Simplehash, Reservoir, or OpenSea API
router.get('/:walletAddress', requireAuth, async (req: AuthedRequest, res) => {
  const { walletAddress: _walletAddress } = req.params
  const userId = req.userId

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    // TODO: Fetch NFTs from external API
    // Example: Simplehash API
    // const response = await fetch(`https://api.simplehash.com/api/v0/nfts/owners?chains=ethereum&wallet_addresses=${walletAddress}`, {
    //   headers: { 'X-API-KEY': process.env.SIMPLEHASH_API_KEY }
    // })
    // const data = await response.json()

    // For now, return demo data
    const demoNFTs = [
      {
        id: '1',
        name: 'Demo NFT #1',
        collection: 'Demo Collection',
        category: 'PFP',
        image: '🎨',
        floorPrice: 1.5,
        floorChange24h: 2.3,
        purchasePrice: 1.2,
        quantity: 1,
        chain: 'ETH',
        openseaUrl: 'https://opensea.io',
      },
    ]

    res.json({
      nfts: demoNFTs,
      totalValue: 1.5,
      totalCost: 1.2,
      count: demoNFTs.length,
    })
  } catch (error) {
    console.error('NFT fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch NFTs' })
  }
})

// Get floor price for a collection
router.get('/floor/:collection', async (req, res) => {
  const { collection } = req.params

  try {
    // TODO: Fetch floor price from OpenSea/Blur/Reservoir
    // Example: OpenSea API
    // const response = await fetch(`https://api.opensea.io/api/v1/collection/${collection}/stats`)
    // const data = await response.json()
    // return data.stats.floor_price

    res.json({
      collection,
      floorPrice: 0,
      volume24h: 0,
      change24h: 0,
      source: 'demo',
    })
  } catch (error) {
    console.error('Floor price fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch floor price' })
  }
})

export default router
