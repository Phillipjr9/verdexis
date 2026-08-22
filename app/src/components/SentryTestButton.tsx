import * as Sentry from '@sentry/react'

/**
 * Dev / admin-only control to verify Sentry error tracking, logs, and metrics.
 * Throws on click so the ErrorBoundary + Sentry SDK both capture the event.
 */
export default function SentryTestButton() {
  return (
    <button
      type="button"
      onClick={() => {
        try {
          // Structured log (requires enableLogs: true in Sentry.init)
          if (typeof Sentry.logger?.info === 'function') {
            Sentry.logger.info('User triggered test error', {
              action: 'test_error_button_click',
            })
          }
          // Metric counter when available
          if (typeof Sentry.metrics?.count === 'function') {
            Sentry.metrics.count('test_counter', 1)
          }
        } catch {
          /* older SDK builds may not expose logger/metrics */
        }
        throw new Error('This is your first error!')
      }}
      className="px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors"
    >
      Break the world
    </button>
  )
}
