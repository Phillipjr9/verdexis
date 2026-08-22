import test from 'node:test'
import assert from 'node:assert/strict'
import {
  mapBalances,
  clampTransactionLimit,
  normalizeEmail,
  evaluateTransferGate,
  buildTransferKeyBase,
  parseWithdrawalFeeRate,
  transferBodySchema,
} from './walletHelpers.js'

test('mapBalances maps USD with $ symbol and locked amount', () => {
  const rows = mapBalances([
    { currency: 'USD', balance: '100.50', available: '80.25' },
    { currency: 'BTC', balance: 1.5, available: 1.5 },
  ])
  assert.equal(rows.length, 2)
  assert.deepEqual(rows[0], {
    currency: 'USD',
    symbol: '$',
    balance: 100.5,
    available: 80.25,
    locked: 20.25,
  })
  assert.equal(rows[1].symbol, 'BTC')
  assert.equal(rows[1].locked, 0)
})

test('clampTransactionLimit clamps and falls back', () => {
  assert.equal(clampTransactionLimit(undefined), 50)
  assert.equal(clampTransactionLimit(''), 50)
  assert.equal(clampTransactionLimit(-1), 50)
  assert.equal(clampTransactionLimit(0), 50)
  assert.equal(clampTransactionLimit(1), 1)
  assert.equal(clampTransactionLimit(25), 25)
  assert.equal(clampTransactionLimit(100), 100)
  assert.equal(clampTransactionLimit(999), 100)
  assert.equal(clampTransactionLimit('10'), 10)
  assert.equal(clampTransactionLimit(10.9), 10)
})

test('normalizeEmail trims and lowercases', () => {
  assert.equal(normalizeEmail('  Admin@Verdexis.com '), 'admin@verdexis.com')
  assert.equal(normalizeEmail(''), '')
  assert.equal(normalizeEmail(null), '')
})

test('transferBodySchema validates transfer payload', () => {
  const ok = transferBodySchema.safeParse({
    recipientEmail: 'user@example.com',
    currency: 'USD',
    amount: 10.5,
    note: 'test',
  })
  assert.equal(ok.success, true)

  const badEmail = transferBodySchema.safeParse({
    recipientEmail: 'not-an-email',
    currency: 'USD',
    amount: 10,
  })
  assert.equal(badEmail.success, false)

  const badAmount = transferBodySchema.safeParse({
    recipientEmail: 'user@example.com',
    currency: 'USD',
    amount: 0,
  })
  assert.equal(badAmount.success, false)

  const negative = transferBodySchema.safeParse({
    recipientEmail: 'user@example.com',
    currency: 'USD',
    amount: -5,
  })
  assert.equal(negative.success, false)
})

test('evaluateTransferGate blocks missing recipient', () => {
  const r = evaluateTransferGate({
    senderId: 'a',
    sender: { suspended: false },
    recipient: null,
    amount: 10,
    available: 100,
  })
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.status, 404)
    assert.match(r.error, /not found/i)
  }
})

test('evaluateTransferGate blocks self-transfer', () => {
  const r = evaluateTransferGate({
    senderId: 'a',
    sender: { suspended: false },
    recipient: { id: 'a', email: 'a@x.com' },
    amount: 10,
    available: 100,
  })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.status, 400)
})

test('evaluateTransferGate blocks suspended recipient', () => {
  const r = evaluateTransferGate({
    senderId: 'a',
    sender: { suspended: false },
    recipient: { id: 'b', suspended: true },
    amount: 10,
    available: 100,
  })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.status, 400)
})

test('evaluateTransferGate blocks suspended or missing sender', () => {
  assert.equal(
    evaluateTransferGate({
      senderId: 'a',
      sender: null,
      recipient: { id: 'b' },
      amount: 10,
      available: 100,
    }).ok,
    false,
  )
  const r = evaluateTransferGate({
    senderId: 'a',
    sender: { suspended: true },
    recipient: { id: 'b' },
    amount: 10,
    available: 100,
  })
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.status, 403)
})

test('evaluateTransferGate blocks hold on all or transfer', () => {
  for (const holdType of ['all', 'transfer']) {
    const r = evaluateTransferGate({
      senderId: 'a',
      sender: { suspended: false, holdActive: true, holdType },
      recipient: { id: 'b' },
      amount: 10,
      available: 100,
    })
    assert.equal(r.ok, false, `holdType=${holdType}`)
    if (!r.ok) assert.equal(r.status, 403)
  }
  const allowed = evaluateTransferGate({
    senderId: 'a',
    sender: { suspended: false, holdActive: true, holdType: 'withdraw' },
    recipient: { id: 'b' },
    amount: 10,
    available: 100,
  })
  assert.equal(allowed.ok, true)
})

test('evaluateTransferGate blocks insufficient balance', () => {
  const r = evaluateTransferGate({
    senderId: 'a',
    sender: { suspended: false },
    recipient: { id: 'b' },
    amount: 50,
    available: 10,
  })
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.status, 400)
    assert.match(r.error, /insufficient/i)
  }
})

test('evaluateTransferGate allows valid transfer', () => {
  const r = evaluateTransferGate({
    senderId: 'a',
    sender: { suspended: false, holdActive: false },
    recipient: { id: 'b', suspended: false },
    amount: 25,
    available: 100,
  })
  assert.equal(r.ok, true)
})

test('buildTransferKeyBase prefers client key', () => {
  const withClient = buildTransferKeyBase({
    clientKey: 'abc-123',
    senderId: 's1',
    recipientId: 'r1',
    currency: 'USD',
    amount: 10,
    uuid: 'uuid-1',
  })
  assert.equal(withClient, 'user_transfer:abc-123')

  const without = buildTransferKeyBase({
    senderId: 's1',
    recipientId: 'r1',
    currency: 'USD',
    amount: 10,
    uuid: 'uuid-1',
  })
  assert.equal(without, 'user_transfer:s1:r1:USD:10:uuid-1')
})

test('parseWithdrawalFeeRate parses settings JSON', () => {
  assert.equal(parseWithdrawalFeeRate(null), 0)
  assert.equal(parseWithdrawalFeeRate(undefined), 0)
  assert.equal(parseWithdrawalFeeRate('not-json'), 0)
  assert.equal(parseWithdrawalFeeRate('{"ratePct":11.8}'), 11.8)
  assert.equal(parseWithdrawalFeeRate('{"ratePct":"5"}'), 5)
})
