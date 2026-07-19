# VERDEXIS Advanced Features - Quick Start Guide

## 🚀 Getting Started

### Step 1: Backend is Ready ✅
All backend services are already implemented and deployed:
- Compliance Engine
- Analytics Engine
- Push Notifications
- Tax Optimization

### Step 2: Frontend Integration (Your Next Task)

#### 2.1 Import the API Client
```typescript
import { analyticsApi, taxApi, complianceApi, notificationsApi } from '../lib/advancedFeaturesApi'
```

#### 2.2 Create Analytics Page
```typescript
// pages/Analytics.tsx
import { AnalyticsDashboard } from '../components/AdvancedFeaturesExamples'

export default function Analytics() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Portfolio Analytics</h1>
      <AnalyticsDashboard />
    </div>
  )
}
```

#### 2.3 Create Tax Page
```typescript
// pages/TaxOptimization.tsx
import { TaxOptimization } from '../components/AdvancedFeaturesExamples'

export default function TaxPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Tax Optimization</h1>
      <TaxOptimization />
    </div>
  )
}
```

#### 2.4 Create Notification Settings Page
```typescript
// pages/NotificationSettings.tsx
import { NotificationPreferences } from '../components/AdvancedFeaturesExamples'

export default function NotificationSettings() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Notification Settings</h1>
      <NotificationPreferences />
    </div>
  )
}
```

#### 2.5 Add Routes to App.tsx
```typescript
import Analytics from './pages/Analytics'
import TaxOptimization from './pages/TaxOptimization'
import NotificationSettings from './pages/NotificationSettings'

// In your Routes component:
<Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
<Route path="/tax" element={<RequireAuth><TaxOptimization /></RequireAuth>} />
<Route path="/settings/notifications" element={<RequireAuth><NotificationSettings /></RequireAuth>} />
```

#### 2.6 Add Navigation Links
```typescript
// In Navigation.tsx or main menu:
<Link to="/analytics">Analytics</Link>
<Link to="/tax">Tax Optimization</Link>
<Link to="/settings/notifications">Notifications</Link>
```

---

## 📚 API Reference

### Analytics API
```typescript
// Get performance metrics (Sharpe, Sortino, max drawdown, etc.)
const metrics = await analyticsApi.getPerformanceMetrics(365)

// Get risk metrics (volatility, VaR, CVaR, etc.)
const risk = await analyticsApi.getRiskMetrics(365)

// Get portfolio attribution (top performers, sectors, etc.)
const attribution = await analyticsApi.getAttribution()

// Get recommendations (rebalancing, harvesting, etc.)
const recommendations = await analyticsApi.getRecommendations()

// Get everything at once
const full = await analyticsApi.getFullAnalytics(365)
```

### Tax API
```typescript
// Find tax-loss harvesting opportunities
const opportunities = await taxApi.getTaxLossOpportunities()

// Execute a harvest
const result = await taxApi.executeTaxLossHarvest('BTC', 1)

// Get tax report for a year
const report = await taxApi.getTaxReport(2024)

// Download Form 8949 as CSV
const blob = await taxApi.downloadForm8949(2024)

// Get tax recommendations
const recommendations = await taxApi.getTaxRecommendations()
```

### Compliance API
```typescript
// Get user risk profile
const profile = await complianceApi.getRiskProfile()

// Screen a transaction
const result = await complianceApi.screenTransaction('withdraw', 50000, 'USD')
```

### Notifications API
```typescript
// Get user preferences
const prefs = await notificationsApi.getPreferences()

// Update preferences
await notificationsApi.updatePreferences({
  emailNotifications: true,
  priceAlerts: true,
  dailyDigest: false
})

// Mark notification as read
await notificationsApi.markAsRead(notificationId)

// Mark all as read
await notificationsApi.markAllAsRead()
```

---

## 🎨 UI Components

### Pre-built Components Available
See `app/src/components/AdvancedFeaturesExamples.tsx`:

1. **AnalyticsDashboard** - Display performance & risk metrics
2. **TaxOptimization** - Tax-loss harvesting UI
3. **NotificationPreferences** - Notification settings
4. **ComplianceRiskProfile** - Risk profile display

### Using Pre-built Components
```typescript
import {
  AnalyticsDashboard,
  TaxOptimization,
  NotificationPreferences,
  ComplianceRiskProfile
} from '../components/AdvancedFeaturesExamples'

// Use in your pages
<AnalyticsDashboard />
<TaxOptimization />
<NotificationPreferences />
<ComplianceRiskProfile />
```

---

## 🔧 Customization

### Customize Analytics Display
```typescript
function CustomAnalytics() {
  const [metrics, setMetrics] = useState(null)
  const [days, setDays] = useState(365)

  useEffect(() => {
    analyticsApi.getPerformanceMetrics(days).then(setMetrics)
  }, [days])

  return (
    <div>
      <h2>Sharpe Ratio: {metrics?.sharpeRatio}</h2>
      <h2>Max Drawdown: {metrics?.maxDrawdown}%</h2>
      {/* Add your custom UI here */}
    </div>
  )
}
```

### Customize Tax Display
```typescript
function CustomTax() {
  const [opportunities, setOpportunities] = useState([])

  useEffect(() => {
    taxApi.getTaxLossOpportunities().then(data => {
      setOpportunities(data.opportunities)
    })
  }, [])

  return (
    <div>
      {opportunities.map(opp => (
        <div key={opp.symbol}>
          <h3>{opp.symbol}</h3>
          <p>Loss: ${Math.abs(opp.unrealizedLoss)}</p>
          {/* Add your custom UI here */}
        </div>
      ))}
    </div>
  )
}
```

---

## 🧪 Testing

### Test Analytics
```typescript
// In your test file
import { analyticsApi } from '../lib/advancedFeaturesApi'

test('should load analytics', async () => {
  const metrics = await analyticsApi.getPerformanceMetrics(365)
  expect(metrics).toBeDefined()
  expect(metrics.sharpeRatio).toBeDefined()
})
```

### Test Tax
```typescript
test('should find tax opportunities', async () => {
  const opportunities = await taxApi.getTaxLossOpportunities()
  expect(Array.isArray(opportunities)).toBe(true)
})
```

### Test Compliance
```typescript
test('should get risk profile', async () => {
  const profile = await complianceApi.getRiskProfile()
  expect(profile.riskScore).toBeDefined()
})
```

---

## 📊 Data Structures

### Performance Metrics
```typescript
{
  totalReturn: number
  totalReturnPercent: number
  annualizedReturn: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  calmarRatio: number
  winRate: number
  profitFactor: number
  averageWin: number
  averageLoss: number
  riskRewardRatio: number
}
```

### Risk Metrics
```typescript
{
  volatility: number
  beta: number
  correlation: Record<string, number>
  valueAtRisk95: number
  conditionalValueAtRisk95: number
  expectedShortfall: number
}
```

### Tax Opportunity
```typescript
{
  symbol: string
  currentPrice: number
  costBasis: number
  unrealizedLoss: number
  unrealizedLossPercent: number
  holdingPeriod: 'short' | 'long'
  recommendation: string
}
```

### Risk Profile
```typescript
{
  userId: string
  riskScore: number
  sanctioned: boolean
  pepMatch: boolean
  kycStatus: string
  kycTier: string
  transactionCount30d: number
  totalVolume30d: number
  recentSecurityEvents: number
  flags: string[]
  lastUpdated: Date
}
```

---

## ⚡ Performance Tips

### Caching
- Analytics calculations are cached for 1 hour
- Risk profiles are cached for 30 minutes
- Tax reports are cached for 24 hours

### Optimization
- Use `getFullAnalytics()` instead of multiple calls
- Batch notification updates
- Use time period selectors to limit data

### Monitoring
- Monitor API response times
- Track error rates
- Watch for slow queries

---

## 🐛 Troubleshooting

### Analytics Not Loading
```typescript
// Check if user has enough data
const metrics = await analyticsApi.getPerformanceMetrics(365)
if (!metrics) {
  console.log('Not enough data for analytics')
}
```

### Tax Opportunities Empty
```typescript
// Check if user has any losses
const opportunities = await taxApi.getTaxLossOpportunities()
if (opportunities.length === 0) {
  console.log('No tax-loss opportunities available')
}
```

### Compliance Errors
```typescript
// Check user KYC status
const profile = await complianceApi.getRiskProfile()
if (profile.kycStatus !== 'approved') {
  console.log('User not fully verified')
}
```

---

## 📖 Documentation

For detailed documentation, see:
- `ADVANCED_FEATURES_IMPLEMENTATION.md` - Full feature documentation
- `IMPLEMENTATION_SUMMARY.md` - Implementation summary
- `AdvancedFeaturesExamples.tsx` - Component examples

---

## ✅ Checklist

- [ ] Import API clients
- [ ] Create Analytics page
- [ ] Create Tax page
- [ ] Create Notification Settings page
- [ ] Add routes to App.tsx
- [ ] Add navigation links
- [ ] Test all features
- [ ] Performance testing
- [ ] Error handling
- [ ] Responsive design

---

## 🎯 Next Steps

1. **Today:** Create the 3 new pages
2. **Tomorrow:** Add routes and navigation
3. **Day 3:** Test all features
4. **Day 4:** Polish UI and error handling
5. **Day 5:** Performance optimization

**Estimated Time: 3-5 days for full frontend integration**

---

## 💡 Tips

- Start with the pre-built components in `AdvancedFeaturesExamples.tsx`
- Customize them to match your design system
- Use the API client for any additional features
- Test thoroughly before deploying
- Monitor performance in production

---

## 🚀 You're Ready!

All backend services are ready. Start building the frontend and your platform will be at 80% completion!

Good luck! 🎉
