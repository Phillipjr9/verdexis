// server/src/lambda.ts
// AWS Lambda handler for Express app

import awsServerlessExpress from 'aws-serverless-express';
import app from './app.js';

let server: any;

export const handler = async (event: any, context: any) => {
  console.log('Lambda handler invoked', { 
    path: event.path,
    method: event.httpMethod,
    headers: Object.keys(event.headers || {})
  });

  if (!server) {
    server = awsServerlessExpress.createServer(app);
  }

  return awsServerlessExpress.proxy(server, event, context);
};
