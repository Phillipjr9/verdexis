import { Router } from 'express'
import { authenticateToken } from '../auth.js'
import { prisma } from '../db.js'
import type { Request } from 'express'

interface AuthRequest extends Request {
  user?: { id: string }
}

const router = Router()

// List user's passkeys
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const passkeys = await prisma.passkey.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        credentialId: true,
        deviceName: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const formatted = passkeys.map((pk) => ({
      id: pk.id,
      deviceName: pk.deviceName || 'Unnamed device',
      lastUsed: pk.lastUsedAt ? new Date(pk.lastUsedAt).toLocaleDateString() : 'Never',
      createdAt: new Date(pk.createdAt).toLocaleDateString(),
    }))

    res.json({ passkeys: formatted })
  } catch (err) {
    console.error('[passkeys] list error:', err)
    res.status(500).json({ error: 'Failed to load passkeys' })
  }
})

// Start passkey registration (generate challenge)
router.post('/register/options', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // WebAuthn registration would generate a challenge here
    // For now, return a placeholder response
    res.json({
      success: false,
      error: 'Passkey registration will be available in the next update',
    })
  } catch (err) {
    console.error('[passkeys] register options error:', err)
    res.status(500).json({ error: 'Failed to start registration' })
  }
})

// Complete passkey registration (verify credential)
router.post('/register/verify', authenticateToken, async (req: AuthRequest, res) => {
  try {
    res.json({
      success: false,
      error: 'Passkey registration will be available in the next update',
    })
  } catch (err) {
    console.error('[passkeys] register verify error:', err)
    res.status(500).json({ error: 'Failed to complete registration' })
  }
})

// Start passkey authentication (generate challenge)
router.post('/auth/options', async (req, res) => {
  try {
    res.json({
      success: false,
      error: 'Passkey authentication will be available in the next update',
    })
  } catch (err) {
    console.error('[passkeys] auth options error:', err)
    res.status(500).json({ error: 'Failed to start authentication' })
  }
})

// Complete passkey authentication (verify assertion)
router.post('/auth/verify', async (req, res) => {
  try {
    res.json({
      success: false,
      error: 'Passkey authentication will be available in the next update',
    })
  } catch (err) {
    console.error('[passkeys] auth verify error:', err)
    res.status(500).json({ error: 'Failed to complete authentication' })
  }
})

// Remove a passkey
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    const passkey = await prisma.passkey.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!passkey) {
      return res.status(404).json({ error: 'Passkey not found' })
    }

    if (passkey.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    await prisma.passkey.delete({ where: { id } })

    res.json({ success: true })
  } catch (err) {
    console.error('[passkeys] delete error:', err)
    res.status(500).json({ error: 'Failed to remove passkey' })
  }
})

export default router
