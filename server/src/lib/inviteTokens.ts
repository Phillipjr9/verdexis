import crypto from 'crypto'
import { prisma } from '../db'

export const INVITE_TOKEN_EXPIRES_DAYS = 30

export async function generateInviteToken(opts: {
  email: string
  amountUsd: number
  isReferral: boolean
  adminId: string
}) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + INVITE_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000)

  const existing = await prisma.inviteToken.findFirst({ where: { email: opts.email } })
  if (existing) {
    await prisma.inviteToken.delete({ where: { id: existing.id } })
  }

  const record = await prisma.inviteToken.create({
    data: {
      email: opts.email,
      token,
      amount: opts.amountUsd,
      currency: 'USD',
      isReferral: opts.isReferral,
      expiresAt,
      createdBy: opts.adminId,
    },
  })

  return { token, expiresAt, tokenId: record.id }
}

export async function validateInviteToken(token: string) {
  const record = await prisma.inviteToken.findUnique({ where: { token } })

  if (!record) {
    return { valid: false, reason: 'Token not found' }
  }

  if (new Date() > record.expiresAt) {
    return { valid: false, reason: 'Token expired' }
  }

  if (record.usedAt) {
    return { valid: false, reason: 'Token already used' }
  }

  return { valid: true, record }
}

export async function redeemInviteToken(tokenId: string, userId: string) {
  const updated = await prisma.inviteToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  })
  return updated
}

export function getInviteSignupUrl(token: string, appUrl: string) {
  return `${appUrl}/invite/${token}`
}
