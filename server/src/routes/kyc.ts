import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, type AuthedRequest } from '../auth.js'
import { encryptSsn, validateSsn } from '../kycService.js'
import { deleteDocument, storeDocument } from '../documentService.js'
import { documentUpload } from '../middleware/documentUpload.js'

const router = Router()

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
})

/**
 * Upload KYC document (identity, address, or selfie)
 */
router.post(
  '/upload/:documentType',
  requireAuth,
  documentUpload,
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

    try {
      const stored = await storeDocument(
        req.userId!,
        documentType as 'identity' | 'address' | 'selfie',
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      )

      // Get current user's documents
      const user = await prisma.user.findUnique({ where: { id: req.userId! } })
      if (!user) {
        res.status(404).json({ error: 'User not found' })
        return
      }

      // Parse existing documents
      let docs: Array<{ type: string; id: string; uploaded: boolean; hash?: string; size?: number; name?: string; storagePath?: string }> = []
      try {
        if (user.kycDocumentsJson) {
          docs = JSON.parse(user.kycDocumentsJson)
        }
      } catch (e) {
        docs = []
      }

      // Remove the previous file as well as its metadata when replacing it.
      const previous = docs.find(d => d.type === documentType)
      if (previous?.storagePath) {
        await deleteDocument(req.userId!, previous.storagePath)
      }
      docs = docs.filter(d => d.type !== documentType)

      // Add new document
      docs.push({
        type: documentType,
        id: stored.id,
        uploaded: true,
        hash: stored.hash,
        size: stored.fileSize,
        name: stored.fileName,
        storagePath: stored.storagePath,
      })

      // Update user
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
router.delete('/document/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } })
    if (!user || !user.kycDocumentsJson) {
      res.status(404).json({ error: 'Document not found' })
      return
    }

    let docs: Array<{ type: string; id: string; uploaded: boolean; storagePath?: string }> = []
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

    if (doc.storagePath) {
      await deleteDocument(req.userId!, doc.storagePath)
    }

    // Remove from database
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
})

/**
 * Submit KYC with all documents verified
 */
router.post('/submit', requireAuth, async (req: AuthedRequest, res) => {
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
    // Verify all documents are uploaded
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

    // Encrypt SSN
    const ssnEncrypted = encryptSsn(ssn)

    // Update user with KYC data
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
      },
    })

    // Create audit log
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
        }),
      },
    })

    res.json({
      ok: true,
      kycStatus: updated.kycStatus,
      message: 'KYC information submitted for review. Typically takes 1-2 business days.',
    })
  } catch (e) {
    console.error('[verdexis-api] KYC submit error:', e)
    res.status(500).json({ error: 'Failed to submit KYC' })
  }
})

/**
 * Get KYC status
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

  res.json({
    status: user.kycStatus,
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
  })
})

export default router
