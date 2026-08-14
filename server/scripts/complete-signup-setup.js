#!/usr/bin/env node
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'

/**
 * complete-signup-setup.js
 * Usage: node complete-signup-setup.js user@example.com 123456
 *
 * Verifies the OTP code for the given user's signup and marks the user as
 * emailVerified. This script will NOT run automatically — run it only when
 * you have the setup/verification code to complete the account.
 */

async function main() {
  const email = process.argv[2] || process.env.EMAIL
  const code = process.argv[3] || process.env.CODE

  if (!email || !code) {
    console.error('Usage: node complete-signup-setup.js user@example.com 123456')
    process.exit(2)
  }

  const prisma = new PrismaClient()
  try {
    await prisma.$connect()
    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } })
    if (!user) {
      console.error('User not found:', email)
      process.exit(1)
    }

    if (user.emailVerified) {
      console.log('User already verified:', email)
      process.exit(0)
    }

    // Find the most recent valid OTP for email verification
    const now = new Date()
    const otpRecord = await prisma.otp.findFirst({
      where: {
        userId: user.id,
        purpose: 'email_verification',
        used: false,
        expiresAt: { gte: now },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) {
      console.error('No valid OTP found for this user (expired or used)')
      process.exit(1)
    }

    const hashed = crypto.createHash('sha256').update(String(code)).digest('hex')
    if (hashed !== otpRecord.hashedOtp) {
      // increment attempts and possibly mark used
      await prisma.otp.update({ where: { id: otpRecord.id }, data: { attempts: { increment: 1 } } })
      const refreshed = await prisma.otp.findUnique({ where: { id: otpRecord.id } })
      if (refreshed && refreshed.attempts >= (refreshed.maxAttempts || 5)) {
        await prisma.otp.update({ where: { id: otpRecord.id }, data: { used: true } })
        console.error('Invalid code — too many attempts. OTP invalidated.')
        process.exit(1)
      }
      console.error('Invalid code')
      process.exit(1)
    }

    // Mark OTP used and update user as verified
    await prisma.otp.update({ where: { id: otpRecord.id }, data: { used: true, verifiedAt: new Date() } })
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, emailVerifiedAt: new Date() } })

    console.log('User email verified successfully for', email)
  } catch (err) {
    console.error('Error completing signup setup:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('complete-signup-setup.js')) {
  main()
}
