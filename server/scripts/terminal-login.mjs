import bcrypt from 'bcryptjs'
import { prisma } from '../dist/db.js'
import { signToken } from '../dist/auth.js'

async function main() {
  const args = process.argv.slice(2)
  const email = (args[0] || process.env.ADMIN_EMAIL || 'admin@verdexisgroup.com').toLowerCase()
  const password = args[1] || process.env.ADMIN_PASSWORD || 'Admin@Verdexis2024'

  console.log('Attempting login for', email)
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, passwordHash: true, role: true, suspended: true, tokenVersion: true } })
  if (!user) {
    console.error('User not found')
    process.exit(1)
  }
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    console.error('Invalid credentials')
    process.exit(1)
  }
  if (user.suspended) {
    console.error('Account suspended')
    process.exit(1)
  }
  const token = signToken({ sub: user.id, email: user.email, v: user.tokenVersion ?? 0 })
  console.log('Login successful')
  console.log('Token:', token)
  console.log('User:', { id: user.id, email: user.email, name: user.name, role: user.role })
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
