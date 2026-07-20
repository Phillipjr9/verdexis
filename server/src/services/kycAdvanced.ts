import crypto from 'node:crypto'
import { prisma } from '../db.js'

export type DocumentType = 'passport' | 'driver_license' | 'national_id' | 'residence_permit'
export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'expired'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface KYCDocument {
  id: string
  userId: string
  type: DocumentType
  documentNumber: string
  issuedAt: Date
  expiresAt: Date
  country: string
  status: VerificationStatus
  uploadedAt: Date
  verifiedAt: Date | null
  verifiedBy: string | null
  rejectionReason: string | null
}

export interface LivenessCheck {
  id: string
  userId: string
  status: 'pending' | 'passed' | 'failed'
  score: number
  attempts: number
  createdAt: Date
  completedAt: Date | null
}

export interface RiskScore {
  userId: string
  score: number
  level: RiskLevel
  factors: string[]
  updatedAt: Date
}

export class KYCService {
  /**
   * Upload KYC document
   */
  static async uploadDocument(
    userId: string,
    type: DocumentType,
    documentNumber: string,
    issuedAt: Date,
    expiresAt: Date,
    country: string,
    documentUrl: string,
  ): Promise<KYCDocument> {
    // Check if document already exists
    const existing = await prisma.kYCDocument.findFirst({
      where: { userId, type, status: { not: 'rejected' } },
    })

    if (existing) {
      throw new Error(`${type} already uploaded and pending verification`)
    }

    const document = await prisma.kYCDocument.create({
      data: {
        userId,
        type,
        documentNumber,
        issuedAt,
        expiresAt,
        country,
        documentUrl,
        status: 'pending',
      },
    })

    return { ...document, type: document.type as DocumentType, status: document.status as VerificationStatus }
  }

  /**
   * Verify KYC document
   */
  static async verifyDocument(
    documentId: string,
    adminId: string,
    approved: boolean,
    rejectionReason?: string,
  ): Promise<KYCDocument> {
    const document = await prisma.kYCDocument.update({
      where: { id: documentId },
      data: {
        status: approved ? 'approved' : 'rejected',
        verifiedAt: new Date(),
        verifiedBy: adminId,
        rejectionReason: rejectionReason || null,
      },
    })

    // Update user KYC status
    if (approved) {
      const allDocuments = await prisma.kYCDocument.findMany({
        where: { userId: document.userId, status: 'approved' },
      })

      if (allDocuments.length > 0) {
        await prisma.user.update({
          where: { id: document.userId },
          data: { kycStatus: 'approved' },
        })
      }
    }

    return { ...document, type: document.type as DocumentType, status: document.status as VerificationStatus }
  }

  /**
   * Get user's KYC documents
   */
  static async getUserDocuments(userId: string): Promise<KYCDocument[]> {
    const docs = await prisma.kYCDocument.findMany({
      where: { userId },
      orderBy: { uploadedAt: 'desc' },
    })
    return docs.map(d => ({ ...d, type: d.type as DocumentType, status: d.status as VerificationStatus }))
  }

  /**
   * Initiate liveness check
   */
  static async initiateLivenessCheck(userId: string): Promise<LivenessCheck> {
    // Check if user already has a pending liveness check
    const pending = await prisma.livenessCheck.findFirst({
      where: { userId, status: 'pending' },
    })

    if (pending) {
      throw new Error('Liveness check already in progress')
    }

    const check = await prisma.livenessCheck.create({
      data: {
        userId,
        status: 'pending',
        score: 0,
        attempts: 0,
      },
    })

    return check as unknown as LivenessCheck
  }

  /**
   * Complete liveness check
   */
  static async completeLivenessCheck(checkId: string, passed: boolean, score: number): Promise<LivenessCheck> {
    const check = await prisma.livenessCheck.update({
      where: { id: checkId },
      data: {
        status: passed ? 'passed' : 'failed',
        score,
        completedAt: new Date(),
        attempts: { increment: 1 },
      },
    })

    if (passed) {
      await prisma.user.update({
        where: { id: check.userId },
        data: { livenessVerified: true, livenessVerifiedAt: new Date() },
      })
    }

    return check as unknown as LivenessCheck
  }

  /**
   * Calculate risk score
   */
  static async calculateRiskScore(userId: string): Promise<RiskScore> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        emailVerified: true,
        phoneVerified: true,
        livenessVerified: true,
        suspended: true,
        kycStatus: true,
        prefs: true,
      },
    })

    if (!user) {
      throw new Error('User not found')
    }

    let score = 0
    const factors: string[] = []

    // Account age (newer = higher risk)
    const daysSinceCreation = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceCreation < 7) {
      score += 20
      factors.push('New account (< 7 days)')
    } else if (daysSinceCreation < 30) {
      score += 10
      factors.push('New account (< 30 days)')
    }

    // Verification status
    if (!user.emailVerified) {
      score += 15
      factors.push('Email not verified')
    }
    if (!user.phoneVerified) {
      score += 15
      factors.push('Phone not verified')
    }
    if (!user.livenessVerified) {
      score += 10
      factors.push('Liveness not verified')
    }

    // KYC status
    if (user.kycStatus !== 'approved') {
      score += 20
      factors.push('KYC not approved')
    }

    // Account suspension history
    if (user.suspended) {
      score += 30
      factors.push('Account suspended')
    }

    // Check transaction patterns
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      select: { amount: true, kind: true, createdAt: true },
    })

    // Large transactions
    const largeTransactions = transactions.filter(t => t.amount > 10000)
    if (largeTransactions.length > 0) {
      score += 10
      factors.push(`Large transactions (${largeTransactions.length})`)
    }

    // Rapid transactions
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recentTransactions = transactions.filter(t => t.createdAt > last24h)
    if (recentTransactions.length > 10) {
      score += 15
      factors.push('High transaction velocity')
    }

    // Determine risk level
    let level: RiskLevel = 'low'
    if (score >= 80) level = 'critical'
    else if (score >= 60) level = 'high'
    else if (score >= 40) level = 'medium'

    // Store risk score
    const stored = await prisma.riskScore.upsert({
      where: { userId },
      create: {
        userId,
        score,
        level,
        factors,
      },
      update: {
        score,
        level,
        factors,
        updatedAt: new Date(),
      },
    })

    return { userId, score, level: level as RiskLevel, factors, updatedAt: new Date() }
  }

  /**
   * Check OFAC sanctions list
   */
  static async checkOFAC(name: string, country: string): Promise<{ sanctioned: boolean; reason?: string }> {
    // This is a placeholder - in production, integrate with actual OFAC API
    // For now, check against a simple list
    const sanctionedCountries = ['iran', 'north korea', 'syria', 'cuba']
    const sanctionedNames = ['osama bin laden', 'saddam hussein'] // Simplified

    if (sanctionedCountries.includes(country.toLowerCase())) {
      return { sanctioned: true, reason: `Country ${country} is on OFAC sanctions list` }
    }

    if (sanctionedNames.some(n => name.toLowerCase().includes(n))) {
      return { sanctioned: true, reason: `Name matches OFAC sanctions list` }
    }

    return { sanctioned: false }
  }

  /**
   * Check PEP (Politically Exposed Persons)
   */
  static async checkPEP(name: string, country: string): Promise<{ isPEP: boolean; reason?: string }> {
    // This is a placeholder - in production, integrate with actual PEP database
    // For now, check against a simple list
    const pepNames = ['vladimir putin', 'xi jinping', 'joe biden']

    if (pepNames.some(n => name.toLowerCase().includes(n))) {
      return { isPEP: true, reason: `Name matches PEP database` }
    }

    return { isPEP: false }
  }

  /**
   * Get user's KYC status
   */
  static async getKYCStatus(userId: string): Promise<{
    kycStatus: string
    documents: KYCDocument[]
    livenessVerified: boolean
    riskScore: RiskScore | null
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, livenessVerified: true },
    })

    const documents = await this.getUserDocuments(userId)
    const riskScore = await prisma.riskScore.findUnique({ where: { userId } })

    return {
      kycStatus: user?.kycStatus || 'none',
      documents,
      livenessVerified: user?.livenessVerified || false,
      riskScore,
    }
  }
}

export const kycService = new KYCService()
