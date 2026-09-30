import { Router } from 'express'
import { prisma } from '../db.js'
import { validateInviteToken, redeemInviteToken } from '../lib/inviteTokens.js'

const router = Router()

// GET /api/invite/:token - Validate and get invite details
router.get('/invite/:token', async (req, res) => {
  try {
    const { token } = req.params
    const validation = await validateInviteToken(token)

    if (!validation.valid) {
      res.status(400).json({ error: validation.reason || 'Invalid token' })
      return
    }

    const record = validation.record
    res.json({
      ok: true,
      email: record.email,
      amountUsd: record.amount,
      isReferral: record.isReferral,
      expiresAt: record.expiresAt,
      tokenId: record.id,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to validate invite' })
  }
})

// POST /api/invite/:token/redeem - Redeem invite (set password + create account)
router.post('/invite/:token/redeem', async (req, res) => {
  try {
    const { token } = req.params
    const { password, name } = req.body

    if (!password || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }

    const validation = await validateInviteToken(token)
    if (!validation.valid) {
      res.status(400).json({ error: validation.reason || 'Invalid token' })
      return
    }

    const record = validation.record
    const user = await prisma.user.findUnique({ where: { email: record.email } })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    if (user.passwordHash && user.passwordHash.length > 0) {
      res.status(400).json({ error: 'Account already has a password set' })
      return
    }

    // Hash password and update user
    const bcrypt = require('bcryptjs')
    const passwordHash = await bcrypt.hash(password, 12)

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        name: name || user.name,
      },
    })

    // Mark token as redeemed
    await redeemInviteToken(record.id, user.id)

    res.json({
      ok: true,
      message: 'Account set up successfully',
      userId: updated.id,
      email: updated.email,
      name: updated.name,
    })
  } catch (err) {
    console.error('[invite redeem]', err)
    res.status(500).json({ error: 'Failed to redeem invite' })
  }
})

export default router
