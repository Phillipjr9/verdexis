const AWS = require('aws-sdk');

class FullCognitoAuth {
  constructor() {
    this.cognito = new AWS.CognitoIdentityServiceProvider({
      region: process.env.AWS_REGION
    });
    
    this.cognitoIdentity = new AWS.CognitoIdentity({
      region: 'us-east-1' // Identity pools are in us-east-1
    });

    this.userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
    this.clientId = process.env.AWS_COGNITO_CLIENT_ID;
    this.identityPoolId = process.env.AWS_COGNITO_IDENTITY_POOL_ID;
  }

  // Get AWS credentials for authenticated user
  async getAWSCredentials(idToken) {
    try {
      const loginKey = `cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${this.userPoolId}`;
      
      const params = {
        IdentityPoolId: this.identityPoolId,
        Logins: {
          [loginKey]: idToken
        }
      };

      const identityResult = await this.cognitoIdentity.getId(params).promise();
      
      const credentialsParams = {
        IdentityId: identityResult.IdentityId,
        Logins: {
          [loginKey]: idToken
        }
      };

      const credentials = await this.cognitoIdentity.getCredentialsForIdentity(credentialsParams).promise();
      
      return {
        success: true,
        identityId: identityResult.IdentityId,
        credentials: {
          accessKeyId: credentials.Credentials.AccessKeyId,
          secretAccessKey: credentials.Credentials.SecretKey,
          sessionToken: credentials.Credentials.SessionToken,
          expiration: credentials.Credentials.Expiration
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Complete authentication with AWS credentials
  async authenticateUser(email, password) {
    try {
      // Step 1: Authenticate with Cognito
      const authParams = {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      };

      const authResult = await this.cognito.initiateAuth(authParams).promise();
      
      if (authResult.AuthenticationResult) {
        const { IdToken, AccessToken, RefreshToken } = authResult.AuthenticationResult;
        
        // Step 2: Get AWS credentials
        const credentialsResult = await this.getAWSCredentials(IdToken);
        
        return {
          success: true,
          tokens: {
            idToken: IdToken,
            accessToken: AccessToken,
            refreshToken: RefreshToken
          },
          awsCredentials: credentialsResult.success ? credentialsResult.credentials : null,
          identityId: credentialsResult.identityId
        };
      }
      
      return { success: false, error: 'Authentication failed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Configure AWS SDK with user credentials
  configureAWS(credentials) {
    AWS.config.update({
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
      region: process.env.AWS_REGION
    });
    
    return {
      success: true,
      message: 'AWS SDK configured with user credentials'
    };
  }
}

module.exports = FullCognitoAuth;