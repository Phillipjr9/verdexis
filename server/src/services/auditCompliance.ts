import { prisma } from '../db.js'

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.suspend'
  | 'user.unsuspend'
  | 'transaction.create'
  | 'transaction.approve'
  | 'transaction.reject'
  | 'withdrawal.initiate'
  | 'withdrawal.approve'
  | 'withdrawal.reject'
  | 'kyc.submit'
  | 'kyc.approve'
  | 'kyc.reject'
  | 'security.2fa_enable'
  | 'security.2fa_disable'
  | 'security.password_change'
  | 'admin.action'

export interface AuditLog {
  id: string
  userId: string
  action: AuditAction
  resource: string
  resourceId: string
  changes: Record<string, unknown>
  ipAddress: string
  userAgent: string
  status: 'success' | 'failure'
  errorMessage?: string
  createdAt: Date
}

export class AuditComplianceService {
  /**
   * Log audit event
   */
  static async logAuditEvent(
    userId: string,
    action: AuditAction,
    resource: string,
    resourceId: string,
    changes: Record<string, unknown>,
    ipAddress: string,
    userAgent: string,
    status: 'success' | 'failure' = 'success',
    errorMessage?: string,
  ): Promise<AuditLog> {
    const log = await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        changes: JSON.stringify(changes),
        ipAddress,
        userAgent,
        status,
        errorMessage,
      },
    })

    return log
  }

  /**
   * Get audit trail for user
   */
  static async getUserAuditTrail(userId: string, limit: number = 100): Promise<AuditLog[]> {
    const logs = await prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return logs.map(log => ({
      ...log,
      changes: JSON.parse(log.changes),
    }))
  }

  /**
   * Get audit trail for resource
   */
  static async getResourceAuditTrail(resource: string, resourceId: string, limit: number = 100): Promise<AuditLog[]> {
    const logs = await prisma.auditLog.findMany({
      where: { resource, resourceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return logs.map(log => ({
      ...log,
      changes: JSON.parse(log.changes),
    }))
  }

  /**
   * Get audit trail for action
   */
  static async getActionAuditTrail(action: AuditAction, limit: number = 100): Promise<AuditLog[]> {
    const logs = await prisma.auditLog.findMany({
      where: { action },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return logs.map(log => ({
      ...log,
      changes: JSON.parse(log.changes),
    }))
  }

  /**
   * Search audit logs
   */
  static async searchAuditLogs(
    filters: {
      userId?: string
      action?: AuditAction
      resource?: string
      status?: 'success' | 'failure'
      startDate?: Date
      endDate?: Date
    },
    limit: number = 100,
  ): Promise<AuditLog[]> {
    const logs = await prisma.auditLog.findMany({
      where: {
        ...(filters.userId ? { userId: filters.userId } : {}),
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.resource ? { resource: filters.resource } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.startDate || filters.endDate
          ? {
              createdAt: {
                ...(filters.startDate ? { gte: filters.startDate } : {}),
                ...(filters.endDate ? { lte: filters.endDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return logs.map(log => ({
      ...log,
      changes: JSON.parse(log.changes),
    }))
  }

  /**
   * Track user action
   */
  static async trackUserAction(
    userId: string,
    action: string,
    details: Record<string, unknown>,
    ipAddress: string,
  ): Promise<void> {
    await prisma.userAction.create({
      data: {
        userId,
        action,
        details: JSON.stringify(details),
        ipAddress,
      },
    })
  }

  /**
   * Get user action history
   */
  static async getUserActionHistory(userId: string, limit: number = 50): Promise<any[]> {
    const actions = await prisma.userAction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return actions.map(a => ({
      ...a,
      details: JSON.parse(a.details),
    }))
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(startDate: Date, endDate: Date): Promise<any> {
    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    })

    const actionCounts: Record<string, number> = {}
    const statusCounts = { success: 0, failure: 0 }
    const userActions: Record<string, number> = {}

    for (const log of logs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1
      statusCounts[log.status]++
      userActions[log.userId] = (userActions[log.userId] || 0) + 1
    }

    return {
      period: { startDate, endDate },
      totalEvents: logs.length,
      actionCounts,
      statusCounts,
      successRate: logs.length > 0 ? ((statusCounts.success / logs.length) * 100).toFixed(2) + '%' : '0%',
      uniqueUsers: Object.keys(userActions).length,
      topUsers: Object.entries(userActions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, count })),
    }
  }

  /**
   * Export audit logs as CSV
   */
  static async exportAuditLogsCSV(startDate: Date, endDate: Date): Promise<string> {
    const logs = await prisma.auditLog.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      orderBy: { createdAt: 'asc' },
    })

    const headers = ['Timestamp', 'User ID', 'Action', 'Resource', 'Resource ID', 'Status', 'IP Address', 'Error']
    const rows = logs.map(log => [
      log.createdAt.toISOString(),
      log.userId,
      log.action,
      log.resource,
      log.resourceId,
      log.status,
      log.ipAddress,
      log.errorMessage || '',
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

    return csv
  }

  /**
   * Detect suspicious activity
   */
  static async detectSuspiciousActivity(userId: string): Promise<{ suspicious: boolean; reasons: string[] }> {
    const reasons: string[] = []

    // Check for multiple failed logins
    const failedLogins = await prisma.auditLog.count({
      where: {
        userId,
        action: 'user.login',
        status: 'failure',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    })

    if (failedLogins > 5) {
      reasons.push(`${failedLogins} failed login attempts in last hour`)
    }

    // Check for unusual transaction volume
    const recentTransactions = await prisma.transaction.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    })

    if (recentTransactions > 20) {
      reasons.push(`${recentTransactions} transactions in last hour`)
    }

    // Check for large withdrawal
    const largeWithdrawals = await prisma.transaction.findMany({
      where: {
        userId,
        kind: 'withdraw',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })

    const totalWithdrawn = largeWithdrawals.reduce((sum, t) => sum + t.amount, 0)
    if (totalWithdrawn > 100000) {
      reasons.push(`Large withdrawal: $${totalWithdrawn.toFixed(2)} in last 24 hours`)
    }

    // Check for IP changes
    const recentIPs = await prisma.auditLog.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { ipAddress: true },
      distinct: ['ipAddress'],
    })

    if (recentIPs.length > 3) {
      reasons.push(`Activity from ${recentIPs.length} different IP addresses in last 24 hours`)
    }

    return {
      suspicious: reasons.length > 0,
      reasons,
    }
  }

  /**
   * Archive old audit logs
   */
  static async archiveOldLogs(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)

    const result = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    })

    return result.count
  }
}

export const auditComplianceService = new AuditComplianceService()
