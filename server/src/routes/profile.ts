import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { warnUnverified } from '../middleware/verificationCheck.js'
import { sendAdminEmailNotification, sendEmailNotification } from '../notificationService.js'
import { archiveUserDeletion } from '../services/accountDeletion.js'

const router = Router()

const profileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  username: z.string().min(3).max(40).regex(/^[a-z0-9_.-]+$/i).toLowerCase().nullable().optional(),
  email: z.string().email('Invalid email').toLowerCase().trim().optional(),
  phone: z.string().trim().min(7).max(32).regex(/^[+0-9 ()\-.]+$/, 'Invalid phone number').optional(),
  avatar: z.string().nullable().optional(),
  prefs: z.record(z.unknown()).optional(),
  twoFactor: z.boolean().optional(),
})

router.patch('/', requireAuth, warnUnverified, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, prefs: true } })
  if (!currentUser) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const data: {
    name?: string
    username?: string | null
    email?: string
    avatar?: string | null
    prefs?: string
    twoFactor?: boolean
    emailVerified?: boolean
    emailVerifiedAt?: Date | null
    phoneVerified?: boolean
    phoneVerifiedAt?: Date | null
  } = {}

  const auditPayload: Record<string, unknown> = {}
  let prefsObj: Record<string, unknown> | undefined

  if (parsed.data.prefs !== undefined) {
    try {
      prefsObj = currentUser.prefs ? JSON.parse(currentUser.prefs) : {}
    } catch {
      prefsObj = {}
    }
    prefsObj = { ...prefsObj, ...parsed.data.prefs }
  }

  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name
    auditPayload.name = parsed.data.name
  }

  if (parsed.data.username !== undefined) {
    data.username = parsed.data.username
    auditPayload.username = parsed.data.username
  }

  if (parsed.data.email !== undefined) {
    auditPayload.email = parsed.data.email
    if (parsed.data.email !== currentUser.email) {
      data.email = parsed.data.email
      data.emailVerified = false
      data.emailVerifiedAt = null
    }
  }

  if (parsed.data.phone !== undefined) {
    auditPayload.phone = parsed.data.phone
    if (!prefsObj) {
      try {
        prefsObj = currentUser.prefs ? JSON.parse(currentUser.prefs) : {}
      } catch {
        prefsObj = {}
      }
    }
    const existingPhone = typeof prefsObj.phone === 'string' ? prefsObj.phone : ''
    prefsObj.phone = parsed.data.phone
    delete (prefsObj as { pendingPhoneNumber?: unknown }).pendingPhoneNumber
    delete (prefsObj as { phoneVerificationStartedAt?: unknown }).phoneVerificationStartedAt
    if (parsed.data.phone.trim() !== existingPhone.trim()) {
      data.phoneVerified = false
      data.phoneVerifiedAt = null
    }
  }

  if (parsed.data.avatar !== undefined) {
    if (parsed.data.avatar && parsed.data.avatar.length > 1_000_000) {
      res.status(413).json({ error: 'Avatar too large (>1 MB encoded)' })
      return
    }
    data.avatar = parsed.data.avatar
    auditPayload.avatar = parsed.data.avatar
  }

  if (prefsObj !== undefined) {
    data.prefs = JSON.stringify(prefsObj)
  }

  if (parsed.data.twoFactor !== undefined) {
    data.twoFactor = parsed.data.twoFactor
    auditPayload.twoFactor = parsed.data.twoFactor
  }

  try {
    const user = await prisma.user.update({ where: { id: userId }, data })

    await prisma.adminAudit.create({
      data: {
        actorId: userId,
        action: 'user.profile.update',
        targetUserId: userId,
        payload: Object.keys(auditPayload).length ? JSON.stringify(auditPayload).slice(0, 4000) : null,
      },
    })

    const changedFields = Object.keys(auditPayload)
    if (changedFields.length) {
      const message = `User ${user.id} updated profile fields: ${changedFields.join(', ')}`
      await sendAdminEmailNotification('User profile updated', message)
      const admins = await prisma.user.findMany({ where: { role: 'admin', suspended: false }, select: { id: true } })
      if (admins.length) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            kind: 'system',
            title: 'User profile updated',
            body: message,
          })),
        }).catch(() => {})
      }
    }

    let prefs: unknown = {}
    try {
      prefs = user.prefs ? JSON.parse(user.prefs) : {}
    } catch {
      prefs = {}
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        twoFactor: user.twoFactor,
        prefs,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        kycStatus: user.kycStatus || 'none',
        kycTier: user.kycTier || 'UNVERIFIED',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('P2002') || msg.includes('Unique constraint')) {
      const message = msg.includes('email') ? 'Email already in use' : msg.includes('username') ? 'Username already taken' : 'That username or email is already taken'
      res.status(409).json({ error: message })
      return
    }
    throw e
  }
})

router.delete('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      role: true,
      suspended: true,
      deletedAt: true,
      prefs: true,
      walletAddress: true,
      walletChainId: true,
      walletProvider: true,
      phoneVerified: true,
      kycStatus: true,
      createdAt: true,
      updatedAt: true,
      investmentId: true,
      referralCode: true,
    },
  })

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  if (user.deletedAt) {
    res.status(409).json({ error: 'Account already scheduled for deletion' })
    return
  }

  const reason = 'User requested account deletion'
  const archive = await archiveUserDeletion(user, reason)

  const email = user.email
  let userEmailDelivered = false
  if (email) {
    userEmailDelivered = await sendEmailNotification(
      email,
      'Your account deletion request has been received',
      'We have received your request to delete your Verdexis account. Your account is now in a protected archive for review by our admin team, so it remains available for fraud and compliance review while not allowing sign-in access. If you did not request this, contact support immediately.',
      undefined,
      { userId: user.id, createWebNotification: true, title: 'Account deletion requested', body: 'Your account has been scheduled for review and deactivation.' },
    )
  } else {
    console.warn('[profile-delete] No email available for deletion notice')
  }

  await sendAdminEmailNotification(
    `User account deletion request: ${user.email}`,
    `User ${user.name} (${user.email}) has requested account deletion.\n\nThe account has been archived for admin review and cannot be used until reviewed.\n\nArchive status: ${archive.status}`,
  )

  await prisma.notification.create({
    data: {
      userId,
      kind: 'system',
      title: 'Account deletion requested',
      body: 'Your account has been archived for admin review and is no longer active.',
    },
  }).catch(() => {})

  res.json({ ok: true, archived: true, emailSent: userEmailDelivered })
})

export default router
