import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'
import { recordLedgerTransaction } from '../services/ledger.js'
import { sendEmailNotification } from '../notificationService.js'
import { appUrl, customerEmailName } from '../config/email.js'
import { companyInfo } from '../config/company.js'
import { generateInvestmentId } from '../investmentId.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Matches an email embedded inside a larger token, e.g. `Jane Doe <jane@x.com>,`
const LOOSE_EMAIL_RE = /[^\s@<>()[\]"',;]+@[^\s@<>()[\]"',;]+\.[^\s@<>()[\]"',;]+/

export interface ParsedInviteRecipient {
  email: string
  name?: string
  amount?: number
}

/**
 * Coerce an amount that may arrive as a number, a numeric string, or a
 * formatted currency string ("1,000.00", "$500"). Returns undefined when the
 * value cannot be interpreted as a finite number.
 */
export function coerceAmountValue(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[$€£¥\s,_]/g, '')
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
      amount:
        typeof amountNum === 'number' && Number.isFinite(amountNum) && amountNum >= 0 && amountNum <= 1_000_000_000
          ? amountNum
          : undefined,
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

    // Mail-client paste format: `Full Name <user@example.com>` — a line can
    // hold several such entries separated by `;` or `,`.
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
        // CSV row: `email, [name], [amount]`
        const rest = cols.slice(1)
        const amount = rest.map(coerceAmountValue).find((v): v is number => typeof v === 'number')
        const name = rest.find((c) => !extractEmail(c) && coerceAmountValue(c) === undefined)
        addOne(emails[0], name, amount)
        return
      }
      // Otherwise treat every column containing an email as its own recipient,
      // e.g. `a@x.com,b@x.com;c@x.com` no longer drops all but the first.
      for (const col of cols) {
        const email = extractEmail(col)
        if (email) addOne(email)
      }
      return
    }

    // Whitespace / newline separated list — every email-like token counts.
    for (const token of trimmed.split(/\s+/)) {
      const email = extractEmail(token)
      if (email) addOne(email)
    }
  }

  const parseObjectEntry = (obj: Record<string, unknown>) => {
    if (typeof obj.email === 'string') {
      addOne(obj.email, typeof obj.name === 'string' ? obj.name : undefined, coerceAmountValue(obj.amount))
    }
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        item.split(/[\r\n]+/).forEach(parseLine)
      } else if (item && typeof item === 'object') {
        parseObjectEntry(item as Record<string, unknown>)
      }
    }
  } else if (typeof raw === 'string') {
    raw.split(/[\r\n]+/).forEach(parseLine)
  } else if (raw && typeof raw === 'object') {
    // Single `{ email, name?, amount? }` object — previously rejected outright.
    parseObjectEntry(raw as Record<string, unknown>)
  }

  return recipients
}

function formatCurrencyAmount(amount: number, currency: string): string {
  if (currency === 'USD') {
    return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
  }
  if (['EUR', 'GBP', 'CAD', 'AUD', 'JPY'].includes(currency)) {
    try {
      return amount.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2 })
    } catch {
      return `${amount.toLocaleString('en-US')} ${currency}`
    }
  }
  return `${amount} ${currency}`
}

function generateSecureTempPassword(): string {
  // Generate 12-character alphanumeric temporary password with symbols
  const bytes = crypto.randomBytes(9).toString('base64url').slice(0, 10)
  return `${bytes}!9A`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Fully composed welcome message used when the admin leaves the message field
 * blank — covers the invitation, any credited balance, and sign-in steps so an
 * invite can be dispatched with zero typing. The greeting and sign-off are
 * excluded (they are rendered separately per channel).
 */
export function buildAutoInviteParagraphs(opts: {
  hasCredit: boolean
  amountLabel: string
  hasTempPassword: boolean
  companyName: string
}): string[] {
  const { hasCredit, amountLabel, hasTempPassword, companyName } = opts
  const paragraphs = [
    `You have been personally invited to join ${companyName} — institutional-grade portfolio management and trading. Your account has already been created for you, so there is nothing extra to set up.`,
  ]
  if (hasCredit) {
    paragraphs.push(
      `To get you started, your new wallet has been credited with ${amountLabel}. The balance is available the moment you sign in — no waiting period and no extra steps required.`,
    )
  }
  paragraphs.push(
    hasTempPassword
      ? 'Getting started takes less than a minute: sign in with your email and the temporary password shown below, then update your password from your security settings. If you ever need a hand, simply reply to this email — our team is happy to help.'
      : 'Getting started takes less than a minute: sign in with your existing credentials and head to your dashboard to explore the platform. If you ever need a hand, simply reply to this email — our team is happy to help.',
  )
  return paragraphs
}

/** Branded closing line shown at the very end of every invite (after credentials/notes). */
export function buildAutoInviteSignOff(companyName: string): string {
  return `Welcome aboard,\nThe ${companyName} Team`
}

function buildInviteEmailHtml(opts: {
  recipientName: string
  recipientEmail: string
  amountLabel: string
  amount: number
  currency: string
  loginUrl: string
  plainPassword?: string | null
  note?: string | null
  customMessage?: string | null
}): string {
  const {
    recipientName,
    recipientEmail,
    amountLabel,
    amount,
    currency,
    loginUrl,
    plainPassword,
    note,
    customMessage,
  } = opts

  const hasCredit = amount > 0
  const companyName = companyInfo.name || 'Verdexis'
  const autoParagraphs = buildAutoInviteParagraphs({
    hasCredit,
    amountLabel,
    hasTempPassword: Boolean(plainPassword),
    companyName,
  })
  const messageBlock = customMessage?.trim()
    ? `<div class="custom-msg">${escapeHtml(customMessage.trim()).replace(/\n/g, '<br/>')}</div>`
    : autoParagraphs
        .map(
          (p) =>
            `<p style="font-size: 14px; color: #A0A0A0; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`,
        )
        .join('\n      ')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to ${companyName}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #070C0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #E5E5E5; }
    .email-container { max-width: 580px; margin: 24px auto; background-color: #0f1619; border: 1px solid #ffffff15; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(180deg, rgba(12, 139, 68, 0.25) 0%, rgba(15, 22, 25, 0) 100%); padding: 32px 28px 20px; text-align: center; border-bottom: 1px solid #ffffff0a; }
    .logo-badge { display: inline-block; background-color: #0C8B44; color: #ffffff; font-weight: 700; font-size: 16px; letter-spacing: 2px; padding: 6px 14px; border-radius: 8px; margin-bottom: 16px; text-transform: uppercase; }
    .header-title { color: #FFFFFF; font-size: 24px; font-weight: 600; margin: 0 0 6px; }
    .header-sub { color: #A0A0A0; font-size: 14px; margin: 0; }
    .content { padding: 28px; }
    .greeting { font-size: 16px; color: #E5E5E5; margin: 0 0 16px; }
    .custom-msg { background-color: #070C0E; border-left: 3px solid #0C8B44; padding: 14px 16px; border-radius: 0 10px 10px 0; color: #D1D5DB; font-size: 14px; line-height: 1.5; margin: 0 0 20px; }
    .credit-box { background: linear-gradient(135deg, rgba(12, 139, 68, 0.15) 0%, rgba(7, 12, 14, 0.6) 100%); border: 1px solid rgba(12, 139, 68, 0.4); border-radius: 14px; padding: 20px; text-align: center; margin: 20px 0; }
    .credit-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #A0A0A0; margin: 0 0 6px; }
    .credit-amount { font-size: 32px; font-weight: 700; color: #00E676; margin: 0 0 6px; }
    .credit-desc { font-size: 13px; color: #9CA3AF; margin: 0; }
    .creds-card { background-color: #070C0E; border: 1px solid #ffffff10; border-radius: 12px; padding: 16px 20px; margin: 24px 0; }
    .creds-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; font-size: 13px; border-bottom: 1px solid #ffffff08; }
    .creds-row:last-child { border-bottom: none; }
    .creds-label { color: #737373; font-weight: 500; }
    .creds-val { color: #E5E5E5; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 600; }
    .btn-container { text-align: center; margin: 28px 0 20px; }
    .btn { display: inline-block; background-color: #0C8B44; color: #FFFFFF !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; letter-spacing: 0.3px; }
    .security-note { font-size: 12px; color: #737373; text-align: center; line-height: 1.5; margin: 0 0 24px; }
    .footer { background-color: #070C0E; border-top: 1px solid #ffffff0a; padding: 20px 28px; text-align: center; font-size: 12px; color: #525252; }
    .footer a { color: #0C8B44; text-decoration: none; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="logo-badge">${companyName}</div>
      <h1 class="header-title">You're Invited</h1>
      <p class="header-sub">Exclusive access to institutional-grade portfolio management</p>
    </div>

    <div class="content">
      <p class="greeting">Hello ${escapeHtml(recipientName || 'there')},</p>

      ${messageBlock}

      ${hasCredit ? `
      <div class="credit-box">
        <div class="credit-label">Welcome Credit Available</div>
        <div class="credit-amount">${amountLabel}</div>
        <div class="credit-desc">This balance has been credited to your wallet and is ready to use immediately upon sign in.</div>
      </div>` : ''}

      <div class="creds-card">
        <div class="creds-row">
          <span class="creds-label">Sign-in Email:</span>
          <span class="creds-val">${recipientEmail}</span>
        </div>
        ${plainPassword ? `
        <div class="creds-row">
          <span class="creds-label">Temporary Password:</span>
          <span class="creds-val" style="background-color: #1a1a1a; padding: 2px 8px; border-radius: 6px; color: #00E676;">${plainPassword}</span>
        </div>` : `
        <div class="creds-row">
          <span class="creds-label">Account Status:</span>
          <span class="creds-val" style="color: #00E676;">Active — Use Existing Password</span>
        </div>`}
      </div>

      <div class="btn-container">
        <a href="${loginUrl}" class="btn" target="_blank" rel="noopener">Access Your Account →</a>
      </div>

      <p class="security-note">
        ${plainPassword ? 'For your security, you will be prompted or advised to update your password after logging in for the first time.' : 'If you forgot your password, you can reset it directly from the sign-in page.'}
      </p>

      ${note?.trim() ? `
      <div style="font-size: 12px; color: #737373; border-top: 1px solid #ffffff0a; padding-top: 14px; margin-top: 14px;">
        <strong>Admin Note:</strong> ${escapeHtml(note.trim())}
      </div>` : ''}

      <p style="font-size: 14px; color: #A0A0A0; line-height: 1.6; margin: 20px 0 0;">
        ${escapeHtml(buildAutoInviteSignOff(companyName)).replace(/\n/g, '<br/>')}
      </p>
    </div>

    <div class="footer">
      <div>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</div>
      <div style="margin-top: 6px;">
        Institutional Portfolio Management & Trading Infrastructure
      </div>
    </div>
  </div>
</body>
</html>
`.trim()
}

const inviteSchema = z.object({
  // Accept a raw string, a single `{ email, name?, amount? }` object, or an
  // array of either — previously a bare object was rejected as "Invalid input".
  emails: z.union([
    z.string().min(3),
    z.record(z.unknown()),
    z.array(z.union([z.string().min(3), z.record(z.unknown())])),
  ]),
  // Accept numbers, plain numeric strings and formatted amounts like "1,000.00".
  amount: z.preprocess(
    (v) => coerceAmountValue(v) ?? (v == null || v === '' ? 0 : v),
    z.number().finite().min(0).max(1_000_000_000).optional().default(0),
  ),
  // Tolerate an empty/blank currency instead of failing validation.
  currency: z
    .string()
    .max(10)
    .default('USD')
    .transform((s) => s.trim().toUpperCase() || 'USD'),
  subject: z.coerce.string().max(200).optional(),
  customMessage: z.coerce.string().max(2000).optional(),
  note: z.coerce.string().max(1000).optional(),
  creditExisting: z.boolean().default(true),
})

/** Human-readable summary of the first validation issue, e.g. "Invalid input: emails — Required". */
function invalidInputMessage(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid input'
  const path = issue.path.join('.')
  return path ? `Invalid input: ${path} — ${issue.message}` : `Invalid input: ${issue.message}`
}

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

/**
 * POST /api/admin/invites/preview
 * Returns a rendered email preview without sending or modifying data.
 */
router.post('/invites/preview', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = inviteSchema.safeParse({
    emails: req.body?.emails || 'investor@example.com',
    amount: req.body?.amount ?? 1000,
    currency: req.body?.currency ?? 'USD',
    subject: req.body?.subject,
    customMessage: req.body?.customMessage,
    note: req.body?.note,
    creditExisting: req.body?.creditExisting !== false,
  })

  const amount = parsed.success ? parsed.data.amount : 1000
  const currency = parsed.success ? parsed.data.currency : 'USD'
  const customMessage = parsed.success ? parsed.data.customMessage : undefined
  const note = parsed.success ? parsed.data.note : undefined
  const sampleEmail = 'investor@example.com'
  const sampleName = 'Alex Mercer'
  const samplePassword = 'VDX-Invite9!a'
  const amountLabel = formatCurrencyAmount(amount, currency)
  const defaultSubject = amount > 0
    ? `You're invited to Verdexis — ${amountLabel} credited`
    : `You're invited to join Verdexis`
  const subject = parsed.success && parsed.data.subject ? parsed.data.subject : defaultSubject
  const loginUrl = `${appUrl}/login`

  const companyName = companyInfo.name || 'Verdexis'
  const autoMessage = customMessage?.trim()
    ? null
    : [
        ...buildAutoInviteParagraphs({
          hasCredit: amount > 0,
          amountLabel,
          hasTempPassword: true,
          companyName,
        }),
        buildAutoInviteSignOff(companyName),
      ].join('\n\n')

  const html = buildInviteEmailHtml({
    recipientName: sampleName,
    recipientEmail: sampleEmail,
    amountLabel,
    amount,
    currency,
    loginUrl,
    plainPassword: samplePassword,
    note,
    customMessage,
  })

  res.json({
    ok: true,
    subject,
    html,
    // Complete auto-generated welcome message shown to invitees when no custom
    // message is provided (null when a custom message is set).
    autoMessage,
    sample: {
      email: sampleEmail,
      name: sampleName,
      amount,
      currency,
      amountLabel,
      tempPassword: samplePassword,
    },
  })
})

/**
 * GET /api/admin/invites/history
 * Returns recent invitation audit entries.
 */
router.post('/invites/history', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const audits = await prisma.adminAudit.findMany({
      where: {
        action: { in: ['invite.create_credit', 'invite.credit', 'invite.batch', 'invite.create'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actor: { select: { id: true, email: true, name: true } },
        targetUser: { select: { id: true, email: true, name: true } },
      },
    })

    const history = audits.map((a) => {
      let payloadObj: Record<string, unknown> = {}
      try {
        if (a.payload) payloadObj = JSON.parse(a.payload)
      } catch {
        payloadObj = { raw: a.payload }
      }
      return {
        id: a.id,
        action: a.action,
        createdAt: a.createdAt,
        actor: a.actor,
        targetUser: a.targetUser,
        details: payloadObj,
      }
    })

    res.json({ ok: true, history })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invite history', details: err instanceof Error ? err.message : String(err) })
  }
})

// Also support GET for history
router.get('/invites/history', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const audits = await prisma.adminAudit.findMany({
      where: {
        action: { in: ['invite.create_credit', 'invite.credit', 'invite.batch', 'invite.create'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        actor: { select: { id: true, email: true, name: true } },
        targetUser: { select: { id: true, email: true, name: true } },
      },
    })

    const history = audits.map((a) => {
      let payloadObj: Record<string, unknown> = {}
      try {
        if (a.payload) payloadObj = JSON.parse(a.payload)
      } catch {
        payloadObj = { raw: a.payload }
      }
      return {
        id: a.id,
        action: a.action,
        createdAt: a.createdAt,
        actor: a.actor,
        targetUser: a.targetUser,
        details: payloadObj,
      }
    })

    res.json({ ok: true, history })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch invite history', details: err instanceof Error ? err.message : String(err) })
  }
})

/**
 * POST /api/admin/invites
 * Creates accounts if needed, credits balance, emails each invitee with credentials and credited amount.
 */
router.post('/invites', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  const parsed = inviteSchema.safeParse({
    emails: req.body?.emails,
    amount: req.body?.amount,
    currency: req.body?.currency ?? 'USD',
    subject: req.body?.subject,
    customMessage: req.body?.customMessage,
    note: req.body?.note,
    creditExisting: req.body?.creditExisting !== false,
  })

  if (!parsed.success) {
    res.status(400).json({ error: invalidInputMessage(parsed.error), details: parsed.error.flatten() })
    return
  }

  const recipients = parseEmailsAndRecipients(parsed.data.emails)
  if (recipients.length === 0) {
    res.status(400).json({ error: 'Provide at least one valid email address' })
    return
  }
  if (recipients.length > 200) {
    res.status(400).json({ error: 'Maximum 200 emails per batch' })
    return
  }

  const adminId = req.userId!
  const defaultAmount = parsed.data.amount
  const currency = parsed.data.currency
  const customSubject = parsed.data.subject
  const customMessage = parsed.data.customMessage
  const note = parsed.data.note
  const creditExisting = parsed.data.creditExisting
  const loginUrl = `${appUrl}/login`
  const results: InviteResultItem[] = []

  for (const item of recipients) {
    const email = item.email
    const userAmount = typeof item.amount === 'number' ? item.amount : defaultAmount

    try {
      let user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, suspended: true, emailVerified: true },
      })
      let created = false
      let plainPassword: string | null = null

      if (!user) {
        plainPassword = generateSecureTempPassword()
        const passwordHash = await bcrypt.hash(plainPassword, 12)
        const investmentId = await generateInvestmentId()
        const derivedName = item.name || email.split('@')[0]?.replace(/[._+-]/g, ' ') || 'Investor'
        const name = derivedName.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80) || 'Investor'

        // Set emailVerified: true so invited users can log in immediately with their temporary password
        user = await prisma.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: 'user',
            investmentId,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
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
          try {
            await prisma.userAdminAssignment.create({
              data: { userId: user.id, adminId, assignedBy: adminId },
            })
          } catch (e) {
            console.warn('[invites] assignment failed', e)
          }
        }
      } else if (user.suspended) {
        results.push({ email, name: user.name, status: 'skipped', userId: user.id, error: 'User is suspended' })
        continue
      } else if (!creditExisting && userAmount > 0) {
        results.push({ email, name: user.name, status: 'skipped', userId: user.id, error: 'User already exists' })
        continue
      }

      // If credit amount > 0, credit the user balance
      if (userAmount > 0) {
        const idem = `admin_invite:${user.id}:${userAmount}:${currency}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`
        await prisma.$transaction(async (tx) => {
          await recordLedgerTransaction({
            tx,
            userId: user!.id,
            asset: currency,
            amount: userAmount,
            entryType: 'debit',
            kind: 'deposit',
            eventType: 'admin_invite_credit',
            sourceType: 'admin_invite',
            sourceId: idem,
            externalRef: idem,
            idempotencyKey: idem,
            description: note?.trim() || `Invitation credit of ${formatCurrencyAmount(userAmount, currency)}`,
            reference: note?.trim() || 'Invitation credit',
            subType: 'invite',
            recordTransaction: true,
            createdBy: adminId,
          })
        })
      }

      const amountLabel = formatCurrencyAmount(userAmount, currency)
      const subject = customSubject
        ? customSubject
        : userAmount > 0
          ? `You're invited to Verdexis — ${amountLabel} credited`
          : `You're invited to join Verdexis`

      const plainTextLines = [`Hello${user.name ? ` ${user.name}` : ''},`, '']
      if (customMessage?.trim()) {
        plainTextLines.push(customMessage.trim(), '')
      } else {
        // Complete auto welcome message when the admin leaves the field blank.
        const companyName = companyInfo.name || 'Verdexis'
        for (const paragraph of buildAutoInviteParagraphs({
          hasCredit: userAmount > 0,
          amountLabel,
          hasTempPassword: Boolean(plainPassword),
          companyName,
        })) {
          plainTextLines.push(paragraph, '')
        }
      }
      plainTextLines.push(`Login: ${loginUrl}`)
      plainTextLines.push(`Email: ${email}`)
      if (plainPassword) {
        plainTextLines.push(`Temporary password: ${plainPassword}`)
      }
      if (note?.trim()) {
        plainTextLines.push('')
        plainTextLines.push(`Note: ${note.trim()}`)
      }
      plainTextLines.push('')
      plainTextLines.push(buildAutoInviteSignOff(companyInfo.name || 'Verdexis'))

      const body = plainTextLines.join('\n')
      const html = buildInviteEmailHtml({
        recipientName: user.name,
        recipientEmail: email,
        amountLabel,
        amount: userAmount,
        currency,
        loginUrl,
        plainPassword,
        note,
        customMessage,
      })

      let emailSent = false
      try {
        emailSent = await sendEmailNotification(email, subject, body, html, {
          userId: user.id,
          kind: 'deposit',
          title: subject,
          body: userAmount > 0 ? `Invitation credit of ${amountLabel}` : 'Invitation to Verdexis',
          createWebNotification: true,
        })
      } catch (e) {
        console.warn('[invites] email delivery failed for', email, e)
      }

      try {
        await prisma.adminAudit.create({
          data: {
            actorId: adminId,
            action: created ? (userAmount > 0 ? 'invite.create_credit' : 'invite.create') : 'invite.credit',
            targetUserId: user.id,
            payload: JSON.stringify({
              email,
              name: user.name,
              amount: userAmount,
              currency,
              emailSent,
              note: note?.slice(0, 200),
            }).slice(0, 4000),
          },
        })
      } catch { /* ignore audit errors */ }

      results.push({
        email,
        name: user.name,
        status: created ? 'created' : 'credited',
        userId: user.id,
        amount: userAmount,
        currency,
        emailSent,
        plainPassword: plainPassword || undefined,
      })
    } catch (e) {
      console.error('[invites] failed for', email, e)
      results.push({
        email,
        name: item.name,
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
      amountPerInvite: defaultAmount,
      currency,
    },
    results,
  })
})

export default router
