import { prisma } from '../dist/db.js'
import fs from 'node:fs'
const payload = JSON.parse(fs.readFileSync('/tmp/signup_payload.json','utf8'))
const email = payload.email
const rows = await prisma.$queryRawUnsafe('SELECT id,email,address,prefs FROM "User" WHERE email = $1 LIMIT 1', email)
console.log(rows)
await prisma.$disconnect()
