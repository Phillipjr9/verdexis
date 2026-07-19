import test from 'node:test'
import assert from 'node:assert/strict'
import { registerComplianceRoutes } from '../src/compliance/routes.ts'
import { enqueueComplianceCheck } from '../src/compliance/producer.ts'

class MockApp {
  constructor() {
    this.routes = new Map()
  }
  routes
  post(path, handler) {
    this.routes.set(path, handler)
  }
}

test('compliance route registers /api/compliance/tx', () => {
  const app = new MockApp()
  registerComplianceRoutes(app)
  assert.ok(app.routes.has('/api/compliance/tx'))
})

test('enqueueComplianceCheck is callable', async () => {
  // Just ensure the function exists and returns a promise-like object
  const maybe = enqueueComplianceCheck({ txId: 'tx:test', from: 'alice', to: 'bob', amount: 1, currency: 'USD' })
  assert.ok(maybe && typeof maybe.then === 'function')
})
