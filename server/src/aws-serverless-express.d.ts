declare module 'aws-serverless-express' {
  import { Request, Response } from 'express'

  interface Server {
    address(): string | null
    close(): void
  }

  interface ProxyResult {
    (server: Server, event: any, context: any, callback?: (err: Error | null, result?: any) => void): void
    (server: Server, event: any, context: any): Promise<void>
  }

  interface CreateServer {
    (app: any, config?: any): Server
    proxy: ProxyResult
  }

  const awsServerlessExpress: {
    createServer: CreateServer
    proxy: ProxyResult
  }

  export default awsServerlessExpress
}
