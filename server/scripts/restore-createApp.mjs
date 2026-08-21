/**
 * Ensures server/src/createApp.ts exists before tsc.
 * 1) Prefer an already-committed createApp.ts
 * 2) Else download the last known-good server entry from GitHub and patch it
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '../src/createApp.ts')

if (fs.existsSync(out) && fs.statSync(out).size > 15000) {
  console.log('[restore-createApp] using committed createApp.ts (', fs.statSync(out).size, 'bytes)')
  process.exit(0)
}

const GOOD_URL =
  'https://raw.githubusercontent.com/Phillipjr9/verdexis/40d03390ee467d90ef6b975fe4731530ebde5c62/server/src/index.ts'

async function main() {
  console.log('[restore-createApp] downloading', GOOD_URL)
  const res = await fetch(GOOD_URL)
  if (!res.ok) {
    console.error('[restore-createApp] download failed', res.status, res.statusText)
    process.exit(1)
  }
  let text = await res.text()

  if (!text.includes('mountAdminExtras')) {
    text = text.replace(
      "import adminRoutes from './routes/admin.js'",
      "import adminRoutes from './routes/admin.js'\nimport { mountAdminExtras } from './mountAdminExtras.js'",
    )
    text = text.replace(
      "app.use('/api/admin', adminRoutes)\napp.use('/api/swap'",
      "app.use('/api/admin', adminRoutes)\nmountAdminExtras(app)\napp.use('/api/swap'",
    )
  }

  const guard =
    "if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {"
  if (text.includes(guard)) {
    text = text.replace(guard, 'export function startServer() {')
  } else if (!text.includes('export function startServer')) {
    console.error('[restore-createApp] could not locate main listen guard to rewrite')
    process.exit(1)
  }

  fs.writeFileSync(out, text)
  console.log('[restore-createApp] wrote', out, text.length, 'bytes')
}

main().catch((err) => {
  console.error('[restore-createApp] failed', err)
  process.exit(1)
})
