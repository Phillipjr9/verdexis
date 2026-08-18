// AWS Cognito Service - DISABLED due to SDK v2->v3 migration issues  
// TODO: Migrate to AWS SDK v3
export class AWSCognitoService {
  async sendSMSOTP() {
    return { success: false, error: 'AWS Cognito service disabled' }
  }
  isConfigured() {
    return false
  }
}

export const awsCognitoService = new AWSCognitoService()
