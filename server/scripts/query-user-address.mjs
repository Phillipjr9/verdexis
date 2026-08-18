import { prisma } from '../dist/db.js'
import fs from 'node:fs'
const payload = JSON.parse(fs.readFileSync('/tmp/signup_payload.json','utf8'))
const email = payload.email
const u = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, address: true, prefs: true } })
console.log(u)
process.exit(0)
