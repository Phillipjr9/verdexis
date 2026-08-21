import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '../src/createApp.ts')
const PART_COUNT = 7
const parts = []
for (let i = 0; i < PART_COUNT; i++) {
  const p = path.join(__dirname, `createApp.b64.${i}`)
  if (!fs.existsSync(p)) {
    console.error('[restore-createApp] missing', p)
    process.exit(1)
  }
  parts.push(fs.readFileSync(p, 'utf8').trim())
}
const buf = Buffer.concat(parts.map((p) => Buffer.from(p, 'base64')))
fs.writeFileSync(out, buf)
console.log('[restore-createApp] wrote', out, buf.length, 'bytes')
