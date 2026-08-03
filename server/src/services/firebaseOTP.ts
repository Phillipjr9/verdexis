import { env } from '../env.js'
import { initializeFirebaseAdmin, getFirebaseAuth } from './firebaseAdmin.js'

/**
 * Firebase Phone OTP Authentication Service
 * Replaces Twilio for OTP delivery - completely free
 */

let isFirebaseAvailable = false

export function initializeFirebase() {
  try {
    initializeFirebaseAdmin()
    isFirebaseAvailable = true
  } catch (error) {
    console.warn('[firebase-otp] Firebase not available, OTP service will fail')
    isFirebaseAvailable = false
  }
}

export class FirebasePhoneOTPService {
  private auth: ReturnType<typeof getFirebaseAuth> | null = null

  private getAuth() {
    if (!this.auth) {
      this.auth = getFirebaseAuth()
    }
    return this.auth
  }

  /**
   * Send OTP to phone number
   * Firebase handles SMS delivery automatically
   */
  async sendOTP(phoneNumber: string): Promise<{ sessionInfo: string; success: boolean }> {
    try {
      if (!isFirebaseAvailable) {
        console.error('[firebase-otp] Firebase not initialized')
        return {
          sessionInfo: '',
          success: false,
        }
      }

      console.log(`[firebase-otp] Sending OTP to ${phoneNumber}`)

      const auth = this.getAuth()
      if (!auth) {
        console.error('[firebase-otp] Firebase Auth not available')
        return {
          sessionInfo: '',
          success: false,
        }
      }

      const customToken = await auth.createCustomToken(phoneNumber)

      return {
        sessionInfo: customToken,
        success: true,
      }
    } catch (error) {
      console.error('[firebase-otp] Error sending OTP:', error)
      return {
        sessionInfo: '',
        success: false,
      }
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(idToken: string): Promise<{ uid: string; phoneNumber: string; success: boolean }> {
    try {
      const auth = this.getAuth()
      if (!auth) {
        console.error('[firebase-otp] Firebase Auth not available')
        return { uid: '', phoneNumber: '', success: false }
      }
      
      const decodedToken = await auth.verifyIdToken(idToken)

      return {
        uid: decodedToken.uid,
        phoneNumber: decodedToken.phone_number || '',
        success: true,
      }
    } catch (error) {
      console.error('[firebase-otp] Error verifying OTP:', error)
      return {
        uid: '',
        phoneNumber: '',
        success: false,
      }
    }
  }

  /**
   * Create or update user with phone number
   */
  async createUserWithPhone(phoneNumber: string, displayName?: string): Promise<{ uid: string; success: boolean }> {
    try {
      const auth = this.getAuth()
      if (!auth) {
        console.error('[firebase-otp] Firebase Auth not available')
        return { uid: '', success: false }
      }
      
      const user = await auth.createUser({
        phoneNumber,
        displayName,
      })

      console.log(`[firebase-otp] ✅ User created: ${user.uid}`)

      return {
        uid: user.uid,
        success: true
      }
    } catch (error: any) {
      // User might already exist
      if (error.code === 'auth/phone-number-already-exists') {
        const auth = this.getAuth()
        if (!auth) return { uid: '', success: false }
        
        const users = await auth.getUserByPhoneNumber(phoneNumber)
        return {
          uid: users.uid,
          success: true
        }
      }

      console.error('[firebase-otp] Error creating user:', error)
      return {
        uid: '',
        success: false
      }
    }
  }

  /**
   * Get user by phone number
   */
  async getUserByPhone(phoneNumber: string): Promise<ReturnType<typeof getFirebaseAuth> extends { getUserByPhoneNumber(phoneNumber: string): Promise<infer U> } ? U : null> {
    try {
      const auth = this.getAuth()
      if (!auth) {
        console.error('[firebase-otp] Firebase Auth not available')
        return null
      }
      return await auth.getUserByPhoneNumber(phoneNumber)
    } catch (error) {
      console.error('[firebase-otp] Error getting user:', error)
      return null
    }
  }

  /**
   * Delete user
   */
  async deleteUser(uid: string): Promise<boolean> {
    try {
      const auth = this.getAuth()
      if (!auth) {
        console.error('[firebase-otp] Firebase Auth not available')
        return false
      }
      await auth.deleteUser(uid)
      return true
    } catch (error) {
      console.error('[firebase-otp] Error deleting user:', error)
      return false
    }
  }

  /**
   * Revoke all refresh tokens (logout all sessions)
   */
  async revokeRefreshTokens(uid: string): Promise<boolean> {
    try {
      const auth = this.getAuth()
      if (!auth) {
        console.error('[firebase-otp] Firebase Auth not available')
        return false
      }
      await auth.revokeRefreshTokens(uid)
      return true
    } catch (error) {
      console.error('[firebase-otp] Error revoking tokens:', error)
      return false
    }
  }
}

let firebasePhoneOTPInstance: FirebasePhoneOTPService | null = null

try {
  firebasePhoneOTPInstance = new FirebasePhoneOTPService()
} catch (error) {
  console.warn('[firebase-otp] Failed to instantiate Firebase OTP service:', error instanceof Error ? error.message : String(error))
  firebasePhoneOTPInstance = new FirebasePhoneOTPService() // Still create instance, but it will fail gracefully
}

export const firebasePhoneOTP = firebasePhoneOTPInstance

export default {
  initializeFirebase,
  firebasePhoneOTP,
}
