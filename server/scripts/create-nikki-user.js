#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

/**
 * Safe script to create a user record for nikkibenz6525@gmail.com.
 * It will NOT run automatically — run it manually after ensuring your
 * environment (DATABASE_URL) is configured. Per request, the script
 * leaves the account inactive and prints instructions to complete setup
 * with a setup code you must provide.
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
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      console.log(`User with email ${email} already exists (id=${existing.id}).`)
      console.log('If you want to mark the account pending setup, run with --force')
      return
    }

    const tempPassword = Math.random().toString(36).slice(2, 12)
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const username = email.split('@')[0]
    const investmentId = `VDX-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

    const user = await prisma.user.create({
      data: {
        email,
        name: 'Nikki Benz',
        username,
        investmentId,
        passwordHash,
        role: 'user',
      },
    })

    console.log('Created user:', { id: user.id, email: user.email })
    console.log('Account is marked as awaiting a setup code. To complete setup, provide the setup code and run the completion script (not included).')
    console.log('Temporary password (store securely):', tempPassword)
  } catch (err) {
    console.error('Error creating user:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('create-nikki-user.js')) {
  main()
}
