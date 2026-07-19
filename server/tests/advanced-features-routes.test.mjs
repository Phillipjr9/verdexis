import test from 'node:test'
import assert from 'node:assert/strict'
import analyticsRoutes from '../src/routes/advanced-analytics.ts'
import taxRoutes from '../src/routes/advanced-tax.ts'
import complianceRoutes from '../src/routes/advanced-compliance.ts'
import notificationsRoutes from '../src/routes/advanced-notifications.ts'

function getRoutePaths(router) {
  return [...new Set((router.stack || [])
    .filter((layer) => layer.route)
    .map((layer) => layer.route.path)
    .sort())]
}

test('advanced feature routers expose their own route paths', () => {
  assert.deepEqual(getRoutePaths(analyticsRoutes), ['/attribution', '/full', '/performance', '/recommendations', '/risk'])
  assert.deepEqual(getRoutePaths(taxRoutes), ['/form8949/:year', '/harvest', '/opportunities', '/recommendations', '/report/:year'])
  assert.deepEqual(getRoutePaths(complianceRoutes), ['/risk-profile', '/screen-transaction'])
  assert.deepEqual(getRoutePaths(notificationsRoutes), ['/mark-all-read', '/mark-read/:id', '/preferences'])
})
