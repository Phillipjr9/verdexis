import AWS from 'aws-sdk'
import { env } from '../env.js'

interface SMSResult {
  success: boolean
  messageId?: string
  error?: string
  cost?: string
}

export class AWSSNSService {
  private sns: AWS.SNS
  private region: string

  constructor() {
    this.region = env.AWS_REGION || 'us-east-1'
    
    // Configure AWS SDK
    AWS.config.update({
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      region: this.region
    })

    this.sns = new AWS.SNS({ region: this.region })
  }

  /**
   * Send SMS via AWS SNS
   */
  async sendSMS(phoneNumber: string, message: string): Promise<SMSResult> {
    try {
      const params: AWS.SNS.PublishInput = {
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
          },
          'AWS.SNS.SMS.MaxPrice': {
            DataType: 'String',
            StringValue: '1.00' // Max $1 per message
          }
        }
      }

      const result = await this.sns.publish(params).promise()

      console.log(`[AWS SNS] SMS sent to ${phoneNumber}, MessageId: ${result.MessageId}`)

      return {
        success: true,
        messageId: result.MessageId
      }
    } catch (error) {
      console.error('[AWS SNS] SMS send failed:', error)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS send failed'
      }
    }
  }

  /**
   * Send OTP via SMS
   */
  async sendOTP(phoneNumber: string, code: string, expirationMinutes: number = 10): Promise<SMSResult> {
    const message = `Your Verdexis verification code: ${code}\n\nValid for ${expirationMinutes} minutes. Never share this code.\n\nIf you didn't request this, ignore this message.`
    
    return this.sendSMS(phoneNumber, message)
  }

  /**
   * Send security alert
   */
  async sendSecurityAlert(phoneNumber: string, alertType: string): Promise<SMSResult> {
    const message = `Verdexis Security Alert: ${alertType}\n\nIf this wasn't you, secure your account immediately at ${env.APP_BASE_URL}/security`
    
    return this.sendSMS(phoneNumber, message)
  }

  /**
   * Check SMS delivery status
   */
  async checkDeliveryStatus(messageId: string): Promise<{
    status: string
    deliveredAt?: Date
    errorMessage?: string
  }> {
    try {
      const params = {
        MessageId: messageId
      }

      // Note: SNS doesn't provide delivery receipts by default
      // You need to configure delivery status logging
      // This is a placeholder for the API structure
      
      return {
        status: 'delivered', // Would be actual status from AWS
        deliveredAt: new Date()
      }
    } catch (error) {
      return {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Status check failed'
      }
    }
  }

  /**
   * Get SMS pricing for a phone number
   */
  async getSMSPricing(phoneNumber: string): Promise<{ price: string; currency: string }> {
    try {
      // This would use AWS SNS pricing API or pre-configured rates
      const countryCode = this.getCountryCode(phoneNumber)
      
      // Sample pricing - in production, fetch from AWS pricing API
      const pricing = {
        'US': '0.00645',
        'CA': '0.00645', 
        'GB': '0.03330',
        'DE': '0.07750',
        'FR': '0.07750',
        'default': '0.10000'
      }

      return {
        price: pricing[countryCode as keyof typeof pricing] || pricing.default,
        currency: 'USD'
      }
    } catch (error) {
      return { price: '0.10', currency: 'USD' }
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
   * Get country code from phone number
   */
  private getCountryCode(phoneNumber: string): string {
    const formatted = this.formatPhoneNumber(phoneNumber)
    
    if (formatted.startsWith('+1')) return 'US'
    if (formatted.startsWith('+44')) return 'GB'
    if (formatted.startsWith('+49')) return 'DE'
    if (formatted.startsWith('+33')) return 'FR'
    
    return 'default'
  }

  /**
   * Validate phone number
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    const formatted = this.formatPhoneNumber(phoneNumber)
    const e164Regex = /^\+[1-9]\d{1,14}$/
    return e164Regex.test(formatted)
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY)
  }
}

export const awsSNSService = new AWSSNSService()