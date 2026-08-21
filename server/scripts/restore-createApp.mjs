/**
 * Ensures server/src/createApp.ts exists before tsc.
 * Prefer the committed file whenever it is a real module (not PLACEHOLDER / empty).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '../src/createApp.ts')

function isUsableCreateApp(text) {
  if (!text || text.length < 50) return false
  if (/PLACEHOLDER/i.test(text)) return false
  return text.includes('export default') || text.includes('export function startServer')
}

if (fs.existsSync(out)) {
  const existing = fs.readFileSync(out, 'utf8')
  if (isUsableCreateApp(existing)) {
    console.log('[restore-createApp] using committed createApp.ts (', existing.length, 'bytes)')
    process.exit(0)
  }
  console.warn('[restore-createApp] committed createApp.ts is invalid; will restore')
}

const GOOD_URL =
  'https://raw.githubusercontent.com/Phillipjr9/verdexis/main/server/src/createApp.ts'

async function main() {
  // Prefer a minimal re-export of app.ts (matches current architecture).
  const thin = `/**\n * App factory / server entry used by index.ts.\n * Routes live in app.ts; this module re-exports the Express app and starts the HTTP server.\n */\nimport { pathToFileURL } from 'node:url'\nimport app from './app.js'\nimport { env } from './env.js'\n\nexport default app\n\nexport function startServer() {\n  const port = Number(env.PORT) || 3000\n  const server = app.listen(port, () => {\n    console.log(\`[verdexis-api] listening on :\${port}\`)\n  })\n  return server\n}\n\nif (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {\n  startServer()\n}\n`

  try {
    console.log('[restore-createApp] downloading', GOOD_URL)
    const res = await fetch(GOOD_URL)
    if (res.ok) {
      const text = await res.text()
      if (isUsableCreateApp(text)) {
        fs.writeFileSync(out, text)
        console.log('[restore-createApp] wrote from main', out, text.length, 'bytes')
        return
      }
    }
  } catch (err) {
    console.warn('[restore-createApp] download failed, using thin fallback', err)
  }

  fs.writeFileSync(out, thin)
  console.log('[restore-createApp] wrote thin fallback', out, thin.length, 'bytes')
}

main().catch((err) => {
  console.error('[restore-createApp] failed', err)
  process.exit(1)
})
