import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import { sendEmailNotification } from '../notificationService.js'
import { appUrl } from '../config/email.js'
import { generateInvestmentId } from '../investmentId.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseEmails(raw: unknown): string[] {
  const parts: string[] = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') parts.push(...item.split(/[\s,;]+/))
    }
  } else if (typeof raw === 'string') {
    parts.push(...raw.split(/[\s,;]+/))
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const e = p.trim().toLowerCase()
    if (!e || !EMAIL_RE.test(e) || seen.has(e)) continue
    seen.add(e)
    out.push(e)
  }
  return out
}

function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

function tempPassword(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12)
}

const inviteSchema = z.object({
  emails: z.union([z.string().min(3), z.array(z.string().min(3))]),
  amount: z.number().finite().positive().max(1_000_000_000),
  currency: z.string().min(1).max(10).default('USD').transform((s) => s.toUpperCase()),
  note: z.string().max(1000).optional(),
  creditExisting: z.boolean().default(true),
})

type InviteResult = {
  email: string
  status: 'created' | 'credited' | 'skipped' | 'failed'
  userId?: string
  amount?: number
  emailSent?: boolean
  error?: string
}

/**
 * POST /api/admin/invites
 * Creates accounts if needed, credits balance, emails each invitee with the amount.
 */
router.post('/invites', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = inviteSchema.safeParse({
    emails: req.body?.emails,
    amount: Number(req.body?.amount),
    currency: req.body?.currency ?? 'USD',
    note: req.body?.note,
    creditExisting: req.body?.creditExisting !== false,
  })
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  const emails = parseEmails(parsed.data.emails)
  if (emails.length === 0) {
    res.status(400).json({ error: 'Provide at least one valid email' })
    return
  }
  if (emails.length > 200) {
    res.status(400).json({ error: 'Maximum 200 emails per batch' })
    return
  }

  const adminId = req.userId!
  const { amount, currency, note, creditExisting } = parsed.data
  const loginUrl = `${appUrl}/login`
  const results: InviteResult[] = []

  for (const email of emails) {
    try {
      let user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, suspended: true },
      })
      let created = false
      let plainPassword: string | null = null

      if (!user) {
        plainPassword = tempPassword()
        const passwordHash = await bcrypt.hash(plainPassword, 12)
        const investmentId = await generateInvestmentId()
        const nameFromEmail = email.split('@')[0]?.replace(/[._+-]/g, ' ') || 'Investor'
        const name = nameFromEmail.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80) || 'Investor'
        user = await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: 'user',
            investmentId,
          },
          select: { id: true, email: true, name: true, suspended: true },
        })
        created = true
        try {
          await prisma.userAdminAssignment.upsert({
            where: { userId_adminId: { userId: user.id, adminId } },
            create: { userId: user.id, adminId, assignedBy: adminId },
            update: {},
          })
        } catch {
          try {
            await prisma.userAdminAssignment.create({
              data: { userId: user.id, adminId, assignedBy: adminId },
            })
          } catch (e) {
            console.warn('[invites] assignment failed', e)
          }
        }
      } else if (user.suspended) {
        results.push({ email, status: 'skipped', userId: user.id, error: 'User is suspended' })
        continue
      } else if (!creditExisting) {
        results.push({ email, status: 'skipped', userId: user.id, error: 'User already exists' })
        continue
      }

      const idem = `admin_invite:${user.id}:${amount}:${currency}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`
      await prisma.$transaction(async (tx) => {
        await recordLedgerTransaction({
          tx,
          userId: user!.id,
          asset: currency,
          amount,
          entryType: 'debit',
          kind: 'deposit',
          eventType: 'admin_invite_credit',
          sourceType: 'admin_invite',
          sourceId: idem,
          externalRef: idem,
          idempotencyKey: idem,
          description: note?.trim() || `Invitation credit of ${money(amount)}`,
          reference: note?.trim() || 'Invitation credit',
          subType: 'invite',
          recordTransaction: true,
          createdBy: adminId,
        })
      })

      const amountLabel = currency === 'USD' ? money(amount) : `${amount} ${currency}`
      const subject = `You're invited to Verdexis — ${amountLabel} credited`
      const lines = [
        `Hello${user.name ? ` ${user.name}` : ''},`,
        '',
        `You have been invited to Verdexis.`,
        '',
        `Your account balance has been credited with ${amountLabel}.`,
        `You can log in and see this amount in your wallet immediately.`,
        '',
        `Login: ${loginUrl}`,
        `Email: ${email}`,
      ]
      if (plainPassword) {
        lines.push(`Temporary password: ${plainPassword}`)
        lines.push('')
        lines.push('Please sign in and change your password after first login.')
      } else {
        lines.push('')
        lines.push('Use your existing password, or reset it from the login page if needed.')
      }
      if (note?.trim()) {
        lines.push('')
        lines.push(`Note from admin: ${note.trim()}`)
      }
      lines.push('')
      lines.push('— Verdexis Team')

      const body = lines.join('\n')
      const html = `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="color:#0C8B44;font-weight:600">You're invited to Verdexis</h2>
          <p>Hello${user.name ? ` ${user.name}` : ''},</p>
          <p>Your account has been credited with:</p>
          <p style="font-size:28px;font-weight:700;color:#0C8B44;margin:16px 0">${amountLabel}</p>
          <p>This amount is already in your <strong>wallet balance</strong>. Sign in to view and use it.</p>
          <p style="margin:24px 0">
            <a href="${loginUrl}" style="background:#0C8B44;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open Verdexis</a>
          </p>
          <p style="font-size:14px;color:#555"><strong>Email:</strong> ${email}</p>
          ${plainPassword ? `<p style="font-size:14px;color:#555"><strong>Temporary password:</strong> <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px">${plainPassword}</code></p><p style="font-size:13px;color:#888">Please change this password after your first login.</p>` : '<p style="font-size:14px;color:#555">Use your existing password, or reset it from the login page.</p>'}
          ${note?.trim() ? `<p style="font-size:14px;color:#555;border-left:3px solid #0C8B44;padding-left:12px;margin-top:16px"><em>${note.trim().replace(/</g, '&lt;')}</em></p>` : ''}
          <p style="margin-top:32px;font-size:12px;color:#999">— Verdexis Team</p>
        </div>
      `.trim()

      let emailSent = false
      try {
        emailSent = await sendEmailNotification(email, subject, body, html, {
          userId: user.id,
          kind: 'deposit',
          title: subject,
          body: `Invitation credit of ${amountLabel}`,
          createWebNotification: true,
        })
      } catch (e) {
        console.warn('[invites] email failed', email, e)
      }

      try {
        await prisma.adminAudit.create({
          data: {
            actorId: adminId,
            action: created ? 'invite.create_credit' : 'invite.credit',
            targetUserId: user.id,
            payload: JSON.stringify({ email, amount, currency, emailSent, note: note?.slice(0, 200) }).slice(0, 4000),
          },
        })
      } catch { /* ignore */ }

      results.push({
        email,
        status: created ? 'created' : 'credited',
        userId: user.id,
        amount,
        emailSent,
      })
    } catch (e) {
      console.error('[invites] failed for', email, e)
      results.push({
        email,
        status: 'failed',
        error: e instanceof Error ? e.message : 'Invite failed',
      })
    }
  }

  res.json({
    ok: true,
    summary: {
      total: results.length,
      created: results.filter((r) => r.status === 'created').length,
      credited: results.filter((r) => r.status === 'credited').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
      emailsSent: results.filter((r) => r.emailSent).length,
      amountPerInvite: amount,
      currency,
    },
    results,
  })
})

export default router
