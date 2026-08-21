import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '../src/createApp.ts')
const parts = []
for (let i = 0; ; i++) {
  const p = path.join(__dirname, `createApp.b64.${i}`)
  if (!fs.existsSync(p)) break
  parts.push(fs.readFileSync(p, 'utf8').trim())
}
if (!parts.length) {
  console.error('[restore-createApp] no b64 parts found')
  process.exit(1)
}
const buf = Buffer.concat(parts.map((p) => Buffer.from(p, 'base64')))
fs.writeFileSync(out, buf)
console.log('[restore-createApp] wrote', out, buf.length, 'bytes')
