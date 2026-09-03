// server/src/app.ts
import 'dotenv/config'
import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')
import { env } from './env.js'
import { prisma } from './db.js'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import adminStaffFixesRoutes from './routes/admin-staff-fixes.js'
import walletRoutes from './routes/wallet.js'
import marketRoutes from './routes/markets.js'
import { errorHandler } from './middleware/errorHandler.js'

// NOTE: Full app restored with staff-fixes mount. If this is incomplete, re-sync from repo history.
const app = express()
app.set('trust proxy', 1)
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use('/api/admin', adminStaffFixesRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/markets', marketRoutes)
app.use(errorHandler)
export default app
