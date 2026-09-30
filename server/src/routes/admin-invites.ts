import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import { recordLedgerBalanceReservation } from '../services/ledger.js'
import { applyBonusLock } from '../services/bonusLock.js'
import { sendEmailNotification } from '../notificationService.js'
import { emailService } from '../services/email.js'
import { sendViaConfiguredSmtp, listAllowedFromAddresses } from '../lib/sendViaSmtp.js'
import { generateReferralCode, linkReferrer } from '../referrals.js'
import { generateInviteToken, getInviteSignupUrl } from '../lib/inviteTokens.js'
import { appUrl, customerEmailName } from '../config/email.js'
import { companyInfo } from '../config/company.js'
import { generateInvestmentId } from '../investmentId.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LOOSE_EMAIL_RE = /[^\s@<>()[\]"',;]+@[^\s@<>()[\]"',;]+\.[^\s@<>()[\]"',;]+/

export interface ParsedInviteRecipient {
  email: string
  name?: string
  amount?: number
}

export function coerceAmountValue(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[$\u20ac\u00a3\u00a5\s,_]/g, '')
    if (!cleaned) return undefined
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

export function parseEmailsAndRecipients(raw: unknown): ParsedInviteRecipient[] {
  const recipients: ParsedInviteRecipient[] = []
  const seen = new Set<string>()
  const addOne = (emailStr: string, nameStr?: string, amountNum?: number) => {
    const e = emailStr.trim().toLowerCase()
    if (!e || !EMAIL_RE.test(e) || seen.has(e)) return
    seen.add(e)
    recipients.push({
      email: e,
      name: nameStr?.trim() || undefined,
      amount: typeof amountNum === 'number' && Number.isFinite(amountNum) && amountNum >= 0 && amountNum <= 1_000_000_000 ? amountNum : undefined,
    })
  }
  const extractEmail = (token: string): string | undefined => {
    const m = token.match(LOOSE_EMAIL_RE)
    const candidate = (m?.[0] ?? '').toLowerCase()
    return EMAIL_RE.test(candidate) ? candidate : undefined
  }
  const parseLine = (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const angleMatches = [...trimmed.matchAll(/<([^>]*)>/g)]
    if (angleMatches.length) {
      let added = 0
      for (const m of angleMatches) {
        const emailInBrackets = extractEmail(m[1] ?? '')
        if (!emailInBrackets) continue
        const before = trimmed.slice(0, m.index).replace(/^[\s,;]+/, '').replace(/[\s,;]+$/, '')
        const name = (before.split(/[;,]/).pop() ?? '').replace(/^["']+|["']+$/g, '').trim()
        addOne(emailInBrackets, name || undefined)
        added++
      }
      if (added) return
    }
    if (trimmed.includes(',') || trimmed.includes(';')) {
      const cols = trimmed.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
      const emails = cols.map((c) => extractEmail(c)).filter((c): c is string => Boolean(c))
      const firstIsEmail = cols.length > 0 && extractEmail(cols[0]) !== undefined
      if (emails.length === 1 && firstIsEmail) {
        const rest = cols.slice(1)
        const amount = rest.map(coerceAmountValue).find((v): v is number => typeof v === 'number')
        const name = rest.find((c) => !extractEmail(c) && coerceAmountValue(c) === undefined)
        addOne(emails[0], name, amount)
        return
      }
      for (const col of cols) {
        const email = extractEmail(col)
        if (email) addOne(email)
      }
      return
    }
    for (const token of trimmed.split(/\s+/)) {
      const email = extractEmail(token)
      if (email) addOne(email)
    }
  }
  const parseObjectEntry = (obj: Record<string, unknown>) => {
    if (typeof obj.email === 'string') addOne(obj.email, typeof obj.name === 'string' ? obj.name : undefined, coerceAmountValue(obj.amount))
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') item.split(/[\r\n]+/).forEach(parseLine)
      else if (item && typeof item === 'object') parseObjectEntry(item as Record<string, unknown>)
    }
  } else if (typeof raw === 'string') raw.split(/[\r\n]+/).forEach(parseLine)
  else if (raw && typeof raw === 'object') parseObjectEntry(raw as Record<string, unknown>)
  return recipients
}

function formatCurrencyAmount(amount: number, currency: string): string {
  if (currency === 'USD') return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
  if (['EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(currency)) {
    try { return amount.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }) }
    catch { return `${amount.toLocaleString('en-US')} ${currency}` }
  }
  return `${amount} ${currency}`
}

function generateSecureTempPassword(): string {
  const bytes = crypto.randomBytes(9).toString('base64url').slice(0, 10)
  return `${bytes}!9A`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&' + 'amp;').replace(/</g, '&' + 'lt;').replace(/>/g, '&' + 'gt;')
}

export function buildAutoInviteParagraphs(opts: { hasCredit: boolean; amountLabel: string; companyName: string }): string[] {
  const { hasCredit, amountLabel, companyName } = opts
  const paragraphs = [`You have been personally invited to join ${companyName}. Your account has been created with your email address.`]
  if (hasCredit) paragraphs.push(`Your new wallet has been credited with ${amountLabel}.`)
  paragraphs.push('Click the link below to set your password and start trading.')
  return paragraphs
}

export function buildAutoInviteSignOff(companyName: string): string {
  return `Welcome aboard,\nThe ${companyName} Team`
}

function buildInviteEmailHtml(opts: { recipientName: string; recipientEmail: string; amountLabel: string; amount: number; currency: string; loginUrl: string; note?: string | null; customMessage?: string | null }): string {
  const { recipientName, recipientEmail, amountLabel, amount, currency, loginUrl, note, customMessage } = opts
  const hasCredit = amount > 0
  const companyName = companyInfo.name || 'Verdexis'
  const autoParagraphs = buildAutoInviteParagraphs({ hasCredit, amountLabel, companyName })
  const messageBlock = customMessage?.trim()
    ? `<div>${escapeHtml(customMessage.trim()).replace(/\n/g, '<br/>')}</div>`
    : autoParagraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>body{font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;line-height:1.6;max-width:600px;margin:0 auto}h1{color:#0C8B44;font-size:24px}code{background:#f5f5f5;padding:2px 6px;border-radius:4px;font-family:monospace}table{border-collapse:collapse;width:100%}td{padding:8px;border:1px solid #e0e0e0}</style></head><body><div style="background:#f9f9f9;padding:20px;border-radius:8px"><h1>Welcome to ${escapeHtml(companyName)}</h1><p>Hello <strong>${escapeHtml(recipientName || 'Investor')}</strong>,</p>${messageBlock}${hasCredit ? `<div style="background:#0C8B44;color:white;padding:16px;border-radius:8px;margin:16px 0;text-align:center"><p style="margin:0;font-size:14px">Your wallet has been credited with</p><p style="margin:8px 0;font-size:28px;font-weight:bold">${amountLabel}</p><p style="margin:0;font-size:12px">Ready to use upon sign-in</p></div>` : ''}<div style="background:#fff;padding:16px;border:1px solid #e0e0e0;border-radius:8px;margin:16px 0"><p><strong>Sign-in Details:</strong></p><table><tr><td style="font-weight:bold;width:120px">Email:</td><td><code>${escapeHtml(recipientEmail)}</code></td></tr></table></div><div style="text-align:center;margin:24px 0"><a href="${loginUrl}" style="display:inline-block;background:#0C8B44;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Open Your Account</a></div>${note?.trim() ? `<div style="background:#fff3cd;padding:12px;border-radius:8px;border-left:4px solid #ffc107"><strong>Admin Note:</strong> ${escapeHtml(note.trim())}</div>` : ''}<p style="font-size:12px;color:#999;margin-top:32px;border-top:1px solid #e0e0e0;padding-top:16px">${escapeHtml(buildAutoInviteSignOff(companyName)).replace(/\n/g, '<br/>')}</p></div></body></html>`
}

const inviteSchema = z.object({
  emails: z.any().optional(),
  email: z.any().optional(),
  recipients: z.any().optional(),
  fromAddress: z.coerce.string().max(120).optional(),
  asReferral: z.any().optional(),
  amount: z.any().optional(),
  currency: z.any().optional(),
  subject: z.any().optional(),
  customMessage: z.any().optional(),
  note: z.any().optional(),
  creditExisting: z.any().optional(),
})

export type InviteResultItem = {
  email: string
  name?: string
  status: 'created' | 'credited' | 'skipped' | 'failed'
  userId?: string
  amount?: number
  currency?: string
  emailSent?: boolean
  plainPassword?: string
  error?: string
}

router.post('/invites/preview', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const amount = coerceAmountValue(req.body?.amount) ?? 1000
  const currency = String(req.body?.currency || 'USD').toUpperCase()
  const customMessage = req.body?.customMessage
  const note = req.body?.note
  const sampleEmail = 'investor@example.com'
  const sampleName = 'Alex Mercer'
  const samplePassword = 'VDX-Invite9!a'
  const amountLabel = formatCurrencyAmount(amount, currency)
  const subject = req.body?.subject || (amount > 0 ? `You're invited to Verdexis — ${amountLabel} credited` : `You're invited to join Verdexis`)
  const loginUrl = `${appUrl}/login`
  const html = buildInviteEmailHtml({ recipientName: sampleName, recipientEmail: sampleEmail, amountLabel, amount, currency, loginUrl, note, customMessage })
  res.json({ ok: true, subject, html, autoMessage: null, sample: { email: sampleEmail, name: sampleName, amount, currency, amountLabel } })
})

async function inviteHistoryHandler(req: AuthedRequest, res: any) {
  try {
    const audits = await prisma.adminAudit.findMany({
      where: { action: { in: ['invite.create_credit', 'invite.credit', 'invite.batch', 'invite.create'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actor: { select: { id: true, email: true, name: true } },
        targetUser: { select: { id: true, email: true, name: true } },
      },
    })
    const history = audits.map((a) => {
      let payloadObj: Record<string, unknown> = {}
      try { if (a.payload) payloadObj = JSON.parse(a.payload) } catch { payloadObj = { raw: a.payload } }
      return { id: a.id, action: a.action, createdAt: a.createdAt, actor: a.actor, targetUser: a.targetUser, details: payloadObj }
    })
    res.json({ ok: true, history })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invite history', details: err instanceof Error ? err.message : String(err) })
  }
}

router.post('/invites/history', requireAuth, requireAdmin, inviteHistoryHandler)
router.get('/invites/history', requireAuth, requireAdmin, inviteHistoryHandler)
router.get('/invites/from-options', requireAuth, requireAdmin, (_req, res) => {
  res.json({ ok: true, fromAddresses: listAllowedFromAddresses() })
})

router.post('/invites', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  inviteSchema.safeParse(body)
  const rawEmails = body.emails ?? body.email ?? body.recipients ?? body.to ?? ''
  const recipients = parseEmailsAndRecipients(rawEmails)
  if (recipients.length === 0) {
    res.status(400).json({ error: 'Provide at least one valid email address' })
    return
  }
  if (recipients.length > 200) {
    res.status(400).json({ error: 'Maximum 200 emails per batch' })
    return
  }
  const adminId = req.userId!
  const defaultAmount = coerceAmountValue(body.amount) ?? 0
  const currency = String(body.currency || 'USD').trim().toUpperCase() || 'USD'
  const customSubject = typeof body.subject === 'string' ? body.subject : undefined
  const customMessage = typeof body.customMessage === 'string' ? body.customMessage : undefined
  const note = typeof body.note === 'string' ? body.note : undefined
  const creditExisting = !(body.creditExisting === false || body.creditExisting === 'false' || body.creditExisting === 0 || body.creditExisting === '0')
  const fromAddress = typeof body.fromAddress === 'string' ? body.fromAddress : undefined
  const asReferral = !(body.asReferral === false || body.asReferral === 'false' || body.asReferral === 0 || body.asReferral === '0')
  const loginUrl = `${appUrl}/login`
  const results: InviteResultItem[] = []
  
  // Stagger emails to avoid spam filter triggers (250ms between sends for bulk)
  const shouldStagger = recipients.length > 5
  const staggerDelayMs = shouldStagger ? 250 : 0
  
  for (let idx = 0; idx < recipients.length; idx++) {
    if (shouldStagger && idx > 0) {
      await new Promise(resolve => setTimeout(resolve, staggerDelayMs))
    }
    const item = recipients[idx]
    const email = item.email
    const userAmount = typeof item.amount === 'number' ? item.amount : defaultAmount
    try {
      let user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, name: true, suspended: true, emailVerified: true } })
      let created = false
      let plainPassword: string | null = null
      let referralCode: string | undefined
      if (!user) {
        // Create user WITHOUT password and WITHOUT email verification
        // User will set password during signup, and must verify email before trading
        const investmentId = await generateInvestmentId()
        const derivedName = item.name || email.split('@')[0]?.replace(/[._+-]/g, ' ') || 'Investor'
        const name = derivedName.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80) || 'Investor'
        
        // Determine if this is a referral invite (referral bonuses are unlocked, regular invites are locked)
        const isReferralInvite = asReferral
        const invitePrefs = isReferralInvite ? {} : applyBonusLock({}, { amountUsd: userAmount, source: 'invite' })
        
        user = await prisma.user.create({
          data: { email, name, passwordHash: '', role: 'user', investmentId, emailVerified: false, emailVerifiedAt: null, prefs: JSON.stringify(invitePrefs) },
          select: { id: true, email: true, name: true, suspended: true, emailVerified: true },
        })
        created = true
        try {
          await prisma.userAdminAssignment.upsert({
            where: { userId_adminId: { userId: user.id, adminId } },
            create: { userId: user.id, adminId, assignedBy: adminId },
            update: {},
          })
        } catch {
          try { await prisma.userAdminAssignment.create({ data: { userId: user.id, adminId, assignedBy: adminId } }) } catch (e) { console.warn('[invites] assignment failed', e) }
        }
      } else if (user.suspended) {
        results.push({ email, name: user.name, status: 'skipped', userId: user.id, error: 'User is suspended' })
        continue
      } else if (!creditExisting && userAmount > 0) {
        results.push({ email, name: user.name, status: 'skipped', userId: user.id, error: 'User already exists' })
        continue
      }
      if (asReferral && created) {
        try {
          const adminUser = await prisma.user.findUnique({ where: { id: adminId }, select: { id: true, referralCode: true } })
          referralCode = adminUser?.referralCode || undefined
          if (!referralCode) {
            referralCode = await generateReferralCode()
            await prisma.user.update({ where: { id: adminId }, data: { referralCode } })
          }
          await prisma.user.update({ where: { id: user.id }, data: { referrerId: adminId } }).catch(() => {})
          await linkReferrer(user.id, email, referralCode)
        } catch (e) {
          console.warn('[invites] referral link failed', e)
        }
      }
      if (userAmount > 0) {
        const idem = `admin_invite:${user.id}:${userAmount}:${currency}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`
        const isReferral = asReferral && created
        const lockRef = `admin_invite_lock:${user.id}:${idem}`
        await prisma.$transaction(async (tx) => {
          await recordLedgerTransaction({
            tx, userId: user!.id, asset: currency, amount: userAmount, entryType: 'credit', kind: 'deposit',
            eventType: 'admin_invite_credit', sourceType: 'admin_invite', sourceId: idem, externalRef: idem,
            idempotencyKey: idem,
            description: isReferral ? `Referral bonus ${formatCurrencyAmount(userAmount, currency)}` : `Invitation credit of ${formatCurrencyAmount(userAmount, currency)} (locked)`,
            reference: note?.trim() || 'Invitation credit', subType: 'invite', recordTransaction: true, createdBy: adminId,
            metadata: { type: 'admin_invite', locked: !isReferral, isReferral, amountUsd: currency === 'USD' ? userAmount : undefined },
          })
          
          // Lock invite credits (but NOT referral bonuses - those are always unlocked)
          if (!isReferral) {
            await recordLedgerBalanceReservation({
              tx,
              userId: user!.id,
              asset: currency,
              amount: userAmount,
              action: 'lock',
              kind: 'invite_lock',
              eventType: 'invite_lock',
              sourceType: 'admin_invite_lock',
              sourceId: idem,
              externalRef: lockRef,
              idempotencyKey: lockRef,
              description: `Lock invitation credit ${formatCurrencyAmount(userAmount, currency)}`,
              metadata: { type: 'invite_lock', amountUsd: currency === 'USD' ? userAmount : undefined },
              createdBy: adminId,
              reference: `Lock invitation credit`,
            })
          }
        })
      }
      const amountLabel = formatCurrencyAmount(userAmount, currency)
      const subject = customSubject ? customSubject : userAmount > 0 ? `You're invited to Verdexis — ${amountLabel} credited` : `You're invited to join Verdexis`
      
      // Generate magic link token
      let inviteSignupUrl = `${appUrl}/login` // fallback to login if token generation fails
      try {
        const { token } = await generateInviteToken({
          email,
          amountUsd: userAmount,
          isReferral: asReferral && created,
          adminId,
        })
        inviteSignupUrl = getInviteSignupUrl(token, appUrl)
        console.log('[invites] generated token for', email, 'url:', inviteSignupUrl.slice(0, 50) + '...')
      } catch (err) {
        console.error('[invites] failed to generate token for', email, err)
      }
      
      const plainTextLines = [`Hello${user.name ? ` ${user.name}` : ''},`, '']
      if (customMessage?.trim()) plainTextLines.push(customMessage.trim(), '')
      else {
        const companyName = companyInfo.name || 'Verdexis'
        for (const paragraph of buildAutoInviteParagraphs({ hasCredit: userAmount > 0, amountLabel, companyName })) {
          plainTextLines.push(paragraph, '')
        }
      }
      plainTextLines.push(`Signup link: ${inviteSignupUrl}`)
      if (asReferral && referralCode) {
        plainTextLines.push(`Referral code: ${referralCode}`)
        plainTextLines.push(`Referral link: ${loginUrl}?ref=${encodeURIComponent(referralCode)}`)
      }
      plainTextLines.push(`Email: ${email}`)
      if (note?.trim()) { plainTextLines.push(''); plainTextLines.push(`Note: ${note.trim()}`) }
      plainTextLines.push('')
      plainTextLines.push(buildAutoInviteSignOff(companyInfo.name || 'Verdexis'))
      const textBody = plainTextLines.join('\n')
      const html = buildInviteEmailHtml({ recipientName: user.name, recipientEmail: email, amountLabel, amount: userAmount, currency, loginUrl: inviteSignupUrl, note, customMessage })
      let emailSent = false
      try {
        emailSent = await sendViaConfiguredSmtp(email, subject, textBody, html, fromAddress)
        if (!emailSent) emailSent = await emailService.send({ to: email, subject, html, text: textBody, userId: user.id, kind: 'invite', title: subject, createWebNotification: true })
        if (!emailSent) {
          emailSent = await sendEmailNotification(email, subject, textBody, html, {
            userId: user.id, kind: 'invite', title: subject,
            body: userAmount > 0 ? `Invitation credit of ${amountLabel}` : 'Invitation to Verdexis',
            createWebNotification: true,
          })
        }
      } catch (e) {
        console.warn('[invites] email delivery failed for', email, e)
      }
      try {
        await prisma.adminAudit.create({
          data: {
            actorId: adminId,
            action: created ? (userAmount > 0 ? 'invite.create_credit' : 'invite.create') : 'invite.credit',
            targetUserId: user.id,
            payload: JSON.stringify({ email, name: user.name, amount: userAmount, currency, emailSent, fromAddress, asReferral, referralCode, note: note?.slice(0, 200) }).slice(0, 4000),
          },
        })
      } catch { /* ignore audit errors */ }
      results.push({ email, name: user.name, status: created ? 'created' : 'credited', userId: user.id, amount: userAmount, currency, emailSent })
    } catch (e) {
      console.error('[invites] failed for', email, e)
      results.push({ email, name: item.name, status: 'failed', error: e instanceof Error ? e.message : 'Invite failed' })
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
      amountPerInvite: defaultAmount,
      currency,
    },
    results,
  })
})

export default router
// Force rebuild - invite link fix
