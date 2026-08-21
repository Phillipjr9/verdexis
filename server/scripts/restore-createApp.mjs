import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '../src/createApp.ts')

if (fs.existsSync(out) && fs.statSync(out).size > 15000) {
  console.log('[restore-createApp] using committed createApp.ts (', fs.statSync(out).size, 'bytes)')
  process.exit(0)
}

const single = path.join(__dirname, 'createApp.full.b64')
let b64 = ''
if (fs.existsSync(single)) {
  b64 = fs.readFileSync(single, 'utf8').trim()
} else {
  for (let i = 0; ; i++) {
    const p = path.join(__dirname, `createApp.full.b64.${i}`)
    if (!fs.existsSync(p)) break
    b64 += fs.readFileSync(p, 'utf8').trim()
  }
}

if (b64) {
  const buf = Buffer.from(b64, 'base64')
  fs.writeFileSync(out, buf)
  console.log('[restore-createApp] wrote', out, buf.length, 'bytes')
  process.exit(0)
}

const parts = []
for (let i = 0; i < 6; i++) {
  const p = path.join(__dirname, `createApp.b64.${i}`)
  if (!fs.existsSync(p)) {
    console.error('[restore-createApp] missing', p)
    process.exit(1)
  }
  parts.push(fs.readFileSync(p, 'utf8').trim())
}
const buf = Buffer.concat(parts.map((p) => Buffer.from(p, 'base64')))
fs.writeFileSync(out, buf)
console.log('[restore-createApp] wrote (legacy parts)', out, buf.length, 'bytes')
