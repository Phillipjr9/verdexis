import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(__dirname, 'admin_ts_b64')
const out = path.join(__dirname, '../src/routes/admin.ts')

if (!fs.existsSync(dir)) {
  console.error('[restore-admin] missing', dir)
  process.exit(1)
}

const parts = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.txt'))
  .sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]))

if (!parts.length) {
  console.error('[restore-admin] no chunks')
  process.exit(1)
}

const b64 = parts.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('')
const buf = Buffer.from(b64, 'base64')
fs.writeFileSync(out, buf)
console.log('[restore-admin] wrote', out, buf.length, 'bytes')
