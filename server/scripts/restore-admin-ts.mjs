import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(__dirname, '../src/routes/admin.ts')
const p1 = path.join(__dirname, 'admin.ts.b64.1')
const p2 = path.join(__dirname, 'admin.ts.b64.2')
const single = path.join(__dirname, 'admin.ts.b64')
const dir = path.join(__dirname, 'admin_ts_b64')

let b64 = ''
if (fs.existsSync(p1) && fs.existsSync(p2)) {
  b64 = fs.readFileSync(p1, 'utf8') + fs.readFileSync(p2, 'utf8')
} else if (fs.existsSync(single)) {
  b64 = fs.readFileSync(single, 'utf8').trim()
} else if (fs.existsSync(dir)) {
  const parts = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.txt'))
    .sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]))
  b64 = parts.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('')
} else {
  console.error('[restore-admin] missing admin.ts.b64 parts')
  process.exit(1)
}

const buf = Buffer.from(b64.replace(/\s+/g, ''), 'base64')
fs.writeFileSync(out, buf)
console.log('[restore-admin] wrote', out, buf.length, 'bytes')
