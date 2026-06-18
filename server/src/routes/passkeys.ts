import { Router } from 'express'
import { z } from 'zod'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest, signToken } from '../auth.js'
import { env } from '../env.js'

const router = Router()

// RP (Relying Party) config
const rpName = 'Verdexis'
const rpID = env.APP_BASE_URL ? new URL(env.APP_BASE_URL).hostname : 'localhost'
const origin = env.APP_BASE_URL || 'http://localhost:5173'

// In-memory challenges (production: use Redis or DB with TTL)
const challenges = new Map<string, { challenge: string; expiresAt: number }>()

function cleanExpiredChallenges() {
  const now = Date.now()
  for (const [userId, data] of challenges.entries()) {
    if (data.expiresAt < now) challenges.delete(userId)
  }
}
setInterval(cleanExpiredChallenges, 60000) // cleanup every minute

// GET /api/passkeys - List user's passkeys
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
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
  res.json({ passkeys })
})

// POST /api/passkeys/register/options - Start passkey registration
router.post('/register/options', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: { passkeys: true },
  })
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    attestationType: 'none',
    excludeCredentials: user.passkeys.map((pk) => ({
      id: pk.credentialId,
      transports: pk.transports ? JSON.parse(pk.transports) : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  })

  // Store challenge
  challenges.set(req.userId!, {
    challenge: options.challenge,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
  })

  res.json({ options })
})

// POST /api/passkeys/register/verify - Complete passkey registration
const registerSchema = z.object({
  response: z.any(), // RegistrationResponseJSON
  deviceName: z.string().min(1).max(100).trim(),
})

router.post('/register/verify', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const stored = challenges.get(req.userId!)
  if (!stored || stored.expiresAt < Date.now()) {
    res.status(400).json({ error: 'Challenge expired or not found' })
    return
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: parsed.data.response as RegistrationResponseJSON,
      expectedChallenge: stored.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'Verification failed' })
      return
    }

    const { credential } = verification.registrationInfo
    const transports = parsed.data.response.response?.transports || []

    // Save passkey
    const passkey = await prisma.passkey.create({
      data: {
        userId: req.userId!,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: JSON.stringify(transports),
        deviceName: parsed.data.deviceName,
      },
    })

    challenges.delete(req.userId!)
    res.json({ verified: true, passkey: { id: passkey.id, deviceName: passkey.deviceName } })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Verification failed' })
  }
})

// POST /api/passkeys/auth/options - Start passkey authentication
const authOptionsSchema = z.object({
  email: z.string().email().optional(),
})

router.post('/auth/options', async (req, res) => {
  const parsed = authOptionsSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  let allowCredentials: Array<{ id: string; transports?: ('ble' | 'hybrid' | 'internal' | 'nfc' | 'usb')[] }> = []

  // If email provided, only allow that user's passkeys
  if (parsed.data.email) {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase().trim() },
      include: { passkeys: true },
    })
    if (user) {
      allowCredentials = user.passkeys.map((pk) => ({
        id: pk.credentialId,
        transports: pk.transports ? JSON.parse(pk.transports) : undefined,
      }))
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'preferred',
  })

  // Store challenge temporarily (keyed by challenge itself since user not known yet)
  challenges.set(`auth:${options.challenge}`, {
    challenge: options.challenge,
    expiresAt: Date.now() + 5 * 60 * 1000,
  })

  res.json({ options })
})

// POST /api/passkeys/auth/verify - Complete passkey authentication
const authVerifySchema = z.object({
  response: z.any(), // AuthenticationResponseJSON
})

router.post('/auth/verify', async (req, res) => {
  const parsed = authVerifySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input' })
    return
  }

  const response = parsed.data.response as AuthenticationResponseJSON
  const credentialId = response.id

  // Find passkey
  const passkey = await prisma.passkey.findUnique({
    where: { credentialId },
    include: { user: true },
  })

  if (!passkey) {
    res.status(401).json({ error: 'Passkey not found' })
    return
  }

  // Verify challenge exists
  const challengeKey = `auth:${response.response.clientDataJSON}`
  let storedChallenge: string | undefined
  for (const [key, data] of challenges.entries()) {
    if (key.startsWith('auth:') && data.expiresAt > Date.now()) {
      storedChallenge = data.challenge
      break
    }
  }

  if (!storedChallenge) {
    res.status(400).json({ error: 'Challenge expired' })
    return
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: storedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, 'base64url'),
        counter: passkey.counter,
      },
    })

    if (!verification.verified) {
      res.status(401).json({ error: 'Authentication failed' })
      return
    }

    // Update counter and last used
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    })

    // Clean up challenge
    for (const key of challenges.keys()) {
      if (key.startsWith('auth:')) challenges.delete(key)
    }

    // Sign JWT
    const token = signToken({
      sub: passkey.user.id,
      email: passkey.user.email,
      v: passkey.user.tokenVersion,
    })

    res.json({
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
    res.status(400).json({ error: err instanceof Error ? err.message : 'Verification failed' })
  }
})

// DELETE /api/passkeys/:id - Remove a passkey
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  const passkey = await prisma.passkey.findUnique({ where: { id: req.params.id } })
  if (!passkey || passkey.userId !== req.userId) {
    res.status(404).json({ error: 'Passkey not found' })
    return
  }

  await prisma.passkey.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

export default router
