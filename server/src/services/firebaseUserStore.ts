import { randomBytes } from 'node:crypto'
import { getFirebaseRealtimeDatabase } from './firebaseAdmin.js'
import { prisma } from '../db.js'
import { env } from '../env.js'

const normalizeKey = (value: string): string => encodeURIComponent(value.trim().toLowerCase())
const usersRoot = env.FIREBASE_DB_LISTEN_PATH.replace(/^\/+|\/+$/g, '') || 'users'
const emailIndexRoot = `${usersRoot}_by_email`
const usernameIndexRoot = `${usersRoot}_by_username`

export interface FirebaseUserRecord {
  id: string
  email: string
  username?: string | null
  name: string
  passwordHash: string
  avatar?: string | null
  prefs?: string | null
  twoFactor?: boolean
  role?: string
  suspended?: boolean
  investmentId?: string | null
  kycStatus?: string
  emailVerified?: boolean
  emailVerifiedAt?: string | null
  phoneVerified?: boolean
  phoneVerifiedAt?: string | null
  tokenVersion?: number
  createdAt?: string
  updatedAt?: string
  [key: string]: any
}

function getDb() {
  return getFirebaseRealtimeDatabase()
}

function userRef(id: string) {
  return getDb().ref(`${usersRoot}/${id}`)
}

function emailIndexRef(email: string) {
  return getDb().ref(`${emailIndexRoot}/${normalizeKey(email)}`)
}

function usernameIndexRef(username: string) {
  return getDb().ref(`${usernameIndexRoot}/${normalizeKey(username)}`)
}

export async function getUserById(id: string): Promise<FirebaseUserRecord | null> {
  const snapshot = await userRef(id).once('value')
  return snapshot.exists() ? snapshot.val() as FirebaseUserRecord : null
}

export async function findUserByEmail(email: string): Promise<FirebaseUserRecord | null> {
  const emailSnapshot = await emailIndexRef(email).once('value')
  const userId = emailSnapshot.val() as string | null
  if (!userId) return null
  return getUserById(userId)
}

export async function findUserByUsername(username: string): Promise<FirebaseUserRecord | null> {
  const usernameSnapshot = await usernameIndexRef(username).once('value')
  const userId = usernameSnapshot.val() as string | null
  if (!userId) return null
  return getUserById(userId)
}

export async function createUser(data: any): Promise<FirebaseUserRecord> {
  if (!data.email || !data.name || !data.passwordHash) {
    throw new Error('Firebase user store requires email, name, and passwordHash')
  }

  const email = data.email.trim().toLowerCase()
  const username = typeof data.username === 'string' && data.username.trim() ? data.username.trim().toLowerCase() : null
  const existingByEmail = await findUserByEmail(email)
  if (existingByEmail) {
    const err = new Error('Email already registered')
    ;(err as any).code = 'EMAIL_EXISTS'
    throw err
  }
  if (username) {
    const existingByUsername = await findUserByUsername(username)
    if (existingByUsername) {
      const err = new Error('Username already taken')
      ;(err as any).code = 'USERNAME_EXISTS'
      throw err
    }
  }

  const id = data.id ?? `user_${randomBytes(8).toString('hex')}`
  const now = new Date().toISOString()
  const record: FirebaseUserRecord = {
    id,
    email,
    username: username || null,
    name: data.name,
    passwordHash: data.passwordHash,
    avatar: data.avatar || null,
    prefs: data.prefs ?? null,
    address: data.address ?? null,
    twoFactor: Boolean(data.twoFactor),
    role: data.role || 'user',
    suspended: Boolean(data.suspended) || false,
    investmentId: data.investmentId ?? null,
    kycStatus: data.kycStatus ?? 'none',
    emailVerified: Boolean(data.emailVerified),
    emailVerifiedAt: data.emailVerifiedAt ?? null,
    phoneVerified: Boolean(data.phoneVerified),
    phoneVerifiedAt: data.phoneVerifiedAt ?? null,
    tokenVersion: typeof data.tokenVersion === 'number' ? data.tokenVersion : 0,
    createdAt: now,
    updatedAt: now,
  }

  const updates: Record<string, any> = {}
  updates[`${usersRoot}/${id}`] = record
  updates[`${emailIndexRoot}/${normalizeKey(email)}`] = id
  if (username) updates[`${usernameIndexRoot}/${normalizeKey(username)}`] = id

  await getDb().ref().update(updates)

  try {
    await prisma.user.create({ data: {
      id: record.id,
      email: record.email,
      name: record.name,
      passwordHash: record.passwordHash,
      username: record.username,
      role: record.role,
      emailVerified: record.emailVerified,
      emailVerifiedAt: record.emailVerifiedAt ? new Date(record.emailVerifiedAt) : null,
      phoneVerified: record.phoneVerified,
      phoneVerifiedAt: record.phoneVerifiedAt ? new Date(record.phoneVerifiedAt) : null,
      prefs: record.prefs,
      address: (record as any).address ?? null,
      investmentId: record.investmentId,
      tokenVersion: record.tokenVersion ?? 0,
    }})
  } catch {
    // best-effort fallback to allow Firebase auth to continue even if SQL user creation fails
  }

  return record
}

export async function updateUser(id: string, data: any): Promise<FirebaseUserRecord> {
  const existing = await getUserById(id)
  if (!existing) {
    throw new Error('User not found')
  }

  const updates: Record<string, any> = {}
  const now = new Date().toISOString()
  const record = {
    ...existing,
    ...data,
    email: data.email ? data.email.trim().toLowerCase() : existing.email,
    username: data.username !== undefined ? (data.username ? data.username.trim().toLowerCase() : null) : existing.username,
    updatedAt: now,
  }

  if (data.email && data.email.trim().toLowerCase() !== existing.email) {
    const emailExists = await findUserByEmail(data.email)
    if (emailExists && emailExists.id !== id) {
      const err = new Error('Email already registered')
      ;(err as any).code = 'EMAIL_EXISTS'
      throw err
    }
    updates[`${emailIndexRoot}/${normalizeKey(existing.email)}`] = null
    updates[`${emailIndexRoot}/${normalizeKey(data.email)}`] = id
  }

  if (data.username !== undefined && data.username !== existing.username) {
    if (data.username) {
      const usernameExists = await findUserByUsername(data.username)
      if (usernameExists && usernameExists.id !== id) {
        const err = new Error('Username already taken')
        ;(err as any).code = 'USERNAME_EXISTS'
        throw err
      }
      if (existing.username) {
        updates[`${usernameIndexRoot}/${normalizeKey(existing.username)}`] = null
      }
      updates[`${usernameIndexRoot}/${normalizeKey(data.username)}`] = id
    } else if (existing.username) {
      updates[`${usernameIndexRoot}/${normalizeKey(existing.username)}`] = null
    }
  }

  updates[`${usersRoot}/${id}`] = record
  await getDb().ref().update(updates)

  try {
    await prisma.user.update({ where: { id }, data: {
      email: record.email,
      username: record.username,
      name: record.name,
      passwordHash: record.passwordHash,
      role: record.role,
      suspended: record.suspended,
      emailVerified: record.emailVerified,
      emailVerifiedAt: record.emailVerifiedAt ? new Date(record.emailVerifiedAt) : null,
      phoneVerified: record.phoneVerified,
      phoneVerifiedAt: record.phoneVerifiedAt ? new Date(record.phoneVerifiedAt) : null,
      prefs: record.prefs,
      address: (record as any).address ?? null,
      investmentId: record.investmentId,
      tokenVersion: record.tokenVersion ?? 0,
    }})
  } catch {
    // ignore SQL sync failures
  }

  return record
}

export async function deleteUser(id: string): Promise<void> {
  const existing = await getUserById(id)
  if (!existing) return
  const updates: Record<string, any> = {}
  updates[`${usersRoot}/${id}`] = null
  updates[`${emailIndexRoot}/${normalizeKey(existing.email)}`] = null
  if (existing.username) {
    updates[`${usernameIndexRoot}/${normalizeKey(existing.username)}`] = null
  }
  await getDb().ref().update(updates)

  try {
    await prisma.user.delete({ where: { id } })
  } catch {
    // ignore SQL delete failures
  }
}
