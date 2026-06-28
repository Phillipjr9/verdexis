// AWS Lambda function for serverless OTP processing
import { SNS } from 'aws-sdk'
import { DynamoDB } from 'aws-sdk'

const sns = new SNS()
const dynamodb = new DynamoDB.DocumentClient()
const OTP_TABLE = process.env.OTP_TABLE_NAME || 'verdexis-otp-codes'

export const handler = async (event: any) => {
  try {
    const { httpMethod, path, body } = event
    
    if (httpMethod === 'POST' && path === '/send-otp') {
      return await handleSendOTP(JSON.parse(body))
    }
    
    if (httpMethod === 'POST' && path === '/verify-otp') {
      return await handleVerifyOTP(JSON.parse(body))
    }
    
    return createResponse(400, { error: 'Invalid request' })
    
  } catch (error) {
    return createResponse(500, { error: 'Internal server error' })
  }
}

async function handleSendOTP(data: any) {
  const { phoneNumber, code, purpose, expirationMinutes = 10 } = data
  
  try {
    const otpRecord = {
      pk: `otp#${phoneNumber}`,
      sk: `code#${Date.now()}`,
      code: hashCode(code),
      phoneNumber,
      expiresAt: Math.floor(Date.now() / 1000) + (expirationMinutes * 60),
      used: false
    }

    await dynamodb.put({ TableName: OTP_TABLE, Item: otpRecord }).promise()

    const message = `Your Verdexis verification code: ${code}\nValid for ${expirationMinutes} minutes.`
    
    const result = await sns.publish({
      Message: message,
      PhoneNumber: phoneNumber,
      MessageAttributes: {
        'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: 'Verdexis' }
      }
    }).promise()

    return createResponse(200, { success: true, messageId: result.MessageId })
  } catch (error) {
    return createResponse(500, { error: 'Failed to send OTP' })
  }
}

async function handleVerifyOTP(data: any) {
  const { phoneNumber, code } = data
  
  try {
    const result = await dynamodb.query({
      TableName: OTP_TABLE,
      KeyConditionExpression: 'pk = :pk',
      FilterExpression: '#used = :false AND #expiresAt > :now',
      ExpressionAttributeNames: { '#used': 'used', '#expiresAt': 'expiresAt' },
      ExpressionAttributeValues: {
        ':pk': `otp#${phoneNumber}`,
        ':false': false,
        ':now': Math.floor(Date.now() / 1000)
      },
      Limit: 1
    }).promise()

    if (!result.Items?.length || hashCode(code) !== result.Items[0].code) {
      return createResponse(400, { error: 'Invalid code' })
    }

    const otpRecord = result.Items[0]
    await dynamodb.update({
      TableName: OTP_TABLE,
      Key: { pk: otpRecord.pk, sk: otpRecord.sk },
      UpdateExpression: 'SET #used = :true',
      ExpressionAttributeNames: { '#used': 'used' },
      ExpressionAttributeValues: { ':true': true }
    }).promise()

    return createResponse(200, { success: true, verified: true })
  } catch (error) {
    return createResponse(500, { error: 'Failed to verify OTP' })
  }
}

function hashCode(code: string): string {
  const crypto = require('crypto')
  return crypto.createHash('sha256').update(code).digest('hex')
}

function createResponse(statusCode: number, body: any) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body)
  }
}