import { Router } from 'express'
import { z } from 'zod'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import csrf from 'csurf'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { encryptSsn, validateSsn } from '../kycServiceEnhanced.js'
import { storeDocument } from '../documentService.js'

let prisma: any = null

// Export setter for prisma
export function setPrisma(p: any) {
  prisma = p
}

const router = Router()

// Extend Express Request for CSRF
declare global {
  namespace Express {
    interface Request {
      csrfToken(): string
      userId?: string
    }
  }
}

// CSRF protection middleware
const csrfProtection = csrf({ cookie: false })

// Rate limiting: 10 submissions per day per user
const kycSubmitLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.userId || req.ip!,
  message: 'Too many KYC submissions. Try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

// Rate limiting: 100 uploads per day per user
const documentUploadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => req.userId || req.ip!,
  message: 'Too many document uploads. Try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

// File upload: 8MB max (reduced from 10MB for DoS prevention)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

const submitKycSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  country: z.string().min(2).max(2),
  ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$|^\d{9}$/),
  addressStreet: z.string().min(5).max(200),
  addressCity: z.string().min(1).max(100),
  addressZip: z.string().min(3).max(20),
  idDocType: z.enum(['passport', 'dl', 'id']),
  _csrf: z.string(),
})

/**
 * KYC Tier System:
 * - UNVERIFIED: No KYC submitted
 * - TIER_1: Basic identity verified (ID + selfie)
 * - TIER_2: Full verification (ID + address + selfie)
 * - TIER_3: Enhanced verification (pending admin review)
 */

interface KycTier {
  tier: string
  dailyWithdrawLimit: number
  monthlyWithdrawLimit: number
  dailyTransferLimit: number
  monthlyTransferLimit: number
  maxTradeSize: number
}

const KYC_TIERS: Record<string, KycTier> = {
  UNVERIFIED: {
    tier: 'UNVERIFIED',
    dailyWithdrawLimit: 100,
    monthlyWithdrawLimit: 500,
    dailyTransferLimit: 500,
    monthlyTransferLimit: 2000,
    maxTradeSize: 1000,
  },
  TIER_1: {
    tier: 'TIER_1',
    dailyWithdrawLimit: 5000,
    monthlyWithdrawLimit: 50000,
    dailyTransferLimit: 10000,
    monthlyTransferLimit: 100000,
    maxTradeSize: 50000,
  },
  TIER_2: {
    tier: 'TIER_2',
    dailyWithdrawLimit: 50000,
    monthlyWithdrawLimit: 500000,
    dailyTransferLimit: 100000,
    monthlyTransferLimit: 1000000,
    maxTradeSize: 500000,
  },
  TIER_3: {
    tier: 'TIER_3',
    dailyWithdrawLimit: 250000,
    monthlyWithdrawLimit: 5000000,
    dailyTransferLimit: 500000,
    monthlyTransferLimit: 10000000,
    maxTradeSize: 5000000,
  },
}

router.get('/csrf-token', csrfProtection as any, (req, res) => {
  res.json({ csrfToken: req.csrfToken() })
})

/**
 * Upload KYC document (identity, address, or selfie)
 */
router.post(
  '/upload/:documentType',
  requireAuth,
  csrfProtection as any,
  documentUploadLimiter,
  upload.single('document'),
  async (req: AuthedRequest, res) => {
    const documentType = (req.params.documentType || '').toLowerCase()
    if (!['identity', 'address', 'selfie'].includes(documentType)) {
      res.status(400).json({ error: 'Invalid document type. Must be: identity, address, or selfie' })
      return
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    // Validate file type (basic check)
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf']
    if (!allowedMimes.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'Invalid file type. Only JPG, PNG, or PDF allowed' })
      return
    }

    try {
      const stored = await storeDocument(
        req.userId!,
        documentType as 'identity' | 'address' | 'selfie',
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      )

      const user = await prisma.user.findUnique({ where: { id: req.userId! } })
      if (!user) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      let docs: Array<{ type: string; id: string; uploaded: boolean; hash?: string; size?: number; name?: string }> = []
      try {
        if (user.kycDocumentsJson) {
          docs = JSON.parse(user.kycDocumentsJson)
        }
      } catch (e) {
        docs = []
      }

      docs = docs.filter(d => d.type !== documentType)
      docs.push({
        type: documentType,
        id: stored.id,
        uploaded: true,
        hash: stored.hash,
        size: stored.fileSize,
        name: stored.fileName,
      })

      await prisma.user.update({
        where: { id: req.userId! },
        data: { kycDocumentsJson: JSON.stringify(docs) },
      })

      res.json({
        ok: true,
        document: {
          id: stored.id,
          type: documentType,
          fileName: stored.fileName,
          size: stored.fileSize,
          uploadedAt: stored.uploadedAt.toISOString(),
        },
      })
    } catch (e) {
      console.error('[verdexis-api] Document upload error:', e)
      res.status(400).json({ error: (e as Error)?.message || 'Failed to upload document' })
    }
  },
)

/**
 * Get uploaded documents for current user
 */
router.get('/documents', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    let docs: Array<{ type: string; id: string; uploaded: boolean; hash?: string; size?: number; name?: string }> = []
    try {
      if (user.kycDocumentsJson) {
        docs = JSON.parse(user.kycDocumentsJson)
      }
    } catch (e) {
      docs = []
    }

    res.json({
      documents: docs.map(d => ({
        id: d.id,
        type: d.type,
        uploaded: d.uploaded,
        fileName: d.name,
        size: d.size,
      })),
    })
  } catch (e) {
    console.error('[verdexis-api] Get documents error:', e)
    res.status(500).json({ error: 'Failed to retrieve documents' })
  }
})

/**
 * Delete uploaded document
 */
router.delete(
  '/document/:id',
  requireAuth,
  csrfProtection as any,
  async (req: AuthedRequest, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } })
      if (!user || !user.kycDocumentsJson) {
        res.status(404).json({ error: 'Document not found' })
        return
      }

      let docs: Array<{ type: string; id: string; uploaded: boolean }> = []
      try {
        docs = JSON.parse(user.kycDocumentsJson)
      } catch (e) {
        docs = []
      }

      const doc = docs.find(d => d.id === req.params.id)
      if (!doc) {
        res.status(404).json({ error: 'Document not found' })
        return
      }

      docs = docs.filter(d => d.id !== req.params.id)
      await prisma.user.update({
        where: { id: req.userId! },
        data: { kycDocumentsJson: JSON.stringify(docs) },
      })

      res.json({ ok: true })
    } catch (e) {
      console.error('[verdexis-api] Document delete error:', e)
      res.status(500).json({ error: 'Failed to delete document' })
    }
  },
)

/**
 * Submit KYC with all documents verified (Tier 2)
 */
router.post(
  '/submit',
  requireAuth,
  csrfProtection as any,
  kycSubmitLimiter,
  async (req: AuthedRequest, res) => {
    const parsed = submitKycSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
      return
    }

    const { ssn, firstName, lastName, dob, country, addressStreet, addressCity, addressZip, idDocType } = parsed.data

    if (!validateSsn(ssn)) {
      res.status(400).json({ error: 'Invalid SSN format' })
      return
    }

    const dobDate = new Date(dob)
    if (dobDate > new Date()) {
      res.status(400).json({ error: 'Date of birth must be in the past' })
      return
    }

    const age = Math.floor((Date.now() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    if (age < 18) {
      res.status(400).json({ error: 'Must be 18 or older' })
      return
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId! } })
      if (!user) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      let docs: Array<{ type: string; uploaded: boolean }> = []
      try {
        if (user.kycDocumentsJson) {
          docs = JSON.parse(user.kycDocumentsJson)
        }
      } catch (e) {
        docs = []
      }

      const hasIdentity = docs.some(d => d.type === 'identity' && d.uploaded)
      const hasAddress = docs.some(d => d.type === 'address' && d.uploaded)
      const hasSelfie = docs.some(d => d.type === 'selfie' && d.uploaded)

      if (!hasIdentity || !hasAddress || !hasSelfie) {
        res.status(400).json({
          error: 'All documents required: identity, address, and selfie',
          missing: {
            identity: !hasIdentity,
            address: !hasAddress,
            selfie: !hasSelfie,
          },
        })
        return
      }

      const ssnEncrypted = encryptSsn(ssn)

      // Update user with KYC data and set to Tier 2
      const updated = await prisma.user.update({
        where: { id: req.userId! },
        data: {
          kycFirstName: firstName,
          kycLastName: lastName,
          kycDob: dob,
          kycCountry: country,
          kycSsnEncrypted: ssnEncrypted,
          kycAddressStreet: addressStreet,
          kycAddressCity: addressCity,
          kycAddressZip: addressZip,
          kycIdDocType: idDocType,
          kycStatus: 'pending',
          // Set Tier 2 limits initially
          dailyWithdrawLimit: 5000,
          monthlyWithdrawLimit: 50000,
          dailyTransferLimit: 10000,
          monthlyTransferLimit: 100000,
        },
      })

      await prisma.adminAudit.create({
        data: {
          actorId: req.userId!,
          targetUserId: req.userId!,
          action: 'kyc_submitted',
          payload: JSON.stringify({
            name: `${firstName} ${lastName}`,
            country,
            idDocType,
            documentsCount: docs.length,
            tier: 'TIER_2',
          }),
        },
      })

      res.json({
        ok: true,
        kycStatus: updated.kycStatus,
        tier: 'TIER_2',
        message: 'KYC information submitted for review. Typically takes 1-2 business days.',
        limits: KYC_TIERS.TIER_2,
      })
    } catch (e) {
      console.error('[verdexis-api] KYC submit error:', e)
      res.status(500).json({ error: 'Failed to submit KYC' })
    }
  },
)

/**
 * Get KYC status and tier information
 */
router.get('/status', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      kycStatus: true,
      kycNotes: true,
      kycReviewedAt: true,
      kycFirstName: true,
      kycLastName: true,
      kycCountry: true,
      kycDocumentsJson: true,
      dailyWithdrawLimit: true,
      monthlyWithdrawLimit: true,
      dailyTransferLimit: true,
      monthlyTransferLimit: true,
    },
  })

  if (!user) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  let uploadedDocuments: Array<{ type: string; uploaded: boolean }> = []
  try {
    if (user.kycDocumentsJson) {
      uploadedDocuments = JSON.parse(user.kycDocumentsJson)
    }
  } catch (e) {
    uploadedDocuments = []
  }

  // Determine tier based on KYC status
  let tier = 'UNVERIFIED'
  if (user.kycStatus === 'approved') {
    tier = 'TIER_2'
  } else if (user.kycStatus === 'pending') {
    tier = 'TIER_3'
  }

  res.json({
    status: user.kycStatus,
    tier,
    tierLimits: KYC_TIERS[tier],
    notes: user.kycNotes,
    reviewedAt: user.kycReviewedAt,
    submitted: {
      firstName: user.kycFirstName,
      lastName: user.kycLastName,
      country: user.kycCountry,
    },
    documents: {
      identity: uploadedDocuments.some(d => d.type === 'identity' && d.uploaded),
      address: uploadedDocuments.some(d => d.type === 'address' && d.uploaded),
      selfie: uploadedDocuments.some(d => d.type === 'selfie' && d.uploaded),
    },
    limits: {
      dailyWithdraw: user.dailyWithdrawLimit || KYC_TIERS['UNVERIFIED']?.dailyWithdrawLimit || 100,
      monthlyWithdraw: user.monthlyWithdrawLimit || KYC_TIERS['UNVERIFIED']?.monthlyWithdrawLimit || 500,
      dailyTransfer: user.dailyTransferLimit || KYC_TIERS['UNVERIFIED']?.dailyTransferLimit || 500,
      monthlyTransfer: user.monthlyTransferLimit || KYC_TIERS['UNVERIFIED']?.monthlyTransferLimit || 2000,
    },
  })
})

/**
 * Get current user's KYC tier
 */
router.get('/tier', requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      kycStatus: true,
      dailyWithdrawLimit: true,
      monthlyWithdrawLimit: true,
      dailyTransferLimit: true,
      monthlyTransferLimit: true,
    },
  })

  if (!user) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  let tier = 'UNVERIFIED'
  if (user.kycStatus === 'approved') {
    tier = 'TIER_2'
  } else if (user.kycStatus === 'pending') {
    tier = 'TIER_3'
  }

  res.json({
    tier,
    tierInfo: KYC_TIERS[tier],
    currentLimits: {
      dailyWithdraw: user.dailyWithdrawLimit || KYC_TIERS[tier]?.dailyWithdrawLimit || 100,
      monthlyWithdraw: user.monthlyWithdrawLimit || KYC_TIERS[tier]?.monthlyWithdrawLimit || 500,
      dailyTransfer: user.dailyTransferLimit || KYC_TIERS[tier]?.dailyTransferLimit || 500,
      monthlyTransfer: user.monthlyTransferLimit || KYC_TIERS[tier]?.monthlyTransferLimit || 2000,
    },
  })
})

export default router
export { KYC_TIERS }
export type { KycTier }
