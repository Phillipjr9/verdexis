import { prisma } from '../dist/db.js'
import { recordLedgerTransaction } from '../dist/services/ledger.js'

async function main() {
  const superAdminEmail = process.env.ADMIN_EMAIL || 'admin@verdexisgroup.com'
  const admin = await prisma.user.findUnique({ where: { email: superAdminEmail }, select: { id: true, email: true } })
  if (!admin) {
    console.error('Super admin not found:', superAdminEmail)
    process.exit(1)
  }
  console.log('Super admin id:', admin.id)

  const balances = await prisma.walletBalance.findMany({ where: { userId: admin.id } })
  console.log('Wallet balances for super admin:')
  for (const b of balances) console.log(` - ${b.currency}: balance=${b.balance} available=${b.available}`)

  // Perform a small test transfer from admin to a test user (create a test user if missing)
  let testUser = await prisma.user.findFirst({ where: { email: { startsWith: 'test-user+' } }, select: { id: true, email: true } })
  if (!testUser) {
    const now = Date.now()
    const email = `test-user+${now}@example.com`
    const user = await prisma.user.create({ data: { email, name: 'Test User', passwordHash: 'x', role: 'user', walletBalances: { create: [{ currency: 'USD', symbol: '$', balance: 0, available: 0 }] } } })
    testUser = { id: user.id, email: user.email }
    console.log('Created test user', testUser.email)
  }

  // Seed a small amount to admin (if admin has insufficient USD for the test)
  const adminUsd = await prisma.walletBalance.findUnique({ where: { userId_currency: { userId: admin.id, currency: 'USD' } } })
  if (!adminUsd || adminUsd.available < 10) {
    console.log('Seeding admin with $100 via ledger for test')
    await prisma.$transaction(async (tx) => {
      await recordLedgerTransaction({ tx, userId: admin.id, asset: 'USD', amount: 100, entryType: 'debit', kind: 'deposit', eventType: 'test_seed', sourceType: 'script_test', sourceId: `script_test:${Date.now()}`, externalRef: `script_test:${Date.now()}`, idempotencyKey: `script_test:${Date.now()}`, description: 'Test seed', reference: 'Test seed', subType: 'test_seed', recordTransaction: false, createdBy: 'script' })
    })
  }

  console.log('Attempting a $5 transfer from admin → test user via ledger')
  // Perform two sequential ledger calls (non-transactional) for this quick check
  const outRes = await recordLedgerTransaction({ tx: prisma, userId: admin.id, asset: 'USD', amount: 5, entryType: 'credit', kind: 'transfer', eventType: 'admin_test_transfer', sourceType: 'admin_test_transfer', sourceId: `admin_test:${admin.id}:${testUser.id}:${Date.now()}`, externalRef: `admin_test:${admin.id}:${testUser.id}:${Date.now()}`, idempotencyKey: `admin_test:${admin.id}:${testUser.id}:${Date.now()}`, description: 'Admin test transfer out', reference: 'Admin test transfer', subType: 'transfer', recordTransaction: false, createdBy: admin.id })
  const incomingRes = await recordLedgerTransaction({ tx: prisma, userId: testUser.id, asset: 'USD', amount: 5, entryType: 'debit', kind: 'deposit', eventType: 'admin_test_transfer', sourceType: 'admin_test_transfer', sourceId: `admin_test:${admin.id}:${testUser.id}:in:${Date.now()}`, externalRef: `admin_test:${admin.id}:${testUser.id}:in:${Date.now()}`, idempotencyKey: `admin_test:${admin.id}:${testUser.id}:in:${Date.now()}`, description: 'Admin test transfer in', reference: 'Admin test transfer', subType: 'transfer', recordTransaction: false, createdBy: admin.id })

  // Fetch current wallet balances from DB to avoid relying on ledger return shape
  const adminBalance = await prisma.walletBalance.findUnique({ where: { userId_currency: { userId: admin.id, currency: 'USD' } } })
  const testBalance = await prisma.walletBalance.findUnique({ where: { userId_currency: { userId: testUser.id, currency: 'USD' } } })

  console.log('Transfer result:')
  console.log(' - admin USD after:', adminBalance ? adminBalance.balance : 'N/A', 'available:', adminBalance ? adminBalance.available : 'N/A')
  console.log(' - test user USD after:', testBalance ? testBalance.balance : 'N/A', 'available:', testBalance ? testBalance.available : 'N/A')

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
