import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import ScrollToTop from './components/ScrollToTop'
import DocumentTitle from './components/DocumentTitle'
import CookieBanner from './components/CookieBanner'
import OfflineToast from './components/OfflineToast'
import WhatsAppFab from './components/WhatsAppFab'
import RequireAuth from './components/RequireAuth'
import RequireAdmin from './components/RequireAdmin'
import CommandPalette from './components/CommandPalette'
import ErrorBoundary from './components/ErrorBoundary'
import AlertChecker from './components/AlertChecker'
import { OnboardingTips } from './components/OnboardingTips'
import { SessionTimeoutWarning } from './components/SessionTimeoutWarning'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { ErrorRecovery } from './components/ErrorRecovery'
import { Toaster } from 'sonner'
import TxModalHost from './components/TxModalHost'

// Error Boundary wrapper for lazy-loaded components
const withLazyErrorBoundary = <P extends object>(
  lazyImport: () => Promise<{ default: React.ComponentType<P> }>,
  scope: string
) => {
  const LazyComponent = lazy(lazyImport)
  
  return function ErrorBoundaryWrapped(props: P) {
    return (
      <ErrorBoundary scope={scope}>
        <Suspense fallback={<div className="min-h-screen bg-[#070C0E] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#0C8B44] border-t-transparent rounded-full animate-spin" /></div>}>
          <LazyComponent {...props} />
        </Suspense>
      </ErrorBoundary>
    )
  }
}

// Create all lazy-loaded components with error boundaries
const Home = withLazyErrorBoundary(() => import('./pages/Home'), 'Home')
const Dashboard = withLazyErrorBoundary(() => import('./pages/Dashboard'), 'Dashboard')
const Trading = withLazyErrorBoundary(() => import('./pages/Trading'), 'Trading')
const Markets = withLazyErrorBoundary(() => import('./pages/Markets'), 'Markets')
const AIAssistant = withLazyErrorBoundary(() => import('./pages/AIAssistant'), 'AI Assistant')
const Wallet = withLazyErrorBoundary(() => import('./pages/Wallet'), 'Wallet')
const News = withLazyErrorBoundary(() => import('./pages/News'), 'News')
const Settings = withLazyErrorBoundary(() => import('./pages/Settings'), 'Settings')
const Legal = withLazyErrorBoundary(() => import('./pages/Legal'), 'Legal')
const About = withLazyErrorBoundary(() => import('./pages/About'), 'About')
const NotFound = withLazyErrorBoundary(() => import('./pages/NotFound'), '404')
const ResetPassword = withLazyErrorBoundary(() => import('./pages/ResetPassword'), 'Reset Password')
const Alerts = withLazyErrorBoundary(() => import('./pages/Alerts'), 'Alerts')
const Goals = withLazyErrorBoundary(() => import('./pages/Goals'), 'Goals')
const StatusPage = withLazyErrorBoundary(() => import('./pages/Status'), 'Status')
const Disclosures = withLazyErrorBoundary(() => import('./pages/Disclosures'), 'Disclosures')
const Help = withLazyErrorBoundary(() => import('./pages/Help'), 'Help')
const AssetDetail = withLazyErrorBoundary(() => import('./pages/AssetDetail'), 'Asset Detail')
const Activity = withLazyErrorBoundary(() => import('./pages/Activity'), 'Activity')
const AdminDashboard = withLazyErrorBoundary(() => import('./pages/AdminDashboard'), 'Admin Dashboard')
const AdminDeposits = withLazyErrorBoundary(() => import('./pages/AdminDeposits'), 'Admin Deposits')
const AdminUsers = withLazyErrorBoundary(() => import('./pages/AdminUsers'), 'Admin Users')
const AdminUserDetail = withLazyErrorBoundary(() => import('./pages/AdminUserDetail'), 'Admin User Detail')
const AdminAudit = withLazyErrorBoundary(() => import('./pages/AdminAudit'), 'Admin Audit')
const AdminTransfer = withLazyErrorBoundary(() => import('./pages/AdminTransfer'), 'Admin Transfer')
const AdminBroadcast = withLazyErrorBoundary(() => import('./pages/AdminBroadcast'), 'Admin Broadcast')
const AdminReferrals = withLazyErrorBoundary(() => import('./pages/AdminReferrals'), 'Admin Referrals')
const AdminSignupBonus = withLazyErrorBoundary(() => import('./pages/AdminSignupBonus'), 'Admin Signup Bonus')
const AdminWallets = withLazyErrorBoundary(() => import('./pages/AdminWallets'), 'Admin Wallets')
const AdminExports = withLazyErrorBoundary(() => import('./pages/AdminExports'), 'Admin Exports')
const AdminSecurityEvents = withLazyErrorBoundary(() => import('./pages/AdminSecurityEvents'), 'Admin Security Events')
const PaperTrading = withLazyErrorBoundary(() => import('./pages/PaperTrading'), 'Paper Trading')
const EconomicCalendar = withLazyErrorBoundary(() => import('./pages/EconomicCalendar'), 'Economic Calendar')
const Screener = withLazyErrorBoundary(() => import('./pages/Screener'), 'Screener')
const Leaderboard = withLazyErrorBoundary(() => import('./pages/Leaderboard'), 'Leaderboard')
const Referral = withLazyErrorBoundary(() => import('./pages/Referral'), 'Referral')
const LearnCenter = withLazyErrorBoundary(() => import('./pages/LearnCenter'), 'Learn Center')
const KYC = withLazyErrorBoundary(() => import('./pages/KYC'), 'KYC')
const Achievements = withLazyErrorBoundary(() => import('./pages/Achievements'), 'Achievements')
const Loyalty = withLazyErrorBoundary(() => import('./pages/Loyalty'), 'Loyalty')
const CopyTrading = withLazyErrorBoundary(() => import('./pages/CopyTrading'), 'Copy Trading')
const TraderDetail = withLazyErrorBoundary(() => import('./pages/TraderDetail'), 'Trader Detail')
const CopyTradingDashboard = withLazyErrorBoundary(() => import('./pages/CopyTradingDashboard'), 'Copy Trading Dashboard')
const DCAScheduler = withLazyErrorBoundary(() => import('./pages/DCAScheduler'), 'DCA Scheduler')
const Rebalance = withLazyErrorBoundary(() => import('./pages/Rebalance'), 'Rebalance')
const SubAccounts = withLazyErrorBoundary(() => import('./pages/SubAccounts'), 'Sub Accounts')
const TaxHarvesting = withLazyErrorBoundary(() => import('./pages/TaxHarvesting'), 'Tax Harvesting')
const Analytics = withLazyErrorBoundary(() => import('./pages/Analytics'), 'Analytics')
const NFTPortfolio = withLazyErrorBoundary(() => import('./pages/NFTPortfolio'), 'NFT Portfolio')
const Integrations = withLazyErrorBoundary(() => import('./pages/Integrations'), 'Integrations')
const Changelog = withLazyErrorBoundary(() => import('./pages/Changelog'), 'Changelog')
const AdminSettings = withLazyErrorBoundary(() => import('./pages/AdminSettings'), 'Admin Settings')
const AdminAnalytics = withLazyErrorBoundary(() => import('./pages/AdminAnalytics'), 'Admin Analytics')
const AdminReviews = withLazyErrorBoundary(() => import('./pages/AdminReviews'), 'Admin Reviews')
const AdvancedOrders = withLazyErrorBoundary(() => import('./pages/AdvancedOrders'), 'Advanced Orders')
const OrderHistory = withLazyErrorBoundary(() => import('./pages/OrderHistory'), 'Order History')
const CryptoDeposit = withLazyErrorBoundary(() => import('./pages/CryptoDeposit'), 'Crypto Deposit')
const AdminDepositAddresses = withLazyErrorBoundary(() => import('./pages/AdminDepositAddresses'), 'Admin Deposit Addresses')
const Swap = withLazyErrorBoundary(() => import('./pages/Swap'), 'Swap')
const StressTesting = withLazyErrorBoundary(() => import('./pages/StressTesting'), 'Stress Testing')
const CreateWallet = withLazyErrorBoundary(() => import('./pages/CreateWallet'), 'Create Wallet')
const Staking = withLazyErrorBoundary(() => import('./pages/Staking'), 'Staking')
const VerifyEmail = withLazyErrorBoundary(() => import('./pages/VerifyEmail'), 'Verify Email')
const KYCEnhanced = withLazyErrorBoundary(() => import('./pages/KYCEnhanced'), 'KYC Enhanced')
const CryptoDepositSafe = withLazyErrorBoundary(() => import('./pages/CryptoDepositSafe'), 'Crypto Deposit Safe')
const NotificationSettings = withLazyErrorBoundary(() => import('./pages/NotificationSettings'), 'Notification Settings')
const Notifications = withLazyErrorBoundary(() => import('./pages/Notifications'), 'Notifications')
const LinkedWallets = withLazyErrorBoundary(() => import('./pages/LinkedWallets'), 'Linked Wallets')
const Limits = withLazyErrorBoundary(() => import('./pages/Limits'), 'Limits')
const WalletVerification = withLazyErrorBoundary(() => import('./pages/WalletVerification'), 'Wallet Verification')
const Login = withLazyErrorBoundary(() => import('./pages/Login'), 'Login')
const PublicInformation = withLazyErrorBoundary(() => import('./pages/PublicInformation'), 'Public information')

export default function App() {
  useKeyboardShortcuts()
  // Development helper: capture duplicate-key React warnings and print stack traces
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    const _orig = console.error.bind(console)
    console.error = (...args: any[]) => {
      try {
        if (args && args[0] && typeof args[0] === 'string' && args[0].includes('Encountered two children with the same key')) {
          _orig('React duplicate key warning captured:')
          _orig(...args)
          try {
            _orig('React duplicate key warning - detailed args:')
            args.forEach((a: any, idx: number) => {
              try {
                _orig(`ARG[${idx}] (${typeof a}):`, a)
              } catch (e) {
                _orig(`ARG[${idx}] (${typeof a}): [unserializable]`)
              }
            })
          } catch (e) {
            _orig('React duplicate key warning (args inspect failed)')
          }
          _orig(new Error('Duplicate key stack:').stack)
        } else {
          _orig(...args)
        }
      } catch (e) {
        _orig(...args)
      }
    }
  }
  
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <DocumentTitle />
      <RoutedPages />
      <CommandPalette />
      <CookieBanner />
      <OfflineToast />
      <ErrorRecovery />
      <AlertChecker />
      <WhatsAppFab />
      <OnboardingTips />
      <SessionTimeoutWarning />
      <Toaster position="top-right" theme="dark" richColors />
      <TxModalHost />
    </ErrorBoundary>
  )
}

// Wrapper component for route-specific styling.
function RoutedPages() {
  const location = useLocation()
  return (
    <div className="page-fade-in">
      <ErrorBoundary resetKey={location.pathname} scope="this page">
      <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Login />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Login />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/trading" element={<Trading />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/ai" element={<RequireAuth><AIAssistant /></RequireAuth>} />
          <Route path="/wallet" element={<RequireAuth><Wallet /></RequireAuth>} />
          <Route path="/create-wallet" element={<CreateWallet />} />
          <Route path="/activity" element={<RequireAuth><Activity /></RequireAuth>} />
          <Route path="/news" element={<News />} />
          <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
          <Route path="/settings/notifications" element={<RequireAuth><NotificationSettings /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/alerts" element={<RequireAuth><Alerts /></RequireAuth>} />
          <Route path="/goals" element={<RequireAuth><Goals /></RequireAuth>} />
          <Route path="/legal" element={<Legal />} />
          <Route path="/about" element={<About />} />
          {/* Products page removed from public site - keep page file for internal features if needed */}
          <Route path="/privacy" element={<PublicInformation />} />
          <Route path="/terms" element={<PublicInformation />} />
          <Route path="/cookies" element={<PublicInformation />} />
          <Route path="/cookie-preferences" element={<PublicInformation />} />
          <Route path="/risk-disclosure" element={<PublicInformation />} />
          <Route path="/security" element={<PublicInformation />} />
          <Route path="/accessibility" element={<PublicInformation />} />
          <Route path="/regulatory" element={<PublicInformation />} />
          <Route path="/fees" element={<PublicInformation />} />
          <Route path="/contact" element={<PublicInformation />} />
          <Route path="/support" element={<PublicInformation />} />
          <Route path="/security/fraud-prevention" element={<PublicInformation />} />
          <Route path="/careers" element={<PublicInformation />} />
          <Route path="/faq" element={<PublicInformation />} />
          <Route path="/admin/status" element={<RequireAdmin><StatusPage /></RequireAdmin>} />
          <Route path="/disclosures" element={<Disclosures />} />
          <Route path="/help" element={<Help />} />
          <Route path="/asset/:id" element={<AssetDetail />} />
          <Route path="/coin/:id" element={<AssetDetail />} />
          <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
          <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
          <Route path="/admin/users/:id" element={<RequireAdmin><AdminUserDetail /></RequireAdmin>} />
          <Route path="/admin/audit" element={<RequireAdmin><AdminAudit /></RequireAdmin>} />
          <Route path="/admin/reviews" element={<RequireAdmin><AdminReviews /></RequireAdmin>} />
          <Route path="/admin/transfer" element={<RequireAdmin><AdminTransfer /></RequireAdmin>} />
          <Route path="/admin/broadcast" element={<RequireAdmin><AdminBroadcast /></RequireAdmin>} />
          <Route path="/admin/deposits" element={<RequireAdmin><AdminDeposits /></RequireAdmin>} />
          <Route path="/admin/referrals" element={<RequireAdmin><AdminReferrals /></RequireAdmin>} />
          <Route path="/admin/signup-bonus" element={<RequireAdmin><AdminSignupBonus /></RequireAdmin>} />
          <Route path="/admin/wallets" element={<RequireAdmin><AdminWallets /></RequireAdmin>} />
          <Route path="/admin/exports" element={<RequireAdmin><AdminExports /></RequireAdmin>} />
          <Route path="/admin/security-events" element={<RequireAdmin><AdminSecurityEvents /></RequireAdmin>} />
          <Route path="/admin/settings" element={<RequireAdmin><AdminSettings /></RequireAdmin>} />
          <Route path="/admin/analytics" element={<RequireAdmin><AdminAnalytics /></RequireAdmin>} />
          <Route path="/paper-trading" element={<RequireAuth><PaperTrading /></RequireAuth>} />
          <Route path="/calendar" element={<EconomicCalendar />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/leaderboard" element={<RequireAuth><Leaderboard /></RequireAuth>} />
          <Route path="/referral" element={<RequireAuth><Referral /></RequireAuth>} />
          <Route path="/learn" element={<LearnCenter />} />
          <Route path="/kyc" element={<RequireAuth><KYC /></RequireAuth>} />
          <Route path="/achievements" element={<RequireAuth><Achievements /></RequireAuth>} />
          <Route path="/loyalty" element={<RequireAuth><Loyalty /></RequireAuth>} />
          <Route path="/copy-trading" element={<RequireAuth><CopyTrading /></RequireAuth>} />
          <Route path="/copy-trading/trader/:userId" element={<TraderDetail />} />
          <Route path="/copy-trading/dashboard" element={<RequireAuth><CopyTradingDashboard /></RequireAuth>} />
          <Route path="/dca" element={<RequireAuth><DCAScheduler /></RequireAuth>} />
          <Route path="/rebalance" element={<RequireAuth><Rebalance /></RequireAuth>} />
          <Route path="/accounts" element={<RequireAuth><SubAccounts /></RequireAuth>} />
          <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
          <Route path="/tax" element={<RequireAuth><TaxHarvesting /></RequireAuth>} />
          <Route path="/nft" element={<RequireAuth><NFTPortfolio /></RequireAuth>} />
          <Route path="/integrations" element={<RequireAuth><Integrations /></RequireAuth>} />
          <Route path="/advanced-orders" element={<RequireAuth><AdvancedOrders /></RequireAuth>} />
          <Route path="/order-history" element={<RequireAuth><OrderHistory /></RequireAuth>} />
          <Route path="/deposit/crypto" element={<RequireAuth><CryptoDeposit /></RequireAuth>} />
          <Route path="/swap" element={<RequireAuth><Swap /></RequireAuth>} />
          <Route path="/stress-test" element={<RequireAuth><StressTesting /></RequireAuth>} />
          <Route path="/admin/deposit-addresses" element={<RequireAdmin><AdminDepositAddresses /></RequireAdmin>} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/reset" element={<ResetPassword />} />
          <Route path="/staking" element={<RequireAuth><Staking /></RequireAuth>} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/kyc/enhanced" element={<RequireAuth><KYCEnhanced /></RequireAuth>} />
          <Route path="/deposit/crypto/safe" element={<RequireAuth><CryptoDepositSafe /></RequireAuth>} />
          <Route path="/wallet-verification" element={<RequireAuth><WalletVerification /></RequireAuth>} />
          <Route path="/limits" element={<RequireAuth><Limits /></RequireAuth>} />
          <Route path="/linked-wallets" element={<RequireAuth><LinkedWallets /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
      </div>
  )
}
