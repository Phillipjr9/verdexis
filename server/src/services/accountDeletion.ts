import { prisma } from '../db.js'

export type AccountDeletionUser = {
  id: string
  email: string
  username: string | null
  name: string
  role: string
  suspended: boolean
  kycStatus?: string | null
  walletAddress?: string | null
  walletChainId?: string | null
  walletProvider?: string | null
  phoneVerified?: boolean | null
  prefs?: string | null
  createdAt?: Date | string | null
  updatedAt?: Date | string | null
  investmentId?: string | null
  referralCode?: string | null
}

export function isDeletedUserDecision(user: { deletedAt?: Date | string | null } | null | undefined): boolean {
  return !!user && !!user.deletedAt
}

export function buildDeletionArchivePayload(user: AccountDeletionUser, reason?: string) {
  const prefs = (() => {
    if (!user.prefs) return {}
    try {
      return JSON.parse(user.prefs)
    } catch {
      return {}
    }
  })()

  return {
    status: 'user_requested_deletion',
    reason: reason || 'User requested account deletion',
    archivedAt: new Date().toISOString(),
    snapshot: {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role,
      suspended: user.suspended,
      kycStatus: user.kycStatus ?? 'none',
      walletAddress: user.walletAddress ?? null,
      walletChainId: user.walletChainId ?? null,
      walletProvider: user.walletProvider ?? null,
      phoneVerified: user.phoneVerified ?? false,
      prefs,
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
      updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : null,
      investmentId: user.investmentId ?? null,
      referralCode: user.referralCode ?? null,
    },
  }
}

export async function archiveUserDeletion(user: AccountDeletionUser, reason = 'User requested account deletion') {
  const archivePayload = buildDeletionArchivePayload(user, reason)
  const now = new Date()

  const archive = await prisma.deletedUserArchive.upsert({
    where: { userId: user.id },
    update: {
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      status: 'user_requested_deletion',
      reason,
      archiveJson: JSON.stringify(archivePayload),
      reviewedAt: null,
      reviewedBy: null,
      reviewedReason: null,
    },
    create: {
      userId: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      status: 'user_requested_deletion',
      reason,
      archiveJson: JSON.stringify(archivePayload),
    },
  })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      deletedAt: now,
      deletedReason: reason,
      deletionRequestedAt: now,
      suspended: true,
      suspendedReason: 'User requested account deletion; archived for admin review',
    },
  })

  return archive
}
