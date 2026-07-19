process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:memory?mode=memory&cache=shared'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testjwtsecret000000'

import test from 'node:test'
import assert from 'node:assert/strict'
import { registerComplianceAdminRoutes } from '../src/compliance/adminRoutes.ts'

class MockApp {
  constructor() {
    this.routes = new Map()
  }
  routes
  get(path, handler) {
    this.routes.set(path, handler)
  }
  post(path, handler) {
    this.routes.set(path, handler)
  }
}

test('admin compliance routes register expected endpoints', () => {
  const app = new MockApp()
  registerComplianceAdminRoutes(app)
  assert.ok(app.routes.has('/api/admin/compliance/findings'))
  assert.ok(app.routes.has('/api/admin/compliance/findings/:txId'))
  assert.ok(app.routes.has('/api/admin/compliance/findings/:txId/action'))
})
