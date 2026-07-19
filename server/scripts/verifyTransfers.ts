import {
  buildWithdrawalTransferPlan,
  buildTemporaryFundingTransferResult,
  detectWalletAddressType,
  resolveWithdrawalChain,
} from '../src/services/cryptoWithdrawal.js'

const cases = [
  { asset: 'ETH', addr: '0x1234567890123456789012345678901234567890' },
  { asset: 'USDT', addr: '0x1234567890123456789012345678901234567890' },
  { asset: 'USDT', addr: 'So11111111111111111111111111111111111111112' },
  { asset: 'SOL', addr: 'So11111111111111111111111111111111111111112' },
  { asset: 'BTC', addr: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4' },
]

console.log('Running external-transfer verification for sample addresses...')

for (const c of cases) {
  const detected = detectWalletAddressType(c.addr)
  const resolved = resolveWithdrawalChain({ asset: c.asset, destinationAddress: c.addr })
  const plan = buildWithdrawalTransferPlan({ asset: c.asset, amount: 1.2345, destinationAddress: c.addr })
  const tempFund = buildTemporaryFundingTransferResult({ asset: c.asset, amount: 1.2345, destinationAddress: c.addr, chain: resolved.chain })

  console.log('---')
  console.log(`Asset: ${c.asset}`)
  console.log(`Address: ${c.addr}`)
  console.log(`Detected type: ${detected}`)
  console.log('Resolved chain:', resolved)
  console.log('Transfer plan:', plan)
  console.log('Temporary funding result:', tempFund)
}
