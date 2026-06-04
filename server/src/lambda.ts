import awsServerlessExpress from 'aws-serverless-express'
import app from './index.js'

// Note: This must be the default export
const server = awsServerlessExpress.createServer(app)

export const handler = (event: any, context: any) => {
  awsServerlessExpress.proxy(server, event, context)
}
