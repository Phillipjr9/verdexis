import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPendingVerificationPayload } from './authVerification.js'

test('buildPendingVerificationPayload returns signup-specific messaging', () => {
  const payload = buildPendingVerificationPayload({
    kind: 'signup',
    pendingToken: 'pending-token-123',
    email: 'user@example.com',
  })

  assert.equal(payload.otpRequired, true)
  assert.equal(payload.pendingToken, 'pending-token-123')
  assert.equal(payload.verificationType, 'signup')
  assert.match(payload.message, /email/i)
  assert.match(payload.message, /verify/i)
})
