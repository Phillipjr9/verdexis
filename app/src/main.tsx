import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { initTheme } from './lib/themeApplier'
import { initAnalytics, initErrorReporting } from './lib/telemetry'
import { CurrencyProvider } from './lib/currencyContext'
import { hydrateDensity } from './lib/density'
import { initUpdatePrompt } from './lib/updatePrompt'
import { unregisterServiceWorker } from './lib/serviceWorker'

try {
  const drop = [
    'verdexis_fee_proofs_v1', 'verdexis_user_wallets_v1', 'verdexis_deposit_instructions_v1',
    'verdexis_holdings', 'verdexis_trades', 'verdexis_wallet', 'verdexis_transactions',
    'verdexis_dca', 'verdexis_dca_schedules', 'verdexis_staking', 'verdexis_markets_watchlist',
    'verdexis_admin',
  ]
  drop.forEach((k) => localStorage.removeItem(k))
} catch { /* ignore */ }

initTheme()
hydrateDensity()
initErrorReporting()
initAnalytics() // no-op unless cookies accepted AND VITE_PLAUSIBLE_DOMAIN set
initUpdatePrompt()
unregisterServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CurrencyProvider>
        <App />
      </CurrencyProvider>
    </BrowserRouter>
  </StrictMode>,
)
