import { Router } from 'express'
import { prisma } from '../db.js'
import type { AuthedRequest } from '../auth.js'

const router: Router = Router()

router.get('/users/:id/deposit-addresses', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, prefs: true },
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
  const addresses = (prefs as { depositAddresses?: unknown }).depositAddresses ?? null
  res.json({ addresses })
})

router.put('/users/:id/deposit-addresses', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, prefs: true },
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
  prefs.depositAddresses = req.body ?? { cryptos: {} }
  await prisma.user.update({
    where: { id: user.id },
    data: { prefs: JSON.stringify(prefs) },
  })
  res.json({ ok: true, addresses: prefs.depositAddresses })
})

router.delete('/users/:id/deposit-addresses', async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, prefs: true },
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
  delete prefs.depositAddresses
  await prisma.user.update({
    where: { id: user.id },
    data: { prefs: JSON.stringify(prefs) },
  })
  res.json({ ok: true })
})

export default router
