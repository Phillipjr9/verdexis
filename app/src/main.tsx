import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.tsx'
import { initTheme } from './lib/themeApplier'
import { initAnalytics, initErrorReporting } from './lib/telemetry'
import { CurrencyProvider } from './lib/currencyContext'
import { hydrateDensity } from './lib/density'
import { initUpdatePrompt } from './lib/updatePrompt'
import { registerServiceWorker } from './lib/serviceWorker'

initTheme()
hydrateDensity()
initErrorReporting()
initAnalytics() // no-op unless cookies accepted AND VITE_PLAUSIBLE_DOMAIN set
initUpdatePrompt()
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN as string | undefined}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined}
      authorizationParams={{ redirect_uri: window.location.origin, audience: import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined }}
    >
      <BrowserRouter>
        <CurrencyProvider>
          <App />
        </CurrencyProvider>
      </BrowserRouter>
    </Auth0Provider>
  </StrictMode>,
)
