import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()

// NOTE: Do not put global requireAuth/requireAdmin here.
// This router is mounted at /api; global auth would 401 every unmatched /api/* path
// (e.g. /api/health/email). Auth is applied per-route below.

// Schema for admin configuring ACH for a user
const setUserAchSchema = z.object({
  bankAccountId: z.string().optional(),
  bankName: z.string().min(1),
  institution: z.string().min(1),
  accountNumber: z.string().min(4),
  routingNumber: z.string().length(9),
  accountMask: z.string().length(4),
  verified: z.boolean().default(false),
})

// Schema for admin configuring wire for a user
const setUserWireSchema = z.object({
  beneficiaryName: z.string().min(1),
  bankName: z.string().min(1),
  accountNumber: z.string().min(4),
  routingNumber: z.string().length(9),
  swiftCode: z.string().optional(),
  iban: z.string().optional(),
  reference: z.string().optional(),
})

// Schema for admin configuring check withdrawals (cashier's check + wire check)
// These are mailed to the user — no deposit of checks, withdrawal only.
const setUserCheckSchema = z.object({
  /** Which check subtypes the user may request */
  types: z
    .array(z.enum(['cashier_check', 'wire_check']))
    .min(1)
    .default(['cashier_check']),
  /** Legal name printed as payee on the check */
  payeeName: z.string().min(1).max(120),
  mailingAddress: z.object({
    line1: z.string().min(1).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(2).max(100).default('US'),
  }),
  notes: z.string().max(500).optional(),
})

async function loadPrefs(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return null
  let prefs: Record<string, unknown> = {}
  try {
    if (user.prefs) prefs = JSON.parse(user.prefs)
  } catch {
    prefs = {}
  }
  return { user, prefs }
}

async function savePrefs(userId: string, prefs: Record<string, unknown>) {
  await prisma.user.update({
    where: { id: userId },
    data: { prefs: JSON.stringify(prefs) },
  })
}

// ADMIN ONLY: Set ACH withdrawal destination for a user
router.post('/admin/users/:userId/withdrawal-ach', requireAdmin, async (req: AuthedRequest, res) => {
  const { userId } = req.params
  const parsed = setUserAchSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const loaded = await loadPrefs(userId)
    if (!loaded) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const { prefs } = loaded
    prefs.withdrawalAch = {
      bankAccountId: parsed.data.bankAccountId,
      bankName: parsed.data.bankName,
      institution: parsed.data.institution,
      accountMask: parsed.data.accountMask,
      routingNumber: parsed.data.routingNumber,
      accountNumber: parsed.data.accountNumber,
      verified: parsed.data.verified,
      configuredAt: new Date().toISOString(),
      configuredBy: req.userId ?? '',
    }
    await savePrefs(userId, prefs)

    res.json({
      ok: true,
      message: 'ACH withdrawal configured for user',
      preview: {
        institution: parsed.data.institution,
        accountMask: parsed.data.accountMask,
      },
    })
  } catch (error) {
    console.error('Failed to set user ACH:', error)
    res.status(500).json({ error: 'Failed to configure ACH withdrawal' })
  }
})

// ADMIN ONLY: Set wire withdrawal destination for a user
router.post('/admin/users/:userId/withdrawal-wire', requireAdmin, async (req: AuthedRequest, res) => {
  const { userId } = req.params
  const parsed = setUserWireSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const loaded = await loadPrefs(userId)
    if (!loaded) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const { prefs } = loaded
    prefs.withdrawalWire = {
      ...parsed.data,
      configuredAt: new Date().toISOString(),
      configuredBy: req.userId ?? '',
    }
    await savePrefs(userId, prefs)

    res.json({
      ok: true,
      message: 'Wire withdrawal configured for user',
      preview: {
        beneficiaryName: parsed.data.beneficiaryName,
        bankName: parsed.data.bankName,
      },
    })
  } catch (error) {
    console.error('Failed to set user wire:', error)
    res.status(500).json({ error: 'Failed to configure wire withdrawal' })
  }
})

// ADMIN ONLY: Set check withdrawal (cashier's check / wire check) — mailed to user
router.post('/admin/users/:userId/withdrawal-check', requireAdmin, async (req: AuthedRequest, res) => {
  const { userId } = req.params
  const parsed = setUserCheckSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    const loaded = await loadPrefs(userId)
    if (!loaded) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const { prefs } = loaded
    prefs.withdrawalCheck = {
      types: parsed.data.types,
      payeeName: parsed.data.payeeName,
      mailingAddress: parsed.data.mailingAddress,
      notes: parsed.data.notes ?? null,
      configuredAt: new Date().toISOString(),
      configuredBy: req.userId ?? '',
    }
    await savePrefs(userId, prefs)

    res.json({
      ok: true,
      message: 'Check withdrawal configured for user',
      preview: {
        payeeName: parsed.data.payeeName,
        types: parsed.data.types,
        city: parsed.data.mailingAddress.city,
        state: parsed.data.mailingAddress.state,
      },
    })
  } catch (error) {
    console.error('Failed to set user check withdrawal:', error)
    res.status(500).json({ error: 'Failed to configure check withdrawal' })
  }
})

// ADMIN ONLY: Remove ACH withdrawal option for a user
router.delete('/admin/users/:userId/withdrawal-ach', requireAdmin, async (req: AuthedRequest, res) => {
  const { userId } = req.params

  try {
    const loaded = await loadPrefs(userId)
    if (!loaded) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const { prefs } = loaded
    delete (prefs as { withdrawalAch?: unknown }).withdrawalAch
    await savePrefs(userId, prefs)

    res.json({ ok: true, message: 'ACH withdrawal removed for user' })
  } catch (error) {
    console.error('Failed to remove user ACH:', error)
    res.status(500).json({ error: 'Failed to remove ACH withdrawal' })
  }
})

// ADMIN ONLY: Remove wire withdrawal option for a user
router.delete('/admin/users/:userId/withdrawal-wire', requireAdmin, async (req: AuthedRequest, res) => {
  const { userId } = req.params

  try {
    const loaded = await loadPrefs(userId)
    if (!loaded) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const { prefs } = loaded
    delete (prefs as { withdrawalWire?: unknown }).withdrawalWire
    await savePrefs(userId, prefs)

    res.json({ ok: true, message: 'Wire withdrawal removed for user' })
  } catch (error) {
    console.error('Failed to remove user wire:', error)
    res.status(500).json({ error: 'Failed to remove wire withdrawal' })
  }
})

// ADMIN ONLY: Remove check withdrawal option for a user
router.delete('/admin/users/:userId/withdrawal-check', requireAdmin, async (req: AuthedRequest, res) => {
  const { userId } = req.params

  try {
    const loaded = await loadPrefs(userId)
    if (!loaded) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    const { prefs } = loaded
    delete (prefs as { withdrawalCheck?: unknown }).withdrawalCheck
    await savePrefs(userId, prefs)

    res.json({ ok: true, message: 'Check withdrawal removed for user' })
  } catch (error) {
    console.error('Failed to remove user check withdrawal:', error)
    res.status(500).json({ error: 'Failed to remove check withdrawal' })
  }
})

// USER: Get available withdrawal options (READ-ONLY)
router.get('/withdrawal-options', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId ?? '' },
    })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    let prefs: Record<string, unknown> = {}
    try {
      if (user.prefs) prefs = JSON.parse(user.prefs)
    } catch {
      prefs = {}
    }
    const ach = prefs.withdrawalAch as Record<string, unknown> | undefined
    const wire = prefs.withdrawalWire as Record<string, unknown> | undefined
    const check = prefs.withdrawalCheck as
      | {
          types?: Array<'cashier_check' | 'wire_check'>
          payeeName?: string
          mailingAddress?: {
            line1?: string
            line2?: string
            city?: string
            state?: string
            postalCode?: string
            country?: string
          }
          notes?: string | null
        }
      | undefined

    const mask = (s?: string | null) => {
      if (!s) return undefined
      const clean = String(s).replace(/\s+/g, '')
      if (clean.length <= 4) return `****${clean}`
      return `****${clean.slice(-4)}`
    }

    const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL']

    res.json({
      crypto: {
        enabled: true,
        currencies: cryptoCurrencies,
      },
      ach: {
        enabled: !!ach,
        account: ach
          ? {
              bankName: ach.bankName as string,
              accountMask: ach.accountMask as string,
              institution: ach.institution as string,
              verified: ach.verified as boolean,
            }
          : undefined,
      },
      wire: {
        enabled: !!wire,
        details: wire
          ? {
              beneficiaryName: wire.beneficiaryName as string,
              bankName: wire.bankName as string,
              accountMask: mask(wire.accountNumber as string | undefined) as string | undefined,
              routingMask: mask(wire.routingNumber as string | undefined) as string | undefined,
              swiftCode: wire.swiftCode as string | undefined,
              reference: wire.reference as string | undefined,
            }
          : undefined,
      },
      check: {
        enabled: !!check && Array.isArray(check.types) && check.types.length > 0,
        types: check?.types ?? [],
        details: check
          ? {
              payeeName: check.payeeName ?? '',
              mailingAddress: check.mailingAddress
                ? {
                    line1: check.mailingAddress.line1 ?? '',
                    line2: check.mailingAddress.line2,
                    city: check.mailingAddress.city ?? '',
                    state: check.mailingAddress.state ?? '',
                    postalCode: check.mailingAddress.postalCode ?? '',
                    country: check.mailingAddress.country ?? 'US',
                  }
                : undefined,
              notes: check.notes ?? undefined,
            }
          : undefined,
      },
    })
  } catch (error) {
    console.error('Failed to get withdrawal options:', error)
    res.status(500).json({ error: 'Failed to load withdrawal options' })
  }
})

export default router
