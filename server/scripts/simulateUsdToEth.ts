import fetch from 'node-fetch'
import {
  buildWithdrawalTransferPlan,
  buildTemporaryFundingTransferResult,
} from '../src/services/cryptoWithdrawal.js'

async function getEthPriceUSD(): Promise<number | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {})
    if (!res.ok) return null
    const j = await res.json()
    return j?.ethereum?.usd ?? null
  } catch (e) {
    return null
  }
}

async function run() {
  const addr = '0x6C1f1C8dfAbb45CCAF2E6Ef3503627222a964e70'
  const usd = 100
  console.log('Fetching ETH price (USD)')
  const price = await getEthPriceUSD()
  if (!price) {
    console.log('Could not fetch live price; using fallback 1800 USD/ETH')
  }
  const ethPrice = price ?? 1800
  const ethAmount = usd / ethPrice

  console.log(`$${usd} USD ≈ ${ethAmount.toFixed(6)} ETH at $${ethPrice}/ETH`)

  const plan = buildWithdrawalTransferPlan({ asset: 'ETH', amount: ethAmount, destinationAddress: addr })
  const temp = buildTemporaryFundingTransferResult({ asset: 'ETH', amount: ethAmount, destinationAddress: addr, chain: 'ethereum' })

  console.log('Transfer plan:')
  console.log(plan)
  console.log('Temporary funding result:')
  console.log(temp)
}

run().catch((e) => { console.error(e); process.exit(1) })
