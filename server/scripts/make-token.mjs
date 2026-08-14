import 'dotenv/config'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SECRET = process.env.JWT_SECRET
if (!SECRET) { console.error('JWT_SECRET missing'); process.exit(1) }

const email = process.argv[2] || process.env.TEST_TOKEN_EMAIL || 'admin@verdexisgroup.com'

async function run() {
  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) { console.error('User not found for email', email); process.exit(1) }
    const payload = { sub: user.id, email: user.email, v: user.tokenVersion ?? 0 }
    const token = jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
    console.log(token)
  } catch (e) {
    console.error('Error generating token', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

run()
