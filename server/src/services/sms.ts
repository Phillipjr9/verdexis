import { env } from '../env.js'

interface SMSResponse {
  success: boolean
  messageId?: string
  error?: string
}

export class SMSService {
  private twilioClient: any = null
  private awsSNS: any = null

  constructor() {
    this.initializeProviders()
  }

  private initializeProviders() {
    // Initialize Twilio if credentials available
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      try {
        const twilio = require('twilio')
        this.twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
      } catch (error) {
        console.warn('[sms] Twilio not available:', error)
      }
    }

    // Initialize AWS SNS if credentials available
    if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
      try {
        const AWS = require('aws-sdk')
        this.awsSNS = new AWS.SNS({
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          region: env.AWS_REGION || 'us-east-1'
        })
      } catch (error) {
        console.warn('[sms] AWS SNS not available:', error)
      }
    }
  }

  /**
   * Send SMS via available provider
   */
  async sendSMS(phoneNumber: string, message: string): Promise<SMSResponse> {
    // Try Twilio first
    if (this.twilioClient) {
      return this.sendViaTwilio(phoneNumber, message)
    }

    // Fallback to AWS SNS
    if (this.awsSNS) {
      return this.sendViaAWS(phoneNumber, message)
    }

    // No provider available - log for development
    console.log('[sms] Would send SMS to:', phoneNumber)
    console.log('[sms] Message:', message)
    
    return { success: true, messageId: 'dev-mode' }
  }

  /**
   * Send OTP via SMS
   */
  async sendOTP(phoneNumber: string, code: string, expirationMinutes: number = 10): Promise<SMSResponse> {
    const message = `Your Verdexis verification code is: ${code}. Valid for ${expirationMinutes} minutes. Never share this code.`
    return this.sendSMS(phoneNumber, message)
  }

  /**
   * Send security alert via SMS
   */
  async sendSecurityAlert(phoneNumber: string, alertType: string, details: string): Promise<SMSResponse> {
    const message = `Verdexis Security Alert: ${alertType}. ${details}. If this wasn't you, secure your account immediately.`
    return this.sendSMS(phoneNumber, message)
  }

  /**
   * Send transaction notification via SMS
   */
  async sendTransactionAlert(
    phoneNumber: string, 
    type: string, 
    amount: string, 
    currency: string
  ): Promise<SMSResponse> {
    const message = `Verdexis: ${type} of ${amount} ${currency} processed. Check your account for details.`
    return this.sendSMS(phoneNumber, message)
  }

  /**
   * Send via Twilio
   */
  private async sendViaTwilio(phoneNumber: string, message: string): Promise<SMSResponse> {
    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: env.TWILIO_PHONE_NUMBER,
        to: this.formatPhoneNumber(phoneNumber)
      })

      return {
        success: true,
        messageId: result.sid
      }
    } catch (error) {
      console.error('[sms] Twilio error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS send failed'
      }
    }
  }

  /**
   * Send via AWS SNS
   */
  private async sendViaAWS(phoneNumber: string, message: string): Promise<SMSResponse> {
    try {
      const params = {
        Message: message,
        PhoneNumber: this.formatPhoneNumber(phoneNumber),
        MessageAttributes: {
          'AWS.SNS.SMS.SenderID': {
            DataType: 'String',
            StringValue: 'Verdexis'
          },
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional'
          }
        }
      }

      const result = await this.awsSNS.publish(params).promise()

      return {
        success: true,
        messageId: result.MessageId
      }
    } catch (error) {
      console.error('[sms] AWS SNS error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS send failed'
      }
    }
  }

  /**
   * Format phone number to E.164
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    const digits = phoneNumber.replace(/\D/g, '')
    
    // Add country code if missing
    if (digits.length === 10) {
      return `+1${digits}` // Assume US/Canada
    }
    
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    }
    
    // Already formatted or international
    if (phoneNumber.startsWith('+')) {
      return phoneNumber
    }
    
    return `+${digits}`
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    const formatted = this.formatPhoneNumber(phoneNumber)
    const e164Regex = /^\+[1-9]\d{1,14}$/
    return e164Regex.test(formatted)
  }

  /**
   * Check if SMS service is available
   */
  isAvailable(): boolean {
    return !!(this.twilioClient || this.awsSNS)
  }

  /**
   * Get available provider name
   */
  getProviderName(): string {
    if (this.twilioClient) return 'Twilio'
    if (this.awsSNS) return 'AWS SNS'
    return 'Development (Log Only)'
  }
}

export const smsService = new SMSService()