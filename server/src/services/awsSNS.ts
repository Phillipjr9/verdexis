// AWS SNS Service - DISABLED due to SDK v2->v3 migration issues
// TODO: Migrate to AWS SDK v3
export class AWSSNSService {
  async sendSMS() {
    return { success: false, error: 'AWS SNS service disabled' }
  }
  async sendOTP() {
    return { success: false, error: 'AWS SNS service disabled' }
  }
  isConfigured() {
    return false
  }
}

export const awsSNSService = new AWSSNSService()
