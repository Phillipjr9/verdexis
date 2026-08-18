import AWS from 'aws-sdk'
import { env } from '../env.js'

interface CognitoConfig {
  userPoolId: string
  clientId: string
  region: string
}

interface CognitoOTPResult {
  success: boolean
  challengeName?: string
  session?: string
  error?: string
}

export class AWSCognitoService {
  private cognito: AWS.CognitoIdentityServiceProvider
  private config: CognitoConfig

  constructor() {
    this.config = {
      userPoolId: env.AWS_COGNITO_USER_POOL_ID || '',
      clientId: env.AWS_COGNITO_CLIENT_ID || '',
      region: env.AWS_REGION || 'us-east-1'
    }

    AWS.config.update({
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      region: this.config.region
    })

    this.cognito = new AWS.CognitoIdentityServiceProvider({ 
      region: this.config.region 
    })
  }

  /**
   * Create Cognito user with phone number
   */
  async createUser(email: string, phoneNumber: string, temporaryPassword: string): Promise<{
    success: boolean
    userSub?: string
    error?: string
  }> {
    try {
      const params = {
        UserPoolId: this.config.userPoolId,
        Username: email,
        TemporaryPassword: temporaryPassword,
        MessageAction: 'SUPPRESS', // Don't send welcome email
        UserAttributes: [
          {
            Name: 'email',
            Value: email
          },
          {
            Name: 'phone_number',
            Value: this.formatPhoneNumber(phoneNumber)
          },
          {
            Name: 'email_verified',
            Value: 'false'
          },
          {
            Name: 'phone_number_verified',
            Value: 'false'
          }
        ]
      }

      const result = await this.cognito.adminCreateUser(params).promise()

      return {
        success: true,
        userSub: result.User?.Username
      }
    } catch (error) {
      console.error('[Cognito] Create user failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User creation failed'
      }
    }
  }

  /**
   * Initiate SMS OTP for phone verification
   */
  async sendSMSOTP(username: string): Promise<CognitoOTPResult> {
    try {
      const params = {
        ClientId: this.config.clientId,
        Username: username,
        AuthFlow: 'CUSTOM_AUTH',
        AuthParameters: {
          USERNAME: username
        }
      }

      const result = await this.cognito.initiateAuth(params).promise()

      return {
        success: true,
        challengeName: result.ChallengeName,
        session: result.Session
      }
    } catch (error) {
      console.error('[Cognito] SMS OTP send failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS OTP send failed'
      }
    }
  }

  /**
   * Verify SMS OTP code
   */
  async verifySMSOTP(
    username: string, 
    code: string, 
    session: string
  ): Promise<CognitoOTPResult> {
    try {
      const params = {
        ClientId: this.config.clientId,
        ChallengeName: 'SMS_MFA',
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          SMS_MFA_CODE: code
        }
      }

      const result = await this.cognito.respondToAuthChallenge(params).promise()

      return {
        success: true,
        session: result.Session
      }
    } catch (error) {
      console.error('[Cognito] SMS OTP verify failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS OTP verification failed'
      }
    }
  }

  /**
   * Enable SMS MFA for user
   */
  async enableSMSMFA(username: string): Promise<{ success: boolean; error?: string }> {
    try {
      const params = {
        UserPoolId: this.config.userPoolId,
        Username: username,
        MFAOptions: [{
          DeliveryMedium: 'SMS',
          AttributeName: 'phone_number'
        }]
      }

      await this.cognito.adminSetUserMFAPreference({
        UserPoolId: this.config.userPoolId,
        Username: username,
        SMSMfaSettings: {
          Enabled: true,
          PreferredMfa: true
        }
      }).promise()

      return { success: true }
    } catch (error) {
      console.error('[Cognito] Enable SMS MFA failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS MFA enable failed'
      }
    }
  }

  /**
   * Associate software token (TOTP) with user
   */
  async setupTOTP(accessToken: string): Promise<{
    success: boolean
    secretCode?: string
    error?: string
  }> {
    try {
      const result = await this.cognito.associateSoftwareToken({
        AccessToken: accessToken
      }).promise()

      return {
        success: true,
        secretCode: result.SecretCode
      }
    } catch (error) {
      console.error('[Cognito] TOTP setup failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'TOTP setup failed'
      }
    }
  }

  /**
   * Verify and enable software token (TOTP)
   */
  async enableTOTP(accessToken: string, code: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      await this.cognito.verifySoftwareToken({
        AccessToken: accessToken,
        UserCode: code
      }).promise()

      // Set software token MFA as preferred
      await this.cognito.setUserMFAPreference({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: {
          Enabled: true,
          PreferredMfa: true
        }
      }).promise()

      return { success: true }
    } catch (error) {
      console.error('[Cognito] TOTP enable failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'TOTP enable failed'
      }
    }
  }

  /**
   * Get user MFA options
   */
  async getUserMFAOptions(username: string): Promise<{
    smsEnabled: boolean
    totpEnabled: boolean
    error?: string
  }> {
    try {
      const params = {
        UserPoolId: this.config.userPoolId,
        Username: username
      }

      const user = await this.cognito.adminGetUser(params).promise()
      
      const smsEnabled = user.MFAOptions?.some(option => 
        option.DeliveryMedium === 'SMS'
      ) || false

      const totpEnabled = user.UserMFASettingList?.includes('SOFTWARE_TOKEN_MFA') || false

      return {
        smsEnabled,
        totpEnabled
      }
    } catch (error) {
      console.error('[Cognito] Get MFA options failed:', error)
      return {
        smsEnabled: false,
        totpEnabled: false,
        error: error instanceof Error ? error.message : 'Get MFA options failed'
      }
    }
  }

  /**
   * Send custom OTP via Lambda trigger
   */
  async sendCustomOTP(
    phoneNumber: string, 
    code: string, 
    purpose: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // This would trigger a custom Lambda function to send OTP
      const lambda = new AWS.Lambda({ region: this.config.region })
      
      const params = {
        FunctionName: env.AWS_LAMBDA_OTP_FUNCTION || 'verdexis-send-otp',
        Payload: JSON.stringify({
          phoneNumber: this.formatPhoneNumber(phoneNumber),
          code,
          purpose,
          timestamp: Date.now()
        })
      }

      const result = await lambda.invoke(params).promise()
      
      if (result.StatusCode === 200) {
        return { success: true }
      } else {
        return { 
          success: false, 
          error: `Lambda invocation failed with status ${result.StatusCode}` 
        }
      }
    } catch (error) {
      console.error('[Cognito] Custom OTP send failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Custom OTP send failed'
      }
    }
  }

  /**
   * Format phone number to E.164
   */
  private formatPhoneNumber(phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, '')
    
    if (digits.length === 10) {
      return `+1${digits}`
    }
    
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    }
    
    if (phoneNumber.startsWith('+')) {
      return phoneNumber
    }
    
    return `+${digits}`
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.userPoolId && 
      this.config.clientId && 
      env.AWS_ACCESS_KEY_ID && 
      env.AWS_SECRET_ACCESS_KEY
    )
  }
}

export const awsCognitoService = new AWSCognitoService()