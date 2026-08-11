import { Router } from 'express'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()

router.use(requireAuth)
router.use(requireAdmin)

let agentInstance: any | null = null

async function getAgent(): Promise<any> {
  if (!agentInstance) {
    const { TokenRegistryAgent } = await import('../scripts/tokenRegistryAgent.js')
    agentInstance = new TokenRegistryAgent(
      process.env.ANTHROPIC_API_KEY,
      process.env.ETHERSCAN_API_KEY,
      process.env.SOLANA_RPC_ENDPOINT,
      process.env.ETHEREUM_RPC_ENDPOINT,
    )
  }

  return agentInstance
}

router.post('/query', async (req: AuthedRequest, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''

  if (!query) {
    res.status(400).json({ error: 'Missing query' })
    return
  }

  try {
    const agent = await getAgent()
    const rawResult = await agent.runQuery(query)
    let parsedResult: unknown = rawResult

    try {
      parsedResult = JSON.parse(rawResult)
    } catch {
      // Keep the raw string if it is not JSON.
    }

    res.json({
      ok: true,
      actor: req.userEmail ?? null,
      result: parsedResult,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ ok: false, error: message })
  }
})

router.post('/register', async (req: AuthedRequest, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
  const address = typeof req.body?.address === 'string' ? req.body.address.trim() : ''
  const chain = typeof req.body?.chain === 'string' ? req.body.chain : undefined
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined
  const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim() : undefined
  const decimals = typeof req.body?.decimals === 'number' ? req.body.decimals : undefined
  const userId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : req.userId
  const amount = typeof req.body?.amount === 'number'
    ? req.body.amount
    : typeof req.body?.amount === 'string'
      ? Number.parseFloat(req.body.amount)
      : 0
  const avgPrice = typeof req.body?.avgPrice === 'number'
    ? req.body.avgPrice
    : typeof req.body?.avgPrice === 'string'
      ? Number.parseFloat(req.body.avgPrice)
      : 0
  const type = typeof req.body?.type === 'string' ? req.body.type : 'crypto'
  const mode = typeof req.body?.mode === 'string' && (req.body.mode === 'set' || req.body.mode === 'add')
    ? req.body.mode
    : 'add'
  const walletAddress = typeof req.body?.walletAddress === 'string' && req.body.walletAddress.trim()
    ? req.body.walletAddress.trim()
    : typeof req.body?.wallet === 'string' && req.body.wallet.trim()
      ? req.body.wallet.trim()
      : undefined

  if (!query && !address) {
    res.status(400).json({ error: 'Missing query or address' })
    return
  }

  try {
    const agent = await getAgent()
    const rawResult = await agent.registerToken({
      query,
      chain: chain === 'solana' || chain === 'ethereum' ? chain : undefined,
      address,
      name,
      symbol,
      decimals,
      userId,
      amount,
      avgPrice,
      type: type === 'crypto' || type === 'stock' || type === 'etf' ? type : 'crypto',
      mode,
      walletAddress,
    })

    let parsedResult: unknown = rawResult
    try {
      parsedResult = JSON.parse(rawResult)
    } catch {
      // Keep the raw string if it is not JSON.
    }

    res.json({
      ok: true,
      actor: req.userEmail ?? null,
      result: parsedResult,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ ok: false, error: message })
  }
})

router.get('/status', async (_req, res) => {
  try {
    const agent = await getAgent()
    const status = agent.getRegistryStatus()
    res.json({ ok: true, registryStatus: status })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    res.status(500).json({ ok: false, error: message })
  }
})

export default router
