/**
 * Privacy-respecting analytics + error reporting.
 *
 * - Loads Plausible only when:
 *     (a) the user has ACCEPTED cookies, AND
 *     (b) VITE_PLAUSIBLE_DOMAIN is configured at build time.
 *
 * - Initializes @sentry/react when a DSN is available
 *   (VITE_SENTRY_DSN or built-in fallback). Session Replay and
 *   performance tracing are enabled per Sentry defaults.
 */

import * as Sentry from '@sentry/react'
import { consented } from './cookieConsent'

let analyticsLoaded = false
let sentryInitialized = false

const FALLBACK_SENTRY_DSN =
  'https://66e0b01f6ef5a90b1a02b9f8a38523d6@o4511956641906688.ingest.us.sentry.io/4511956655144960'

export function initAnalytics() {
  if (analyticsLoaded) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!consented()) return

  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined
  const src =
    (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) ||
    'https://plausible.io/js/script.js'

  if (!domain) return

  const s = document.createElement('script')
  s.defer = true
  s.setAttribute('data-domain', domain)
  s.src = src
  document.head.appendChild(s)
  analyticsLoaded = true
}

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  if (!consented()) return
  // @ts-expect-error plausible global injected by script
  if (typeof window !== 'undefined' && typeof window.plausible === 'function') {
    // @ts-expect-error plausible global injected by script
    window.plausible(name, { props })
  }
}

/**
 * Initialize Sentry as early as possible (before React render).
 * Safe to call multiple times — only runs once.
 */
export function initErrorReporting() {
  if (sentryInitialized) return
  if (typeof window === 'undefined') return
  sentryInitialized = true

  const dsn =
    (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim() || FALLBACK_SENTRY_DSN

  if (!dsn) {
    // Fallback: local console handlers only
    window.addEventListener('error', (e) => {
      console.error('[verdexis] uncaught error', e.error ?? e.message)
    })
    window.addEventListener('unhandledrejection', (e) => {
      console.error('[verdexis] unhandled rejection', e.reason)
    })
    return
  }

  const isProd = import.meta.env.PROD

  Sentry.init({
    dsn,
    environment: isProd ? 'production' : 'development',
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    // Tracing — 100% in dev, 20% in prod to control volume/cost
    tracesSampleRate: isProd ? 0.2 : 1.0,
    // Propagate traces to our own API hosts
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/(www\.)?verdexisgroup\.com/,
      /^https:\/\/.*\.vercel\.app/,
      /^https:\/\/verdexis-fjqz\.onrender\.com/,
      /^https:\/\/.*\.onrender\.com\/api/,
    ],
    // Session Replay
    replaysSessionSampleRate: isProd ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,
    // Optional: send structured logs to Sentry (SDK 8+/10+)
    enableLogs: true,
  })

  // Still log to console in development for faster local debugging
  if (!isProd) {
    console.info('[verdexis] Sentry initialized', { environment: 'development' })
  }
}

/** Call this when the user clicks "Accept" in the cookie banner. */
export function onConsentAccepted() {
  initAnalytics()
  // Sentry is already initialized at boot so errors are never lost.
}

/** Re-export for callers that want the Sentry client directly. */
export { Sentry }
