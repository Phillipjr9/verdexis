const AWS = require('aws-sdk');

class AuditLoggingService {
  constructor() {
    this.cloudwatch = new AWS.CloudWatch({
      region: process.env.AWS_REGION
    });
    this.auditLogs = [];
  }

  // Log user action
  async logAction(userId, action, details, ipAddress, status = 'success') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId,
      action,
      details,
      ipAddress,
      status,
      userAgent: details.userAgent || 'Unknown'
    };

    this.auditLogs.push(logEntry);

    // Send to CloudWatch
    await this.sendToCloudWatch(logEntry);

    return logEntry;
  }

  // Send log to CloudWatch
  async sendToCloudWatch(logEntry) {
    try {
      const params = {
        MetricData: [
          {
            MetricName: `Verdexis-${logEntry.action}`,
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date(),
            Dimensions: [
              {
                Name: 'Status',
                Value: logEntry.status
              },
              {
                Name: 'Action',
                Value: logEntry.action
              }
            ]
          }
        ],
        Namespace: 'Verdexis/Audit'
      };

      await this.cloudwatch.putMetricData(params).promise();
    } catch (error) {
      console.error('CloudWatch error:', error);
    }
  }

  // Log authentication events
  async logAuthEvent(userId, eventType, details, ipAddress) {
    const authEvents = {
      login: 'User login',
      logout: 'User logout',
      passwordChange: 'Password changed',
      passwordReset: 'Password reset',
      2faEnabled: '2FA enabled',
      2faDisabled: '2FA disabled',
      sessionTimeout: 'Session timeout',
      failedLogin: 'Failed login attempt'
    };

    return this.logAction(
      userId,
      authEvents[eventType] || eventType,
      details,
      ipAddress,
      eventType.startsWith('failed') ? 'failure' : 'success'
    );
  }

  // Log trading events
  async logTradeEvent(userId, tradeDetails, ipAddress) {
    return this.logAction(
      userId,
      'Trade Executed',
      {
        symbol: tradeDetails.symbol,
        type: tradeDetails.type,
        quantity: tradeDetails.quantity,
        price: tradeDetails.price,
        total: tradeDetails.total
      },
      ipAddress
    );
  }

  // Log transaction events
  async logTransactionEvent(userId, transactionDetails, ipAddress) {
    return this.logAction(
      userId,
      transactionDetails.type === 'deposit' ? 'Deposit' : 'Withdrawal',
      {
        amount: transactionDetails.amount,
        currency: transactionDetails.currency,
        status: transactionDetails.status
      },
      ipAddress
    );
  }

  // Log security events
  async logSecurityEvent(userId, eventType, details, ipAddress) {
    return this.logAction(
      userId,
      `Security - ${eventType}`,
      details,
      ipAddress,
      details.severity || 'info'
    );
  }

  // Log KYC events
  async logKYCEvent(userId, kycStatus, details, ipAddress) {
    return this.logAction(
      userId,
      `KYC - ${kycStatus}`,
      details,
      ipAddress
    );
  }

  // Log admin actions
  async logAdminAction(adminId, targetUserId, action, details, ipAddress) {
    return this.logAction(
      adminId,
      `Admin - ${action}`,
      {
        targetUser: targetUserId,
        ...details
      },
      ipAddress
    );
  }

  // Get audit logs for user
  getAuditLogs(userId, limit = 100) {
    return this.auditLogs
      .filter(log => log.userId === userId)
      .slice(-limit)
      .reverse();
  }

  // Get audit logs for time range
  getAuditLogsByTimeRange(startTime, endTime) {
    return this.auditLogs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= startTime && logTime <= endTime;
    });
  }

  // Get failed login attempts
  getFailedLoginAttempts(userId, hours = 24) {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    return this.auditLogs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return log.userId === userId &&
             log.action === 'Failed login attempt' &&
             logTime > cutoff;
    });
  }

  // Get suspicious activities
  getSuspiciousActivities(userId) {
    const suspiciousActions = [
      'Failed login attempt',
      'Security - IP Change',
      'Security - Device Change',
      'Security - Unusual Activity'
    ];

    return this.auditLogs.filter(log => {
      return log.userId === userId &&
             suspiciousActions.includes(log.action);
    });
  }

  // Export audit logs
  exportAuditLogs(userId, format = 'json') {
    const logs = this.getAuditLogs(userId, 1000);

    if (format === 'csv') {
      return this.convertToCSV(logs);
    }

    return JSON.stringify(logs, null, 2);
  }

  // Convert to CSV
  convertToCSV(logs) {
    const headers = ['Timestamp', 'Action', 'Status', 'IP Address', 'Details'];
    const rows = logs.map(log => [
      log.timestamp,
      log.action,
      log.status,
      log.ipAddress,
      JSON.stringify(log.details)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  // Clear old logs
  clearOldLogs(daysOld = 90) {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const beforeCount = this.auditLogs.length;

    this.auditLogs = this.auditLogs.filter(log => {
      return new Date(log.timestamp).getTime() > cutoff;
    });

    return {
      deleted: beforeCount - this.auditLogs.length,
      remaining: this.auditLogs.length
    };
  }
}

module.exports = AuditLoggingService;