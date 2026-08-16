import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFallbackMarketList } from './market.js'

test('buildFallbackMarketList returns usable fallback market data', async () => {
  const list = await buildFallbackMarketList()

  assert.ok(Array.isArray(list), 'fallback should return an array')
  assert.ok(list.length > 0, 'fallback should include at least one coin')
  assert.ok(list.some((coin) => coin.id === 'bitcoin'), 'fallback should include bitcoin')
  assert.ok(list.every((coin) => typeof coin.current_price === 'number'), 'each fallback coin should include a numeric price')
})
