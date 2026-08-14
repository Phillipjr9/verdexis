import test from 'node:test'
import assert from 'node:assert/strict'
import { buildDeletionArchivePayload, isDeletedUserDecision } from './accountDeletion.js'

const sampleUser = {
  id: 'user_123',
  email: 'alice@example.com',
  name: 'Alice Example',
  username: 'alice',
  role: 'user',
  suspended: false,
  kycStatus: 'approved',
  walletAddress: '0xabc123',
  phoneVerified: true,
  prefs: JSON.stringify({ phone: '+1 555 123 4567' }),
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-05-01T00:00:00.000Z'),
}

test('buildDeletionArchivePayload keeps a full user snapshot for admin review', () => {
  const archive = buildDeletionArchivePayload(sampleUser as any)

  assert.equal(archive.status, 'user_requested_deletion')
  assert.equal(archive.snapshot.email, 'alice@example.com')
  assert.equal(archive.snapshot.name, 'Alice Example')
  assert.equal(archive.snapshot.username, 'alice')
  assert.equal(archive.snapshot.role, 'user')
  assert.equal(archive.snapshot.prefs.phone, '+1 555 123 4567')
})

test('isDeletedUserDecision distinguishes active from soft-deleted accounts', () => {
  assert.equal(isDeletedUserDecision({ deletedAt: null } as any), false)
  assert.equal(isDeletedUserDecision({ deletedAt: new Date() } as any), true)
})
