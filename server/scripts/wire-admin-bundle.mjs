#!/usr/bin/env node
/**
 * Ensures server/src/index.ts imports admin-bundle (staff scope + role + seed)
 * instead of the bare admin router.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const indexPath = path.join(__dirname, '../src/index.ts')

if (!fs.existsSync(indexPath)) {
  console.warn('[wire-admin-bundle] index.ts not found, skip')
  process.exit(0)
}

let src = fs.readFileSync(indexPath, 'utf8')
const before = src
src = src.replace(
  /from ['\"]\.\/routes\/admin\.js['\"]/g,
  "from './routes/admin-bundle.js'",
)
if (src === before) {
  if (src.includes('admin-bundle')) {
    console.log('[wire-admin-bundle] already using admin-bundle')
  } else {
    console.warn('[wire-admin-bundle] no admin.js import found to rewrite')
  }
} else {
  fs.writeFileSync(indexPath, src)
  console.log('[wire-admin-bundle] rewrote index.ts to import admin-bundle')
}
