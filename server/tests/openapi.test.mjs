import test from 'node:test'
import assert from 'node:assert/strict'
import { getOpenApiDocument, registerOpenApiDocs } from '../src/openapiDocs.ts'

class MockApp {
  constructor() {
    this.routes = new Map()
  }

  routes

  get(path, handler) {
    this.routes.set(path, handler)
  }
}

test('openapi doc exposes expected metadata', () => {
  const doc = getOpenApiDocument()
  assert.equal(doc.openapi, '3.1.0')
  assert.equal(doc.info.title, 'Verdexis API')
  assert.ok(doc.paths['/health'])
  assert.ok(doc.paths['/docs/openapi.json'])
})

test('openapi docs registration wires the expected routes', () => {
  const app = new MockApp()
  registerOpenApiDocs(app)

  assert.ok(app.routes.has('/api/docs'))
  assert.ok(app.routes.has('/api/docs/openapi.json'))
  assert.ok(app.routes.has('/api/docs/swagger'))
})
