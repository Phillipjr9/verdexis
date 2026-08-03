import { prisma } from '../db.js'
import { env } from '../env.js'
import {
  createUser as createFirebaseUser,
  findUserByEmail as getFirebaseUserByEmail,
  findUserByUsername as getFirebaseUserByUsername,
  getUserById as getFirebaseUserById,
  updateUser as updateFirebaseUser,
} from './firebaseUserStore.js'

export const isFirebaseUserStore = Boolean(
  env.FIREBASE_PROJECT_ID &&
  env.FIREBASE_PRIVATE_KEY &&
  env.FIREBASE_CLIENT_EMAIL &&
  env.FIREBASE_DATABASE_URL,
)

export async function getUserByEmail(email: string) {
  if (isFirebaseUserStore) {
    return getFirebaseUserByEmail(email)
  }
  return prisma.user.findUnique({ where: { email } })
}

export async function getUserById(id: string) {
  if (isFirebaseUserStore) {
    return getFirebaseUserById(id)
  }
  return prisma.user.findUnique({ where: { id } })
}

export async function getUserByUsername(username: string) {
  if (isFirebaseUserStore) {
    return getFirebaseUserByUsername(username)
  }
  return prisma.user.findUnique({ where: { username } })
}

export async function findUserByEmailOrUsername(identifier: string) {
  const normalized = identifier.trim().toLowerCase()
  if (!normalized) return null

  if (/^.+@.+\..+$/.test(normalized)) {
    const user = await getUserByEmail(normalized)
    if (user) return user
  }

  return getUserByUsername(normalized)
}

export async function createUser(data: any) {
  if (isFirebaseUserStore) {
    return createFirebaseUser(data)
  }
  return prisma.user.create({ data })
}

export async function updateUser(id: string, data: any) {
  if (isFirebaseUserStore) {
    return updateFirebaseUser(id, data)
  }
  return prisma.user.update({ where: { id }, data })
}
