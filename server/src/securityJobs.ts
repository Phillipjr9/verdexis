import { otpService } from './services/otp.js'
import { trustedDeviceService } from './services/trustedDevice.js'
import { sessionManagementService } from './services/sessionManagement.js'
import { env } from './env.js'

/**
 * Security cleanup jobs
 * Run periodically to clean expired data
 */
export class SecurityCleanupJobs {
  private static intervals: NodeJS.Timeout[] = []

  /**
   * Start all cleanup jobs
   */
  static start(): void {
    console.log('[security-cleanup] Starting security cleanup jobs...')

    // OTP cleanup - every hour
    const otpInterval = setInterval(async () => {
      try {
        await otpService.cleanup()
        console.log('[security-cleanup] OTP cleanup completed')
      } catch (error) {
        console.error('[security-cleanup] OTP cleanup failed:', error)
      }
    }, env.OTP_CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000)

    // Trusted devices cleanup - every 6 hours
    const devicesInterval = setInterval(async () => {
      try {
        const deleted = await trustedDeviceService.cleanupExpiredDevices()
        console.log(`[security-cleanup] Cleaned up ${deleted} expired devices`)
      } catch (error) {
        console.error('[security-cleanup] Device cleanup failed:', error)
      }
    }, 6 * 60 * 60 * 1000)

    // Sessions cleanup - every 2 hours
    const sessionsInterval = setInterval(async () => {
      try {
        const deleted = await sessionManagementService.cleanupExpiredSessions()
        console.log(`[security-cleanup] Cleaned up ${deleted} expired sessions`)
      } catch (error) {
        console.error('[security-cleanup] Session cleanup failed:', error)
      }
    }, 2 * 60 * 60 * 1000)

    // Risk assessments cleanup - daily (keep only last 30 days)
    const riskCleanupInterval = setInterval(async () => {
      try {
        await this.cleanupOldRiskAssessments()
        console.log('[security-cleanup] Risk assessments cleanup completed')
      } catch (error) {
        console.error('[security-cleanup] Risk assessments cleanup failed:', error)
      }
    }, 24 * 60 * 60 * 1000)

    // Security events cleanup - weekly (keep only last 90 days)
    const securityEventsInterval = setInterval(async () => {
      try {
        await this.cleanupOldSecurityEvents()
        console.log('[security-cleanup] Security events cleanup completed')
      } catch (error) {
        console.error('[security-cleanup] Security events cleanup failed:', error)
      }
    }, 7 * 24 * 60 * 60 * 1000)

    this.intervals = [
      otpInterval,
      devicesInterval,
      sessionsInterval,
      riskCleanupInterval,
      securityEventsInterval
    ]
  }

  /**
   * Stop all cleanup jobs
   */
  static stop(): void {
    console.log('[security-cleanup] Stopping security cleanup jobs...')
    this.intervals.forEach(interval => clearInterval(interval))
    this.intervals = []
  }

  /**
   * Run immediate cleanup
   */
  static async runImmediate(): Promise<void> {
    console.log('[security-cleanup] Running immediate cleanup...')
    
    try {
      await Promise.all([
        otpService.cleanup(),
        trustedDeviceService.cleanupExpiredDevices(),
        sessionManagementService.cleanupExpiredSessions(),
        this.cleanupOldRiskAssessments(),
        this.cleanupOldSecurityEvents()
      ])
      
      console.log('[security-cleanup] Immediate cleanup completed')
    } catch (error) {
      console.error('[security-cleanup] Immediate cleanup failed:', error)
    }
  }

  /**
   * Clean up old risk assessments (keep last 30 days)
   */
  private static async cleanupOldRiskAssessments(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const { prisma } = await import('./db.js')
    
    const result = await prisma.riskAssessment.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo }
      }
    })

    return result.count
  }

  /**
   * Clean up old security events (keep last 90 days for compliance)
   */
  private static async cleanupOldSecurityEvents(): Promise<number> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    
    const { prisma } = await import('./db.js')
    
    // Only clean up resolved events older than 90 days
    // Keep unresolved events indefinitely
    const result = await prisma.securityEvent.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
        resolved: true
      }
    })

    return result.count
  }
}

// Auto-start cleanup jobs when module is loaded
if (process.env.NODE_ENV !== 'test') {
  SecurityCleanupJobs.start()
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    SecurityCleanupJobs.stop()
    process.exit(0)
  })
  
  process.on('SIGTERM', () => {
    SecurityCleanupJobs.stop()
    process.exit(0)
  })
}