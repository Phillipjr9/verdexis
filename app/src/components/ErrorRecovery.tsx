import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { WifiOff, RefreshCw } from 'lucide-react'

export function ErrorRecovery() {
  const [lastError, setLastError] = useState<string>()
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    // Listen for API errors
    const handleApiError = (event: CustomEvent<{ message: string; retry?: () => void }>) => {
      const { message, retry } = event.detail
      
      if (lastError === message && retryCount >= 3) {
        // Don't spam the same error
        return
      }

      setLastError(message)
      setRetryCount(prev => prev + 1)

      toast.error('Connection Error', {
        description: message,
        action: retry ? {
          label: 'Retry',
          onClick: () => {
            retry()
            setRetryCount(0)
          },
        } : undefined,
        icon: <WifiOff className="w-4 h-4" />,
      })
    }

    // Listen for successful recovery
    const handleRecovery = () => {
      if (retryCount > 0) {
        toast.success('Connected', {
          description: 'Connection restored successfully',
          icon: <RefreshCw className="w-4 h-4" />,
        })
        setRetryCount(0)
        setLastError(undefined)
      }
    }

    window.addEventListener('api-error' as any, handleApiError)
    window.addEventListener('api-recovered' as any, handleRecovery)

    return () => {
      window.removeEventListener('api-error' as any, handleApiError)
      window.removeEventListener('api-recovered' as any, handleRecovery)
    }
  }, [lastError, retryCount])

  return null
}

// Helper to emit error events
export function emitApiError(message: string, retry?: () => void) {
  window.dispatchEvent(new CustomEvent('api-error', { detail: { message, retry } }))
}

// Helper to emit recovery events
export function emitApiRecovery() {
  window.dispatchEvent(new CustomEvent('api-recovered'))
}
