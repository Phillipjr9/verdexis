import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const SECRET = process.env.JWT_SECRET || 'verdexis-dev-secret-key-2024-minimum-32-chars-required'

async function main() {
  const email = process.env.TEST_USER_EMAIL || 'local.test+1@example.com'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log('User already exists:', existing.id)
    const token = jwt.sign({ sub: existing.id, email: existing.email, v: existing.tokenVersion }, SECRET, { expiresIn: '7d' })
    console.log('JWT=', token)
    process.exit(0)
  }

  const pwd = process.env.TEST_USER_PASSWORD || 'password1234'
  const hash = await bcrypt.hash(pwd, 10)

  const user = await prisma.user.create({
    data: {
      email,
      name: 'Local Test',
      passwordHash: hash,
      role: 'user',
    },
  })

  const token = jwt.sign({ sub: user.id, email: user.email, v: user.tokenVersion }, SECRET, { expiresIn: '7d' })
  console.log('Created user:', user.id, user.email)
  console.log('JWT=', token)
}

main().catch((e) => { console.error(e); process.exit(1) })
