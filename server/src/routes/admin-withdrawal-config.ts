import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireAdmin, type AuthedRequest } from '../auth.js'

const router = Router()

// Require authenticated admin for all routes in this file
router.use(requireAuth)
router.use(requireAdmin)

// Schema for admin configuring ACH for a user
const setUserAchSchema = z.object({
  bankAccountId: z.string().optional(), // ID of a system bank account
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

// ADMIN ONLY: Set ACH withdrawal destination for a user
router.post('/admin/users/:userId/withdrawal-ach', requireAdmin, async (req: AuthedRequest, res) => {
  const { userId } = req.params
  const parsed = setUserAchSchema.safeParse(req.body)
  
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
    return
  }

  try {
    // Store in user prefs
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    let prefs: Record<string, unknown> = {}
    try { if (user.prefs) prefs = JSON.parse(user.prefs) } catch { prefs = {} }
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

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) },
    })

    res.json({ 
      ok: true,
      message: 'ACH withdrawal configured for user',
      preview: {
        institution: parsed.data.institution,
        accountMask: parsed.data.accountMask,
      }
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
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    let prefs: Record<string, unknown> = {}
    try { if (user.prefs) prefs = JSON.parse(user.prefs) } catch { prefs = {} }
    prefs.withdrawalWire = {
      ...parsed.data,
      configuredAt: new Date().toISOString(),
      configuredBy: req.userId ?? '',
    }

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) },
    })

    res.json({ 
      ok: true,
      message: 'Wire withdrawal configured for user',
      preview: {
        beneficiaryName: parsed.data.beneficiaryName,
        bankName: parsed.data.bankName,
      }
    })
  } catch (error) {
    console.error('Failed to set user wire:', error)
    res.status(500).json({ error: 'Failed to configure wire withdrawal' })
  }
})

// ADMIN ONLY: Remove ACH withdrawal option for a user
router.delete('/admin/users/:userId/withdrawal-ach', requireAdmin, async (req: AuthedRequest, res) => {
  const { userId } = req.params

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    let prefs: Record<string, unknown> = {}
    try { if (user.prefs) prefs = JSON.parse(user.prefs) } catch { prefs = {} }
    delete (prefs as { withdrawalAch?: unknown }).withdrawalAch

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) },
    })

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
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    let prefs: Record<string, unknown> = {}
    try { if (user.prefs) prefs = JSON.parse(user.prefs) } catch { prefs = {} }
    delete (prefs as { withdrawalWire?: unknown }).withdrawalWire

    await prisma.user.update({
      where: { id: userId },
      data: { prefs: JSON.stringify(prefs) },
    })

    res.json({ ok: true, message: 'Wire withdrawal removed for user' })
  } catch (error) {
    console.error('Failed to remove user wire:', error)
    res.status(500).json({ error: 'Failed to remove wire withdrawal' })
  }
})

// USER: Get available withdrawal options (READ-ONLY)
router.get('/withdrawal-options', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: req.userId ?? '' } 
    })
    
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    let prefs: Record<string, unknown> = {}
    try { if (user.prefs) prefs = JSON.parse(user.prefs) } catch { prefs = {} }
    const ach = prefs.withdrawalAch as Record<string, unknown> | undefined
    const wire = prefs.withdrawalWire as Record<string, unknown> | undefined

    const mask = (s?: string | null) => {
      if (!s) return undefined
      const clean = String(s).replace(/\s+/g, '')
      if (clean.length <= 4) return `****${clean}`
      return `****${clean.slice(-4)}`
    }

    // Get crypto addresses from userWallets or depositInstructions
    // For now, assume crypto is always available if admin configured addresses
    const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'USDC', 'SOL'] // Example

    res.json({
      crypto: {
        enabled: true, // Can be controlled by admin
        currencies: cryptoCurrencies,
      },
      ach: {
        enabled: !!ach,
        account: ach ? {
          bankName: ach.bankName as string,
          accountMask: ach.accountMask as string,
          institution: ach.institution as string,
          verified: ach.verified as boolean,
        } : undefined,
      },
      wire: {
        enabled: !!wire,
        details: wire ? {
          beneficiaryName: wire.beneficiaryName as string,
          bankName: wire.bankName as string,
          // Mask full account and routing numbers for security. Frontend may
          // show the masked value and instruct users to contact support for full details.
          accountMask: mask(wire.accountNumber as string | undefined) as string | undefined,
          routingMask: mask(wire.routingNumber as string | undefined) as string | undefined,
          swiftCode: wire.swiftCode as string | undefined,
          reference: wire.reference as string | undefined,
        } : undefined,
      },
    })
  } catch (error) {
    console.error('Failed to get withdrawal options:', error)
    res.status(500).json({ error: 'Failed to load withdrawal options' })
  }
})

export default router
