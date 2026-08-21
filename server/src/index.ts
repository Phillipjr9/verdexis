/**
 * API entrypoint. App wiring lives in createApp.ts.
 */
import { pathToFileURL } from 'node:url'
import app, { startServer } from './createApp.js'

export default app

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer()
}
