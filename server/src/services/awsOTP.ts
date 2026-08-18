// AWS OTP Service - DISABLED due to SDK v2->v3 migration
// TODO: Migrate to AWS SDK v3
export class AWSOTPService {
  async sendOTP() {
    return { success: false, error: 'AWS OTP service disabled', provider: 'disabled' }
  }
  async verifyOTP() {
    return { success: false, error: 'AWS OTP service disabled' }
  }
  getStatus() {
    return { provider: 'disabled', configured: false, capabilities: [], region: 'us-east-1' }
  }
  async testConnection() {
    return { success: false, provider: 'disabled', latency: 0, error: 'AWS OTP service disabled' }
  }
}

export const awsOTPService = new AWSOTPService()
