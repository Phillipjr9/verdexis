import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

export interface LocalAuthUser {
  id: string
  email: string
  username: string | null
  name: string
  passwordHash: string
  avatar: string | null
  role: 'user' | 'admin'
  suspended: boolean
  investmentId: string | null
  prefs: string | null
  twoFactor: boolean
  kycStatus: string
  emailVerified: boolean
  phoneVerified: boolean
  createdAt: string
}

const localAuthUsers = new Map<string, LocalAuthUser>()

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function makeInvestmentId(): string {
  return `VDX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

function makeUserId(): string {
  return `local_${crypto.randomBytes(8).toString('hex')}`
}

export async function createLocalUser(input: {
  email: string
  password: string
  name: string
  role?: 'user' | 'admin'
  phone?: string
  username?: string | null
}): Promise<LocalAuthUser> {
  const email = normalizeEmail(input.email)
  const existing = localAuthUsers.get(email)
  if (existing) {
    return existing
  }

  const passwordHash = await bcrypt.hash(input.password, 12)
  const user: LocalAuthUser = {
    id: makeUserId(),
    email,
    username: input.username?.trim() || null,
    name: input.name.trim(),
    passwordHash,
    avatar: null,
    role: input.role || 'user',
    suspended: false,
    investmentId: makeInvestmentId(),
    prefs: JSON.stringify({ phone: input.phone?.trim() || '' }),
    twoFactor: false,
    kycStatus: 'none',
    emailVerified: false,
    phoneVerified: false,
    createdAt: new Date().toISOString(),
  }

  localAuthUsers.set(email, user)
  return user
}

export async function findLocalUserByEmailOrUsername(identifier: string): Promise<LocalAuthUser | null> {
  const normalized = identifier.trim().toLowerCase()
  if (!normalized) return null

  const exactEmail = normalizeEmail(identifier)
  const existingByEmail = localAuthUsers.get(exactEmail)
  if (existingByEmail) return existingByEmail

  for (const user of localAuthUsers.values()) {
    if (user.username && user.username.toLowerCase() === normalized) {
      return user
    }
  }

  return null
}

export async function getLocalUserById(userId: string): Promise<LocalAuthUser | null> {
  for (const user of localAuthUsers.values()) {
    if (user.id === userId) return user
  }
  return null
}

export async function updateLocalUserPassword(userId: string, passwordHash: string): Promise<LocalAuthUser | null> {
  for (const [email, user] of localAuthUsers.entries()) {
    if (user.id === userId) {
      const updated = { ...user, passwordHash }
      localAuthUsers.set(email, updated)
      return updated
    }
  }
  return null
}
