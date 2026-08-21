/**
 * App factory / server entry used by index.ts.
 * Routes live in app.ts; this module re-exports the Express app and starts the HTTP server.
 */
import { pathToFileURL } from 'node:url'
import app from './app.js'
import { env } from './env.js'

export default app

export function startServer() {
  const port = Number(env.PORT) || 3000
  const server = app.listen(port, () => {
    console.log(`[verdexis-api] listening on :${port}`)
  })
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer()
}
