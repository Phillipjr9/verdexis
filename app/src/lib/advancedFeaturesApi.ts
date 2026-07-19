import { api, getToken } from './api'

/**
 * Analytics API Client
 */
export const analyticsApi = {
  async getPerformanceMetrics(days: number = 365) {
    return api.get(`/analytics/performance?days=${days}`)
  },

  async getRiskMetrics(days: number = 365) {
    return api.get(`/analytics/risk?days=${days}`)
  },

  async getAttribution() {
    return api.get('/analytics/attribution')
  },

  async getRecommendations() {
    return api.get('/analytics/recommendations')
  },

  async getFullAnalytics(days: number = 365) {
    return api.get(`/analytics/full?days=${days}`)
  }
}

/**
 * Tax Optimization API Client
 */
export const taxApi = {
  async getTaxLossOpportunities() {
    return api.get('/tax/opportunities')
  },

  async executeTaxLossHarvest(symbol: string, quantity: number) {
    return api.post('/tax/harvest', { symbol, quantity })
  },

  async getTaxReport(year: number) {
    return api.get(`/tax/report/${year}`)
  },

  async downloadForm8949(year: number) {
    const token = getToken()
    const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/tax/form8949/${year}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!response.ok) {
      throw new Error('Failed to download Form 8949')
    }
    return response.blob()
  },

  async getTaxRecommendations() {
    return api.get('/tax/recommendations')
  }
}

/**
 * Compliance API Client
 */
export const complianceApi = {
  async getRiskProfile() {
    return api.get('/compliance/risk-profile')
  },

  async screenTransaction(kind: string, amount: number, currency: string) {
    return api.post('/compliance/screen-transaction', { kind, amount, currency })
  }
}

/**
 * Notifications API Client
 */
export const notificationsApi = {
  async getPreferences() {
    return api.get('/notifications/advanced/preferences')
  },

  async updatePreferences(prefs: Record<string, boolean>) {
    return api.put('/notifications/advanced/preferences', prefs)
  },

  async markAsRead(notificationId: string) {
    return api.post(`/notifications/advanced/mark-read/${notificationId}`, {})
  },

  async markAllAsRead() {
    return api.post('/notifications/advanced/mark-all-read', {})
  }
}
