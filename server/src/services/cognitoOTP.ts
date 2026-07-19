import { CognitoIdentityProviderClient, AdminInitiateAuthCommand, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminGetUserCommand, AdminDeleteUserCommand, AdminUpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider'
import { env } from '../env.js'

/**
 * AWS Cognito Phone OTP Authentication Service
 * Free tier: 50,000 monthly active users
 * No billing required - completely free
 */

export class CognitoOTPService {
  private cognito: CognitoIdentityProviderClient
  private userPoolId: string
  private clientId: string

  constructor() {
    this.cognito = new CognitoIdentityProviderClient({
      region: env.AWS_REGION || 'us-east-1',
    })

    this.userPoolId = env.AWS_COGNITO_USER_POOL_ID || ''
    this.clientId = env.AWS_COGNITO_CLIENT_ID || ''

    if (!this.userPoolId || !this.clientId) {
      console.warn('[cognito-otp] ⚠️ Cognito credentials not fully configured')
    } else {
      console.log('[cognito-otp] ✅ AWS Cognito OTP Service initialized')
    }
  }

  /**
   * Send OTP to phone number
   */
  async sendOTP(phoneNumber: string, userId?: string): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      console.log(`[cognito-otp] Sending OTP to ${phoneNumber}`)

      // For new users, create them first
      if (userId) {
        await this.createUserIfNotExists(phoneNumber, userId)
      }

      // Send SMS OTP via AdminInitiateAuth
      const command = new AdminInitiateAuthCommand({
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        AuthParameters: {
          USERNAME: phoneNumber,
          PASSWORD: 'TempPassword123!',
        },
      })

      const response = await this.cognito.send(command)

      return {
        success: true,
        sessionId: response.Session,
      }
    } catch (error: any) {
      console.error('[cognito-otp] Error sending OTP:', error.message)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(phoneNumber: string, code: string, sessionId: string): Promise<{ success: boolean; tokens?: any; error?: string }> {
    try {
      console.log(`[cognito-otp] Verifying OTP for ${phoneNumber}`)

      const command = new AdminInitiateAuthCommand({
        UserPoolId: this.userPoolId,
        ClientId: this.clientId,
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        AuthParameters: {
          USERNAME: phoneNumber,
          PASSWORD: 'TempPassword123!',
          MFA_CODE: code,
        },
        Session: sessionId,
      })

      const response = await this.cognito.send(command)

      return {
        success: true,
        tokens: {
          idToken: response.AuthenticationResult?.IdToken,
          accessToken: response.AuthenticationResult?.AccessToken,
          refreshToken: response.AuthenticationResult?.RefreshToken,
        },
      }
    } catch (error: any) {
      console.error('[cognito-otp] Error verifying OTP:', error.message)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Create user with phone number
   */
  async createUserIfNotExists(phoneNumber: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const createCommand = new AdminCreateUserCommand({
        UserPoolId: this.userPoolId,
        Username: phoneNumber,
        TemporaryPassword: 'TempPassword123!',
        UserAttributes: [
          {
            Name: 'phone_number',
            Value: phoneNumber,
          },
          {
            Name: 'phone_number_verified',
            Value: 'false',
          },
          {
            Name: 'custom:user_id',
            Value: userId,
          },
        ],
        MessageAction: 'SUPPRESS',
      })

      await this.cognito.send(createCommand)

      // Set permanent password
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: this.userPoolId,
        Username: phoneNumber,
        Password: 'TempPassword123!',
        Permanent: true,
      })

      await this.cognito.send(setPasswordCommand)

      console.log(`[cognito-otp] ✅ User created: ${phoneNumber}`)

      return { success: true }
    } catch (error: any) {
      // User might already exist
      if (error.name === 'UsernameExistsException') {
        console.log(`[cognito-otp] User already exists: ${phoneNumber}`)
        return { success: true }
      }

      console.error('[cognito-otp] Error creating user:', error.message)
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get user by phone number
   */
  async getUserByPhone(phoneNumber: string): Promise<any> {
    try {
      const command = new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: phoneNumber,
      })

      const response = await this.cognito.send(command)
      return response
    } catch (error: any) {
      console.error('[cognito-otp] Error getting user:', error.message)
      return null
    }
  }

  /**
   * Delete user
   */
  async deleteUser(phoneNumber: string): Promise<boolean> {
    try {
      const command = new AdminDeleteUserCommand({
        UserPoolId: this.userPoolId,
        Username: phoneNumber,
      })

      await this.cognito.send(command)
      return true
    } catch (error: any) {
      console.error('[cognito-otp] Error deleting user:', error.message)
      return false
    }
  }

  /**
   * Verify phone number
   */
  async verifyPhoneNumber(phoneNumber: string): Promise<boolean> {
    try {
      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: this.userPoolId,
        Username: phoneNumber,
        UserAttributes: [
          {
            Name: 'phone_number_verified',
            Value: 'true',
          },
        ],
      })

      await this.cognito.send(command)
      return true
    } catch (error: any) {
      console.error('[cognito-otp] Error verifying phone:', error.message)
      return false
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!(this.userPoolId && this.clientId)
  }

  /**
   * Get service status
   */
  getStatus(): string {
    if (!this.userPoolId || !this.clientId) {
      return 'Not configured'
    }
    return 'Ready'
  }
}

export const cognitoOTPService = new CognitoOTPService()

export default {
  cognitoOTPService,
}
