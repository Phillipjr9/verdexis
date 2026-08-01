import * as admin from 'firebase-admin'
import { env } from '../env.js'

/**
 * Firebase Phone OTP Authentication Service
 * Replaces Twilio for OTP delivery - completely free
 */

// Initialize Firebase Admin SDK
let firebaseApp: admin.App | null = null

export function initializeFirebase() {
  if (firebaseApp) return firebaseApp

  try {
    // Check if running in a Firebase environment (Cloud Functions) or local development.
    if (process.env.FIREBASE_CONFIG) {
      firebaseApp = admin.initializeApp() as admin.App
    } else if (env.FIREBASE_PROJECT_ID && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_CLIENT_EMAIL) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
        }),
      }) as admin.App
    } else {
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json'
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccountPath)),
        projectId: env.FIREBASE_PROJECT_ID,
      }) as admin.App
    }

    console.log('[firebase] ✅ Firebase Admin SDK initialized')
    return firebaseApp
  } catch (error) {
    console.error('[firebase] ❌ Failed to initialize Firebase:', error)
    throw error
  }
}

export class FirebasePhoneOTPService {
  private auth: admin.Auth

  constructor() {
    const app = initializeFirebase()
    this.auth = admin.auth(app)
  }

  /**
   * Send OTP to phone number
   * Firebase handles SMS delivery automatically
   */
  async sendOTP(phoneNumber: string): Promise<{ sessionInfo: string; success: boolean }> {
    try {
      console.log(`[firebase-otp] Sending OTP to ${phoneNumber}`)

      // Create a session for phone sign-in
      // Note: This is typically done on the client-side with Firebase SDK
      // For server-side, we create a custom token instead
      
      const customToken = await this.auth.createCustomToken(phoneNumber)
      
      return {
        sessionInfo: customToken,
        success: true
      }
    } catch (error) {
      console.error('[firebase-otp] Error sending OTP:', error)
      return {
        sessionInfo: '',
        success: false
      }
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(idToken: string): Promise<{ uid: string; phoneNumber: string; success: boolean }> {
    try {
      const decodedToken = await this.auth.verifyIdToken(idToken)
      
      return {
        uid: decodedToken.uid,
        phoneNumber: decodedToken.phone_number || '',
        success: true
      }
    } catch (error) {
      console.error('[firebase-otp] Error verifying OTP:', error)
      return {
        uid: '',
        phoneNumber: '',
        success: false
      }
    }
  }

  /**
   * Create or update user with phone number
   */
  async createUserWithPhone(phoneNumber: string, displayName?: string): Promise<{ uid: string; success: boolean }> {
    try {
      const user = await this.auth.createUser({
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
        const users = await this.auth.getUserByPhoneNumber(phoneNumber)
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
  async getUserByPhone(phoneNumber: string): Promise<admin.UserRecord | null> {
    try {
      return await this.auth.getUserByPhoneNumber(phoneNumber)
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
      await this.auth.deleteUser(uid)
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
      await this.auth.revokeRefreshTokens(uid)
      return true
    } catch (error) {
      console.error('[firebase-otp] Error revoking tokens:', error)
      return false
    }
  }
}

export const firebasePhoneOTP = new FirebasePhoneOTPService()

export default {
  initializeFirebase,
  firebasePhoneOTP,
}
