import { Router, type Request } from 'express'
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

function parseOrigin(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined
  const raw = Array.isArray(value) ? value[0] : value
  try {
    return new URL(raw).origin
  } catch {
    return undefined
  }
}

function getRequestOrigin(req: Request): string {
  if (process.env.PASSKEY_ORIGIN) return process.env.PASSKEY_ORIGIN
  return (
    parseOrigin(req.headers.origin) ||
    parseOrigin(req.headers.referer) ||
    process.env.APP_BASE_URL ||
    'http://localhost:5173'
  )
}

function getRequestRpId(req: Request): string {
  if (process.env.PASSKEY_RP_ID) return process.env.PASSKEY_RP_ID

  const origin = parseOrigin(req.headers.origin) || parseOrigin(req.headers.referer)
  if (origin) {
    try {
      return new URL(origin).hostname
    } catch {
      // fallback to APP_BASE_URL
    }
  }

  if (process.env.APP_BASE_URL) {
    try {
      return new URL(process.env.APP_BASE_URL).hostname
    } catch {
      // fallback to localhost
    }
  }

  return 'localhost'
}

const RP_NAME = 'Verdexis'

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
      rpID: getRequestRpId(req),
      rpName: RP_NAME,
      userID: Buffer.from(user.id),
      userName: user.email,
      userDisplayName: user.name || user.email,
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map((pk) => ({
        id: pk.credentialId,
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

    const expectedOrigin = getRequestOrigin(req)
    const expectedRpId = getRequestRpId(req)
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin,
      expectedRPID: expectedRpId,
      requireUserVerification: false,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Registration verification failed' })
    }

    const { credential } = verification.registrationInfo
    const credentialID = credential.id
    const credentialPublicKey = credential.publicKey
    const counter = credential.counter

    // Store the passkey - store as base64 string
    const credentialIdStr = typeof credentialID === 'string' 
      ? credentialID
      : Buffer.from(credentialID).toString('base64')
    const publicKeyStr = typeof credentialPublicKey === 'string'
      ? credentialPublicKey
      : Buffer.from(credentialPublicKey).toString('base64')
    
    const passkey = await prisma.passkey.create({
      data: {
        userId: req.userId!,
        credentialId: credentialIdStr,
        publicKey: publicKeyStr,
        counter,
        deviceName,
      } as any,
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
    const rawEmail = (req.body as { email?: string })?.email
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    // Match auth routes: emails are stored lowercased
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerified: true },
    })

    if (!user) {
      // Keep message explicit so the UI can distinguish "no account" vs route missing
      return res.status(404).json({
        error: 'User not found',
        message: 'No account found for this email. Sign in with password or create an account first.',
      })
    }

    const passkeys = await prisma.passkey.findMany({
      where: { userId: user.id },
      select: { credentialId: true },
    })

    if (passkeys.length === 0) {
      return res.status(404).json({
        error: 'No passkeys registered',
        message: 'This account has no passkeys yet. Sign in with password, then add a passkey in Security settings.',
      })
    }

    const options = await generateAuthenticationOptions({
      rpID: getRequestRpId(req),
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

    // Find the passkey by credential ID - convert to base64 string
    let credentialIdStr: string
    if (typeof response.id === 'string') {
      credentialIdStr = response.id
    } else {
      credentialIdStr = Buffer.from(response.id as any).toString('base64')
    }

    const passkey = await prisma.passkey.findFirst({
      where: { credentialId: credentialIdStr } as any,
      include: { user: true },
    }) as any

    if (!passkey || !passkey.user) {
      return res.status(404).json({ error: 'Passkey not found' })
    }

    const expectedOrigin = getRequestOrigin(req)
    const expectedRpId = getRequestRpId(req)
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin,
      expectedRPID: expectedRpId,
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, 'base64'),
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
