import { otpService } from './lib/otpService.js'

export function startOTPCleanup(): void {
  // Run cleanup every hour
  const CLEANUP_INTERVAL = 60 * 60 * 1000

  setInterval(async () => {
    try {
      const count = await otpService.cleanupExpiredOTPs()
      if (count > 0) {
        console.log(`[OTP Cleanup] Removed ${count} expired OTP records`)
      }
    } catch (error) {
      console.error('[OTP Cleanup] Error:', error)
    }
  }, CLEANUP_INTERVAL)

  // Run once on startup
  setTimeout(async () => {
    try {
      const count = await otpService.cleanupExpiredOTPs()
      console.log(`[OTP Cleanup] Initial cleanup removed ${count} expired records`)
    } catch (error) {
      console.error('[OTP Cleanup] Initial error:', error)
    }
  }, 5000)
}
