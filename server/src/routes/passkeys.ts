import { Router } from 'express'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { prisma } from '../db.js'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types'

const router = Router()

// In-memory challenge storage (use Redis in production)
const challenges = new Map<string, { challenge: string; timestamp: number }>()
const CHALLENGE_TIMEOUT = 10 * 60 * 1000 // 10 minutes

// Clean up expired challenges
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of challenges.entries()) {
    if (now - value.timestamp > CHALLENGE_TIMEOUT) {
      challenges.delete(key)
    }
  }
}, 60000)

// Extract domain from APP_BASE_URL
function getRpId(): string {
  if (process.env.RP_ID) return process.env.RP_ID
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173'
  try {
    const url = new URL(baseUrl)
    return url.hostname
  } catch {
    return 'localhost'
  }
}

function getOrigin(): string {
  return process.env.APP_BASE_URL || 'http://localhost:5173'
}

const RP_ID = getRpId()
const RP_NAME = 'Verdexis'
const ORIGIN = getOrigin()

console.log('[passkeys] Configured with RP_ID:', RP_ID, 'ORIGIN:', ORIGIN)

// List user's passkeys
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const passkeys = await prisma.passkey.findMany({
      where: { userId: req.userId! },
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
      credentialId: pk.credentialId,
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
router.post('/register/options', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, email: true, name: true },
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get existing passkeys for this user
    const existingPasskeys = await prisma.passkey.findMany({
      where: { userId: req.userId! },
      select: { credentialId: true },
    })

    const options = await generateRegistrationOptions({
      rpID: RP_ID,
      rpName: RP_NAME,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.name || user.email,
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map((pk) => ({
        id: pk.credentialId as any,
        transports: ['usb', 'ble', 'nfc', 'internal'] as const,
      })),
    })

    // Store challenge for verification
    const challengeKey = `reg_${req.userId}_${Date.now()}`
    challenges.set(challengeKey, {
      challenge: options.challenge,
      timestamp: Date.now(),
    })

    // Return challenge key so client can send it back
    res.json({ options, challengeKey })
  } catch (err) {
    console.error('[passkeys] register options error:', err)
    return res.status(500).json({ error: 'Failed to start registration', details: String(err) })
  }
})

// Complete passkey registration (verify credential)
router.post('/register/verify', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { response, deviceName, challengeKey } = req.body as {
      response: RegistrationResponseJSON
      deviceName: string
      challengeKey: string
    }

    if (!response || !deviceName || !challengeKey) {
      return res.status(400).json({ error: 'Missing response, deviceName, or challengeKey' })
    }

    // Retrieve stored challenge
    const storedChallenge = challenges.get(challengeKey)
    if (!storedChallenge) {
      return res.status(400).json({ error: 'Challenge expired or not found' })
    }

    challenges.delete(challengeKey)

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Registration verification failed' })
    }

    const { credential } = verification.registrationInfo
    const credentialID = credential.id
    const credentialPublicKey = credential.publicKey
    const counter = credential.counter

    // Store the passkey
    const passkey = await prisma.passkey.create({
      data: {
        userId: req.userId!,
        credentialId: credentialID as any,
        publicKey: credentialPublicKey as any,
        counter,
        deviceName,
      },
    })

    return res.json({
      verified: true,
      passkey: {
        id: passkey.id,
        deviceName: passkey.deviceName,
      },
    })
  } catch (err) {
    console.error('[passkeys] register verify error:', err)
    return res.status(500).json({ error: 'Failed to complete registration', details: String(err) })
  }
})

// Start passkey authentication (generate challenge)
router.post('/auth/options', async (req, res) => {
  try {
    const { email } = req.body as { email?: string }

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const passkeys = await prisma.passkey.findMany({
      where: { userId: user.id },
      select: { credentialId: true },
    })

    if (passkeys.length === 0) {
      return res.status(404).json({ error: 'No passkeys registered' })
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: passkeys.map((pk) => ({
        id: pk.credentialId as any,
        transports: ['usb', 'ble', 'nfc', 'internal'] as const,
      })),
    })

    // Store challenge for verification
    const challengeKey = `auth_${email}_${Date.now()}`
    challenges.set(challengeKey, {
      challenge: options.challenge,
      timestamp: Date.now(),
    })

    res.json({ options, challengeKey })
  } catch (err) {
    console.error('[passkeys] auth options error:', err)
    return res.status(500).json({ error: 'Failed to start authentication', details: String(err) })
  }
})

// Complete passkey authentication (verify assertion)
router.post('/auth/verify', async (req, res) => {
  try {
    const { response, challengeKey } = req.body as {
      response: AuthenticationResponseJSON
      challengeKey: string
    }

    if (!response || !challengeKey) {
      return res.status(400).json({ error: 'Missing response or challengeKey' })
    }

    // Retrieve stored challenge
    const storedChallenge = challenges.get(challengeKey)
    if (!storedChallenge) {
      return res.status(400).json({ error: 'Challenge expired or not found' })
    }

    challenges.delete(challengeKey)

    // Find the passkey by credential ID
    const credentialIdBuffer = typeof response.id === 'string'
      ? Buffer.from(response.id, 'base64url')
      : Buffer.from(new Uint8Array(response.id as any))

    const passkey = await prisma.passkey.findFirst({
      where: { credentialId: credentialIdBuffer },
      include: { user: true },
    })

    if (!passkey) {
      return res.status(404).json({ error: 'Passkey not found' })
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credentialId as any,
        publicKey: passkey.publicKey as any,
        counter: passkey.counter,
        transports: ['usb', 'ble', 'nfc', 'internal'] as const,
      },
    })

    if (!verification.verified) {
      return res.status(401).json({ error: 'Authentication verification failed' })
    }

    // Update counter and last used
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: verification.authenticationInfo?.newCounter || passkey.counter,
        lastUsedAt: new Date(),
      },
    })

    // Generate JWT token
    const { signToken } = await import('../auth.js')
    const token = signToken({ sub: passkey.user.id, email: passkey.user.email })

    return res.json({
      verified: true,
      token,
      user: {
        id: passkey.user.id,
        email: passkey.user.email,
        name: passkey.user.name,
        role: passkey.user.role,
      },
    })
  } catch (err) {
    console.error('[passkeys] auth verify error:', err)
    return res.status(500).json({ error: 'Failed to complete authentication', details: String(err) })
  }
})

// Remove a passkey
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params

    const passkey = await prisma.passkey.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!passkey) {
      return res.status(404).json({ error: 'Passkey not found' })
    }

    if (passkey.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' })
    }

    await prisma.passkey.delete({ where: { id } })

    return res.json({ success: true })
  } catch (err) {
    console.error('[passkeys] delete error:', err)
    return res.status(500).json({ error: 'Failed to remove passkey' })
  }
})

export default router
