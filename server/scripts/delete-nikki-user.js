#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

/**
 * Safe script to delete the test user `nikkibenz6525@gmail.com`.
 * Requires --yes to perform deletion to avoid accidental runs.
 */

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Do not run this script until you provide DB setup.');
    process.exit(2)
  }

  const prisma = new PrismaClient()
  try {
    await prisma.$connect()
    const email = 'nikkibenz6525@gmail.com'
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      console.log(`No user found with email ${email}. Nothing to delete.`)
      return
    }

    if (!process.argv.includes('--yes')) {
      console.log('User found:', { id: user.id, email: user.email })
      console.log('To delete this user run with the --yes flag.')
      return
    }

    // attempt delete; if there are dependent records, cascade or remove manually
    await prisma.user.delete({ where: { email } })
    console.log(`Deleted user ${email} (id=${user.id}).`)
  } catch (err) {
    console.error('Error deleting user:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('delete-nikki-user.js')) {
  main()
}
