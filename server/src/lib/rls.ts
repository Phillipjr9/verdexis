import type { Prisma } from '@prisma/client'
import { prisma } from '../db.js'

export type RlsUser = {
  id: string
  role?: string | null
}

export async function setRlsContext(user: RlsUser | null): Promise<void> {
  const userId = user?.id ?? ''
  const role = user?.role ?? 'anonymous'
  const isAdmin = role === 'admin' || role === 'super_admin'

  await prisma.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`
  await prisma.$executeRaw`SELECT set_config('app.current_user_role', ${role}, true)`
  await prisma.$executeRaw`SELECT set_config('app.current_user_is_admin', ${isAdmin ? 'true' : 'false'}, true)`
}

export async function withRlsSession<T>(user: RlsUser | null, callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const userId = user?.id ?? ''
    const role = user?.role ?? 'anonymous'
    const isAdmin = role === 'admin' || role === 'super_admin'

    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`
    await tx.$executeRaw`SELECT set_config('app.current_user_role', ${role}, true)`
    await tx.$executeRaw`SELECT set_config('app.current_user_is_admin', ${isAdmin ? 'true' : 'false'}, true)`

    return callback(tx)
  })
}
