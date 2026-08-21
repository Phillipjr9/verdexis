import type { Express } from 'express'
import adminConsoleRoutes from './routes/admin-console.js'
import adminDepositAddressRoutes from './routes/admin-deposit-addresses.js'
import adminPendingDepositsRoutes from './routes/admin-pending-deposits.js'

/** Mounts extra admin routers that are not part of the core admin.ts surface. */
export function mountAdminExtras(app: Express) {
  app.use('/api/admin', adminConsoleRoutes)
  app.use('/api/admin', adminDepositAddressRoutes)
  app.use('/api/admin', adminPendingDepositsRoutes)
}
