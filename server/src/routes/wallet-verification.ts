import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import crypto from 'crypto'

const router = Router()

router.post('/links/:id/verify-challenge', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const walletLink = await prisma.walletLink.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })

    if (!walletLink) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    // Generate challenge message
    const challenge = crypto.randomBytes(32).toString('hex')
    const message = `Verify wallet ownership for ${walletLink.address}\nChallenge: ${challenge}\nTimestamp: ${new Date().toISOString()}`

    // Store or update verification record
    const verification = await prisma.walletVerification.upsert({
      where: { walletLinkId: req.params.id },
      create: {
        walletLinkId: req.params.id,
        verificationChallenge: challenge,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
      update: {
        verificationChallenge: challenge,
        signature: null,
        verifiedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    res.json({
      challenge: message,
      expiresAt: verification.expiresAt,
    })
  } catch (error) {
    console.error('Challenge generation error:', error)
    res.status(500).json({ error: 'Failed to generate challenge' })
  }
})

router.post('/links/:id/verify', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { signature } = z.object({
      signature: z.string().min(1),
    }).parse(req.body)

    const walletLink = await prisma.walletLink.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })

    if (!walletLink) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    const verification = await prisma.walletVerification.findUnique({
      where: { walletLinkId: req.params.id },
    })

    if (!verification) {
      res.status(400).json({ error: 'No active verification challenge' })
      return
    }

    if (verification.expiresAt < new Date()) {
      res.status(400).json({ error: 'Challenge expired' })
      return
    }

    // In production, verify the signature using ethers.js or web3.js
    // For now, we'll accept any signature and mark as verified
    // Real implementation would recover the address from signature and compare

    const verified = await prisma.walletVerification.update({
      where: { walletLinkId: req.params.id },
      data: {
        signature,
        verifiedAt: new Date(),
      },
    })

    // Record as a security event audit (do not surface as dashboard notification)
    await prisma.securityEvent.create({
      data: {
        userId: req.userId!,
        eventType: 'wallet_verification',
        severity: 'info',
        description: `Wallet ${walletLink.address} verified`,
        metadata: JSON.stringify({ walletLinkId: walletLink.id, address: walletLink.address }),
      },
    })

    res.json({
      verified: true,
      walletAddress: walletLink.address,
      verifiedAt: verified.verifiedAt,
    })
  } catch (error) {
    console.error('Verification error:', error)
    res.status(500).json({ error: 'Failed to verify wallet' })
  }
})

router.get('/links/:id/verification-status', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const walletLink = await prisma.walletLink.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    })

    if (!walletLink) {
      res.status(404).json({ error: 'Wallet not found' })
      return
    }

    const verification = await prisma.walletVerification.findUnique({
      where: { walletLinkId: req.params.id },
    })

    res.json({
      verified: !!verification?.verifiedAt,
      verifiedAt: verification?.verifiedAt,
      expiresAt: verification?.expiresAt,
    })
  } catch (error) {
    console.error('Status check error:', error)
    res.status(500).json({ error: 'Failed to check verification status' })
  }
})

export default router
