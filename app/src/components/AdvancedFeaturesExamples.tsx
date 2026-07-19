import React, { useEffect, useState } from 'react'
import { analyticsApi, taxApi, complianceApi, notificationsApi } from '../lib/advancedFeaturesApi'

/**
 * EXAMPLE: Analytics Dashboard Component
 * Shows how to integrate the analytics API
 */
export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [risk, setRisk] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(365)

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true)
        const [perfData, riskData] = await Promise.all([
          analyticsApi.getPerformanceMetrics(days),
          analyticsApi.getRiskMetrics(days)
        ])
        setMetrics(perfData.metrics)
        setRisk(riskData.risk)
      } catch (error) {
        console.error('Failed to load analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAnalytics()
  }, [days])

  if (loading) return <div>Loading analytics...</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 border rounded">
          <h3>Sharpe Ratio</h3>
          <p className="text-2xl font-bold">{metrics?.sharpeRatio.toFixed(2)}</p>
        </div>
        <div className="p-4 border rounded">
          <h3>Max Drawdown</h3>
          <p className="text-2xl font-bold">{metrics?.maxDrawdown.toFixed(2)}%</p>
        </div>
        <div className="p-4 border rounded">
          <h3>Volatility</h3>
          <p className="text-2xl font-bold">{risk?.volatility.toFixed(2)}%</p>
        </div>
        <div className="p-4 border rounded">
          <h3>Value at Risk (95%)</h3>
          <p className="text-2xl font-bold">{risk?.valueAtRisk95.toFixed(2)}%</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[30, 90, 365].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-4 py-2 rounded ${days === d ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            {d}d
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * EXAMPLE: Tax Optimization Component
 * Shows how to integrate the tax API
 */
export function TaxOptimization() {
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadOpportunities = async () => {
      try {
        const data = await taxApi.getTaxLossOpportunities()
        setOpportunities(data.opportunities)
      } catch (error) {
        console.error('Failed to load opportunities:', error)
      } finally {
        setLoading(false)
      }
    }

    loadOpportunities()
  }, [])

  const handleHarvest = async (symbol: string, quantity: number) => {
    try {
      const result = await taxApi.executeTaxLossHarvest(symbol, quantity)
      if (result.success) {
        alert(`Harvested ${quantity} ${symbol} for a loss of $${Math.abs(result.harvestedLoss).toFixed(2)}`)
        // Reload opportunities
        const data = await taxApi.getTaxLossOpportunities()
        setOpportunities(data.opportunities)
      }
    } catch (error) {
      console.error('Failed to harvest:', error)
    }
  }

  if (loading) return <div>Loading tax opportunities...</div>

  return (
    <div className="space-y-4">
      <h2>Tax-Loss Harvesting Opportunities</h2>
      {opportunities.map(opp => (
        <div key={opp.symbol} className="p-4 border rounded">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold">{opp.symbol}</h3>
              <p className="text-sm text-gray-600">
                Loss: ${Math.abs(opp.unrealizedLoss).toFixed(2)} ({opp.unrealizedLossPercent.toFixed(1)}%)
              </p>
              <p className="text-sm text-gray-600">{opp.recommendation}</p>
            </div>
            <button
              onClick={() => handleHarvest(opp.symbol, 1)}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Harvest
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * EXAMPLE: Notification Preferences Component
 * Shows how to integrate the notifications API
 */
export function NotificationPreferences() {
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const data = await notificationsApi.getPreferences()
        setPrefs(data.preferences)
      } catch (error) {
        console.error('Failed to load preferences:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPrefs()
  }, [])

  const handleToggle = async (key: string) => {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    try {
      await notificationsApi.updatePreferences(updated)
    } catch (error) {
      console.error('Failed to update preferences:', error)
      // Revert on error
      setPrefs(prefs)
    }
  }

  if (loading) return <div>Loading preferences...</div>

  return (
    <div className="space-y-4">
      <h2>Notification Preferences</h2>
      {Object.entries(prefs || {}).map(([key, value]) => (
        <label key={key} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={() => handleToggle(key)}
          />
          <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
        </label>
      ))}
    </div>
  )
}

/**
 * EXAMPLE: Compliance Risk Profile Component
 * Shows how to integrate the compliance API
 */
export function ComplianceRiskProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await complianceApi.getRiskProfile()
        setProfile(data.profile)
      } catch (error) {
        console.error('Failed to load profile:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  if (loading) return <div>Loading risk profile...</div>

  const getRiskColor = (score: number) => {
    if (score < 20) return 'text-green-600'
    if (score < 40) return 'text-yellow-600'
    if (score < 60) return 'text-orange-600'
    return 'text-red-600'
  }

  return (
    <div className="space-y-4">
      <h2>Compliance Risk Profile</h2>
      <div className="p-4 border rounded">
        <div className="flex justify-between items-center mb-4">
          <span>Risk Score</span>
          <span className={`text-2xl font-bold ${getRiskColor(profile?.riskScore || 0)}`}>
            {profile?.riskScore}/100
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <p>KYC Status: <span className="font-semibold">{profile?.kycStatus}</span></p>
          <p>KYC Tier: <span className="font-semibold">{profile?.kycTier}</span></p>
          <p>Transactions (30d): <span className="font-semibold">{profile?.transactionCount30d}</span></p>
          <p>Volume (30d): <span className="font-semibold">${profile?.totalVolume30d.toFixed(2)}</span></p>
        </div>

        {profile?.flags && profile.flags.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 rounded">
            <p className="font-semibold text-sm mb-2">Flags:</p>
            <ul className="text-sm space-y-1">
              {profile.flags.map((flag, i) => (
                <li key={i}>• {flag}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * INTEGRATION CHECKLIST
 * 
 * 1. Import the API clients:
 *    import { analyticsApi, taxApi, complianceApi, notificationsApi } from '../lib/advancedFeaturesApi'
 * 
 * 2. Create pages for each feature:
 *    - pages/Analytics.tsx (use AnalyticsDashboard component)
 *    - pages/TaxOptimization.tsx (use TaxOptimization component)
 *    - pages/NotificationSettings.tsx (use NotificationPreferences component)
 *    - pages/AdminCompliance.tsx (use ComplianceRiskProfile component)
 * 
 * 3. Add routes to App.tsx:
 *    <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
 *    <Route path="/tax" element={<RequireAuth><TaxOptimization /></RequireAuth>} />
 *    <Route path="/settings/notifications" element={<RequireAuth><NotificationSettings /></RequireAuth>} />
 *    <Route path="/admin/compliance" element={<RequireAdmin><AdminCompliance /></RequireAdmin>} />
 * 
 * 4. Add navigation links:
 *    - Dashboard: Link to /analytics
 *    - Settings: Link to /settings/notifications
 *    - Admin: Link to /admin/compliance
 * 
 * 5. Test each feature:
 *    - Load analytics dashboard
 *    - View tax opportunities
 *    - Update notification preferences
 *    - Check compliance risk profile
 * 
 * 6. Monitor performance:
 *    - Check API response times
 *    - Monitor database queries
 *    - Track error rates
 */
