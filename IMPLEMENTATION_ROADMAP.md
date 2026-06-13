# VERDEXIS - Complete Implementation Roadmap

## Phase 1: Foundation (Weeks 1-2) - User Funding & Core Data
**Critical blockers: Users can't fund accounts or see live data**

### 1.1 Fiat On-Ramp (Stripe + Plaid)
- **Impact**: Users can deposit fiat money
- **Backend**:
  - `POST /api/wallet/stripe/create-intent` - Create payment intent
  - `POST /api/wallet/stripe/confirm` - Confirm payment
  - `GET /api/wallet/plaid/link-token` - Get Plaid link token
  - `POST /api/wallet/plaid/exchange` - Exchange public token
  - Webhook handlers for payment confirmations
- **Frontend**:
  - `components/StripeOnRamp.tsx` - Stripe payment modal
  - `components/PlaidLink.tsx` - Bank linking component
  - Update `Wallet.tsx` to show deposit options
- **Dependencies**: Stripe SDK, Plaid SDK, Prisma migration for payment records

### 1.2 Crypto Deposit Addresses
- **Impact**: Users can deposit crypto
- **Backend**:
  - Generate unique addresses per user/currency (via blockchain APIs)
  - `POST /api/wallet/generate-address?currency=BTC`
  - Store addresses in DB with user association
  - Webhook to track incoming transactions
- **Frontend**:
  - `components/CryptoDepositAddress.tsx` - Show QR code + address
  - Update `Wallet.tsx` deposit tab
- **Dependencies**: Bitcoin/Ethereum address generation library

### 1.3 Real-time WebSocket for Live Prices
- **Impact**: Market data updates without polling
- **Backend**:
  - `src/websocket.ts` - WebSocket server setup
  - Connect to Finnhub WebSocket for crypto/stock prices
  - Broadcast to subscribed clients
  - Fallback to polling if WS fails
- **Frontend**:
  - `hooks/useMarketStream.ts` - WebSocket hook
  - Update Dashboard, Trading, Markets to use live prices
- **Dependencies**: ws, Finnhub WebSocket API

---

## Phase 2: Trading Enhancements (Weeks 2-3)
**Critical for traders: Better order types and visibility**

### 2.1 Advanced Order Types
- **Impact**: Support trailing stops, conditional orders
- **Backend**:
  - Add `stopPrice`, `trailAmount`, `condition` fields to Order model
  - Implement order evaluation logic in `orderPoller.ts`
  - Execute orders when conditions met
- **Frontend**:
  - `components/AdvancedOrderForm.tsx` - Trailing stop, conditional UI
  - Update `Trading.tsx`

### 2.2 Order Book Depth Visualization
- **Impact**: Show market depth, bid/ask levels
- **Backend**:
  - `GET /api/market/orderbook/:symbol?depth=20` - Return bid/ask levels
  - Fetch from CoinGecko/Twelve Data
- **Frontend**:
  - `components/OrderBookChart.tsx` - Depth heatmap visualization
  - Update `Trading.tsx`

### 2.3 TradingView Charts Integration
- **Impact**: Professional charting instead of basic charts
- **Frontend**:
  - Replace chart library with TradingView Lightweight Charts
  - Update `Trading.tsx`, `AssetDetail.tsx`
  - Support 1m, 5m, 15m, 1h, 4h, 1d, 1w, 1m timeframes

---

## Phase 3: Portfolio Intelligence (Weeks 3-4)
**Power users: Advanced analytics and optimization**

### 3.1 Tax Reporting & Harvesting
- **Impact**: IRS compliance, tax optimization
- **Backend**:
  - Prisma migration: Add `lotSelectionMethod` (FIFO/LIFO/specific), `taxLot` fields
  - `POST /api/tax/harvest` - Suggest/execute tax loss harvesting
  - `GET /api/tax/report?year=2024` - Generate IRS 8949 export
  - Wash sale detection logic
- **Frontend**:
  - `pages/TaxHarvesting.tsx` - Enhancement with harvesting suggestions
  - `components/TaxReportExport.tsx` - Download PDF/CSV reports
  - `components/WashSaleWarning.tsx` - Alert on wash sales

### 3.2 Performance Attribution & Analytics
- **Impact**: Understand which holdings drive returns
- **Backend**:
  - Calculate Sharpe ratio, Sortino ratio, max drawdown
  - `GET /api/portfolio/performance?period=1y` - Attribution by holding
  - `GET /api/portfolio/sector-allocation` - Sector breakdown
- **Frontend**:
  - `components/PerformanceAttribution.tsx` - Show contribution by holding
  - `components/RiskMetrics.tsx` - Display Sharpe, drawdown, etc.

### 3.3 AI-Driven Portfolio Rebalancing
- **Impact**: Intelligent allocation suggestions
- **Backend**:
  - `POST /api/ai/rebalance-suggestions` - Generate rebalance advice
  - Factor in tax implications, fees, risk tolerance
- **Frontend**:
  - Enhance `pages/Rebalance.tsx` with AI recommendations
  - Show before/after allocation comparison

---

## Phase 4: AI & Automation (Weeks 4-5)
**Engagement: Smarter recommendations and automation**

### 4.1 AI Confidence Scoring & Insights
- **Impact**: Users trust AI recommendations more
- **Backend**:
  - Add `confidence` field (0-100) to AI insights
  - Implement reasoning explanations
  - `POST /api/ai/chat` - Enhanced with confidence scoring
- **Frontend**:
  - `components/ConfidenceIndicator.tsx` - Visual confidence meter
  - Show reasoning behind recommendations

### 4.2 Email Digests & Notifications
- **Impact**: Keep users engaged
- **Backend**:
  - Scheduled job: `emailDigestPoller.ts` (daily/weekly)
  - `POST /api/notifications/send-digest`
  - Track notification preferences in User model
- **Frontend**:
  - `pages/Settings.tsx` - Notification preferences UI
  - `components/NotificationCenter.tsx` - In-app notification bell

### 4.3 Mobile Push Notifications
- **Impact**: Real-time alerts on mobile
- **Backend**:
  - Firebase Cloud Messaging setup
  - `POST /api/notifications/register-device` - Store FCM tokens
  - Push on price alerts, order fills, AI insights
- **Frontend**:
  - Service worker for PWA push handling
  - Request push permission on first login

### 4.4 Slack & Zapier Integration
- **Impact**: Notifications go where users are
- **Backend**:
  - OAuth flow for Slack/Zapier
  - `POST /api/integrations/slack/connect`
  - Webhook to send alerts to Slack channels

---

## Phase 5: Social & Gamification (Weeks 5-6)
**Community: Leaderboards, signals, competition**

### 5.1 Trading Signals Marketplace
- **Impact**: Monetization + engagement
- **Backend**:
  - Prisma: Add `Signal` model with publisher, accuracy tracking
  - `POST /api/signals/publish` - Signal creation
  - `GET /api/signals/follow` - Subscribe to signals
  - Auto-execute followed signals as orders
- **Frontend**:
  - `components/SignalCard.tsx` - Display signals with track record
  - `pages/Signals.tsx` - Browse marketplace
  - `components/FollowedSignalsList.tsx` - User's subscriptions

### 5.2 Analyst Profiles & Leaderboards
- **Impact**: Recognition for top performers
- **Backend**:
  - `GET /api/profiles/:userId/stats` - Win rate, accuracy, followers
  - `GET /api/leaderboards` - Global rankings by various metrics
- **Frontend**:
  - Enhance `pages/Leaderboard.tsx` with detailed stats
  - `components/AnalystProfile.tsx` - Creator card
  - `components/AnalystDetails.tsx` - Full profile page

### 5.3 Discussion Forums
- **Impact**: Community engagement
- **Backend**:
  - Prisma: Add `Thread`, `Comment` models
  - `POST /api/forums/threads` - Create discussion
  - Moderation tools for admins
- **Frontend**:
  - `pages/Forums.tsx` - Browse discussions
  - `components/ThreadDetail.tsx` - View comments
  - `components/ThreadForm.tsx` - Create thread

### 5.4 Social Sentiment Tracking
- **Impact**: Gauge community opinion on assets
- **Backend**:
  - Aggregate sentiment from external APIs (Twitter, Reddit)
  - `GET /api/sentiment/:symbol` - Return sentiment score
- **Frontend**:
  - `components/SentimentGauge.tsx` - Display bullish/bearish consensus

---

## Phase 6: Advanced Features (Weeks 6-8)
**Professional traders: Derivatives, leverage, strategies**

### 6.1 Options Trading
- **Impact**: Revenue stream + attract sophisticated traders
- **Backend**:
  - Prisma: Add `OptionsContract` model
  - `GET /api/options/chains/:symbol` - Available options
  - `POST /api/orders` - Extend to handle options orders
  - Greeks calculation (delta, gamma, theta, vega)
- **Frontend**:
  - `pages/Options.tsx` - Options chain viewer
  - `components/OptionsChainTable.tsx` - Filterable contracts
  - `components/OptionGreeks.tsx` - Display Greeks

### 6.2 Futures & Margin Trading
- **Impact**: High-engagement feature
- **Backend**:
  - Add `leverage`, `marginRequired` fields to Order/Trade
  - Liquidation monitoring logic
  - `GET /api/account/margin-level` - Current margin usage
- **Frontend**:
  - `components/LeverageSelector.tsx` - 1-100x leverage
  - `components/LiquidationWarning.tsx` - Risk display
  - `pages/Futures.tsx` - Futures trading interface

### 6.3 Strategy Backtesting
- **Impact**: Users test strategies before trading
- **Backend**:
  - Historical price data seeding
  - `POST /api/backtest` - Run strategy simulation
  - Return performance metrics
- **Frontend**:
  - `pages/Backtester.tsx` - Visual strategy builder
  - `components/StrategyResults.tsx` - Backtest charts

### 6.4 Covered Call Income Strategy
- **Impact**: Generate yield from holdings
- **Backend**:
  - `POST /api/strategies/covered-call` - Suggest contracts
  - Calculate income potential
- **Frontend**:
  - `components/CoveredCallSuggestions.tsx` - Show opportunities

---

## Phase 7: Compliance & Security (Weeks 8-9)
**Trust: Regulatory compliance and security hardening**

### 7.1 Enhanced Audit Logging
- **Impact**: Regulatory compliance (SOX, MiFID II)
- **Backend**:
  - Comprehensive audit for all state changes
  - Immutable audit log (append-only)
  - `GET /api/admin/audit-log?action=trade` - Filter by action
- **Frontend**:
  - `pages/AdminAudit.tsx` - Enhancement with filtering/export

### 7.2 Device Trust & Security
- **Impact**: Prevent account takeover
- **Backend**:
  - Track device fingerprints
  - Require 2FA on new device login
  - `POST /api/auth/trust-device` - Mark device as trusted
- **Frontend**:
  - `components/TrustedDevices.tsx` - Manage devices in settings
  - Prompt for 2FA on new device

### 7.3 Rate Limiting Per Endpoint
- **Impact**: DDoS/brute-force protection
- **Backend**:
  - Tighter limits on sensitive endpoints (auth, trades, wallet)
  - `POST /api/auth/login` - 5 attempts per minute
  - `POST /api/trades` - 10 per minute per user
  - `POST /api/wallet/withdraw` - 3 per day

### 7.4 API Key Management
- **Impact**: Users can integrate with external tools
- **Backend**:
  - `POST /api/keys` - Generate user API keys
  - `DELETE /api/keys/:id` - Revoke keys
  - Scoped permissions (read, trade, withdraw)
- **Frontend**:
  - `components/APIKeyManager.tsx` - Create/revoke/rotate keys

### 7.5 KYC/AML Enhancement
- **Impact**: Regulatory compliance
- **Backend**:
  - Integrate with AML provider (e.g., Cloudflare Radar)
  - `POST /api/kyc/verify` - Submit KYC documents
  - Automated verification workflow
- **Frontend**:
  - Enhance `pages/KYC.tsx` with document upload
  - Show verification status with timeline

---

## Phase 8: Mobile & Accessibility (Weeks 9-10)
**Reach: Progressive Web App, native apps, accessibility**

### 8.1 Progressive Web App (PWA)
- **Impact**: Works offline, installable
- **Frontend**:
  - Service worker for offline caching
  - Manifest.json enhancements
  - Offline mode UI
  - Sync pending transactions when online

### 8.2 Mobile Responsive Overhaul
- **Impact**: Great mobile experience
- **Frontend**:
  - Test all pages on mobile (375px viewport)
  - Touch-friendly buttons (44px min)
  - Bottom tab navigation for mobile
  - Simplify complex UIs for small screens

### 8.3 Dark/Light Mode Toggle
- **Impact**: User preference
- **Frontend**:
  - Add theme context
  - CSS vars for light/dark palettes
  - Persist preference to localStorage
  - System preference detection

### 8.4 Accessibility (WCAG 2.1 AA)
- **Impact**: Legal compliance, inclusive design
- **Frontend**:
  - Audit all pages with axe DevTools
  - Fix color contrast issues
  - Add ARIA labels to interactive elements
  - Keyboard navigation (Tab, Enter, Escape)
  - Screen reader support

---

## Phase 9: Advanced Integrations (Weeks 10-11)
**Power users: MetaMask, external wallets, data export**

### 9.1 MetaMask/Web3 Wallet Connection
- **Impact**: Connect external wallets
- **Backend**:
  - Verify wallet signatures for auth
  - `POST /api/auth/web3-login` - Sign-in with wallet
- **Frontend**:
  - `components/Web3Connect.tsx` - Connect MetaMask
  - `pages/ExternalWallets.tsx` - Link external wallets

### 9.2 Sub-Accounts Management
- **Impact**: Family accounts, trust relationships
- **Backend**:
  - Prisma: Add `SubAccount` model with permissions
  - `POST /api/accounts/create` - Create sub-account
  - Permission-based access control
- **Frontend**:
  - Enhance `pages/SubAccounts.tsx`
  - `components/SubAccountManager.tsx` - Manage accounts

### 9.3 Advanced Stock Screener
- **Impact**: Discovery and research
- **Backend**:
  - `POST /api/screener/scan` - Filter stocks by criteria
  - Support: PE ratio, market cap, dividend yield, technical indicators
- **Frontend**:
  - Enhance `pages/Screener.tsx` with filter UI
  - `components/ScreenerResults.tsx` - Results table

### 9.4 Data Export & Reporting
- **Impact**: Tax, accounting, research
- **Backend**:
  - `GET /api/export/portfolio?format=csv|pdf|json`
  - `GET /api/export/trades?format=csv`
  - `GET /api/export/tax-report?year=2024&format=pdf`
- **Frontend**:
  - Export buttons on all data pages
  - `components/ExportDialog.tsx` - Format selection

---

## Implementation Dependencies Graph

```
Phase 1: Foundation (CRITICAL)
├─ Fiat On-Ramp (Stripe/Plaid)
├─ Crypto Deposit Addresses
└─ WebSocket Live Prices
    ↓ Enables:
Phase 2: Trading Enhancements
├─ Advanced Order Types
├─ Order Book Depth
└─ TradingView Charts
    ↓ Enables:
Phase 3: Portfolio Intelligence
├─ Tax Reporting
├─ Performance Attribution
└─ AI Rebalancing
    ↓ Enables:
Phase 4: AI & Automation
├─ Confidence Scoring
├─ Email Digests
├─ Mobile Push
└─ Slack Integration
    ↓ Enables:
Phase 5: Social & Gamification
├─ Trading Signals
├─ Analyst Profiles
├─ Forums
└─ Social Sentiment
    ↓ Enables:
Phase 6: Advanced Features
├─ Options Trading
├─ Futures & Margin
├─ Strategy Backtesting
└─ Covered Calls
    ↓ Enables:
Phase 7: Compliance & Security
├─ Enhanced Audit Logging
├─ Device Trust
├─ Rate Limiting
├─ API Key Management
└─ KYC/AML
    ↓ Enables:
Phase 8: Mobile & Accessibility
├─ Progressive Web App
├─ Mobile Responsive
├─ Dark/Light Mode
└─ WCAG 2.1 Accessibility
    ↓ Enables:
Phase 9: Advanced Integrations
├─ Web3 Wallet Connection
├─ Sub-Accounts
├─ Advanced Screener
└─ Data Export
```

---

## Effort Estimation

| Phase | Duration | Developer-Weeks | Priority |
|-------|----------|-----------------|----------|
| Phase 1 | 2 weeks | 8-10 | 🔴 CRITICAL |
| Phase 2 | 1 week | 4-5 | 🔴 HIGH |
| Phase 3 | 1.5 weeks | 6-7 | 🟠 HIGH |
| Phase 4 | 1.5 weeks | 6-8 | 🟠 HIGH |
| Phase 5 | 1.5 weeks | 5-7 | 🟡 MEDIUM |
| Phase 6 | 2 weeks | 8-10 | 🟡 MEDIUM |
| Phase 7 | 1 week | 4-5 | 🔴 CRITICAL |
| Phase 8 | 1 week | 4-5 | 🟠 HIGH |
| Phase 9 | 1.5 weeks | 6-7 | 🟡 MEDIUM |
| **TOTAL** | **~13 weeks** | **51-64** | **~3.5 months** |

---

## Quick Start: Phase 1 (Week 1)

Start with Phase 1 since it unblocks everything else. Recommend this order:

1. **WebSocket Live Prices** (2 days) - Easiest, highest impact
2. **Crypto Deposit Addresses** (3 days) - Medium effort, critical for users
3. **Fiat On-Ramp** (5 days) - Most complex, enables revenue

Ready to implement Phase 1?
