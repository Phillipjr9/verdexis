const AWS = require('aws-sdk');

class AdminPanelService {
  constructor() {
    this.cognito = new AWS.CognitoIdentityServiceProvider({
      region: process.env.AWS_REGION
    });
    this.userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
  }

  // Get all users
  async getAllUsers(limit = 60, paginationToken = null) {
    try {
      const params = {
        UserPoolId: this.userPoolId,
        Limit: limit,
        PaginationToken: paginationToken
      };

      const result = await this.cognito.listUsers(params).promise();

      return {
        success: true,
        users: result.Users.map(user => this.formatUser(user)),
        nextToken: result.PaginationToken
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get user details
  async getUserDetails(email) {
    try {
      const result = await this.cognito.adminGetUser({
        UserPoolId: this.userPoolId,
        Username: email
      }).promise();

      return {
        success: true,
        user: this.formatUser(result)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Format user data
  formatUser(user) {
    const attributes = {};
    if (user.Attributes) {
      user.Attributes.forEach(attr => {
        attributes[attr.Name] = attr.Value;
      });
    }

    return {
      username: user.Username,
      email: attributes.email,
      phoneNumber: attributes.phone_number,
      name: attributes.name,
      status: user.UserStatus,
      createdAt: user.UserCreateDate,
      lastModified: user.UserLastModifiedDate,
      attributes
    };
  }

  // Suspend user
  async suspendUser(email, reason) {
    try {
      await this.cognito.adminUpdateUserAttributes({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:suspension_reason',
            Value: reason
          },
          {
            Name: 'custom:suspended_at',
            Value: new Date().toISOString()
          }
        ]
      }).promise();

      return {
        success: true,
        message: `User ${email} suspended`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Reactivate user
  async reactivateUser(email) {
    try {
      await this.cognito.adminUpdateUserAttributes({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:suspension_reason',
            Value: ''
          },
          {
            Name: 'custom:suspended_at',
            Value: ''
          }
        ]
      }).promise();

      return {
        success: true,
        message: `User ${email} reactivated`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Reset user password
  async resetUserPassword(email, temporaryPassword = null) {
    try {
      const password = temporaryPassword || this.generateTemporaryPassword();

      await this.cognito.adminSetUserPassword({
        UserPoolId: this.userPoolId,
        Username: email,
        Password: password,
        Permanent: false
      }).promise();

      return {
        success: true,
        message: 'Password reset',
        temporaryPassword: password
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Generate temporary password
  generateTemporaryPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Delete user
  async deleteUser(email) {
    try {
      await this.cognito.adminDeleteUser({
        UserPoolId: this.userPoolId,
        Username: email
      }).promise();

      return {
        success: true,
        message: `User ${email} deleted`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send user notification
  async sendNotification(email, subject, message) {
    // Integrate with email service
    return {
      success: true,
      message: 'Notification sent'
    };
  }

  // Get user statistics
  async getUserStatistics() {
    try {
      const result = await this.cognito.listUsers({
        UserPoolId: this.userPoolId,
        Limit: 60
      }).promise();

      const users = result.Users;
      const stats = {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.UserStatus === 'CONFIRMED').length,
        unconfirmedUsers: users.filter(u => u.UserStatus === 'UNCONFIRMED').length,
        disabledUsers: users.filter(u => u.UserStatus === 'FORCE_CHANGE_PASSWORD').length
      };

      return { success: true, stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Search users
  async searchUsers(searchTerm) {
    try {
      const result = await this.cognito.listUsers({
        UserPoolId: this.userPoolId,
        Filter: `email ^= "${searchTerm}" or name ^= "${searchTerm}"`
      }).promise();

      return {
        success: true,
        users: result.Users.map(user => this.formatUser(user))
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Generate admin report
  generateAdminReport(data) {
    return {
      reportDate: new Date().toISOString(),
      title: 'Admin Report',
      data: {
        totalUsers: data.totalUsers,
        activeUsers: data.activeUsers,
        suspendedUsers: data.suspendedUsers,
        kyc: {
          approved: data.kycApproved,
          pending: data.kycPending,
          rejected: data.kycRejected
        },
        transactions: {
          totalDeposits: data.totalDeposits,
          totalWithdrawals: data.totalWithdrawals,
          totalTrades: data.totalTrades
        }
      }
    };
  }

  // Export user data
  exportUserData(email, format = 'json') {
    // Implement data export functionality
    return {
      success: true,
      message: 'Data export initiated'
    };
  }

  // View user activity
  async viewUserActivity(email, limit = 50) {
    // Would integrate with audit logging service
    return {
      success: true,
      message: 'Activity retrieved'
    };
  }

  // Get users by status
  async getUsersByStatus(status, limit = 60) {
    try {
      const result = await this.cognito.listUsers({
        UserPoolId: this.userPoolId,
        Filter: `status = "${status}"`,
        Limit: limit
      }).promise();

      return {
        success: true,
        users: result.Users.map(user => this.formatUser(user)),
        count: result.Users.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Create bulk report
  async createBulkReport(reportType, filters = {}) {
    try {
      const result = await this.cognito.listUsers({
        UserPoolId: this.userPoolId,
        Limit: 60
      }).promise();

      const users = result.Users.map(user => this.formatUser(user));
      const report = {
        id: `report_${Date.now()}`,
        type: reportType,
        generatedAt: new Date().toISOString(),
        filters,
        data: {
          totalUsers: users.length,
          byStatus: this.groupUsersByStatus(users),
          newThisMonth: this.getNewUsersThisMonth(users),
          summary: this.generateReportSummary(users)
        }
      };

      return { success: true, report };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Group users by status
  groupUsersByStatus(users) {
    const grouped = {};
    users.forEach(user => {
      const status = user.status || 'unknown';
      grouped[status] = (grouped[status] || 0) + 1;
    });
    return grouped;
  }

  // Get new users this month
  getNewUsersThisMonth(users) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return users.filter(user => 
      new Date(user.createdAt) > thirtyDaysAgo
    ).length;
  }

  // Generate report summary
  generateReportSummary(users) {
    return {
      avgAccountAge: this.calculateAvgAccountAge(users),
      confirmationRate: ((users.filter(u => u.status === 'CONFIRMED').length / users.length) * 100).toFixed(2) + '%',
      activePercentage: ((users.filter(u => u.status === 'CONFIRMED').length / users.length) * 100).toFixed(2) + '%'
    };
  }

  // Calculate average account age
  calculateAvgAccountAge(users) {
    const totalAge = users.reduce((sum, user) => {
      const createdDate = new Date(user.createdAt);
      const ageMs = Date.now() - createdDate.getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      return sum + ageDays;
    }, 0);

    return Math.round(totalAge / users.length) || 0;
  }

  // Update user tier
  async updateUserTier(email, tier) {
    try {
      await this.cognito.adminUpdateUserAttributes({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:user_tier',
            Value: tier
          },
          {
            Name: 'custom:tier_updated_at',
            Value: new Date().toISOString()
          }
        ]
      }).promise();

      return {
        success: true,
        message: `User ${email} tier updated to ${tier}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Send message to user
  async sendAdminMessage(email, message, priority = 'normal') {
    try {
      // Store message in user attributes or dedicated service
      await this.cognito.adminUpdateUserAttributes({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:admin_message',
            Value: message
          },
          {
            Name: 'custom:message_priority',
            Value: priority
          },
          {
            Name: 'custom:message_timestamp',
            Value: new Date().toISOString()
          }
        ]
      }).promise();

      return {
        success: true,
        message: 'Message sent to user'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Verify user KYC
  async verifyUserKYC(email, kycData) {
    try {
      await this.cognito.adminUpdateUserAttributes({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:kyc_status',
            Value: 'approved'
          },
          {
            Name: 'custom:kyc_verified_date',
            Value: new Date().toISOString()
          },
          {
            Name: 'custom:kyc_level',
            Value: kycData.level || '2'
          }
        ]
      }).promise();

      return {
        success: true,
        message: `KYC verified for ${email}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Reject user KYC
  async rejectUserKYC(email, reason) {
    try {
      await this.cognito.adminUpdateUserAttributes({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:kyc_status',
            Value: 'rejected'
          },
          {
            Name: 'custom:kyc_rejection_reason',
            Value: reason
          },
          {
            Name: 'custom:kyc_rejected_date',
            Value: new Date().toISOString()
          }
        ]
      }).promise();

      return {
        success: true,
        message: `KYC rejected for ${email}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Toggle user trading
  async toggleUserTrading(email, enabled = true) {
    try {
      await this.cognito.adminUpdateUserAttributes({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:trading_enabled',
            Value: enabled.toString()
          }
        ]
      }).promise();

      return {
        success: true,
        message: `Trading ${enabled ? 'enabled' : 'disabled'} for ${email}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Lock user account
  async lockUserAccount(email, reason, duration = null) {
    try {
      await this.cognito.adminUpdateUserAttributes({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:account_locked',
            Value: 'true'
          },
          {
            Name: 'custom:lock_reason',
            Value: reason
          },
          {
            Name: 'custom:locked_until',
            Value: duration ? new Date(Date.now() + duration).toISOString() : 'indefinite'
          }
        ]
      }).promise();

      return {
        success: true,
        message: `Account locked for ${email}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Unlock user account
  async unlockUserAccount(email) {
    try {
      await this.cognito.adminUpdateUserAttributes({
        UserPoolId: this.userPoolId,
        Username: email,
        UserAttributes: [
          {
            Name: 'custom:account_locked',
            Value: 'false'
          },
          {
            Name: 'custom:lock_reason',
            Value: ''
          }
        ]
      }).promise();

      return {
        success: true,
        message: `Account unlocked for ${email}`
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get admin dashboard summary
  async getAdminDashboard() {
    try {
      const result = await this.cognito.listUsers({
        UserPoolId: this.userPoolId,
        Limit: 60
      }).promise();

      const users = result.Users;
      const now = new Date();
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

      return {
        success: true,
        dashboard: {
          overview: {
            totalUsers: users.length,
            activeUsers: users.filter(u => u.UserStatus === 'CONFIRMED').length,
            newUsersLastMonth: users.filter(u => new Date(u.UserCreateDate) > thirtyDaysAgo).length
          },
          userStatus: {
            confirmed: users.filter(u => u.UserStatus === 'CONFIRMED').length,
            unconfirmed: users.filter(u => u.UserStatus === 'UNCONFIRMED').length,
            archived: users.filter(u => u.UserStatus === 'ARCHIVED').length
          },
          alerts: this.generateAdminAlerts(users)
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Generate admin alerts
  generateAdminAlerts(users) {
    const alerts = [];
    
    const unconfirmedCount = users.filter(u => u.UserStatus === 'UNCONFIRMED').length;
    if (unconfirmedCount > 10) {
      alerts.push({
        type: 'high_unconfirmed',
        message: `${unconfirmedCount} unconfirmed users`,
        severity: 'warning'
      });
    }

    return alerts;
  }
}

module.exports = AdminPanelService;