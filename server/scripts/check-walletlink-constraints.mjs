import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function run() {
  try {
    const res = await prisma.$queryRawUnsafe(`
      SELECT tc.constraint_name, tc.constraint_type, kcu.column_name
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'walletlink' OR tc.table_name = 'wallet_link' OR tc.table_name = 'WalletLink'
      ORDER BY tc.constraint_name, kcu.ordinal_position;
    `)
    console.log(JSON.stringify(res, null, 2))
  } catch (e) {
    console.error('Error', e)
  } finally {
    await prisma.$disconnect()
  }
}
run()
