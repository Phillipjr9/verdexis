import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'

const router = Router()

function normalizeAddress(raw: unknown): string {
  return String(raw || '').trim().toLowerCase()
}

async function upsertLink(userId: string, body: Record<string, unknown>) {
  const address = normalizeAddress(body.address)
  if (address.length < 8 || address.length > 100) {
    throw Object.assign(new Error('Enter a valid wallet address'), { status: 400 })
  }
  const chainId = body.chainId != null ? String(body.chainId).slice(0, 32) : null
  const provider = body.provider != null ? String(body.provider).slice(0, 40) : null
  const label = body.label != null ? String(body.label).slice(0, 100) : null
  const makePrimary = body.isPrimary === true
  if (makePrimary) {
    await prisma.walletLink.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } })
  }
  const existingCount = await prisma.walletLink.count({ where: { userId } })
  return prisma.walletLink.upsert({
    where: { userId_address: { userId, address } },
    create: {
      userId,
      address,
      chainId,
      provider,
      label,
      isPrimary: makePrimary || existingCount === 0,
    },
    update: {
      chainId: chainId ?? undefined,
      provider: provider ?? undefined,
      label: label ?? undefined,
      isPrimary: makePrimary ? true : undefined,
    },
  })
}

router.get('/links', requireAuth, async (req: AuthedRequest, res) => {
  const links = await prisma.walletLink.findMany({
    where: { userId: req.userId! },
    orderBy: [{ isPrimary: 'desc' }, { linkedAt: 'desc' }],
  })
  res.json({ links })
})

router.get('/link', requireAuth, async (req: AuthedRequest, res) => {
  const link = await prisma.walletLink.findFirst({
    where: { userId: req.userId! },
    orderBy: [{ isPrimary: 'desc' }, { linkedAt: 'desc' }],
  })
  res.json({ link })
})

router.post('/link', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const link = await upsertLink(req.userId!, (req.body ?? {}) as Record<string, unknown>)
    res.status(201).json({ link })
  } catch (e) {
    const status = typeof e === 'object' && e && 'status' in e ? Number((e as { status?: number }).status) : 500
    res.status(status || 500).json({ error: (e as Error).message || 'Failed to link wallet' })
  }
})

router.post('/links', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const link = await upsertLink(req.userId!, (req.body ?? {}) as Record<string, unknown>)
    res.status(201).json({ link })
  } catch (e) {
    const status = typeof e === 'object' && e && 'status' in e ? Number((e as { status?: number }).status) : 500
    res.status(status || 500).json({ error: (e as Error).message || 'Failed to link wallet' })
  }
})

router.delete('/link', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const target =
    (await prisma.walletLink.findFirst({ where: { userId, isPrimary: true } })) ||
    (await prisma.walletLink.findFirst({ where: { userId }, orderBy: { linkedAt: 'desc' } }))
  if (!target) {
    res.status(404).json({ error: 'No linked wallet' })
    return
  }
  await prisma.walletLink.delete({ where: { id: target.id } })
  res.json({ ok: true, id: target.id })
})

router.delete('/links/:id', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const existing = await prisma.walletLink.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) {
    res.status(404).json({ error: 'Wallet link not found' })
    return
  }
  await prisma.walletLink.delete({ where: { id: existing.id } })
  if (existing.isPrimary) {
    const next = await prisma.walletLink.findFirst({ where: { userId }, orderBy: { linkedAt: 'desc' } })
    if (next) await prisma.walletLink.update({ where: { id: next.id }, data: { isPrimary: true } })
  }
  res.json({ ok: true })
})

router.post('/links/:id/primary', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!
  const existing = await prisma.walletLink.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) {
    res.status(404).json({ error: 'Wallet link not found' })
    return
  }
  await prisma.walletLink.updateMany({ where: { userId, isPrimary: true }, data: { isPrimary: false } })
  const link = await prisma.walletLink.update({ where: { id: existing.id }, data: { isPrimary: true } })
  res.json({ link })
})

export default router
