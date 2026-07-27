import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { createLocalUser, findLocalUserByEmailOrUsername, getLocalUserById } from './localAuthStore.js'

test('creates and retrieves a local user for fallback auth', async () => {
  const user = await createLocalUser({
    email: 'demo@example.com',
    password: 'Password123!',
    name: 'Demo User',
    role: 'user',
    phone: '+1 555 0100',
  })

  assert.ok(user.id)
  assert.equal(user.email, 'demo@example.com')
  assert.equal(user.name, 'Demo User')
  const verified = await bcrypt.compare('Password123!', user.passwordHash)
  assert.equal(verified, true)

  const found = await findLocalUserByEmailOrUsername('demo@example.com')
  assert.ok(found)
  assert.equal(found?.id, user.id)

  const fetched = await getLocalUserById(user.id)
  assert.ok(fetched)
  assert.equal(fetched?.email, 'demo@example.com')
})
